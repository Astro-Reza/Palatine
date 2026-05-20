import os
import random
import yaml
from datetime import datetime, timezone

class ConstellationController:
    """
    Live Space Segment Controller for Palatine 2.0.
    Handles adding, editing, and removing constellations directly in the project YAML.
    """
    def __init__(self, project_id: str):
        # project_id corresponds to the yaml file name (e.g. duaan.yaml)
        self.project_id = project_id
        
        # Resolve project filepath within the database/projects directory
        # The core/ directory is inside the project root, so parent of core/ is the project root
        self.project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        self.projects_dir = os.path.join(self.project_root, 'database', 'projects')
        
        if not os.path.exists(self.projects_dir):
            os.makedirs(self.projects_dir)
            
        filename = project_id if project_id.endswith('.yaml') else f"{project_id}.yaml"
        self.filepath = os.path.join(self.projects_dir, filename)
        
        self.data = self._load_project()

    def _load_project(self) -> dict:
        if os.path.exists(self.filepath):
            try:
                with open(self.filepath, 'r', encoding='utf-8') as f:
                    return yaml.safe_load(f) or {}
            except Exception as e:
                print(f"Error loading project file: {e}")
                return self._create_blank_project()
        else:
            return self._create_blank_project()

    def _create_blank_project(self) -> dict:
        now = datetime.now(timezone.utc).isoformat()
        return {
            "project": {
                "name": "Arcturus Live Mission",
                "created": now,
                "modified": now,
                "version": "2.0.0"
            },
            "constellations": [],
            "ground_stations": [],
            "isl_links": [],
            "simulation": {},
            "analysis_results": {}
        }

    def _save_project(self):
        try:
            self.data["project"]["modified"] = datetime.now(timezone.utc).isoformat()
            with open(self.filepath, 'w', encoding='utf-8') as f:
                yaml.safe_dump(self.data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)
            return True
        except Exception as e:
            print(f"Error saving project file: {e}")
            return False

    def deploy_walker_delta(self, name: str, apogee: int, inclination: float, planes: int, sats_per_plane: int = 8):
        """
        Deploys a new Walker-Delta satellite constellation, validates parameters to prevent injection,
        updates the project YAML state and returns a DeployResult object.
        """
        # Strict validation and sanitization
        safe_name = str(name or "AI-Generated-Shell").strip()
        
        # Enforce numeric boundaries and prevent invalid values
        try:
            safe_apogee = int(apogee)
            if safe_apogee < 100 or safe_apogee > 40000:
                safe_apogee = 550
        except (ValueError, TypeError):
            safe_apogee = 550
            
        try:
            safe_inclination = float(inclination)
            if safe_inclination < 0.0 or safe_inclination > 180.0:
                safe_inclination = 53.0
        except (ValueError, TypeError):
            safe_inclination = 53.0
            
        try:
            safe_planes = int(planes)
            if safe_planes < 1 or safe_planes > 100:
                safe_planes = 4
        except (ValueError, TypeError):
            safe_planes = 4

        try:
            safe_sats = int(sats_per_plane)
            if safe_sats < 1 or safe_sats > 200:
                safe_sats = 8
        except (ValueError, TypeError):
            safe_sats = 8

        const_id = f"const_{''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=9))}"
        
        new_const = {
            "id": const_id,
            "name": safe_name,
            "orbit": {
                "apogee": safe_apogee,
                "perigee": safe_apogee, # Default perigee to apogee
                "inclination": safe_inclination,
                "orbital_planes": safe_planes,
                "sats_per_plane": safe_sats
            },
            "payload": {
                "beam_quantity": 16,
                "beam_size": 120
            },
            "checked": True
        }

        if "constellations" not in self.data or not isinstance(self.data["constellations"], list):
            self.data["constellations"] = []
            
        self.data["constellations"].append(new_const)
        self._save_project()

        class DeployResult:
            def __init__(self, node_count):
                self.node_count = node_count

        return DeployResult(safe_planes * safe_sats)

    def remove_constellation(self, const_id: str):
        """Removes a constellation by ID or name and cascades to delete related ISL links."""
        safe_id = str(const_id).strip()
        if "constellations" not in self.data or not isinstance(self.data["constellations"], list):
            return False
            
        target = None
        for c in self.data["constellations"]:
            if c.get("id") == safe_id or c.get("name", "").lower() == safe_id.lower():
                target = c
                break
                
        if target:
            tid = target.get("id")
            self.data["constellations"] = [c for c in self.data["constellations"] if c.get("id") != tid]
            
            # Cascade delete ISLs
            if "isl_links" in self.data and isinstance(self.data["isl_links"], list):
                self.data["isl_links"] = [
                    l for l in self.data["isl_links"]
                    if l.get("source") != tid and l.get("target") != tid
                ]
                
            self._save_project()
            return True, target.get("name")
        return False, None
