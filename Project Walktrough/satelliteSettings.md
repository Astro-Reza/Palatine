Palatine app suggested parameters.

### 1. Orbital Mechanics Parameters

These define the satellite's position and movement in space.

* **Eccentricity ($e$):** **Dimensionless** (usually between $0$ and $0.01$ for LEO).
* **Inclination ($i$):** **Degrees ($^\circ$)**.
* **RAAN (Right Ascension of the Ascending Node):** **Degrees ($^\circ$)**.
* **Argument of Perigee ($\omega$):** **Degrees ($^\circ$)**.
* **Mean Motion ($n$):** **Revolutions per day (rev/day)**.
* **Orbital Decay / Lifetime:** **Years (yr)**.

---

### 2. Inter-Satellite Links (ISL) - Laser Focus

Laser communication units are often very precise because of the narrow beamwidths.

* **Wavelength ($\lambda$):** **Nanometers (nm)** (Standard is $1550\text{ nm}$).
* **Maximum Link Range:** **Kilometers (km)**.
* **Link Acquisition Time:** **Seconds (s)** or **Milliseconds (ms)**.
* **Pointing Accuracy:** **Microradians ($\mu\text{rad}$)** or **Milliradians (mrad)**.
* **Bit Error Rate (BER):** **Dimensionless** (expressed as $10^{-x}$, e.g., $10^{-9}$).

---

### 3. Telecommunication & RF

These units are essential for calculating the signal strength at the ground station.

* **3dB Beamwidth:** **Degrees ($^\circ$)**.
* **Peak Antenna Gain:** **dBi** (decibels relative to an isotropic radiator).
* **G/T (Gain-to-Noise Temperature):** **dB/K** (decibels per Kelvin).
* **Bandwidth ($B$):** **Megahertz (MHz)** or **Gigahertz (GHz)**.
* **Symbol Rate:** **Symbols per second (Sps)** or **Msps**.
* **Spectral Efficiency:** **bits/s/Hz**.
* **EIRP (Effective Isotropic Radiated Power):** **dBW** (decibels relative to 1 Watt).

---

### 4. Fleet Economics & Commercialization

Since you are managing a commercial constellation, these units track the "business" health.

* **Footprint Service Area:** **Square Kilometers (km²)**.
* **Throughput Density:** **Gbps/km²**.
* **Cost per Gigabyte:** **USD/GB** (or IDR/GB depending on your market).
* **Total System Capacity:** **Terabits per second (Tbps)**.

---

### Quick Conversion Tip

When you're coding the backend for these settings, remember that while the UI usually shows **Degrees**, most physics libraries (like Python's `math` or `numpy`) require **Radians** for trigonometric functions.

$$\text{Radians} = \text{Degrees} \times \frac{\pi}{180}$$