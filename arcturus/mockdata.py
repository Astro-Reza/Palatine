"""
Elevation-Based Link Budget Analysis
=====================================
Based on:
  Gongora-Torres et al. (2022). Link Budget Analysis for LEO Satellites
  Based on the Statistics of the Elevation Angle. IEEE Access, 10, 14518–14528.
  https://doi.org/10.1109/ACCESS.2022.3147829

Outputs:
  - mockdata.csv  : flat tabular summary for front-end tables / charts
  - mockdata.json : hierarchical structured data for front-end APIs / dashboards
"""

import json
import csv
import numpy as np
from scipy.stats import gamma as gamma_dist

# ─────────────────────────────────────────────────────────────────────────────
# 1. SIMULATION PARAMETERS  (Table 2 of the paper)
# ─────────────────────────────────────────────────────────────────────────────
SIMULATION_DAYS     = 500          # days
TIME_STEP_S         = 5.0          # seconds
LAT_ES_DEG          = 28.230880    # Earth Station latitude  (°N)
LON_ES_DEG          = -81.820348   # Earth Station longitude (°W)
ECCENTRICITY        = 0.0          # Circular orbit
INCLINATION_DEG     = 40.0         # Orbital inclination (°)

# Constellation
ALTITUDE_KM         = 980.0        # Satellite altitude (km)
NUM_PLANES          = 5            # Orbital planes
SATS_PER_PLANE      = 5            # Satellites per plane
TOTAL_SATS          = NUM_PLANES * SATS_PER_PLANE  # 25

# Observation
MIN_ELEVATION_DEG   = 5.0          # Minimum visible elevation (°)
CONTACT_THRESHOLD_DEG = 10.0       # Threshold for contact-duration analysis

# Physical constants
R_EARTH_KM          = 6371.0       # Earth radius (km)
MU_EARTH            = 398600.4418  # Gravitational parameter (km³/s²)
OMEGA_EARTH         = 7.2921159e-5 # Earth rotation rate (rad/s)

# ─────────────────────────────────────────────────────────────────────────────
# 2. LINK BUDGET PARAMETERS  (Table 5 of the paper)
# ─────────────────────────────────────────────────────────────────────────────
EIRP        = 56.0      # Effective Isotropic Radiated Power (dBW)
G_R         = 40.0      # Receiver antenna gain (dBi)
P_REQ       = -105.0    # Required received power (dBW)
THETA_MIN_1 = 5.0       # Min elevation for 1 % exceedance (°)
THETA_MIN_5 = 9.0       # Min elevation for 5 % exceedance (°)

# Attenuation polynomial coefficients  (Table 4)
A_COEF_1 = [0.463, -2.153,  2.578, -0.636, -0.700, -1.616, 191.449]
A_COEF_5 = [0.430, -2.091,  2.891, -0.331,  0.277, -2.427, 193.140]

# Polynomial normalisation factors
MU_THETA    = 32.329
SIGMA_THETA = 24.203


# ─────────────────────────────────────────────────────────────────────────────
# 3. HELPER: ATTENUATION POLYNOMIAL  (Eq. 13)
# ─────────────────────────────────────────────────────────────────────────────
def calculate_At(theta: np.ndarray, coefficients: list) -> np.ndarray:
    """
    Total Attenuation A_T(θ) via standardised polynomial (Eq. 13).
      A_T(θ) = Σ a_k · ((θ − μ_θ) / σ_θ)^(K−k)
    """
    norm = (theta - MU_THETA) / SIGMA_THETA
    K    = len(coefficients) - 1
    At   = sum(a_k * (norm ** (K - k)) for k, a_k in enumerate(coefficients))
    return At


