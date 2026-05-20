import os
import re
import json
import math
import yaml
from datetime import datetime, timezone
from flask import Blueprint, request, Response, stream_with_context
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Initialize blueprint
arc_api = Blueprint('arc_api', __name__)

# Setup paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))

# Load environment variables
for path in ['.env', '../.env', '../../.env']:
    abs_path = os.path.abspath(os.path.join(SCRIPT_DIR, path))
    if os.path.exists(abs_path):
        load_dotenv(abs_path)
        break

api_key = os.getenv("GEMMA_API_KEY")
genai_client = genai.Client(api_key=api_key) if api_key else None

SKILL_REGISTRY = {
    "project_manage": "projectManager.md",
    "constellation_edit": "spaceSystem/constellationEditor.md",
    "payload_edit": "payloadEditor.md",
    "groundstation_edit": "groundSystem/groundStationEditor.md",
    "link_budget": "economicAnalysis/linkBudgetCalculator.md",
    "elevation_stats": "groundSystem/elevationAnalyst.md",
    "attenuation": "attenuationAdvisor.md",
    "link_margin": "economicAnalysis/linkMarginAnalyst.md",
    "outage_probability": "economicAnalysis/outageReporter.md",
    "explain": "platformExplainer.md",
    "error": "errorHandler.md",
    "session_state": "sessionExplainer.md",
    "unclear": "systemPrompt.md"
}

def get_skill_prompt(intent_label: str) -> str:
    """Loads the specific markdown file for a given intent."""
    relative_path = SKILL_REGISTRY.get(intent_label)
    if not relative_path:
        return ""
    filepath = os.path.join(PROJECT_ROOT, 'systemPrompt', relative_path)
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            return f.read()
    return ""

def classify_intent(user_input: str) -> str:
    """Local regex classifier — instant, zero-latency intent detection.
    Mirrors the keyword rules from systemPrompt/classifier.md without an API call."""
    text = user_input.lower()

    # Project management
    if any(kw in text for kw in ["save project", "open project", "delete project", "new project", "load project"]):
        return "project_manage"

    # Session state
    if any(kw in text for kw in ["status", "configured", "what have", "current state", "show session"]):
        return "session_state"

    # Constellation editing (broad keyword net)
    constellation_signals = ["constellation", "walker", "walker-delta", "orbital plane", "satellite shell"]
    action_signals = ["add", "edit", "deploy", "create", "remove", "delete", "launch", "modify", "update", "change"]
    if any(cs in text for cs in constellation_signals) and any(a in text for a in action_signals):
        return "constellation_edit"
    # Direct deploy/create phrasing without explicit "constellation" word
    if any(kw in text for kw in ["deploy a", "create a", "launch a"]) and any(kw in text for kw in ["walker", "leo", "meo", "plane", "orbit"]):
        return "constellation_edit"

    # Payload editing
    if any(kw in text for kw in ["eirp", "payload", "beam size", "beam quantity", "frequency band", "transponder"]):
        return "payload_edit"

    # Ground station editing
    if any(kw in text for kw in ["ground station", "teleport", "earth station", "gateway station"]):
        return "groundstation_edit"

    # Link budget
    if any(kw in text for kw in ["link budget", "received power", "path loss", "fspl", "slant range"]):
        return "link_budget"

    # Elevation statistics
    if "elevation" in text and any(kw in text for kw in ["angle", "stat", "minimum", "average", "distribution"]):
        return "elevation_stats"

    # Attenuation
    if any(kw in text for kw in ["rain", "itu", "attenuation", "atmospheric loss", "fade"]):
        return "attenuation"

    # Link margin
    if "link margin" in text or ("margin" in text and "link" in text):
        return "link_margin"

    # Outage probability
    if any(kw in text for kw in ["outage", "availability", "uptime", "reliability"]):
        return "outage_probability"

    # Explain / general knowledge
    if any(kw in text for kw in ["explain", "what is", "how do", "define", "tell me about", "describe"]):
        return "explain"

    return "unclear"

