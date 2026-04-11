# 🛰️ Palatine 2.0

<div align="center">
  <img width="300px" src="static/logo/palatine-white.svg"/>
</div>

---
<p align="center">
  <a href="https://palatine-space.vercel.app/terminal">
    <img src="https://img.shields.io/badge/Official_Website-2.7.8-blue" alt="Official Website" />
  </a>
  <a href="https://www.linkedin.com/in/rezafauzanz/">
    <img src="https://img.shields.io/badge/Project Lead-Reza Fauzan-lightblue" alt="Official Website" />
  </a>
  <a href="https://www.linkedin.com/in/rezafauzanz/">
    <img src="https://img.shields.io/badge/Project Lead-Reza Fauzan-lightblue" alt="Official Website" />
  </a>
</p>

---
A comprehensive web-based platform for Low Earth Orbit (LEO) satellite constellation visualization and link budget analysis.

### **The Advanced LEO Commercialization & Mission Planning Platform**

**Palatine 2.0** is a sophisticated, data-driven pre-mission consultancy platform designed for satellite operators. It serves as a comprehensive **Decision Support System (DSS)**, enabling rapid visualization, optimization, and session-based management of Low Earth Orbit (LEO) satellite constellations.

---

## 🚀 Core Features

### **1. Real-Time Orbital Visualization**

<details>
<summary><b>More</b></summary>

- **3D World View:** A stunning, interactive WebGL Earth model using **Three.js** with high-resolution day/night shader materials.
- **2D Map Projection:** Seamless toggle to a traditional Mercator projection for global coverage analysis.
- **Dynamic Propagation:** Real-time orbit simulation with customizable time stepping (from real-time to high-speed multipliers).

</details>

### **2. Constellation Design & Payload Parameters**

<details>
<summary><b>More</b></summary>

- **Orbital Mechanics:** Configure inclination, planes, satellites per plane, apogee/perigee, and RAAN spread.
- **Payload Specs:** Define beam quantity, beam size (km), gain, frequency, and transmit power (EIRP).
- **Inter-Satellite Links (ISL):** Logic for simulating laser, RF, or microwave cross-links between satellites.
</details>

### **3. Workspace & Session Management (New)**

<details>
<summary><b>More</b></summary>

- **YAML-Based Projects:** Projects are saved as human-readable `.yaml` files, making them easy to version control and audit.
- **Integrated Menu System:** A custom "Logo Dropdown" provides standard file operations (New Project, Open, Save, Export).
- **Safe Persistence:** Custom async modal dialogs handle "Unsaved Changes" warnings to prevent data loss.
</details>

### **4. Visualization Overlays**

<details>
<summary><b>More</b></summary>

- **Earth Graticule:** Toggleable Latitude/Longitude line grid for precise positioning.
- **Beam Footprints:** Dynamic cone and footprint visualization for focused satellites.
- **Multi-Shell Support:** Push multiple independent constellations into a single simulation environment.
</details>

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Python (Flask), PyYAML |
| **3D Rendering** | Three.js (WebGL) |
| **Frontend UI** | Vanilla JavaScript (ES6+), CSS3 (Modern Glassmorphism) |
| **Data Format** | YAML (Projects), JSON (Legacy Assets) |
| **Typography** | Geologica (Google Fonts) |


---

## ⚡ Getting Started

### **Prerequisites**
- Python 3.8+
- Modern Web Browser (Chrome/Discord/Safari with WebGL support)

### **Installation**
1. **Clone the repository:**
   ```bash
   git clone https://github.com/Astro-Reza/Palatine.git
   cd "Palatine/Palatine 2.0"
   ```

2. **Install dependencies:**
   ```bash
   pip install flask pyyaml
   ```

3. **Run the application:**
   ```bash
   python app.py
   ```

4. **Access the platform:**
   Open your browser and navigate to `http://127.0.0.1:5000`

---

## 📅 Roadmap (Future Updates)
- [ ] **Coverage Map Analysis:** Heatmaps for regional bandwidth availability.
- [ ] **Revisit Time Calculation:** Precision metrics for ground-target visibility.
- [ ] **Monte Carlo Simulation:** Probabilistic analysis for linkage failure scenarios.
- [ ] **Ground Station Manager:** Integration of earth-based telemetry data.

---

## ⚖️ License & Contact
**Project Creator:** [Astro-Reza](https://github.com/Astro-Reza)

Palatine 2.0 is licensed under a proprietary license. See [LICENSE.md](./LICENSE.md) for full terms (Non-commercial, Attribution Required, No Modifications).

*For mission planning inquiries or licensing permissions, please visit the repository link.*

