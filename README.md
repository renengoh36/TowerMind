# TowerMind — Autonomous Sustainability Building AI

> *"Every kilowatt, every drop of water, used where it matters most."*

TowerMind is a full-stack AI system that monitors, predicts, and optimises a smart office building's energy, water, occupancy, carbon emissions, and cost — all in real time.

Built for **ImagineHack 2026 · Track 3** by **XENITH**.

---

## Live Pages

| Page | URL | Description |
|---|---|---|
| Main Landing (wx version) | `http://localhost:5500/index.html` | Full page with Floor Plan, Volt Buddy, Simulator |
| Dashboard (Flask served) | `http://localhost:5000/` | Original dashboard with backend status dot |

---

## Features

### 1. Real-Time Resource Dashboard
Live KPI cards for **Energy (kWh)**, **Water (L)**, **Occupancy (%)**, **Carbon (kg CO₂e)**, and **Monthly Cost (RM)** — all fetched from the backend on load.

### 2. Volt Buddy — AI Efficiency Mascot
Animated mascot showing the building's current efficiency score. Switch between **Current**, **3 Months**, and **1 Year** views — each fetches real historical KPI averages from the API.

### 3. Interactive Floor Plan
8-floor building map with clickable zone hotspots. Each floor card badge (**Normal / Warning / Overload**) is derived from the worst zone on that floor. Clicking a zone shows live energy, water, occupancy, cost, and an AI recommendation.

### 4. AI Forecast & Driver Analysis
Predicts next month's energy bill, expected kWh demand, and budget risk. Includes a 30-day confidence band chart showing weekly demand cycles.

### 5. Anomalies & Optimization Recommendations
Deduped anomaly cards (by floor + type) with **Acknowledge** action. Up to 3 high-impact recommendation cards with **Implement** action. Both fade out on action.

### 6. Space Consolidation Scheduler
Calls the `/api/scheduler/consolidation` and `/api/scheduler/logistics` endpoints to surface underused floors and logistics savings — displayed as insight cards in the alerts section.

### 7. AI Sustainability Simulation Engine
Smart question-type detection routes queries to the right handler:
- **Strategy questions** → Gemini AI (or Digital Twin fallback) generates Scenarios A/B/C with savings, carbon reduction, effort, comfort score, and timeline
- **Forecast questions** → Pulls real `/api/forecast/next-month` data and shows a direct RM answer
- **Summary questions** → Pulls live resource summary (kWh, L, occupancy, carbon, cost)
- **Invalid queries** → Shows a helpful prompt instead of generating fake scenarios

Risk Assessment labels adapt to the question topic (HVAC, water, carbon, renewable, occupancy, energy).

### 8. Smart Building Intelligence Features
Static feature showcase with background image, resource monitoring, AI forecasting, anomaly detection, and simulation engine descriptions.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12 · Flask · SQLAlchemy · SQLite |
| AI | Google Gemini API (with rule-based Digital Twin fallback) |
| Frontend | Vanilla HTML · CSS · JavaScript (no framework) |
| Charts | Apache ECharts 5 |
| CORS | flask-cors |

---

## Project Structure

```
TowerMind/
├── backend/
│   ├── app.py                 # Flask entry point
│   ├── config.py              # CORS, DB, port config
│   ├── models.py              # SQLAlchemy models
│   ├── routes/                # API blueprints
│   │   ├── resources.py       # /api/resources/*
│   │   ├── kpi.py             # /api/kpi/*
│   │   ├── forecast.py        # /api/forecast/*
│   │   ├── anomalies.py       # /api/anomalies/*
│   │   ├── recommendations.py # /api/recommendations/*
│   │   ├── simulation.py      # /api/simulation/*
│   │   └── scheduler.py       # /api/scheduler/*
│   ├── services/              # Business logic
│   │   ├── simulation_engine.py
│   │   └── scheduler_engine.py
│   └── data/
│       └── init_db.py         # Seeds 30 days of mock data
├── frontend/                  # Flask-served dashboard (port 5000)
│   ├── index.html
│   ├── css/style.css
│   └── js/main.js
├── css/style.css              # Root page styles
├── js/
│   ├── main.js                # Root page — all API calls + simulator
│   ├── floorplan.js           # Floor plan interactive map
│   └── voltbuddy.js           # Volt Buddy mascot
├── index.html                 # Root landing page (port 5500)
└── assets/                    # Images, floor plan PNGs
```