# ─────────────────────────────────────────────────────────────────────────────
# 4. ORBITAL PROPAGATION & ELEVATION CALCULATION
# ─────────────────────────────────────────────────────────────────────────────
def run_simulation() -> tuple[np.ndarray, np.ndarray]:
    """
    Propagates a Walker-Delta constellation over SIMULATION_DAYS at
    TIME_STEP_S resolution using Keplerian mechanics (circular orbit).

    Returns
    -------
    t                      : time array (s)
    max_elevation_over_time: per-timestep maximum elevation across all sats (°)
    """
    print(f"[1/4] Running orbital propagation "
          f"({TOTAL_SATS} sats, {SIMULATION_DAYS} days @ {TIME_STEP_S}s) …")

    inc     = np.radians(INCLINATION_DEG)
    lat_es  = np.radians(LAT_ES_DEG)
    lon_es  = np.radians(LON_ES_DEG)
    a_km    = R_EARTH_KM + ALTITUDE_KM   # semi-major axis

    t       = np.arange(0, SIMULATION_DAYS * 24 * 3600, TIME_STEP_S)
    n_mean  = np.sqrt(MU_EARTH / a_km ** 3)

    # Earth rotation
    theta_gst = OMEGA_EARTH * t
    cos_g, sin_g = np.cos(theta_gst), np.sin(theta_gst)

    # Earth Station ECEF position and local "up" unit vector
    x_es = R_EARTH_KM * np.cos(lat_es) * np.cos(lon_es)
    y_es = R_EARTH_KM * np.cos(lat_es) * np.sin(lon_es)
    z_es = R_EARTH_KM * np.sin(lat_es)

    up_x = np.cos(lat_es) * np.cos(lon_es)
    up_y = np.cos(lat_es) * np.sin(lon_es)
    up_z = np.sin(lat_es)

    max_el = np.full(len(t), -90.0)

    for p in range(NUM_PLANES):
        raan = p * (2 * np.pi / NUM_PLANES)
        for s in range(SATS_PER_PLANE):
            v  = s * (2 * np.pi / SATS_PER_PLANE) + n_mean * t  # true anomaly

            # Orbital-plane → ECI
            xo = a_km * np.cos(v)
            yo = a_km * np.sin(v)
            x_eci = xo * np.cos(raan) - yo * np.cos(inc) * np.sin(raan)
            y_eci = xo * np.sin(raan) + yo * np.cos(inc) * np.cos(raan)
            z_eci = yo * np.sin(inc)

            # ECI → ECEF
            x_ecef =  x_eci * cos_g + y_eci * sin_g
            y_ecef = -x_eci * sin_g + y_eci * cos_g
            z_ecef =  z_eci

            # ES → satellite vector
            dx, dy, dz = x_ecef - x_es, y_ecef - y_es, z_ecef - z_es
            dist = np.sqrt(dx**2 + dy**2 + dz**2)

            sin_el = (dx * up_x + dy * up_y + dz * up_z) / dist
            el_deg = np.degrees(np.arcsin(np.clip(sin_el, -1.0, 1.0)))

            max_el = np.maximum(max_el, el_deg)

    print(f"   Propagation complete. {len(t):,} time steps processed.")
    return t, max_el


