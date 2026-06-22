# TowerMind — Setup Guide

## Prerequisites

- **Python 3.10+** (3.12 recommended) — [download](https://www.python.org/downloads/)
- **Git** — [download](https://git-scm.com/)
- **VS Code** with the **Live Server** extension (for the root `index.html` page)
- A modern browser (Chrome or Edge recommended)

---

## Step 1 — Clone the repository

```bash
git clone https://github.com/Wx926/TowerMind.git
cd TowerMind
```

---

## Step 2 — Create and activate a virtual environment

```bash
cd backend

# Create venv
python -m venv venv

# Activate — Windows
venv\Scripts\activate

# Activate — macOS / Linux
source venv/bin/activate
```

Your terminal prompt should now show `(venv)`.

---

## Step 3 — Install dependencies

```bash
pip install -r requirements.txt
```

---

## Step 4 — Configure environment variables

Create a `.env` file inside the `backend/` folder:

```bash
# backend/.env
FLASK_PORT=5000
DATABASE_URL=sqlite:///data/tower_mind.db
GEMINI_API_KEY=          # Leave blank to use built-in Digital Twin fallback
```

> **Gemini API key** is optional. Without it, the AI Simulator uses the built-in rule-based Digital Twin engine which still generates realistic scenarios using your actual building data. Get a free key at [aistudio.google.com](https://aistudio.google.com).

---

## Step 5 — Initialise and seed the database

```bash
# Still inside backend/ with venv active
python data/init_db.py
```

This creates `backend/data/tower_mind.db` and seeds it with:
- 30 days of electricity + water readings (hourly, per floor)
- Bookings and occupancy records
- Anomaly detections
- Optimization recommendations
- 6 months of KPI history (efficiency scores, carbon, cost reduction)

---

## Step 6 — Start the backend

```bash
python app.py
```

You should see:
```
* Running on http://127.0.0.1:5000
```

Keep this terminal open. The API must be running for the frontend to load real data.

---

## Step 7 — Open the frontend

There are **two frontend pages**:

### Option A — Flask-served dashboard (port 5000)
Just open your browser at:
```
http://localhost:5000
```
This serves `frontend/index.html` directly from Flask.

### Option B — Full landing page with Floor Plan (port 5500)
1. Open the project in **VS Code**
2. Right-click `index.html` (root level, not inside `frontend/`) → **Open with Live Server**
3. Browser opens at `http://localhost:5500/index.html`

> Both pages connect to the same Flask backend at port 5000. Both can run simultaneously.

---

## Verify everything is working

Open browser DevTools → Console. You should see no red errors. The KPI cards should populate within 1–2 seconds.

Check the API directly:
```
http://localhost:5000/api/health          → {"status": "ok"}
http://localhost:5000/api/resources/summary
http://localhost:5000/api/kpi/current
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `ModuleNotFoundError` | Run `pip install -r requirements.txt` with venv active |
| `Address already in use` on port 5000 | Kill the other process: `netstat -ano \| findstr :5000` then `taskkill /PID <pid> /F` |
| KPI cards show `—` dashes | Backend not running — start `python app.py` first |
| Simulator returns nothing | Check Console for `HTTP 500` — usually missing `GEMINI_API_KEY` (fallback should still work) |
| Floor plan images missing | Make sure `assets/floor1.png` through `floor8.png` exist in the root `assets/` folder |
| CORS errors in console | Ensure you're on `localhost:5000` or `localhost:5500` — other ports are blocked by default |
| `venv\Scripts\activate` fails on Windows | Run PowerShell as Administrator and execute: `Set-ExecutionPolicy RemoteSigned` |

---

## Resetting the database

If data looks stale or broken, re-seed:

```bash
cd backend
python data/init_db.py
```

This drops and recreates all tables with fresh data.
