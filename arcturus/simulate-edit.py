"""
simulate-edit.py — End-to-End AI Edit Simulation for Arcturus / Palatine 2.0

This script demonstrates the COMPLETE pipeline of how Arcturus (Gemma 4)
takes a natural language prompt and turns it into a real edit on the project
YAML file, which is then visible on the Palatine front-end.

Pipeline:
  1. User writes a natural language prompt (e.g. "Add a polar constellation...")
  2. Gemma classifies the intent (constellation_edit, groundstation_edit, etc.)
  3. Gemma extracts structured parameters from the prompt (JSON)
  4. OrbitLinkMock executes the backend operation (add_constellation, etc.)
  5. OrbitLinkMock saves the updated state to the project YAML file
  6. The Palatine Flask front-end reads that YAML → changes appear on screen

Usage:
  cd arcturus/
  python simulate-edit.py

You can modify the PROMPTS list at the bottom to test different scenarios.
After running, open the Palatine front-end and load the project to see changes.
"""

import os
import sys
import json
import re

# ── Setup paths ──
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(SCRIPT_DIR, '..'))
PROJECTS_DIR = os.path.join(PROJECT_ROOT, 'database', 'projects')

# Load .env
from dotenv import load_dotenv
env_found = False
for path in ['.env', '../.env', '../../.env']:
    if os.path.exists(path):
        load_dotenv(path)
        env_found = True
        print(f"Loaded .env from: {os.path.abspath(path)}")
        break

if not env_found:
    print("Warning: .env file not found!")


# ── Initialize Gemma Client ──
from google import genai
from google.genai import types

api_key = os.getenv("GEMMA_API_KEY")
if not api_key:
    print("✗ GEMMA_API_KEY not found in .env. Cannot proceed.")
    sys.exit(1)

client = genai.Client(api_key=api_key)
MODEL_ID = "gemma-4-26b-a4b-it"
print(f"✓ Gemma client initialized (model: {MODEL_ID})")

# ── Initialize OrbitLinkMock Backend ──
from orbit_link_mock import OrbitLinkMock

backend = OrbitLinkMock()

# ── Target project file (the one you'll check on the front-end) ──
TARGET_PROJECT = "duaan.yaml"
load_result = backend.load_project(TARGET_PROJECT)
print(f"✓ Project loaded: {load_result.get('message', load_result)}")

# ── Skill Registry mapping to systemPrompt markdown files ──
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
    "error": "errorHandler.md"
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
    else:
        print(f"  ⚠ Warning: Skill prompt not found at {filepath}")
        return ""

def classify_intent(user_input: str) -> str:
    """Uses classifier.md to detect the intent label of the user input."""
    classifier_path = os.path.join(PROJECT_ROOT, 'systemPrompt', 'classifier.md')
    if not os.path.exists(classifier_path):
        return "unclear"
    with open(classifier_path, 'r', encoding='utf-8') as f:
        classifier_prompt = f.read()
    try:
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=user_input,
            config=types.GenerateContentConfig(
                system_instruction=classifier_prompt,
                temperature=0.0
            )
        )
        label = response.text.strip().lower()
        label = re.sub(r'[^a-z_]', '', label)
        return label
    except Exception as e:
        print(f"  ✗ Classification failed: {e}")
        return "unclear"