# ─────────────────────────────────────────────────────────────────────────────
# 5. GAMMA DISTRIBUTION FIT  (Section III-A)
# ─────────────────────────────────────────────────────────────────────────────
def fit_gamma(elevation_data: np.ndarray, theta_min: float) -> dict:
    """
    Filters elevations ≥ theta_min and fits a Gamma distribution (MLE).
    Returns a dict with shape, loc, scale and descriptive statistics.
    """
    valid = elevation_data[elevation_data >= theta_min]
    shape, loc, scale = gamma_dist.fit(valid, floc=0)

    theta_vals  = np.linspace(theta_min, 90, 500)
    pdf_vals    = gamma_dist.pdf(theta_vals, shape, loc=loc, scale=scale)
    cdf_vals    = gamma_dist.cdf(theta_vals, shape, loc=loc, scale=scale)

    # Empirical CDF points (for front-end chart rendering)
    data_sorted = np.sort(valid)
    ecdf_p      = np.linspace(0, 1, len(data_sorted))

    return {
        "theta_min_deg":    float(theta_min),
        "n_samples":        int(len(valid)),
        "gamma_shape":      round(float(shape), 6),
        "gamma_loc":        round(float(loc),   6),
        "gamma_scale":      round(float(scale), 6),
        "mean_theta_deg":   round(float(np.mean(valid)),   4),
        "std_theta_deg":    round(float(np.std(valid)),    4),
        "median_theta_deg": round(float(np.median(valid)), 4),
        "q1_theta_deg":     round(float(np.percentile(valid, 25)), 4),
        "q3_theta_deg":     round(float(np.percentile(valid, 75)), 4),
        "min_theta_deg":    round(float(np.min(valid)), 4),
        "max_theta_deg":    round(float(np.max(valid)), 4),
        # Curve arrays (sampled at 500 points) for charting
        "pdf_curve": {
            "theta_deg": [round(v, 3) for v in theta_vals.tolist()],
            "pdf":       [round(v, 8) for v in pdf_vals.tolist()],
        },
        "cdf_curve": {
            "theta_deg": [round(v, 3) for v in theta_vals.tolist()],
            "cdf":       [round(v, 8) for v in cdf_vals.tolist()],
        },
        "empirical_cdf": {
            "theta_deg": [round(v, 3) for v in data_sorted[::max(1, len(data_sorted)//500)].tolist()],
            "ecdf":      [round(v, 6) for v in ecdf_p[::max(1, len(ecdf_p)//500)].tolist()],
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6. CONTACT DURATION ANALYSIS  (Section III / Figure 2)
# ─────────────────────────────────────────────────────────────────────────────
def analyze_contact_duration(t: np.ndarray, el_deg: np.ndarray) -> dict:
    """
    Identifies discrete visible passes (el ≥ CONTACT_THRESHOLD_DEG),
    computes per-pass durations, and aggregates daily statistics.
    """
    print("[3/4] Analysing contact durations …")
    is_visible = el_deg >= CONTACT_THRESHOLD_DEG
    changes    = np.diff(is_visible.astype(int))
    starts     = np.where(changes == 1)[0]
    ends       = np.where(changes == -1)[0]

    if is_visible[0]:
        starts = np.insert(starts, 0, 0)
    if is_visible[-1]:
        ends   = np.append(ends, len(is_visible) - 1)

    durations, days = [], []
    for s, e in zip(starts, ends):
        durations.append(float(t[e] - t[s]))
        days.append(float(t[s] / 86400.0))

    durations    = np.array(durations)
    days_floor   = np.floor(np.array(days)).astype(int)
    unique_days  = np.unique(days_floor)

    daily_mean = np.array([
        np.mean(durations[days_floor == d]) for d in unique_days
    ])

    # 5-day moving average & median
    W = 5
    if len(daily_mean) >= W:
        mov_avg = np.convolve(daily_mean, np.ones(W) / W, mode='valid').tolist()
        mov_med = [float(np.median(daily_mean[i:i+W]))
                   for i in range(len(daily_mean) - W + 1)]
        valid_days_w = unique_days[W - 1:].tolist()
    else:
        mov_avg    = daily_mean.tolist()
        mov_med    = daily_mean.tolist()
        valid_days_w = unique_days.tolist()

    # Histogram of daily mean durations
    hist_counts, hist_edges = np.histogram(daily_mean, bins=15)

    return {
        "contact_threshold_deg":       CONTACT_THRESHOLD_DEG,
        "total_passes":                int(len(durations)),
        "total_contact_time_s":        round(float(np.sum(durations)), 2),
        "mean_pass_duration_s":        round(float(np.mean(durations)), 2),
        "median_pass_duration_s":      round(float(np.median(durations)), 2),
        "std_pass_duration_s":         round(float(np.std(durations)), 2),
        "min_pass_duration_s":         round(float(np.min(durations)), 2),
        "max_pass_duration_s":         round(float(np.max(durations)), 2),
        "daily_mean_duration": {
            "day":          unique_days.tolist(),
            "mean_s":       [round(v, 2) for v in daily_mean.tolist()],
            "moving_avg_s": [round(v, 2) for v in mov_avg],
            "moving_med_s": [round(v, 2) for v in mov_med],
            "window_days":  valid_days_w,
        },
        "duration_histogram": {
            "bin_edges_s":  [round(v, 2) for v in hist_edges.tolist()],
            "counts":       hist_counts.tolist(),
            "relative_freq":[round(c / len(daily_mean), 6) for c in hist_counts.tolist()],
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 7. LINK BUDGET ANALYSIS  (Sections III-B and III-C / Figure 9)
# ─────────────────────────────────────────────────────────────────────────────
def analyze_link_budget(elevation_data: np.ndarray,
                        theta_min: float,
                        coefs: list,
                        pe_label: str) -> dict:
    """
    Calculates statistical link budget for a given exceedance probability
    (pe_label) using Monte-Carlo samples drawn from the fitted Gamma dist.

    P_R = EIRP + G_R - A_T(θ)        [dBW]
    """
    valid = elevation_data[elevation_data >= theta_min]
    if len(valid) == 0:
        return {}

    shape, loc, scale = gamma_dist.fit(valid, floc=0)

    # Monte-Carlo: 100,000 samples
    theta_mc = gamma_dist.rvs(shape, loc=loc, scale=scale, size=100_000,
                               random_state=42)
    At_mc    = calculate_At(theta_mc, coefs)
    Pr_mc    = EIRP + G_R - At_mc          # Received power samples [dBW]

    # Boundary cases
    At_best  = float(calculate_At(np.array([90.0]), coefs)[0])   # zenith
    At_worst = float(calculate_At(np.array([theta_min]), coefs)[0])  # horizon

    max_Pr   = EIRP + G_R - At_best
    min_Pr   = EIRP + G_R - At_worst

    # Percentile array for CDF chart
    pct_points = np.arange(1, 100)
    pct_values = np.percentile(Pr_mc, pct_points)

    # A_T curve vs elevation (for front-end chart)
    theta_curve = np.linspace(theta_min, 90, 200)
    At_curve    = calculate_At(theta_curve, coefs)

    # Weighted A_T by occurrence frequency
    pdf_weight  = gamma_dist.pdf(theta_curve, shape, loc=loc, scale=scale)

    # Most frequent operating state
    hotspot_idx    = int(np.argmax(pdf_weight))
    hotspot_theta  = float(theta_curve[hotspot_idx])
    hotspot_At     = float(At_curve[hotspot_idx])
    hotspot_Pr     = EIRP + G_R - hotspot_At

    return {
        "exceedance_prob":             pe_label,
        "theta_min_deg":               float(theta_min),
        # ── Elevation statistics ──────────────────────────────
        "gamma_shape":                 round(float(shape), 6),
        "gamma_loc":                   round(float(loc),   6),
        "gamma_scale":                 round(float(scale), 6),
        "mean_theta_deg":              round(float(np.mean(valid)), 4),
        "std_theta_deg":               round(float(np.std(valid)),  4),
        # ── Attenuation ───────────────────────────────────────
        "At_best_case_dB":             round(At_best,               4),
        "At_worst_case_dB":            round(At_worst,              4),
        "At_expected_dB":              round(float(np.mean(At_mc)), 4),
        "At_median_dB":                round(float(np.median(At_mc)), 4),
        "At_std_dB":                   round(float(np.std(At_mc)),  4),
        "hotspot_theta_deg":           round(hotspot_theta, 3),
        "hotspot_At_dB":               round(hotspot_At,    3),
        # ── Received Power ────────────────────────────────────
        "Pr_max_dBW":                  round(max_Pr,                          4),
        "Pr_min_dBW":                  round(min_Pr,                          4),
        "Pr_expected_dBW":             round(float(np.mean(Pr_mc)),           4),
        "Pr_median_dBW":               round(float(np.median(Pr_mc)),         4),
        "Pr_std_dBW":                  round(float(np.std(Pr_mc)),            4),
        "Pr_q1_dBW":                   round(float(np.percentile(Pr_mc, 25)), 4),
        "Pr_q3_dBW":                   round(float(np.percentile(Pr_mc, 75)), 4),
        "hotspot_Pr_dBW":              round(hotspot_Pr, 3),
        # ── Link Margin ───────────────────────────────────────
        "P_required_dBW":              P_REQ,
        "link_margin_expected_dB":     round(float(np.mean(Pr_mc)) - P_REQ,    4),
        "link_margin_worst_case_dB":   round(min_Pr - P_REQ,                   4),
        "link_margin_best_case_dB":    round(max_Pr - P_REQ,                   4),
        "link_margin_median_dB":       round(float(np.median(Pr_mc)) - P_REQ,  4),
        # ── Chart data ────────────────────────────────────────
        "At_curve": {
            "theta_deg":       [round(v, 2) for v in theta_curve.tolist()],
            "At_dB":           [round(v, 4) for v in At_curve.tolist()],
            "pdf_weight":      [round(v, 8) for v in pdf_weight.tolist()],
        },
        "Pr_percentile_curve": {
            "percentile":      pct_points.tolist(),
            "Pr_dBW":          [round(v, 4) for v in pct_values.tolist()],
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# 8. EXPORT: JSON  (hierarchical, API-ready)
# ─────────────────────────────────────────────────────────────────────────────
def export_json(payload: dict, path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    print(f"   ✓ JSON written → {path}")


# ─────────────────────────────────────────────────────────────────────────────
# 9. EXPORT: CSV  (flat, one section per block of rows)
# ─────────────────────────────────────────────────────────────────────────────
def export_csv(payload: dict, path: str) -> None:
    rows: list[dict] = []

    def _flat(section: str, d: dict) -> None:
        """Flatten scalar key-value pairs into rows."""
        for k, v in d.items():
            if not isinstance(v, (dict, list)):
                rows.append({"section": section, "key": k, "value": v})

    # Simulation config
    _flat("simulation_config", payload["simulation_config"])

    # Link budget config
    _flat("link_budget_config", payload["link_budget_config"])

    # Orbital summary
    _flat("orbital_summary", payload["orbital_summary"])

    # Gamma fit (pe=1%, pe=5%)
    for rec in payload["gamma_fit"]:
        section = f"gamma_fit_pe_{rec['theta_min_deg']}deg"
        _flat(section, {k: v for k, v in rec.items()
                        if not isinstance(v, (dict, list))})

    # Contact duration summary
    _flat("contact_duration", {k: v for k, v in payload["contact_duration"].items()
                                if not isinstance(v, (dict, list))})

    # Link budget analysis (pe=1%, pe=5%)
    for rec in payload["link_budget_analysis"]:
        section = f"link_budget_{rec['exceedance_prob'].replace(' ', '_')}"
        _flat(section, {k: v for k, v in rec.items()
                        if not isinstance(v, (dict, list))})

    # Daily mean contact duration timeseries
    dm = payload["contact_duration"]["daily_mean_duration"]
    for day, mean_s, in zip(dm["day"], dm["mean_s"]):
        rows.append({"section": "daily_mean_contact_s",
                     "key": f"day_{day}", "value": mean_s})

    # A_T curve (pe=1%)
    lb1 = next(r for r in payload["link_budget_analysis"]
               if r["exceedance_prob"] == "pe=1%")
    for theta, at in zip(lb1["At_curve"]["theta_deg"],
                         lb1["At_curve"]["At_dB"]):
        rows.append({"section": "At_curve_pe1pct",
                     "key": f"theta_{theta}", "value": at})

    # Pr percentile curve (pe=1%)
    for pct, pr in zip(lb1["Pr_percentile_curve"]["percentile"],
                       lb1["Pr_percentile_curve"]["Pr_dBW"]):
        rows.append({"section": "Pr_percentile_pe1pct",
                     "key": f"pct_{pct}", "value": pr})

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["section", "key", "value"])
        writer.writeheader()
        writer.writerows(rows)

    print(f"   ✓ CSV  written → {path}  ({len(rows)} rows)")


# ─────────────────────────────────────────────────────────────────────────────
# 10. MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    print("=" * 60)
    print("  Elevation-Based Link Budget — Mock Data Generator")
    print("=" * 60)

    # ── Step 1: Orbital propagation ──────────────────────────────
    t_arr, el_arr = run_simulation()

    visible_data = el_arr[el_arr >= MIN_ELEVATION_DEG]
    print(f"   Visible samples (≥{MIN_ELEVATION_DEG}°): {len(visible_data):,}")

    # ── Step 2: Gamma fit ────────────────────────────────────────
    print("[2/4] Fitting Gamma distributions …")
    gamma_pe1 = fit_gamma(visible_data, THETA_MIN_1)
    gamma_pe5 = fit_gamma(visible_data, THETA_MIN_5)

    # ── Step 3: Contact duration ─────────────────────────────────
    contact = analyze_contact_duration(t_arr, el_arr)

    # ── Step 4: Link budget ──────────────────────────────────────
    print("[4/4] Computing link budget statistics …")
    lb_pe1 = analyze_link_budget(visible_data, THETA_MIN_1, A_COEF_1, "pe=1%")
    lb_pe5 = analyze_link_budget(visible_data, THETA_MIN_5, A_COEF_5, "pe=5%")

    # ── Assemble payload ─────────────────────────────────────────
    payload = {
        "metadata": {
            "title":       "Elevation-Based LEO Satellite Link Budget",
            "reference":   "Gongora-Torres et al., IEEE Access 2022",
            "doi":         "10.1109/ACCESS.2022.3147829",
            "generator":   "elv_link_budget.py",
        },
        "simulation_config": {
            "simulation_days":     SIMULATION_DAYS,
            "time_step_s":         TIME_STEP_S,
            "lat_es_deg":          LAT_ES_DEG,
            "lon_es_deg":          LON_ES_DEG,
            "eccentricity":        ECCENTRICITY,
            "inclination_deg":     INCLINATION_DEG,
            "altitude_km":         ALTITUDE_KM,
            "num_planes":          NUM_PLANES,
            "sats_per_plane":      SATS_PER_PLANE,
            "total_sats":          TOTAL_SATS,
            "min_elevation_deg":   MIN_ELEVATION_DEG,
            "r_earth_km":          R_EARTH_KM,
            "mu_earth_km3s2":      MU_EARTH,
            "omega_earth_rads":    OMEGA_EARTH,
        },
        "link_budget_config": {
            "EIRP_dBW":            EIRP,
            "G_R_dBi":             G_R,
            "P_req_dBW":           P_REQ,
            "theta_min_1pct_deg":  THETA_MIN_1,
            "theta_min_5pct_deg":  THETA_MIN_5,
            "mu_theta":            MU_THETA,
            "sigma_theta":         SIGMA_THETA,
            "a_coef_pe1pct":       A_COEF_1,
            "a_coef_pe5pct":       A_COEF_5,
        },
        "orbital_summary": {
            "semi_major_axis_km":      round(R_EARTH_KM + ALTITUDE_KM, 3),
            "orbital_period_min":      round(2 * np.pi / np.sqrt(MU_EARTH /
                                            (R_EARTH_KM + ALTITUDE_KM)**3) / 60, 3),
            "total_time_steps":        int(SIMULATION_DAYS * 86400 / TIME_STEP_S),
            "visible_samples":         int(len(visible_data)),
            "visibility_fraction_pct": round(len(visible_data) /
                                             (SIMULATION_DAYS * 86400 / TIME_STEP_S) * 100, 4),
        },
        "gamma_fit":          [gamma_pe1, gamma_pe5],
        "contact_duration":   contact,
        "link_budget_analysis": [lb_pe1, lb_pe5],
    }

    # ── Export ───────────────────────────────────────────────────
    print("\n[Export] Writing output files …")
    export_json(payload, "mockdata.json")
    export_csv(payload,  "mockdata.csv")

    # ── Console summary ──────────────────────────────────────────
    print("\n" + "=" * 60)
    print("  RESULTS SUMMARY")
    print("=" * 60)
    print(f"  Constellation     : {TOTAL_SATS} sats "
          f"({NUM_PLANES} planes × {SATS_PER_PLANE})")
    print(f"  Orbital period    : {payload['orbital_summary']['orbital_period_min']:.2f} min")
    print(f"  Visibility        : {payload['orbital_summary']['visibility_fraction_pct']:.2f} % of time")
    print(f"  Total passes      : {contact['total_passes']}")
    print(f"  Mean pass dur.    : {contact['mean_pass_duration_s']:.1f} s")

    for lb in [lb_pe1, lb_pe5]:
        tag = lb["exceedance_prob"]
        print(f"\n  ─── Link Budget ({tag}) ─────────────────────")
        print(f"  Min elevation      : {lb['theta_min_deg']}°")
        print(f"  Expected P_R       : {lb['Pr_expected_dBW']:.2f} dBW")
        print(f"  Worst-case P_R     : {lb['Pr_min_dBW']:.2f} dBW")
        print(f"  Best-case P_R      : {lb['Pr_max_dBW']:.2f} dBW")
        print(f"  Link margin (exp.) : {lb['link_margin_expected_dB']:.2f} dB")
        print(f"  Link margin (worst): {lb['link_margin_worst_case_dB']:.2f} dB")
        print(f"  Hotspot θ / A_T    : {lb['hotspot_theta_deg']:.1f}° / "
              f"{lb['hotspot_At_dB']:.2f} dB")

    print("\n  Done.\n")


if __name__ == "__main__":
    main()