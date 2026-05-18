import os
import json
import yaml
from datetime import datetime, timezone
from flask import Flask, render_template, send_from_directory, abort, request, jsonify

app = Flask(__name__, template_folder='templates', static_url_path='/none')

V2_STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static'))
V1_STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'Palatine 1.0', 'static'))
DATABASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'database'))
PROJECTS_DIR = os.path.join(DATABASE_DIR, 'projects')
FEEDBACK_LOG_PATH = os.path.join(DATABASE_DIR, 'feedback.jsonl')

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
    if not genai_client:
        return jsonify({"error": "GEMMA_API_KEY is not configured in .env"}), 500
        
    data = request.json or {}
    prompt = data.get('prompt', '')
    mode = data.get('mode', 'think')
    
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
            response = genai_client.models.generate_content_stream(
                model='gemma-4-26b-a4b-it',
                contents=prompt,
                config=config
            )
            for chunk in response:
                if getattr(chunk, 'candidates', None) and chunk.candidates:
                    candidate = chunk.candidates[0]
                    if getattr(candidate, 'content', None) and getattr(candidate.content, 'parts', None):
                        for part in candidate.content.parts:
                            if not getattr(part, 'text', None):
                                continue
                                
                            payload = {}
                            # Check if the SDK marked this part as a thought
                            if getattr(part, 'thought', False):
                                payload['thought'] = part.text
                            else:
                                payload['text'] = part.text
                                
                            yield f"data: {json.dumps(payload)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(stream_with_context(generate()), mimetype='text/event-stream')

@app.route('/api/chat/feedback', methods=['POST'])
def chat_feedback():
    """Append lightweight development feedback for a completed assistant response."""
    data = request.json or {}
    prompt = data.get('prompt')
    response = data.get('response')
    feedback = data.get('feedback')
    mode = data.get('mode')
    message_id = data.get('message_id')

    if not isinstance(prompt, str) or not isinstance(response, str):
        return jsonify({"error": "Prompt and response are required"}), 400
    if feedback not in {'like', 'dislike'}:
        return jsonify({"error": "Feedback must be 'like' or 'dislike'"}), 400
    if mode not in {'thinking', 'instant'}:
        return jsonify({"error": "Mode must be 'thinking' or 'instant'"}), 400

    entry = {
        "prompt": prompt,
        "response": response,
        "feedback": feedback,
        "mode": mode,
        "timestamp": datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    }
    if isinstance(message_id, str) and message_id:
        entry["message_id"] = message_id

    try:
        with open(FEEDBACK_LOG_PATH, 'a', encoding='utf-8') as f:
            f.write(json.dumps(entry, ensure_ascii=False) + '\n')
        return jsonify({"message": "Feedback recorded"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