def analyze_and_extract_generator(user_input: str, intent: str):
    """Generator for streaming reasoning and JSON parameters extraction."""
    skill_prompt = get_skill_prompt(intent)
    
    schema_info = ""
    if intent == "constellation_edit":
        schema_info = '{"action": "add"|"remove"|"edit", "name": string, "apogee": int, "perigee": int, "inclination": float, "planes": int, "sats_per_plane": int, "beam_quantity": int, "beam_size": int}'
    elif intent == "groundstation_edit":
        schema_info = '{"action": "add"|"remove", "name": string, "city": string, "lat": float, "lon": float, "alt": float, "antenna_type": string}'
    elif intent == "link_budget":
        schema_info = '{"station_name": string, "const_id": string, "freq_ghz": float, "elevation_deg": float, "is_uplink": bool}'
    else:
        schema_info = '{}'

    unified_prompt = f"""{skill_prompt}

    [CRITICAL INSTRUCTION]
    You must output ONLY a single JSON object in the following format. Do not write any explanations before or after the JSON:
    {{
      "intent_label": "{intent}",
      "parameters": {schema_info}
    }}
    """
    
    config = types.GenerateContentConfig(
        system_instruction=unified_prompt,
        response_mime_type="application/json",
        thinking_config=types.ThinkingConfig(include_thoughts=True),
        temperature=0.0
    )
    
    full_text_buffer = ""
    
    try:
        response_stream = genai_client.models.generate_content_stream(
            model="gemma-4-26b-a4b-it",
            contents=user_input,
            config=config
        )
        
        for chunk in response_stream:
            if not chunk.candidates or not chunk.candidates[0].content.parts:
                continue
            for part in chunk.candidates[0].content.parts:
                if not part.text:
                    continue
                if getattr(part, 'thought', False):
                    yield {'stream_type': 'thought', 'content': part.text}
                else:
                    full_text_buffer += part.text
                    
        # Parse JSON payload
        raw_text = full_text_buffer.strip()
        raw_text = re.sub(r'^```json\s*', '', raw_text)
        raw_text = re.sub(r'^```\s*', '', raw_text)
        raw_text = re.sub(r'\s*```$', '', raw_text)
        start = raw_text.find('{')
        end = raw_text.rfind('}')
        if start != -1 and end != -1:
            raw_text = raw_text[start:end + 1]
            
        payload = json.loads(raw_text)
        params = payload.get("parameters", {})
        yield {'stream_type': 'params', 'content': params}
    except Exception as e:
        yield {'stream_type': 'status', 'content': f'Parameter extraction failure: {str(e)}'}
        yield {'stream_type': 'params', 'content': {}}

def generate_template_summary(intent: str, execution_data: dict) -> str:
    """Deterministic template summary — instant, zero-latency response generation.
    Replaces the 3rd Gemini API call with a pre-built template."""
    status = execution_data.get("status", "unknown")
    action = execution_data.get("action", "")

    if status == "success":
        if action == "deployed_constellation":
            name = execution_data.get("name", "Unknown")
            alt = execution_data.get("orbit_altitude_km", 550)
            inc = execution_data.get("inclination_deg", 53.0)
            nodes = execution_data.get("total_nodes_deployed", 0)
            return (f"Constellation **{name}** has been deployed successfully. "
                    f"{nodes} orbital nodes configured at {alt} km altitude, {inc}° inclination. "
                    f"Project state updated.")
        elif action == "removed_constellation":
            name = execution_data.get("name", "Unknown")
            return (f"Constellation **{name}** has been removed from the project configuration. "
                    f"All associated ISL links have been pruned.")
        elif action == "registered_teleport":
            name = execution_data.get("facility_name", "Unknown")
            city = execution_data.get("location", "Unknown")
            antenna = execution_data.get("antenna", "Phased Array")
            return (f"Ground station **{name}** registered in {city} ({antenna}). "
                    f"The teleport facility is now active in the project configuration.")
        elif action == "link_budget_calculated":
            const = execution_data.get("constellation", "Unknown")
            station = execution_data.get("station", "Unknown")
            margin = execution_data.get("margin_db", 0)
            rx = execution_data.get("received_power_dbw", 0)
            link_status = execution_data.get("link_status", "UNKNOWN")
            return (f"Link budget analysis complete for **{const}** ↔ **{station}**. "
                    f"Received power: {rx} dBW | Link margin: {margin} dB — Status: **{link_status}**.")
        else:
            return "Action completed successfully. Project state updated."
    elif status == "failed":
        reason = execution_data.get("reason", "Unknown error")
        return f"Action failed: {reason}"
    elif status == "unsupported":
        action_name = execution_data.get("action", "this action")
        return f"The action '{action_name}' is not yet supported in the current pipeline."
    elif status == "not_implemented":
        return "This feature is under development and not yet available."
    else:
        return f"Action completed with status: {status}"

