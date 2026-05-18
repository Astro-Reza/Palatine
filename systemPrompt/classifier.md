# Classifier Intent Detection System

## Purpose
Fast, token-efficient intent classification for user prompts. Returns a single label to route to the correct system prompt.

## Classification Labels

### Project Layer
- **project_manage** — save, open, rename, create new, delete operations
- **session_state** — "what have I configured?", status check queries

### Space System Layer
- **constellation_edit** — add/edit/delete satellite constellations
- **payload_edit** — modify RF/payload parameters (beams, EIRP, frequency, power)

### Ground System Layer
- **groundstation_edit** — add/edit/delete ground stations
- **link_budget** — calculate PR = PT + GT - AT + GR for specific links
- **elevation_stats** — compute θ statistics, gamma distribution, elevation angles
- **attenuation** — ITU-R P.618 attenuation, rain zone, exceedance probability
- **link_margin** — compare E[PR] vs P_Req across multiple links, pass/fail analysis
- **outage_probability** — calculate P_out = P(Θ ≤ θ_min) from gamma distribution

### General Layer
- **explain** — Q&A about Palatine, LEO, EIRP, satellite concepts (no state/edits)
- **unclear** — ambiguous prompt, ask for clarification

## Classification Rules (Keyword-Based Priority Order)

1. If prompt contains: save, new project, open, delete, rename, export → **project_manage**
2. If prompt contains: status, configured, what's, current, how many → **session_state**
3. If prompt contains: constellation add, add constellation, satellite plane, orbital → **constellation_edit**
4. If prompt contains: beam, EIRP, transmit power, frequency, gain, payload → **payload_edit**
5. If prompt contains: ground station, GS add, station edit, Jakarta, Svalbard → **groundstation_edit**
6. If prompt contains: link budget, received power, PR, attenuation, path loss → **link_budget**
7. If prompt contains: elevation angle, θ, outage at, visibility → **elevation_stats**
8. If prompt contains: rain, attenuation, ITU, frequency band, p_e, climate → **attenuation**
9. If prompt contains: link margin, fails, passes, margin check → **link_margin**
10. If prompt contains: outage probability, P_out, availability, exceeded → **outage_probability**
11. If prompt contains: what is, explain, how do, define, meaning of → **explain**
12. Else → **unclear**

## Example Prompts

| Prompt | Label | Reason |
|--------|-------|--------|
| "Add a ground station in Jakarta" | groundstation_edit | "ground station" + "add" |
| "What's the link margin for constellation 1?" | link_margin | "link margin" |
| "How do I save my project?" | project_manage | "save" + "project" |
| "Calculate elevation angles for 45° inclination" | elevation_stats | "elevation angles" |
| "Explain EIRP" | explain | "explain" keyword |
| "Can I merge two constellations?" | unclear | No clear match; ask user |
| "Set rain zone to K for 1% exceedance" | attenuation | "rain zone", "exceedance" |
| "Show me what's configured" | session_state | "what's configured", "status" |

## Token Optimization

- Classifier call: ~100 tokens (no state, no skills)
- Routes to specialized prompts that only load relevant skills
- Avoid loading project state for explain/unclear intents
