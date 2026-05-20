import os
import random
import yaml
from datetime import datetime, timezone

class GroundStationController:
    """
    Live Ground Segment Controller for Palatine 2.0.
    Handles adding, editing, and removing ground stations directly in the project YAML.
    """
    def __init__(self, project_id: str):
        self.project_id = project_id
        self.project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
        self.projects_dir = os.path.join(self.project_root, 'database', 'projects')
        
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

    def add_ground_station(self, name: str, city: str, lat: float, lon: float, alt: float = 10.0, antenna_type: str = "Phased Array"):
        """
        Adds a ground station to the project, performs type safety validation,
        updates the project YAML, and returns the newly registered station details.
        """
        safe_name = str(name or "Jakarta Teleport").strip()
        safe_city = str(city or "Jakarta").strip()
        
        try:
            safe_lat = float(lat)
            if safe_lat < -90.0 or safe_lat > 90.0:
                safe_lat = 0.0
        except (ValueError, TypeError):
            safe_lat = 0.0
            
        try:
            safe_lon = float(lon)
            if safe_lon < -180.0 or safe_lon > 180.0:
                safe_lon = 0.0
        except (ValueError, TypeError):
            safe_lon = 0.0

        try:
            safe_alt = float(alt)
            if safe_alt < -100.0 or safe_alt > 10000.0:
                safe_alt = 10.0
        except (ValueError, TypeError):
            safe_alt = 10.0

        safe_antenna = str(antenna_type or "Phased Array").strip()

        # Check if already exists by name
        if "ground_stations" not in self.data or not isinstance(self.data["ground_stations"], list):
            self.data["ground_stations"] = []

        for gs in self.data["ground_stations"]:
            if gs.get("name", "").lower() == safe_name.lower():
                return gs

        station_id = f"GS_{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=8))}"
        new_gs = {
            "name": safe_name,
            "version": "01",
            "antennaType": safe_antenna,
            "stationCount": 1,
            "stations": [
                {
                    "id": station_id,
                    "city": safe_city,
                    "lat": str(safe_lat),
                    "lon": str(safe_lon),
                    "alt": str(safe_alt)
                }
            ],
            "checked": True,
            "visible": True
        }
        self.data["ground_stations"].append(new_gs)
        self._save_project()
        return new_gs
