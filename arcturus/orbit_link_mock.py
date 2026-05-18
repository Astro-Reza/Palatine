import os
import math
import json
import random
from datetime import datetime, timezone

class OrbitLinkMock:
    """
    OrbitLinkMock: A high-fidelity sandbox state & math engine for Palatine Orbit-Link.
    Allows Arcturus to see, query, construct, and analyze orbital constellations,
    ISL links, and ground stations without direct API dependencies.
    """
    def __init__(self):
        # Physical & Mathematical Constants
        self.R_EARTH_KM = 6371.0       # Earth radius in km
        self.MU_EARTH = 398600.4418    # Standard gravitational parameter (km^3/s^2)
        
        # Primary state matching Palatine 2.0 database YAML/JSON schemas
        self.project_metadata = {
            "name": "Arcturus Sandbox Mission",
            "created": datetime.now(timezone.utc).isoformat(),
            "modified": datetime.now(timezone.utc).isoformat(),
            "version": "2.0.0"
        }
        
        # Seed default state matching standard constellations
        self.constellations = [
            {
                "id": "const_arc_gemma_01",
                "name": "Arc-Gemma LEO Plane A",
                "orbit": {
                    "apogee": 550,
                    "perigee": 550,
                    "inclination": 53.0,
                    "orbital_planes": 1,
                    "sats_per_plane": 4
                },
                "payload": {
                    "beam_quantity": 4,
                    "beam_size": 120
                },
                "checked": True
            }
        ]
        
        # Seed ground stations
        self.ground_stations = [
            {
                "name": "Jakarta Teleport",
                "version": "01",
                "antennaType": "Phased Array",
                "stationCount": 1,
                "stations": [
                    {
                        "id": "GS_JKT_01",
                        "city": "Jakarta, Indonesia",
                        "lat": "-6.175000",
                        "lon": "106.827500",
                        "alt": "15"
                    }
                ],
                "checked": True,
                "visible": True
            }
        ]
        
        self.isl_links = []
        self.simulation_state = {}
        self.logs = []
        
        self.log("OrbitLinkMock Engine successfully initialized with default seed state.")

    def log(self, message):
        """Appends to command/telemetry log and prints output."""
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        log_entry = f"[{timestamp}] {message}"
        self.logs.append(log_entry)
        print(log_entry)

    def load_project(self, filepath):
        """
        Loads state from a Palatine 2.0 project YAML file.
        Attempts to resolve relative paths against the database/projects directory.
        """
        # Clean relative reference resolving
        if not os.path.isabs(filepath):
            projects_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'database', 'projects'))
            candidate = os.path.join(projects_dir, filepath)
            if os.path.exists(candidate):
                filepath = candidate
            else:
                candidate_direct = os.path.abspath(filepath)
                if os.path.exists(candidate_direct):
                    filepath = candidate_direct

        if not os.path.exists(filepath):
            err_msg = f"Error: Project file not found at: {filepath}"
            self.log(err_msg)
            return {"status": "error", "message": err_msg}

        try:
            import yaml
            with open(filepath, 'r', encoding='utf-8') as f:
                data = yaml.safe_load(f) or {}

            self.project_metadata = data.get('project', {})
            self.constellations = data.get('constellations', [])
            self.ground_stations = data.get('ground_stations', [])
            self.isl_links = data.get('isl_links', [])
            self.simulation_state = data.get('simulation', {})

            msg = f"Successfully loaded project '{self.project_metadata.get('name', 'Untitled')}' with {len(self.constellations)} constellations, {len(self.ground_stations)} ground stations, and {len(self.isl_links)} ISL links."
            self.log(msg)
            return {"status": "success", "message": msg}
        except Exception as e:
            err_msg = f"Failed to parse project YAML: {str(e)}"
            self.log(err_msg)
            return {"status": "error", "message": err_msg}

    def save_project(self, filepath):
        """
        Saves current mock state into a fully Palatine-compatible project YAML file.
        Allowing users to immediately load designs planned by Arcturus into their dashboard.
        """
        try:
            import yaml
            now = datetime.now(timezone.utc).isoformat()
            self.project_metadata["modified"] = now

            data = {
                "project": self.project_metadata,
                "constellations": self.constellations,
                "ground_stations": self.ground_stations,
                "isl_links": self.isl_links,
                "simulation": self.simulation_state,
                "analysis_results": {}
            }

            # Resolve output path
            if not os.path.isabs(filepath):
                projects_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'database', 'projects'))
                if os.path.exists(projects_dir):
                    filepath = os.path.join(projects_dir, filepath)

            with open(filepath, 'w', encoding='utf-8') as f:
                yaml.safe_dump(data, f, default_flow_style=False, sort_keys=False, allow_unicode=True)

            msg = f"Saved current sandbox session back to: {filepath}"
            self.log(msg)
            return {"status": "success", "message": msg}
        except Exception as e:
            err_msg = f"Failed to save project YAML: {str(e)}"
            self.log(err_msg)
            return {"status": "error", "message": err_msg}

    # ── Constellation Management ──
    def add_constellation(self, name, apogee, perigee, inclination, planes, sats_per_plane, beam_quantity=16, beam_size=120):
        """Dynamically registers a new Walker-Delta satellite constellation."""
        const_id = f"const_{''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=9))}"
        new_const = {
            "id": const_id,
            "name": name,
            "orbit": {
                "apogee": int(apogee),
                "perigee": int(perigee),
                "inclination": float(inclination),
                "orbital_planes": int(planes),
                "sats_per_plane": int(sats_per_plane)
            },
            "payload": {
                "beam_quantity": int(beam_quantity),
                "beam_size": int(beam_size)
            },
            "checked": True
        }
        self.constellations.append(new_const)
        self.log(f"Created constellation '{name}' (ID: {const_id}) [planes: {planes}, sats/plane: {sats_per_plane}]")
        return new_const

    def remove_constellation(self, const_id):
        """Removes constellation by ID and prunes all connected Inter-Satellite Links (ISL)."""
        initial_count = len(self.constellations)
        self.constellations = [c for c in self.constellations if c.get("id") != const_id]
        
        # Cascade delete ISLs
        self.isl_links = [l for l in self.isl_links if l.get("source") != const_id and l.get("target") != const_id]
        
        success = len(self.constellations) < initial_count
        if success:
            self.log(f"Successfully deleted constellation {const_id} and cleared associated ISL Links.")
        else:
            self.log(f"Constellation ID {const_id} not found.")
        return success

    def get_fleet_status(self):
        """Computes summary details of currently active constellations & total deployed nodes."""
        total_sats = 0
        details = []
        
        for c in self.constellations:
            orbit = c.get("orbit", {})
            planes = orbit.get("orbital_planes", 0)
            sats = orbit.get("sats_per_plane", 0)
            node_count = planes * sats
            total_sats += node_count
            details.append(
                f"- {c['name']} (ID: {c['id']}): {node_count} nodes ({planes} planes x {sats} sats). "
                f"Orbit: {orbit.get('apogee')}km x {orbit.get('perigee')}km @ {orbit.get('inclination')}° inclination."
            )
            
        summary = f"Nominal fleet status. {len(self.constellations)} active constellations containing {total_sats} total orbital nodes."
        self.log(summary)
        return {
            "summary": summary,
            "constellation_count": len(self.constellations),
            "total_satellites": total_sats,
            "details": details
        }

    # ── Ground Station Management ──
    def add_ground_station(self, name, city, lat, lon, alt=10.0, antenna_type="Phased Array"):
        """Registers a new Earth ground station."""
        for gs in self.ground_stations:
            if gs["name"].lower() == name.lower():
                self.log(f"Ground station '{name}' already exists. Skipping insertion.")
                return gs

        station_id = f"GS_{''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=8))}"
        new_gs = {
            "name": name,
            "version": "01",
            "antennaType": antenna_type,
            "stationCount": 1,
            "stations": [
                {
                    "id": station_id,
                    "city": city,
                    "lat": str(lat),
                    "lon": str(lon),
                    "alt": str(alt)
                }
            ],
            "checked": True,
            "visible": True
        }
        self.ground_stations.append(new_gs)
        self.log(f"Registered ground station '{name}' (ID: {station_id}) in {city} at coordinates: ({lat}, {lon}).")
        return new_gs

    # ── Inter-Satellite Link (ISL) Management ──
    def add_isl_link(self, source_id, target_id, link_type="laser", max_range_km=5000, data_rate_gbps=10, bidirectional=True):
        """Sets up a crosslink between two constellations."""
        const_ids = [c["id"] for c in self.constellations]
        if source_id not in const_ids or target_id not in const_ids:
            err = f"Failed to establish ISL: invalid source ({source_id}) or target ({target_id}) constellation ID."
            self.log(err)
            return {"error": err}

        isl_id = f"isl_{''.join(random.choices('abcdefghijklmnopqrstuvwxyz0123456789', k=9))}"
        new_isl = {
            "id": isl_id,
            "source": source_id,
            "target": target_id,
            "type": link_type,
            "max_range_km": max_range_km,
            "data_rate_gbps": data_rate_gbps,
            "bidirectional": bidirectional
        }
        self.isl_links.append(new_isl)
        self.log(f"Established {link_type} ISL link '{isl_id}' ({data_rate_gbps} Gbps, max range: {max_range_km}km) between {source_id} <-> {target_id}.")
        return new_isl

    # ── RF Slant & Link Budget Scientific Models ──
    def calculate_distance(self, alt_km, elevation_deg):
        """
        Slant Range Calculation (km) using Earth geometry and the Law of Cosines.
        Re-implements the standard spherical Earth model for orbital propagation.
        """
        if elevation_deg < 0:
            elevation_deg = 0.0
        el_rad = math.radians(elevation_deg)
        inside = (self.R_EARTH_KM * math.sin(el_rad))**2 + (self.R_EARTH_KM + alt_km)**2 - self.R_EARTH_KM**2
        if inside < 0:
            return alt_km # Vertical fallback
        return -self.R_EARTH_KM * math.sin(el_rad) + math.sqrt(inside)

    def calculate_fspl(self, distance_km, freq_ghz):
        """Free Space Path Loss (FSPL) in dB (ITU-R P.525)."""
        if distance_km <= 0 or freq_ghz <= 0:
            return 0.0
        return 92.45 + 20 * math.log10(freq_ghz) + 20 * math.log10(distance_km)

    def calculate_atmospheric_loss(self, elevation_deg, zenith_loss_db):
        """Elevation-dependent atmospheric attenuation in dB (simplified ITU-R P.676 model)."""
        if elevation_deg <= 0.5:
            elevation_deg = 0.5
        el_rad = math.radians(elevation_deg)
        return zenith_loss_db / math.sin(el_rad)

    def compute_link_budget(self, station_name, const_id, freq_ghz, elevation_deg=30.0, is_uplink=False):
        """
        Computes a complete statistical link budget for a ground-to-satellite link.
        Calculates FSPL, atmospheric losses, and received power, verifying the link margin.
        """
        # Resolve Ground Station
        station = None
        for gs in self.ground_stations:
            if gs["name"].lower() == station_name.lower():
                station = gs
                break
        if not station:
            return {"error": f"Ground station '{station_name}' not found."}

        # Resolve Constellation
        const = None
        for c in self.constellations:
            if c["id"] == const_id or c["name"].lower() == const_id.lower():
                const = c
                break
        if not const:
            return {"error": f"Constellation '{const_id}' not found."}

        orbit = const.get("orbit", {})
        alt_km = (orbit.get("apogee", 550) + orbit.get("perigee", 550)) / 2.0
        
        # 1. Physics Calculations
        distance = self.calculate_distance(alt_km, elevation_deg)
        fspl = self.calculate_fspl(distance, freq_ghz)
        
        # Zenith atmospheric loss defaults based on band (Ku: ~12-18 GHz vs Ka: ~26-40 GHz)
        zenith_loss = 0.5 if freq_ghz < 25.0 else 0.8
        atmos_loss = self.calculate_atmospheric_loss(elevation_deg, zenith_loss)
        
        # Pointing and polarization miscellaneous losses
        pointing_loss = 1.0
        polarization_loss = 1.0
        misc_loss = pointing_loss + polarization_loss
        
        # 2. RF Budgets (EIRP, Antenna Gains, Thermal noise/Required power thresholds)
        if not is_uplink:
            # DOWNLINK: Satellite Tx -> Ground Station Rx
            # EIRP = Sat Power + Sat Gain
            tx_eirp = 56.0         # dBW (Typical Ku/Ka high power transponder)
            rx_gain = 40.0         # dBi (Typical 1.2m terminal antenna gain)
            req_power = -105.0     # dBW (Required demodulation threshold)
            rx_power = tx_eirp + rx_gain - fspl - atmos_loss - misc_loss
            margin = rx_power - req_power
        else:
            # UPLINK: Ground Station Tx -> Satellite Rx
            tx_eirp = 60.0         # dBW (Typical Earth station high-power amplifier)
            rx_gain = 35.0         # dBi (Satellite phased array receiver gain)
            req_power = -110.0     # dBW (Satellite noise-limited threshold)
            rx_power = tx_eirp + rx_gain - fspl - atmos_loss - misc_loss
            margin = rx_power - req_power

        status = "PASS" if margin >= 3.0 else ("MARGINAL" if margin >= 0 else "FAIL")
        
        report = {
            "constellation_name": const["name"],
            "constellation_id": const["id"],
            "ground_station": station["name"],
            "frequency_ghz": float(freq_ghz),
            "elevation_deg": float(elevation_deg),
            "link_direction": "Uplink (Ground -> Sat)" if is_uplink else "Downlink (Sat -> Ground)",
            "slant_range_km": round(distance, 2),
            "free_space_path_loss_db": round(fspl, 2),
            "atmospheric_loss_db": round(atmos_loss, 2),
            "miscellaneous_loss_db": round(misc_loss, 2),
            "total_channel_loss_db": round(fspl + atmos_loss + misc_loss, 2),
            "received_power_dbw": round(rx_power, 2),
            "required_power_dbw": float(req_power),
            "link_margin_db": round(margin, 2),
            "status": status
        }
        
        self.log(
            f"Calculated link budget for {station['name']} <-> {const['name']} "
            f"({report['link_direction']} at {freq_ghz} GHz, El: {elevation_deg}°). "
            f"Result: {status} (Margin: {report['link_margin_db']} dB)"
        )
        return report

    def simulate_passes(self, station_name, const_id, num_passes=5):
        """
        Simulates multiple satellite passes over a station.
        Varies the elevation angle to show dynamic FSPL, atmospheric attenuation, and margin fluctuations.
        """
        results = []
        for i in range(num_passes):
            elevation = round(random.uniform(10.0, 85.0), 1)
            # Ka-band downlink
            report = self.compute_link_budget(station_name, const_id, freq_ghz=20.0, elevation_deg=elevation)
            if "error" not in report:
                results.append({
                    "pass_index": i + 1,
                    "elevation_deg": elevation,
                    "slant_range_km": report["slant_range_km"],
                    "fspl_db": report["free_space_path_loss_db"],
                    "atmos_loss_db": report["atmospheric_loss_db"],
                    "rx_power_dBW": report["received_power_dbw"],
                    "margin_db": report["link_margin_db"],
                    "status": report["status"]
                })
        return results