def compute_live_link_budget(project_id: str, station_name: str, const_id: str, freq_ghz: float, elevation_deg: float = 30.0, is_uplink: bool = False) -> dict:
    """Computes dynamic link budget using live loaded configurations."""
    projects_dir = os.path.abspath(os.path.join(PROJECT_ROOT, 'database', 'projects'))
    filename = project_id if project_id.endswith('.yaml') else f"{project_id}.yaml"
    filepath = os.path.join(projects_dir, filename)
    
    if not os.path.exists(filepath):
        return {"error": "Project session file not found."}
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f) or {}
    except Exception as e:
        return {"error": f"Failed to load project YAML: {str(e)}"}
        
    # Resolve Ground Station
    station = None
    for gs in data.get("ground_stations", []):
        if gs.get("name", "").lower() == str(station_name).lower():
            station = gs
            break
    if not station:
        # Fallback to first available station if none matched
        if data.get("ground_stations"):
            station = data["ground_stations"][0]
        else:
            return {"error": f"Ground station '{station_name}' not found."}

    # Resolve Constellation
    const = None
    for c in data.get("constellations", []):
        if c.get("id") == str(const_id) or c.get("name", "").lower() == str(const_id).lower():
            const = c
            break
    if not const:
        # Fallback to first available constellation
        if data.get("constellations"):
            const = data["constellations"][0]
        else:
            return {"error": f"Constellation '{const_id}' not found."}

    orbit = const.get("orbit", {})
    alt_km = (orbit.get("apogee", 550) + orbit.get("perigee", 550)) / 2.0
    
    R_EARTH_KM = 6371.0
    
    # Distance slant calculation
    try:
        el_val = float(elevation_deg)
    except (ValueError, TypeError):
        el_val = 30.0
    if el_val < 0:
        el_val = 0.0
        
    el_rad = math.radians(el_val)
    inside = (R_EARTH_KM * math.sin(el_rad))**2 + (R_EARTH_KM + alt_km)**2 - R_EARTH_KM**2
    distance = alt_km if inside < 0 else -R_EARTH_KM * math.sin(el_rad) + math.sqrt(inside)
    
    # Freq
    try:
        freq = float(freq_ghz)
    except (ValueError, TypeError):
        freq = 20.0
        
    # FSPL
    fspl = 92.45 + 20 * math.log10(freq) + 20 * math.log10(distance) if distance > 0 and freq > 0 else 0.0
    
    # Atmos
    zenith_loss = 0.5 if freq < 25.0 else 0.8
    atmos_loss = zenith_loss / math.sin(math.radians(max(el_val, 0.5)))
    
    misc_loss = 2.0 # Standard miscellaneous link path loss
    
    if not is_uplink:
        tx_eirp = 56.0
        rx_gain = 40.0
        req_power = -105.0
        rx_power = tx_eirp + rx_gain - fspl - atmos_loss - misc_loss
        margin = rx_power - req_power
    else:
        tx_eirp = 60.0
        rx_gain = 35.0
        req_power = -110.0
        rx_power = tx_eirp + rx_gain - fspl - atmos_loss - misc_loss
        margin = rx_power - req_power

    status = "PASS" if margin >= 3.0 else ("MARGINAL" if margin >= 0 else "FAIL")
    
    return {
        "constellation_name": const["name"],
        "constellation_id": const["id"],
        "ground_station": station["name"],
        "frequency_ghz": freq,
        "elevation_deg": el_val,
        "link_direction": "Uplink (Ground -> Sat)" if is_uplink else "Downlink (Sat -> Ground)",
        "slant_range_km": round(distance, 2),
        "free_space_path_loss_db": round(fspl, 2),
        "atmospheric_loss_db": round(atmos_loss, 2),
        "received_power_dbw": round(rx_power, 2),
        "link_margin_db": round(margin, 2),
        "status": status
    }

