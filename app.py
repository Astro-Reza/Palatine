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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
