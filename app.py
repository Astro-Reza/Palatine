import os
import json
import yaml
import re
from datetime import datetime, timezone
from flask import Flask, render_template, send_from_directory, abort, request, jsonify, Response
from flask.wrappers import Response as FlaskResponse
from flask import stream_with_context
from dotenv import load_dotenv

# Load .env FIRST before configuring AI
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

import google.generativeai as genai

app = Flask(__name__, template_folder='templates', static_url_path='/none')

# ─── Gemma AI Configuration ───
GEMMA_API_KEY = os.environ.get("GEMMA_API_KEY")
if GEMMA_API_KEY:
    genai.configure(api_key=GEMMA_API_KEY)
    gemma_model = genai.GenerativeModel('gemma-4-26b-a4b-it')
else:
    gemma_model = None

V2_STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static'))
V1_STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'Palatine 1.0', 'static'))
DATABASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'database'))
PROJECTS_DIR = os.path.join(DATABASE_DIR, 'projects')

for d in [DATABASE_DIR, PROJECTS_DIR]:
    if not os.path.exists(d):
        os.makedirs(d)

@app.route('/static/<path:filename>')
def serve_static(filename):
    # Try V2 static files first
    v2_path = os.path.join(V2_STATIC_DIR, filename)
    if os.path.exists(v2_path):
        return send_from_directory(V2_STATIC_DIR, filename)
    
    # Fallback to V1 static files (for textures, orbit.js, etc.)
    v1_path = os.path.join(V1_STATIC_DIR, filename)
    if os.path.exists(v1_path):
        return send_from_directory(V1_STATIC_DIR, filename)
    
    abort(404)

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/ground-system')
def ground_system():
    return render_template('ground-system.html')

@app.route('/link-result')
def link_result():
    return render_template('link-result.html')