def execute_pipeline_generator(user_prompt: str, session_id: str):
    """Primary pipeline coordination. Classification -> Param Extraction -> Live Execution -> Summary."""
    if not genai_client:
        yield f"data: {json.dumps({'stream_type': 'error', 'content': 'Arcturus is unconfigured. GEMMA_API_KEY is missing.'})}\n\n"
        return
        
    try:
        # Step 1: Classification
        yield f"data: {json.dumps({'stream_type': 'status', 'content': 'Classifying intent...'})}\n\n"
        intent = classify_intent(user_prompt)
        yield f"data: {json.dumps({'stream_type': 'status', 'content': f'Routed intent: {intent}'})}\n\n"
        
        # Step 2: Route advice mode vs execution mode
        advice_intents = ["explain", "attenuation", "elevation_stats", "link_margin", "outage_probability", "error", "session_state", "unclear"]
        
        if intent in advice_intents:
            skill_prompt = get_skill_prompt(intent)
            
            modified_prompt = user_prompt
            if intent == "session_state":
                projects_dir = os.path.abspath(os.path.join(PROJECT_ROOT, 'database', 'projects'))
                filename = session_id if session_id.endswith('.yaml') else f"{session_id}.yaml"
                filepath = os.path.join(projects_dir, filename)
                if os.path.exists(filepath):
                    try:
                        with open(filepath, 'r', encoding='utf-8') as f:
                            yaml_content = f.read()
                        modified_prompt = f"[CURRENT PROJECT CONFIGURATION]\n{yaml_content}\n\n[USER INSTRUCTION]\n{user_prompt}"
                    except Exception as e:
                        modified_prompt = f"[ERROR LOADING PROJECT CONFIGURATION: {str(e)}]\n\n[USER INSTRUCTION]\n{user_prompt}"

            config = types.GenerateContentConfig(
                system_instruction=skill_prompt,
                thinking_config=types.ThinkingConfig(include_thoughts=True),
                temperature=0.2
            )
            response_stream = genai_client.models.generate_content_stream(
                model="gemma-4-26b-a4b-it",
                contents=modified_prompt,
                config=config
            )
            for chunk in response_stream:
                if not chunk.candidates or not chunk.candidates[0].content.parts:
                    continue
                for part in chunk.candidates[0].content.parts:
                    if not part.text:
                        continue
                    if getattr(part, 'thought', False):
                        yield f"data: {json.dumps({'stream_type': 'thought', 'content': part.text})}\n\n"
                    else:
                        yield f"data: {json.dumps({'stream_type': 'summary', 'content': part.text})}\n\n"
            return

        # Extraction phase for structured actions
        yield f"data: {json.dumps({'stream_type': 'status', 'content': f'Connecting telemetry stream for {intent}...'})}\n\n"
        
        params = {}
        for item in analyze_and_extract_generator(user_prompt, intent):
            if item.get('stream_type') == 'params':
                params = item.get('content')
            else:
                yield f"data: {json.dumps(item)}\n\n"

        # Parameters validation & type safety (Prevention of Injection Faults)
        if not isinstance(params, dict):
            params = {}

        # Step 3: Engine Execution (Mock-free live routing)
        execution_data = {}
        yield f"data: {json.dumps({'stream_type': 'status', 'content': 'Applying live system updates...'})}\n\n"

        if intent == "constellation_edit":
            action = params.get("action", "add")
            
            if action == "add":
                from core.space_segment import ConstellationController
                controller = ConstellationController(project_id=session_id)
                result = controller.deploy_walker_delta(
                    name=params.get("name"),
                    apogee=params.get("apogee"),
                    inclination=params.get("inclination"),
                    planes=params.get("planes"),
                    sats_per_plane=params.get("sats_per_plane") or 8
                )
                execution_data = {
                    "status": "success",
                    "action": "deployed_constellation",
                    "name": params.get("name", "AI-Generated-Shell"),
                    "orbit_altitude_km": params.get("apogee") or 550,
                    "inclination_deg": params.get("inclination") or 53.0,
                    "total_nodes_deployed": result.node_count
                }
            elif action == "remove":
                from core.space_segment import ConstellationController
                controller = ConstellationController(project_id=session_id)
                const_id = params.get("const_id") or params.get("name", "")
                success, removed_name = controller.remove_constellation(const_id)
                if success:
                    execution_data = {
                        "status": "success",
                        "action": "removed_constellation",
                        "name": removed_name
                    }
                else:
                    execution_data = {
                        "status": "failed",
                        "reason": f"Constellation '{const_id}' not found in configuration"
                    }
            else:
                execution_data = {
                    "status": "unsupported",
                    "action": action
                }
                
        elif intent == "groundstation_edit":
            action = params.get("action", "add")
            
            if action == "add":
                from core.ground_segment import GroundStationController
                controller = GroundStationController(project_id=session_id)
                result = controller.add_ground_station(
                    name=params.get("name"),
                    city=params.get("city"),
                    lat=params.get("lat"),
                    lon=params.get("lon"),
                    alt=params.get("alt") or 10.0,
                    antenna_type=params.get("antenna_type") or "Phased Array"
                )
                execution_data = {
                    "status": "success",
                    "action": "registered_teleport",
                    "location": params.get("city", "Jakarta"),
                    "facility_name": params.get("name", "Jakarta Teleport"),
                    "latitude_deg": params.get("lat") or 0.0,
                    "longitude_deg": params.get("lon") or 0.0,
                    "antenna": params.get("antenna_type") or "Phased Array"
                }
            else:
                execution_data = {
                    "status": "unsupported",
                    "action": action
                }
                
        elif intent == "link_budget":
            station = params.get("station_name")
            const_id = params.get("const_id")
            freq = params.get("freq_ghz") or 20.0
            elev = params.get("elevation_deg") or 30.0
            is_up = params.get("is_uplink") or False
            
            report = compute_live_link_budget(
                project_id=session_id,
                station_name=station,
                const_id=const_id,
                freq_ghz=freq,
                elevation_deg=elev,
                is_uplink=is_up
            )
            
            if "error" in report:
                execution_data = {
                    "status": "failed",
                    "reason": report["error"]
                }
            else:
                execution_data = {
                    "status": "success",
                    "action": "link_budget_calculated",
                    "constellation": report['constellation_name'],
                    "station": report['ground_station'],
                    "margin_db": report['link_margin_db'],
                    "received_power_dbw": report['received_power_dbw'],
                    "link_status": report['status']
                }
                
        elif intent == "payload_edit":
            execution_data = {
                "status": "not_implemented",
                "intent": "payload_edit",
                "params": params
            }
            
        else:
            execution_data = {
                "status": "unsupported",
                "reason": f"No active live handler for intent '{intent}'"
            }

        # Step 4: Deterministic summary (no API call — instant)
        summary_text = generate_template_summary(intent, execution_data)
        yield f"data: {json.dumps({'stream_type': 'summary', 'content': summary_text})}\n\n"

        # Step 5: Send final success signal (State Sync Trigger)
        if execution_data.get("status") == "success":
            yield f"data: {json.dumps({'stream_type': 'success', 'content': 'Project state updated successfully'})}\n\n"

    except Exception as e:
        yield f"data: {json.dumps({'stream_type': 'error', 'content': f'Pipeline processing failure: {str(e)}'})}\n\n"

@arc_api.route('/api/arcturus/stream', methods=['POST'])
def stream_arcturus_pipeline():
    """Server-Sent Events endpoint hosting the live intent-action pipeline."""
    payload = request.get_json() or {}
    user_prompt = payload.get('prompt')
    session_id = payload.get('project_id')
    
    if not user_prompt:
        return Response("data: {\"error\": \"prompt is required\"}\n\n", mimetype='text/event-stream')
    if not session_id:
        return Response("data: {\"error\": \"project_id is required\"}\n\n", mimetype='text/event-stream')
        
    return Response(
        stream_with_context(execute_pipeline_generator(user_prompt, session_id)), 
        mimetype='text/event-stream'
    )