---

## Key API Endpoints

| Method | Endpoint | Returns |
|---|---|---|
| GET | `/api/resources/summary` | Today's electricity + water (value, trend_pct, cost) |
| GET | `/api/resources/trend?days=7&resource_type=electricity` | 7-day daily kWh array |
| GET | `/api/resources/by-floor?resource_type=electricity` | Per-floor energy (last 24h) |
| GET | `/api/kpi/current` | Latest efficiency_score, occupancy, carbon, cost_reduction |
| GET | `/api/kpi/history?months=3` | Monthly KPI history array |
| GET | `/api/forecast/next-month` | Projected cost, growth %, drivers, budget risk |
| GET | `/api/forecast/trend?days=30` | 30-day forecast with high/low confidence band |
| GET | `/api/anomalies?limit=50&status=pending` | Active anomaly list |
| GET | `/api/recommendations?limit=3` | Top recommendations with savings + carbon impact |
| POST | `/api/simulation/generate` | Gemini AI scenario generation |
| POST | `/api/simulation/fallback` | Digital Twin rule-based scenarios |
| GET | `/api/scheduler/consolidation` | Underused floors + consolidation savings |
| GET | `/api/scheduler/logistics` | Logistics optimisation + delivery savings |

---

## Team — XENITH

| Name | Role |
|---|---|
| Tan Jia Min | Team Member |
| Ngoh Jia Ying | Team Member |
| Koo Wee Xuan | Team Member |
| Yen Han Soon | Team Member |

- **ImagineHack 2026 · Track 3 (DoubleDot — Smarter Resource Management)**

---

## Challenge & Approach

**Challenge:** Businesses and communities struggle with inefficient use of electricity, water, and building space — leading to unnecessary waste and rising operating costs.

**Approach:** TowerMind addresses this with a full-stack AI web application that:
1. **Monitors** real-time resource usage (electricity, water, occupancy, carbon, cost) across 8 building floors
2. **Forecasts** next month's energy bill using historical trends and AI driver analysis
3. **Detects** anomalies (energy spikes, water leaks, after-hours activity) and recommends corrective actions
4. **Simulates** sustainability strategies via Google Gemini AI before implementation — giving teams confidence in their decisions before spending money

The system uses a Python Flask backend with a SQLite database seeded with 30 days of realistic building data, served to a fully custom vanilla JS + CSS frontend with no UI frameworks.

---

## AI Tools Used

As required by ImagineHack 2026 rules, all AI tool usage is disclosed below:

| AI Tool | Usage |
|---|---|
| **Google Gemini API** | Powers the AI Sustainability Simulation Engine (`/api/simulation/generate`) — generates three strategy scenarios (A/B/C) with savings, carbon reduction, effort score, and implementation timeline |
| **Claude (Anthropic)** | Code assistance for frontend JavaScript logic (simulator routing, floor plan hotspot system, Volt Buddy mascot animation), CSS layout, and README/SETUP documentation |

---

## Quick Start

See [SETUP.md](SETUP.md) for full instructions.

```bash
# 1. Start backend
cd backend
venv\Scripts\activate        # Windows
python app.py                # Runs at http://localhost:5000

# 2. Open frontend
# Option A — Flask built-in (port 5000):
open http://localhost:5000

# Option B — VS Code Live Server (port 5500):
# Right-click index.html → Open with Live Server
```
