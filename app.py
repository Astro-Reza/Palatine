import os
import json
from flask import Flask, render_template, send_from_directory, abort, request, jsonify

app = Flask(__name__, template_folder='templates', static_url_path='/none')

V2_STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'static'))
V1_STATIC_DIR = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(__file__)), 'Palatine 1.0', 'static'))
DATABASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), 'database'))

if not os.path.exists(DATABASE_DIR):
    os.makedirs(DATABASE_DIR)

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

@app.route('/test-advanced')
def test_advanced():
    return render_template('test-advanced.html')

@app.route('/api/save-constellation', methods=['POST'])
def save_constellation():
    data = request.json
    if not data:
        return jsonify({"error": "No data provided"}), 400
    
    # Save each constellation in a separate JSON file named by its ID or Name
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

if __name__ == '__main__':
    app.run(debug=True, port=5000)