def analyze_and_extract_stream(user_input: str, intent: str) -> dict:
    """Streams the thinking process and structured parameter payload using the skill prompt."""
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
        thinking_config=types.ThinkingConfig(include_thoughts=True)
    )
    
    THINKING_MODEL = "gemma-4-26b-a4b-it"
    full_text_buffer = ""
    started_thinking = False
    started_payload = False
    
    print(f"\n📡 Establishing telemetry channel to Arcturus Core (Skill: {intent})...")
    
    try:
        response_stream = client.models.generate_content_stream(
            model=THINKING_MODEL,
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
                    if not started_thinking:
                        print("\n🧠 [ARCTURUS THINKING PROCESS]:")
                        started_thinking = True
                    sys.stdout.write(part.text)
                    sys.stdout.flush()
                else:
                    if not started_payload:
                        print("\n\n📦 [STREAMING EXECUTABLE JSON PAYLOAD]:")
                        started_payload = True
                    sys.stdout.write(part.text)
                    sys.stdout.flush()
                    full_text_buffer += part.text
                    
        print("\n\n✓ Stream transmission complete. Parsing final instructions...")
        raw_text = full_text_buffer.strip()
        raw_text = re.sub(r'^```json\s*', '', raw_text)
        raw_text = re.sub(r'^```\s*', '', raw_text)
        raw_text = re.sub(r'\s*```$', '', raw_text)
        start = raw_text.find('{')
        end = raw_text.rfind('}')
        if start != -1 and end != -1:
            raw_text = raw_text[start:end + 1]
        return json.loads(raw_text)
    except Exception as e:
        print(f"\n✗ Streaming analysis engine failure: {e}")
        return {"intent_label": "unclear", "parameters": {}}

def generate_explanation_stream(user_input: str, intent: str):
    """Streams the reasoning and explanation live using the skill prompt."""
    skill_prompt = get_skill_prompt(intent)
    config = types.GenerateContentConfig(
        system_instruction=skill_prompt,
        thinking_config=types.ThinkingConfig(include_thoughts=True),
        temperature=0.2
    )
    THINKING_MODEL = "gemma-4-26b-a4b-it"
    started_thinking = False
    started_payload = False
    
    print(f"\n📡 Establishing telemetry channel to Arcturus Core (Advice Mode: {intent})...")
    
    try:
        response_stream = client.models.generate_content_stream(
            model=THINKING_MODEL,
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
                    if not started_thinking:
                        print("\n🧠 [ARCTURUS THINKING PROCESS]:")
                        started_thinking = True
                    sys.stdout.write(part.text)
                    sys.stdout.flush()
                else:
                    if not started_payload:
                        print("\n\n💬 [ARCTURUS RESPONSE]:")
                        started_payload = True
                    sys.stdout.write(part.text)
                    sys.stdout.flush()
        print("\n\n✓ Stream transmission complete.\n")
    except Exception as e:
        print(f"\n✗ Streaming explanation failure: {e}")

def generate_final_summary(user_input: str, intent: str, execution_data: dict):
    """
    Streams a natural language summary to the user AFTER the backend has executed the task.
    """
    summary_prompt = f"""
    You are Arcturus, Palatine's AI system engineer.
    
    User Request: "{user_input}"
    Intent Routed: {intent}
    Backend Execution Results: {json.dumps(execution_data)}
    
    Write a brief, professional summary confirming the action was taken. 
    Act as if you just finished the deployment. Keep it concise (1-3 sentences).
    Do NOT show raw JSON or code to the user. Do not explain the math, just confirm the system state.
    """
    
    config = types.GenerateContentConfig(
        temperature=0.3
    )
    
    print(f"\n💬 [ARCTURUS RESPONSE]: ", end="")
    
    try:
        response_stream = client.models.generate_content_stream(
            model="gemma-4-26b-a4b-it", 
            contents=summary_prompt,
            config=config
        )
        
        for chunk in response_stream:
            if chunk.text:
                sys.stdout.write(chunk.text)
                sys.stdout.flush()
        print("\n")
    except Exception as e:
        print(f"\n✗ Summary generation failed: {e}")

# ═══════════════════════════════════════════════════════════════════
# STEP 3: EXECUTOR — Run the backend operation and save to YAML
# ═══════════════════════════════════════════════════════════════════

def execute_edit(user_prompt: str):
    """
    The full end-to-end pipeline:
    Prompt -> Intent Routing -> Skill Loading -> Execution (Structured Edit vs Advisor)
    """
    print("\n" + "=" * 70)
    print(f"  USER PROMPT: \"{user_prompt}\"")
    print("=" * 70)
    
    # ── Phase 1: Intent Routing ──
    intent = classify_intent(user_prompt)
    print(f"│  Routing detected intent: {intent}")
    
    # ── Phase 2: Technical Advice or Read-only Actions ──
    advice_intents = ["explain", "attenuation", "elevation_stats", "link_margin", "outage_probability", "error"]
    if intent in advice_intents:
        generate_explanation_stream(user_prompt, intent)
        return
        
    if intent == "session_state":
        print(f"\n┌─ PHASE 3: STATE ACTIONS")
        status = backend.get_fleet_status()
        print(f"│  Fleet: {status['summary']}")
        for detail in status.get('details', []):
            print(f"│    {detail}")
        print(f"└─ No file edit performed.\n")
        return
        
    if intent == "unclear":
        print(f"\n┌─ PHASE 3: STATE ACTIONS")
        print(f"│  (Prompt is unclear / out of domain)")
        print(f"└─ No file edit performed.\n")
        return

    # ── Phase 2 & 3: Extraction and Backend Execution ──
    payload = analyze_and_extract_stream(user_prompt, intent)
    params = payload.get("parameters", {})
    
    print(f"\n│  Intent Payload: {intent}")
    print(f"│  Params: {json.dumps(params, indent=2)}")
    
    print(f"\n┌─ PHASE 3: BACKEND EXECUTION (OrbitLinkMock)")
    
    execution_data = {}
    
    if intent == "constellation_edit":
        action = params.get("action", "add")
        
        if action == "add":
            name = params.get("name", "AI-Generated-Shell")
            apogee = params.get("apogee") or 550
            perigee = params.get("perigee") or apogee
            inclination = params.get("inclination") or 53.0
            planes = params.get("planes") or 4
            sats = params.get("sats_per_plane") or 8
            beam_qty = params.get("beam_quantity") or 16
            beam_size = params.get("beam_size") or 120
            
            result = backend.add_constellation(
                name=name,
                apogee=apogee,
                perigee=perigee,
                inclination=inclination,
                planes=planes,
                sats_per_plane=sats,
                beam_quantity=beam_qty,
                beam_size=beam_size
            )
            total = planes * sats
            print(f"│  ✓ Added constellation '{name}' (ID: {result['id']})")
            print(f"│    Orbit: {apogee}km × {perigee}km @ {inclination}° inc")
            print(f"│    Nodes: {planes} planes × {sats} sats = {total} satellites")
            
            execution_data = {
                "status": "success",
                "action": "deployed_constellation",
                "name": name,
                "orbit_altitude_km": apogee,
                "inclination_deg": inclination,
                "total_nodes_deployed": total
            }
        
        elif action == "remove":
            const_id = params.get("const_id") or params.get("name", "")
            target = None
            for c in backend.constellations:
                if c["id"] == const_id or c["name"].lower() == const_id.lower():
                    target = c
                    break
            if target:
                backend.remove_constellation(target["id"])
                print(f"│  ✓ Removed constellation '{target['name']}' (ID: {target['id']})")
                execution_data = {
                    "status": "success",
                    "action": "removed_constellation",
                    "name": target['name']
                }
            else:
                print(f"│  ✗ Constellation '{const_id}' not found")
                execution_data = {
                    "status": "failed",
                    "reason": f"Constellation '{const_id}' not found"
                }
        else:
            print(f"│  ⚠ Edit action not yet implemented for constellations")
            execution_data = {
                "status": "unsupported",
                "action": action
            }
    
    elif intent == "groundstation_edit":
        action = params.get("action", "add")
        
        if action == "add":
            name = params.get("name", "Jakarta Teleport")
            city = params.get("city", "Jakarta")
            lat = params.get("lat") or 0.0
            lon = params.get("lon") or 0.0
            alt = params.get("alt") or 10.0
            ant = params.get("antenna_type", "Phased Array")
            
            result = backend.add_ground_station(
                name=name, city=city, lat=lat, lon=lon, alt=alt, antenna_type=ant
            )
            print(f"│  ✓ Added ground station '{name}' in {city}")
            print(f"│    Coords: ({lat}°, {lon}°), Alt: {alt}m")
            print(f"│    Antenna: {ant}")
            
            execution_data = {
                "status": "success",
                "action": "registered_teleport",
                "location": city,
                "facility_name": name,
                "latitude_deg": lat,
                "longitude_deg": lon,
                "antenna": ant
            }
        else:
            print(f"│  ⚠ Remove ground station not yet implemented")
            execution_data = {
                "status": "unsupported",
                "action": action
            }
    
    elif intent == "link_budget":
        station = params.get("station_name") or backend.ground_stations[0]["name"]
        const_id = params.get("const_id") or backend.constellations[0]["name"]
        freq = params.get("freq_ghz") or 20.0
        elev = params.get("elevation_deg") or 30.0
        is_up = params.get("is_uplink") or False
        
        report = backend.compute_link_budget(
            station_name=station,
            const_id=const_id,
            freq_ghz=freq,
            elevation_deg=elev,
            is_uplink=is_up
        )
        
        if "error" in report:
            print(f"│  ✗ {report['error']}")
            execution_data = {
                "status": "failed",
                "reason": report["error"]
            }
        else:
            print(f"│  ✓ Link budget computed:")
            print(f"│    {report['constellation_name']} ↔ {report['ground_station']}")
            print(f"│    Freq: {freq} GHz | Elevation: {elev}°")
            print(f"│    Slant Range: {report['slant_range_km']} km")
            print(f"│    FSPL: {report['free_space_path_loss_db']} dB")
            print(f"│    Atmos Loss: {report['atmospheric_loss_db']} dB")
            print(f"│    Rx Power: {report['received_power_dbw']} dBW")
            print(f"│    Margin: {report['link_margin_db']} dB [{report['status']}]")
            print(f"│  (Link budget is a read-only calculation — no file edit)")
            
            execution_data = {
                "status": "success",
                "action": "link_budget_calculated",
                "constellation": report['constellation_name'],
                "station": report['ground_station'],
                "margin_db": report['link_margin_db'],
                "received_power_dbw": report['received_power_dbw'],
                "link_status": report['status']
            }
            print(f"└─ Done\n")
            # Generate summary for read-only actions too!
            generate_final_summary(user_prompt, intent, execution_data)
            return
    
    elif intent == "payload_edit":
        print(f"│  ⚠ Payload edit intent detected but not wired to backend yet")
        print(f"│    Extracted params: {params}")
        print(f"└─ No file edit performed.\n")
        execution_data = {
            "status": "not_implemented",
            "intent": "payload_edit",
            "params": params
        }
        generate_final_summary(user_prompt, intent, execution_data)
        return
    
    else:
        print(f"│  ⚠ Intent '{intent}' has no backend handler yet")
        print(f"└─ No file edit performed.\n")
        return
    
    print(f"└─ Done")
    
    # ── Phase 4: Save to YAML (makes it visible on front-end) ──
    print(f"\n┌─ PHASE 4: SAVE TO YAML → '{TARGET_PROJECT}'")
    save_result = backend.save_project(TARGET_PROJECT)
    print(f"│  {save_result.get('message', save_result)}")
    print(f"│")
    print(f"│  ✓ The edit is now persisted in the project YAML file.")
    print(f"│  ✓ Open the Palatine front-end → load '{TARGET_PROJECT}' → see the change.")
    print(f"└─ Done\n")
    
    # ── Phase 5: AI Conversational Summary ──
    if execution_data:
        generate_final_summary(user_prompt, intent, execution_data)


# ═══════════════════════════════════════════════════════════════════
# STEP 4: RUN — These are the prompts to simulate
# ═══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n" + "━" * 70)
    print("  ARCTURUS EDIT SIMULATION — End-to-End AI → YAML → Front-End")
    print("━" * 70)
    print(f"  Target file: {os.path.join(PROJECTS_DIR, TARGET_PROJECT)}")
    print(f"  Model: {MODEL_ID}")
    print()
    
    # ── Show current state BEFORE edits ──
    print("─── CURRENT PROJECT STATE (BEFORE) ───")
    fleet = backend.get_fleet_status()
    print(f"  Constellations: {fleet['constellation_count']}")
    print(f"  Total satellites: {fleet['total_satellites']}")
    print(f"  Ground stations: {len(backend.ground_stations)}")
    for c in backend.constellations:
        orbit = c.get("orbit", {})
        print(f"    • {c['name']} ({c['id']}) — {orbit.get('orbital_planes', 0)}×{orbit.get('sats_per_plane', 0)} @ {orbit.get('apogee', 0)}km")
    for gs in backend.ground_stations:
        print(f"    • GS: {gs['name']}")
    
    PROMPTS = [
        # Test a standard backend edit
        "Deploy a Walker-Delta constellation named Palatine-Net at 550km, 53 degrees inc with 4 planes.",
        
        # Test your ground system skill
        "Add a teleport in Jakarta with a 2.4m parabolic dish at latitude -6.2 and longitude 106.8.",
        
        # Test your newly wired technical explanation skills
        "Explain how rain fade and atmospheric attenuation will impact a 20GHz Ka-band downlink to the Jakarta teleport."
    ]
    
    for prompt in PROMPTS:
        execute_edit(prompt)
    
    # ── Show updated state AFTER edits ──
    print("─── UPDATED PROJECT STATE (AFTER) ───")
    fleet = backend.get_fleet_status()
    print(f"  Constellations: {fleet['constellation_count']}")
    print(f"  Total satellites: {fleet['total_satellites']}")
    print(f"  Ground stations: {len(backend.ground_stations)}")
    for c in backend.constellations:
        orbit = c.get("orbit", {})
        checked = "✓" if c.get("checked") else "○"
        print(f"    {checked} {c['name']} ({c['id']}) — {orbit.get('orbital_planes', 0)}×{orbit.get('sats_per_plane', 0)} @ {orbit.get('apogee', 0)}km")
    for gs in backend.ground_stations:
        city = gs.get("stations", [{}])[0].get("city", "?")
        print(f"    • GS: {gs['name']} — {city}")
    
    print(f"\n{'━' * 70}")
    print(f"  DONE. Open Palatine front-end and load '{TARGET_PROJECT}' to verify.")
    print(f"{'━' * 70}\n")
