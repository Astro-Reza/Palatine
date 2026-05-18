# Palatine AI System Prompts — Complete Index

This directory contains the full system prompt suite for the Palatine satellite mission planning platform. Each prompt is specialized for a specific domain and routed by the classifier.

## File Structure

```
systemPrompt/
├── classifier.md                 ← START HERE: Intent detection
├── projectManager.md             ← Project CRUD operations
├── sessionExplainer.md           ← Status queries (read-only)
├── constellationEditor.md        ← Constellation add/edit/delete
├── payloadEditor.md              ← RF/payload parameters
├── linkBudgetCalculator.md       ← P_R = PT + GT - AT + GR
├── elevationAnalyst.md           ← θ statistics, gamma distribution
├── attenuationAdvisor.md         ← ITU-R P.618 rain/atmospheric
├── linkMarginAnalyst.md          ← Full link matrix analysis
├── outageReporter.md             ← P_out probability, availability
├── platformExplainer.md          ← Q&A chatbot (read-only)
├── errorHandler.md               ← Ambiguous/unclear prompts
│
├── groundSystem/
│   └── groundStationEditor.md    ← Ground station CRUD
├── spaceSystem/
│   └── constellation.md          ← (Legacy/reference)
└── economicAnalysis/
    └── CapexOpex.md              ← (Future: cost modeling)
```

## Classification Flow

```
User Prompt
    │
    ▼
[/api/ai/classify] ← Calls classifier.md
    │ Returns one label
    │
    ├─→ project_manage      → projectManager.md
    ├─→ session_state       → sessionExplainer.md
    ├─→ constellation_edit  → constellationEditor.md
    ├─→ payload_edit        → payloadEditor.md
    ├─→ groundstation_edit  → groundSystem/groundStationEditor.md
    ├─→ link_budget         → linkBudgetCalculator.md + skill files
    ├─→ elevation_stats     → elevationAnalyst.md + skill files
    ├─→ attenuation         → attenuationAdvisor.md + skill files
    ├─→ link_margin         → linkMarginAnalyst.md + skill files
    ├─→ outage_probability  → outageReporter.md + skill files
    ├─→ explain             → platformExplainer.md (no skills)
    └─→ unclear             → errorHandler.md (no skills)
```

## Prompt Categories

### Project Layer (No Domain Knowledge)
| Prompt | Purpose | Modifies YAML? | Needs Skills? |
|--------|---------|---|---|
| **classifier.md** | Intent routing | No | No |
| **projectManager.md** | Create/save/delete projects | Yes | No |
| **sessionExplainer.md** | Status queries | No | No |

### Space System Layer (Constellation Design)
| Prompt | Purpose | Modifies YAML? | Needs Skills? |
|--------|---------|---|---|
| **constellationEditor.md** | Add/edit/delete constellations | Yes | No |
| **payloadEditor.md** | Modify EIRP, frequency, beams | Yes | No |

### Ground System Layer (Ground Station Design & Analysis)
| Prompt | Purpose | Modifies YAML? | Needs Skills? |
|--------|---------|---|---|
| **groundStationEditor.md** | Add/edit/delete ground stations | Yes | No |
| **linkBudgetCalculator.md** | Calculate P_R vs P_Req | No | Yes (link_budget.md) |
| **elevationAnalyst.md** | Compute θ stats, Gamma fit | No | Yes (elevation_angle.md) |
| **attenuationAdvisor.md** | ITU-R rain/attenuation model | No | Yes (attenuation.py) |

### Analysis Layer (Cross-Domain)
| Prompt | Purpose | Modifies YAML? | Needs Skills? |
|--------|---------|---|---|
| **linkMarginAnalyst.md** | Full link matrix (all pairs) | No | Yes (multiple) |
| **outageReporter.md** | P_out availability analysis | No | Yes (multiple) |

### General Layer (No Domain Specifics)
| Prompt | Purpose | Modifies YAML? | Needs Skills? |
|--------|---------|---|---|
| **platformExplainer.md** | Q&A, platform concepts | No | No |
| **errorHandler.md** | Ambiguous/unclear intents | No | No |

## Skill Files (Not Yet Created)

These should be placed in a `skills/` directory and auto-loaded when prompts need them:

```
skills/
├── link_budget.md            ← Eq. 8, FSPL, attenuation
├── elevation_angle.md        ← Gamma distribution, θ stats
├── attenuation.py            ← ITU-R P.618 reference, rain zones
├── ground_station.md         ← Parameter reference, G/T calculation
└── README.md                 ← Index of skills
```

## Token Budget Strategy

### Low-Token Prompts (Always OK)
- **classifier.md** — ~200 tokens (no state, no skills)
- **projectManager.md** — ~400 tokens (state only, no skills)
- **sessionExplainer.md** — ~500 tokens (state only, read-only)
- **platformExplainer.md** — ~600 tokens (no state, no skills)
- **errorHandler.md** — ~300 tokens (minimal state, no skills)