@app.route('/api/mockdata')
def get_mockdata():
    mockdata_path = os.path.join(os.path.dirname(__file__), 'arcturus', 'mockdata.json')
    if os.path.exists(mockdata_path):
        try:
            with open(mockdata_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            return jsonify(data)
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": "mockdata.json not found"}), 404

# ─── Legacy Constellation Endpoints (backward compat) ───

@app.route('/api/save-constellation', methods=['POST'])
def save_constellation():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    name = data.get('name', 'untitled').replace(' ', '_').lower()
    filename = f"{name}.json"
    filepath = os.path.join(DATABASE_DIR, filename)
    
    try:
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=4)
        return jsonify({"message": f"Constellation {name} saved successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/constellations', methods=['GET'])
def get_constellations():
    constellations = []
    for filename in os.listdir(DATABASE_DIR):
        if filename.endswith('.json'):
            with open(os.path.join(DATABASE_DIR, filename), 'r') as f:
                constellations.append(json.load(f))
    return jsonify(constellations)

# ─── Project / Session Endpoints ───

def _make_project_template(name="Untitled Project"):
    """Create a blank project dictionary."""
    now = datetime.now(timezone.utc).isoformat()
    return {
        "project": {
            "name": name,
            "created": now,
            "modified": now,
            "version": "2.0.0"
        },
        "constellations": [],
        "isl_links": [],
        "ground_stations": [],
        "simulation": {},
        "analysis_results": {}
    }

def _safe_filename(name):
    """Sanitise a project name into a safe filename (without extension)."""
    return name.strip().replace(' ', '_').lower()

# ─── AI System Prompts Registry ───

SYSTEM_PROMPTS = {
    "classifier":          "systemPrompt/classifier.md",
    "project_manage":      "systemPrompt/projectManager.md",
    "session_state":       "systemPrompt/sessionExplainer.md",
    "constellation_edit":  "systemPrompt/constellationEditor.md",
    "payload_edit":        "systemPrompt/payloadEditor.md",
    "groundstation_edit":  "systemPrompt/groundSystem/groundStationEditor.md",
    "link_budget":         "systemPrompt/linkBudgetCalculator.md",
    "elevation_stats":     "systemPrompt/elevationAnalyst.md",
    "attenuation":         "systemPrompt/attenuationAdvisor.md",
    "link_margin":         "systemPrompt/linkMarginAnalyst.md",
    "outage_probability":  "systemPrompt/outageReporter.md",
    "explain":             "systemPrompt/platformExplainer.md",
    "unclear":             "systemPrompt/errorHandler.md",
}

def load_prompt(intent: str) -> str:
    """Load system prompt from file."""
    filepath = SYSTEM_PROMPTS.get(intent, SYSTEM_PROMPTS["unclear"])
    prompt_path = os.path.join(os.path.dirname(__file__), filepath)
    if os.path.exists(prompt_path):
        with open(prompt_path, 'r', encoding='utf-8') as f:
            return f.read()
    return "You are a helpful AI assistant for the Palatine satellite mission planning platform."

@app.route('/api/project/new', methods=['POST'])
def project_new():
    """Create a new empty project and save it as YAML."""
    data = request.json or {}
    name = data.get('name', 'Untitled Project')
    project = _make_project_template(name)
    
    safe = _safe_filename(name)
    filepath = os.path.join(PROJECTS_DIR, f"{safe}.yaml")
    
    # Avoid overwriting
    counter = 1
    while os.path.exists(filepath):
        filepath = os.path.join(PROJECTS_DIR, f"{safe}_{counter}.yaml")
        counter += 1
    
    with open(filepath, 'w', encoding='utf-8') as f:
        yaml.safe_dump(project, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
    
    return jsonify({
        "message": f"Project '{name}' created",
        "filename": os.path.basename(filepath),
        "project": project
    }), 201

@app.route('/api/project/save', methods=['POST'])
def project_save():
    """Save the full session state to a YAML file."""
    data = request.json
    if not data or 'project' not in data:
        return jsonify({"error": "No project data provided"}), 400
    
    # Update modification timestamp
    data['project']['modified'] = datetime.now(timezone.utc).isoformat()
    
    filename = data.get('_filename')  # internal: which file to overwrite
    if not filename:
        name = data['project'].get('name', 'untitled')
        filename = _safe_filename(name) + '.yaml'
    
    # Remove internal keys before saving
    save_data = {k: v for k, v in data.items() if not k.startswith('_')}
    
    filepath = os.path.join(PROJECTS_DIR, filename)
    
    try:
        with open(filepath, 'w', encoding='utf-8') as f:
            yaml.safe_dump(save_data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
        return jsonify({"message": "Project saved", "filename": filename}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/project/open/<filename>', methods=['GET'])
def project_open(filename):
    """Load a project from a YAML file."""
    # Only allow .yaml extension
    if not filename.endswith('.yaml'):
        filename += '.yaml'
    
    filepath = os.path.join(PROJECTS_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Project not found"}), 404
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            project = yaml.safe_load(f)
        project['_filename'] = filename
        return jsonify(project), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

import uuid

@app.route('/api/project/<filename>/isl', methods=['POST'])
def isl_add(filename):
    if not filename.endswith('.yaml'):
        filename += '.yaml'
    
    filepath = os.path.join(PROJECTS_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Project not found"}), 404
        
    data = request.json
    if not data or 'source' not in data or 'target' not in data:
        return jsonify({"error": "Invalid data. 'source' and 'target' are required."}), 400
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            project = yaml.safe_load(f)
            
        if 'isl_links' not in project:
            project['isl_links'] = []
            
        # Optional: could validate source/target exist in project['constellations']
        
        new_isl = {
            "id": f"isl_{uuid.uuid4().hex[:8]}",
            "source": data['source'],
            "target": data['target'],
            "type": data.get('type', 'laser'),
            "max_range_km": data.get('max_range_km', 5000),
            "data_rate_gbps": data.get('data_rate_gbps', 10),
            "bidirectional": data.get('bidirectional', True)
        }
        
        project['isl_links'].append(new_isl)
        project['project']['modified'] = datetime.now(timezone.utc).isoformat()
        
        with open(filepath, 'w', encoding='utf-8') as f:
            yaml.safe_dump(project, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
            
        return jsonify({"message": "ISL link added", "isl": new_isl}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/project/<filename>/isl/<isl_id>', methods=['DELETE'])
def isl_delete(filename, isl_id):
    if not filename.endswith('.yaml'):
        filename += '.yaml'
        
    filepath = os.path.join(PROJECTS_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Project not found"}), 404
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            project = yaml.safe_load(f)
            
        if 'isl_links' not in project:
            return jsonify({"error": "No ISL links found"}), 404
            
        initial_len = len(project['isl_links'])
        project['isl_links'] = [link for link in project['isl_links'] if link.get('id') != isl_id]
        
        if len(project['isl_links']) == initial_len:
            return jsonify({"error": "ISL link not found"}), 404
            
        project['project']['modified'] = datetime.now(timezone.utc).isoformat()
        
        with open(filepath, 'w', encoding='utf-8') as f:
            yaml.safe_dump(project, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
            
        return jsonify({"message": "ISL link deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/project/<filename>/isl', methods=['GET'])
def isl_list(filename):
    if not filename.endswith('.yaml'):
        filename += '.yaml'
        
    filepath = os.path.join(PROJECTS_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Project not found"}), 404
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            project = yaml.safe_load(f)
            
        return jsonify(project.get('isl_links', [])), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/projects', methods=['GET'])
def project_list():
    """List all saved projects."""
    projects = []
    if os.path.exists(PROJECTS_DIR):
        for fname in sorted(os.listdir(PROJECTS_DIR)):
            if fname.endswith('.yaml'):
                fpath = os.path.join(PROJECTS_DIR, fname)
                try:
                    with open(fpath, 'r', encoding='utf-8') as f:
                        data = yaml.safe_load(f)
                    projects.append({
                        "filename": fname,
                        "name": data.get('project', {}).get('name', fname),
                        "modified": data.get('project', {}).get('modified', ''),
                        "constellation_count": len(data.get('constellations', []))
                    })
                except Exception:
                    projects.append({"filename": fname, "name": fname, "modified": "", "constellation_count": 0})
    return jsonify(projects), 200

@app.route('/api/project/<filename>', methods=['DELETE'])
def project_delete(filename):
    """Delete a project file."""
    if not filename.endswith('.yaml'):
        filename += '.yaml'
    
    filepath = os.path.join(PROJECTS_DIR, filename)
    if not os.path.exists(filepath):
        return jsonify({"error": "Project not found"}), 404
    
    try:
        os.remove(filepath)
        return jsonify({"message": "Project deleted"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ─── Chatbot API ───
from dotenv import load_dotenv
from google import genai
from google.genai import types
from flask import Response, stream_with_context

env_path = os.path.join(os.path.dirname(__file__), '.env')
load_dotenv(env_path)

api_key = os.getenv("GEMMA_API_KEY")
genai_client = genai.Client(api_key=api_key) if api_key else None

@app.route('/api/chat', methods=['POST'])
def chat():
    if not gemma_model:
        return jsonify({"error": "GEMMA_API_KEY is not configured in .env"}), 500
        
    data = request.json or {}
    prompt = data.get('prompt', '')
    mode = data.get('mode', 'think')
    project_state = data.get('project_state', {})
    
    if not prompt:
        return jsonify({"error": "Prompt is required"}), 400

    # Load system instruction from systemPrompt/systemPrompt.md dynamically
    skills_path = os.path.join(os.path.dirname(__file__), 'systemPrompt', 'systemPrompt.md')
    system_instruction = None
    if os.path.exists(skills_path):
        try:
            with open(skills_path, 'r', encoding='utf-8') as f:
                system_instruction = f.read()
        except Exception as e:
            print(f"Warning: Failed to load systemPrompt.md: {e}")

    # Configure generation parameters based on chat mode
    if mode == 'instant':
        config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_budget=0),
            system_instruction=system_instruction
        )
    else:
        config = types.GenerateContentConfig(
            thinking_config=types.ThinkingConfig(thinking_level="high"),
            system_instruction=system_instruction
        )

    def generate():
        try:
            print(f"[DEBUG] Chat request: prompt='{prompt[:50]}...'", flush=True)
            
            # Step 0: Fast keyword-based pre-classifier (skip API call for common queries)
            prompt_lower = prompt.lower()
            intent = "unclear"
            
            # Quick pattern matching for common intents
            if any(word in prompt_lower for word in ["explain", "what is", "how do", "define", "tell me", "what can you", "help", "who are you"]):
                intent = "explain"
            elif any(word in prompt_lower for word in ["save", "open", "delete", "create", "new project"]):
                intent = "project_manage"
            elif any(word in prompt_lower for word in ["status", "configured", "what have", "current"]):
                intent = "session_state"
            elif any(word in prompt_lower for word in ["ground station", "add station"]):
                intent = "groundstation_edit"
            elif any(word in prompt_lower for word in ["constellation", "satellite", "orbit"]):
                intent = "constellation_edit"
            elif any(word in prompt_lower for word in ["link budget", "received power", "pr"]):
                intent = "link_budget"
            elif any(word in prompt_lower for word in ["elevation", "angle"]):
                intent = "elevation_stats"
            elif any(word in prompt_lower for word in ["rain", "attenuation", "itu"]):
                intent = "attenuation"
            elif any(word in prompt_lower for word in ["margin", "fails", "passes"]):
                intent = "link_margin"
            elif any(word in prompt_lower for word in ["outage", "availability"]):
                intent = "outage_probability"
            elif any(word in prompt_lower for word in ["eirp", "beam", "frequency", "payload"]):
                intent = "payload_edit"
            
            # If no match, use slower classifier API
            if intent == "unclear":
                print("[DEBUG] No quick match found, using classifier API", flush=True)
                classifier_prompt = load_prompt("classifier")
                classify_full = f"""{classifier_prompt}

User prompt: "{prompt}"

Return ONLY one label (no explanation):"""
                
                print("[DEBUG] Calling Gemma for classification", flush=True)
                try:
                    classify_response = gemma_model.generate_content(classify_full, generation_config={
                        "temperature": 0.1,
                        "top_p": 0.8,
                        "top_k": 40
                    }, request_options={"timeout": 30}
                    )
                    
                    # Extract the label
                    response_text = classify_response.text.strip().lower()
                    
                    # First, try to find any line that exactly matches a known label
                    for line in response_text.split('\n'):
                        line = line.strip().lower()
                        if line in SYSTEM_PROMPTS:
                            intent = line
                            break
                except Exception as classify_error:
                    print(f"[WARNING] Classifier timeout/error: {classify_error}", flush=True)
                    intent = "unclear"  # Fallback to unclear
            
            print(f"[DEBUG] Detected intent: '{intent}'", flush=True)
            
            # Step 2: Load appropriate system prompt
            print(f"[DEBUG] Loading system prompt for: '{intent}'", flush=True)
            system_prompt = load_prompt(intent)
            
            # Check if explicit instant mode requested
            if mode == "instant":
                print("[DEBUG] Instant mode - returning quick response", flush=True)
                instant_responses = {
                    "project_manage": "Project management: save, open, delete, create project",
                    "session_state": "Session loaded with current configuration.",
                    "groundstation_edit": "Ground station editor active.",
                    "constellation_edit": "Constellation editor active.",
                    "link_budget": "Link budget calculator ready.",
                    "elevation_stats": "Elevation analysis ready.",
                    "attenuation": "Attenuation model ready.",
                    "link_margin": "Link margin analysis ready.",
                    "outage_probability": "Outage analysis ready.",
                    "payload_edit": "Payload editor active.",
                    "explain": "EIRP (Effective Isotropic Radiated Power): Satellite's power output as if radiating from an isotropic antenna. Higher EIRP = stronger signals. Affected by transmit power and antenna gain.",
                    "unclear": "I didn't understand. Please ask about: project status, ground stations, satellites, link budget, or payload parameters."
                }
                raw_text = instant_responses.get(intent, "Ready to help!")
            else:
                # Build full context
                if intent in ["explain", "unclear", "session_state"]:
                    full_prompt = f"""{system_prompt}\n\nUser instruction: "{prompt}"\n\nProvide a natural language response. You MUST put all your internal reasoning, drafts, and planning inside <think>...</think> tags. Only your final, polished response to the user should be outside the tags."""
                else:
                    full_prompt = f"""{system_prompt}

Current project state:
{json.dumps(project_state, indent=2)}

User instruction: "{prompt}"

Return the complete updated project state as valid JSON only (no markdown, no explanation)."""
                
                # Step 3: Get response with timeout handling
                print("[DEBUG] Calling Gemma for full response", flush=True)
                try:
                    response = gemma_model.generate_content(
                        full_prompt,
                        generation_config={"temperature": 0.2, "max_output_tokens": 4000},
                        request_options={"timeout": 300}
                    )
                    raw_text = response.text
                    print(f"[DEBUG] Got response: {len(raw_text)} chars", flush=True)
                except Exception as response_error:
                    import traceback
                    err_str = traceback.format_exc()
                    print(f"[ERROR] Response generation failed: {response_error}", flush=True)
                    try:
                        with open("/tmp/palatine_error.txt", "w") as ef:
                            ef.write(err_str)
                    except:
                        pass
                    raw_text = f"Error: AI response generation timed out or failed. Please try again."
                    response = None
            
            # Extract thought tags for all intents
            thought_text = ""
            if response:
                think_matches = re.findall(r'<think>(.*?)(?:</think>|$)', raw_text, re.DOTALL | re.IGNORECASE)
                if think_matches:
                    thought_text = "\n\n".join(m.strip() for m in think_matches)
                    raw_text = re.sub(r'<think>.*?(?:</think>|$)', '', raw_text, flags=re.DOTALL | re.IGNORECASE).strip()
                
                # Fallback heuristic: If it still generated bullet-point drafts instead of tags
                if re.search(r'^\s*[\*\-]\s*(Draft|Goal:|System Prompt|Self-Correction|Internal Monologue|User input:)', raw_text, re.IGNORECASE | re.MULTILINE):
                    lines = raw_text.split('\n')
                    thought_lines = []
                    final_lines = []
                    
                    # Try to find a clear marker for the final answer
                    marker_idx = -1
                    for i, line in enumerate(lines):
                        lower_line = line.lower()
                        if "drafting the final response" in lower_line or "final response:" in lower_line or "final answer:" in lower_line:
                            marker_idx = i
                            break
                            
                    if marker_idx != -1:
                        thought_lines = lines[:marker_idx+1]
                        final_lines = lines[marker_idx+1:]
                    else:
                        # Fallback: Find the transition to a normal, unindented, non-bullet paragraph
                        split_idx = -1
                        for i, line in enumerate(lines):
                            if not line.strip():
                                continue
                            if not line.strip().startswith('*') and not line.strip().startswith('-') and not line.startswith(' ') and not line.startswith('\t'):
                                split_idx = i
                                break
                                
                        if split_idx != -1:
                            thought_lines = lines[:split_idx]
                            final_lines = lines[split_idx:]
                        else:
                            # If no split found, assume everything is thought except maybe the last paragraph
                            thought_lines = lines
                            final_lines = []
                            
                    if thought_lines and final_lines:
                        new_thought = '\n'.join(thought_lines).strip()
                        thought_text = (thought_text + "\n\n" + new_thought).strip()
                        raw_text = '\n'.join(final_lines).strip()
                        
                        # Clean up quotes if the model wrapped the final answer in quotes
                        if raw_text.startswith('"') and raw_text.endswith('"'):
                            raw_text = raw_text[1:-1]

            # For state-modifying prompts, extract JSON
            if intent not in ["explain", "unclear", "session_state"]:
                json_end = raw_text.rfind('}')
                if json_end > -1:
                    start_pos = raw_text.find('{')
                    while start_pos != -1 and start_pos < json_end:
                        json_text = raw_text[start_pos:json_end+1]
                        try:
                            updated_state = json.loads(json_text)
                            # Auto-save
                            filename = project_state.get('_filename')
                            if filename and filename.endswith('.yaml'):
                                filepath = os.path.join(PROJECTS_DIR, filename)
                                save_data = {k: v for k, v in updated_state.items() if not k.startswith('_')}
                                with open(filepath, 'w', encoding='utf-8') as f:
                                    yaml.safe_dump(save_data, f, default_flow_style=False, sort_keys=False)
                            raw_text = json.dumps({
                                "type": "state_update",
                                "updated_state": updated_state,
                                "saved": bool(filename)
                            })
                            break
                        except json.JSONDecodeError:
                            start_pos = raw_text.find('{', start_pos + 1)
            
            # Stream response
            print("[DEBUG] Sending response", flush=True)
            if thought_text:
                yield f"data: {json.dumps({'thought': thought_text})}\n\n"
            response_json = json.dumps({"text": raw_text})
            
            # DEBUG LOGGING
            try:
                with open("/tmp/palatine_debug.txt", "w") as dbg:
                    dbg.write("=== THOUGHT ===\n" + thought_text + "\n=== RAW ===\n" + raw_text)
            except Exception:
                pass
                
            yield f"data: {response_json}\n\n"
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            import traceback
            print(f"[ERROR] Exception in generate(): {e}", flush=True)
            print(traceback.format_exc(), flush=True)
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

if __name__ == '__main__':
    app.run(debug=True, port=5000)

# ─── AI Integration (Classifier + Prompt Router) ───


# ─── Deprecated: Use /api/chat instead ───

@app.route('/api/ai/classify', methods=['POST'])
def classify_intent():
    """Classify user prompt intent for routing."""
    if not gemma_model:
        return jsonify({"error": "Gemma API not configured"}), 503
    
    data = request.json or {}
    user_prompt = data.get('prompt', '')
    
    if not user_prompt:
        return jsonify({"error": "No prompt provided"}), 400
    
    try:
        classifier_prompt = load_prompt("classifier")
        
        full_prompt = f"""{classifier_prompt}

User prompt: "{user_prompt}"

Return ONLY one label (no explanation):"""
        
        response = gemma_model.generate_content(full_prompt, generation_config={
            "temperature": 0.3,
            "top_p": 0.8,
            "top_k": 40
        })
        
        label = response.text.strip().lower()
        # Ensure label is valid
        if label not in SYSTEM_PROMPTS:
            label = "unclear"
        
        return jsonify({"intent": label, "confidence": 0.95}), 200
    
    except Exception as e:
        return jsonify({"error": str(e), "intent": "unclear"}), 500

@app.route('/api/ai/prompt', methods=['POST'])
def process_ai_prompt():
    """Process user prompt with appropriate system prompt."""
    if not gemma_model:
        return jsonify({"error": "Gemma API not configured"}), 503
    
    data = request.json or {}
    user_prompt = data.get('prompt', '')
    intent = data.get('intent', 'unclear')
    project_state = data.get('project_state', {})
    
    if not user_prompt:
        return jsonify({"error": "No prompt provided"}), 400
    
    try:
        system_prompt = load_prompt(intent)
        
        # Build full context based on intent
        if intent in ["explain", "unclear"]:
            # Read-only, no state needed
            full_prompt = f"""{system_prompt}

User prompt: "{user_prompt}"

Respond helpfully."""
        elif intent == "session_state":
            # Read-only, needs state
            full_prompt = f"""{system_prompt}

Current project state:
{json.dumps(project_state, indent=2)}

User prompt: "{user_prompt}"

Summarize the current configuration."""
        else:
            # Modify state, needs validation
            full_prompt = f"""{system_prompt}

Current project state:
{json.dumps(project_state, indent=2)}

User instruction: "{user_prompt}"

Return the complete updated project state as valid JSON only (no markdown, no explanation)."""
        
        response = gemma_model.generate_content(full_prompt, generation_config={
            "temperature": 0.2,
            "top_p": 0.8,
            "top_k": 40,
            "max_output_tokens": 2000
        })
        
        raw_response = response.text.strip()
        
        # For read-only prompts, return text directly
        if intent in ["explain", "unclear", "session_state"]:
            return jsonify({
                "type": "text",
                "response": raw_response,
                "intent": intent
            }), 200
        
        # For state-modifying prompts, parse JSON
        try:
            # Strip markdown code fences if present
            json_text = re.sub(r'^```json\s*', '', raw_response)
            json_text = re.sub(r'^```\s*', '', json_text)
            json_text = re.sub(r'\s*```$', '', json_text)
            
            # Extract JSON object from response (find the first { and last })
            json_start = json_text.find('{')
            json_end = json_text.rfind('}')
            
            if json_start >= 0 and json_end > json_start:
                json_text = json_text[json_start:json_end+1]
            
            updated_state = json.loads(json_text)
            
            # Auto-save to YAML if filename provided
            filename = project_state.get('_filename')
            if filename and filename.endswith('.yaml'):
                filepath = os.path.join(PROJECTS_DIR, filename)
                save_data = {k: v for k, v in updated_state.items() if not k.startswith('_')}
                with open(filepath, 'w', encoding='utf-8') as f:
                    yaml.safe_dump(save_data, f, default_flow_style=False, sort_keys=False)
            
            return jsonify({
                "type": "state_update",
                "updated_state": updated_state,
                "intent": intent,
                "saved": bool(filename)
            }), 200
        
        except json.JSONDecodeError as e:
            return jsonify({
                "error": f"Invalid JSON response from AI: {str(e)}",
                "raw_response": raw_response,
                "intent": intent
            }), 422
    
    except Exception as e:
        return jsonify({"error": str(e), "intent": intent}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
