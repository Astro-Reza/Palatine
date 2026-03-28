Below is the list for future update.

# Orbit Analysis

## Live Satellite TLE Data Integration

The purpose of integrating system with live satellite TLE data is to get the real-time position of the satellite and visualize it in the 3D globe. The actual data give a detailed analysis about traffic, coverage, and other parameters that can be used to optimize the satellite constellation.

## Coverage & Revisit Time Analysis

This feature is used to analyze the coverage and revisit time of the satellite constellation. The coverage is the area that can be covered by the satellite constellation, and the revisit time is the time it takes for the satellite constellation to revisit the same area. The results of the analysys is maps the instantaneous field of view (FoV).

## Global Coverage Mapping

Calculates what percentage of the Earth (or a specific region) the satellite cover a 24-hour or weekly period. From there, we can get a revisit interval that determines the maximum and average time elapsed between successive passes over the same ground target.

# System Adjusment

## Session Management

Each session will have its own parameters and settings. The session will be saved in the database and can be accessed later. Each session has the list of available constellations, ground stations, and simulation parameters. Each session also saves its analysis results e.g. coverage map, revisit time, monte carlo simulation results etc.