### Medium-Token Prompts (Careful)
- **constellationEditor.md** — ~600 tokens (state + schema)
- **payloadEditor.md** — ~700 tokens (state + schema)
- **groundStationEditor.md** — ~900 tokens (state + full schema)

### High-Token Prompts (Load Skills Selectively)
- **linkBudgetCalculator.md** + link_budget.md — ~1200 tokens
- **elevationAnalyst.md** + elevation_angle.md — ~1400 tokens
- **attenuationAdvisor.md** + attenuation.py — ~1500 tokens
- **linkMarginAnalyst.md** + both skills — ~1800 tokens
- **outageReporter.md** + multiple skills — ~1600 tokens

**Total Gemma API call:** ~100–200 tokens for classifier, then ~500–1800 for routing prompt. Typical session: 2–5 API calls = 1000–3000 tokens total. Well within typical usage limits.

## Integration with Backend (Flask)

```python
# In app.py
SYSTEM_PROMPTS = {
    "classifier":          "systemPrompt/classifier.md",
    "project_manage":      "systemPrompt/projectManager.md",
    "session_state":       "systemPrompt/sessionExplainer.md",
    "constellation_edit":  "systemPrompt/constellationEditor.md",
    "payload_edit":        "systemPrompt/payloadEditor.md",
    "groundstation_edit":  "systemPrompt/groundSystem/groundStationEditor.md",
    "link_budget":         "systemPrompt/linkBudgetCalculator.md",
    "elevation_stats":     "systemPrompt/elevationAnalyst.md",
    "attenuation":         "systemPrompt/attenuationAdvisor.md",
    "link_margin":         "systemPrompt/linkMarginAnalyst.md",
    "outage_probability":  "systemPrompt/outageReporter.md",
    "explain":             "systemPrompt/platformExplainer.md",
    "unclear":             "systemPrompt/errorHandler.md",
}

# Load prompt by intent label
def get_system_prompt(intent: str) -> str:
    filepath = SYSTEM_PROMPTS.get(intent, "systemPrompt/errorHandler.md")
    with open(filepath, 'r') as f:
        return f.read()

# Call Gemma with routed prompt
@app.route('/api/ai/prompt', methods=['POST'])
def ai_prompt():
    data = request.json
    user_prompt = data.get('prompt', '')
    intent = data.get('intent', 'unclear')  # From classifier
    
    system_prompt = get_system_prompt(intent)
    # Build full context and call Gemma...
```

## Usage Examples

### Example 1: User adds a ground station
```
User: "Add a ground station in Jakarta"

Flow:
  1. Classify: "groundstation_edit"
  2. Load: groundSystem/groundStationEditor.md
  3. Call Gemma with current project state + prompt
  4. Gemma returns updated ground_stations[] entry
  5. Backend validates + saves YAML
  6. Frontend re-renders
```

### Example 2: User asks about link margin
```
User: "What's the link margin for my Jakarta-GlobalNet link?"

Flow:
  1. Classify: "link_margin"
  2. Load: linkMarginAnalyst.md + link_budget.md skill
  3. Call Gemma with full project state
  4. Gemma computes all link pairs, returns matrix
  5. Backend extracts Jakarta-GlobalNet pair
  6. Frontend displays result
```

### Example 3: User asks a question
```
User: "What does EIRP mean?"

Flow:
  1. Classify: "explain"
  2. Load: platformExplainer.md (no skills, no project state)
  3. Call Gemma (cheap call, ~200 tokens)
  4. Gemma returns explanation
  5. Display answer
```

## Testing the System Prompts

Each prompt should be tested with:
1. **Valid input** — expected behavior
2. **Edge cases** — missing fields, invalid values
3. **Malformed input** — user typos, ambiguous requests

Example test for constellationEditor.md:
```
Input: "Add a constellation with 51.6° inclination, 2 planes, 40 satellites each"
Expected: Valid YAML constellation entry with all fields populated and defaults filled

Input: "Add a constellation with 91° inclination"
Expected: Error or clarification request (invalid: >90°)

Input: "Modify Constellation-1"
Expected: Clarification (which field? what value?)
```

## Future Enhancements

- [ ] **Vector DB for skill files** — Semantic search instead of keyword matching
- [ ] **Caching** — Load skill files once at startup into memory
- [ ] **Cost modeling** — Integrate economicAnalysis prompts
- [ ] **ISL analysis** — Add inter-satellite link evaluation
- [ ] **Monte Carlo** — Detailed outage simulations beyond Gamma
- [ ] **Export templates** — Generate mission concept docs, TRs, budget sheets
