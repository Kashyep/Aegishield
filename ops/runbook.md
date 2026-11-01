# AegisShield AI — Operations & Demo Runbook

Operator guide for AegisShield AI: clean setup, local execution, Docker containers, SAP BTP deployment, pre-demo verification, test suites, and troubleshooting.

---

## 1. Prerequisites

- **Python 3.12** (64-bit recommended) with `pip`
- **Node.js 20+** with `npm`
- **Docker** (optional, for containerized builds and smoke tests)
- **Cloud Foundry CLI (`cf` v8+)** (optional, for SAP BTP Cloud Foundry deployment)

---

## 2. Clean-Clone Setup

Clone the repository and set up backend and frontend dependencies:

```bash
# 1. Clone repository
git clone <repository-url> aegisshield
cd aegisshield

# 2. Install backend Python dependencies
python -m pip install -r backend/requirements.txt

# 3. Install frontend dependencies
cd frontend
npm ci
cd ..
```

---

## 3. Environment Configuration (`.env`)

Copy the template:

```bash
# Linux/macOS
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

### Configuration Parameters

| Variable | Default | Purpose |
|---|---|---|
| `AEGIS_LLM_MODE` | `off` | LLM execution mode: `off`, `recorded`, or `live`. Demo: `recorded` (ops/demo.ps1 default); offline drill and BTP: `off` (D-033). |
| `AEGIS_DEMO_MODE` | `1` | Enables demo reset and synthetic scenario controls (`1` or `0`). |
| `AEGIS_DB_PATH` | `work/aegis-demo.sqlite3` | SQLite database file location (`/tmp/aegis-demo.sqlite3` in cloud). |
| `AEGIS_CORS_ORIGINS` | `http://localhost:5173,...` | Comma-separated allowed browser origins for dual-server dev mode. |
| `AEGIS_FRONTEND_DIST`| `frontend/dist` | Directory of built frontend assets served at `/` by FastAPI. |
| `AEGIS_LLM_BASE_URL` | — | OpenAI-compatible endpoint URL (live mode only; no code default, set in .env, see .env.example). |
| `AEGIS_LLM_MODEL` | — | Model identifier (live mode only; no code default, set in .env, see .env.example). |
| `AEGIS_LLM_API_KEY` | — | Secret API key (live mode only). |
| `AEGIS_LLM_TIMEOUT_S` | `8` | LLM gateway timeout in seconds (default 8 s, backend/app/llm/gateway.py). |

### LLM Modes Explained

- **`off` (Recommended for Demo):** Pure deterministic rule-based template generation. Zero external network calls, zero API costs, resilient to venue Wi-Fi failure.
- **`recorded`:** Uses pre-recorded responses from test fixtures for offline reproducibility.
- **`live`:** Queries external OpenAI-compatible LLM endpoint. Requires `AEGIS_LLM_API_KEY` and a working model slug (note: `meta-llama/llama-3.3-70b-instruct:free` returned 404 on 2026-10-23).

> [!WARNING]
> **Never commit `.env` to git.** It is ignored by `.gitignore` and must never be committed because it holds private API keys and credentials.

---

## 4. Run Locally

### Option A: One-Command Demo Launcher (Recommended Demo Setup)

The primary way to start the demo is the launcher script (recorded LLM mode per docs/00 D-033; `-Offline` for the unplugged drill, DA-12):

```powershell
powershell -ExecutionPolicy Bypass -File ops/demo.ps1
```

*(For the unplugged drill or offline testing, add `-Offline`: `powershell -ExecutionPolicy Bypass -File ops/demo.ps1 -Offline`).*

Alternatively, start manually with the same-origin single server (FastAPI serves both the API at `/api/v1/*` and the built frontend at `/` on port 8000 when `frontend/dist` is built):

```powershell
# 1. Build frontend dist
cd frontend
$env:VITE_API_MODE = "live"
$env:VITE_API_BASE_URL = "/"
npm run build
cd ..

# 2. Start Uvicorn backend
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

*(On Linux/macOS bash, replace step 1 with `(cd frontend && VITE_API_MODE=live VITE_API_BASE_URL=/ npm run build)`).*

Open `http://127.0.0.1:8000/`.

### Option B: Dual-Server Local Development (Hot Reloading)

**Terminal 1 — Backend API:**
```bash
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```

**Terminal 2 — Frontend Dev Server:**
```powershell
cd frontend
$env:VITE_API_MODE = "live"
$env:VITE_API_BASE_URL = "http://localhost:8000"
npm run dev
```

Open `http://localhost:5173/`.

*(To run the frontend purely against fixture stubs without starting the backend, omit `$env:VITE_API_MODE` and run `npm run dev` directly).*

---

## 5. Docker Build & Run

The multi-stage `Dockerfile` compiles the frontend in Stage 1 and packages it with the Python 3.12 FastAPI backend in Stage 2.

```bash
# Build Docker image
docker build -t aegisshield-demo .

# Run container
docker run -d --name aegisshield -p 8000:8000 -e AEGIS_LLM_MODE=off -e AEGIS_DEMO_MODE=1 aegisshield-demo

# Smoke test container
curl -fs http://localhost:8000/api/v1/health
curl -fs http://localhost:8000/ | grep '<div id="root">'
```

---

## 6. SAP BTP Cloud Foundry Deployment

Deploys the unified application to SAP BTP Cloud Foundry trial:

- **Manifest:** `ops/btp/manifest.yml`
- **Live Deployed Route:** `https://aegisshield-demo.cfapps.ap21.hana.ondemand.com`

### Deployment Steps

```powershell
# 1. Build the frontend into frontend/dist first (.cfignore uploads frontend/dist)
cd frontend
npm ci
$env:VITE_API_MODE = "live"
$env:VITE_API_BASE_URL = "/"
npx vite build
cd ..

# 2. Push application to BTP Cloud Foundry
cf push -f ops/btp/manifest.yml

# 3. Verify health and reset demo state
curl.exe https://aegisshield-demo.cfapps.ap21.hana.ondemand.com/api/v1/health
curl.exe -X POST https://aegisshield-demo.cfapps.ap21.hana.ondemand.com/api/v1/demo/reset -H "X-Actor-Id: USR-PRIYA"
```

> [!NOTE]
> SQLite on BTP Cloud Foundry lives at `/tmp/aegis-demo.sqlite3`. It is ephemeral and resets on app restart or re-push. Always run the reset command before starting a demo.

---

## 7. Pre-Demo Checklist

Run this checklist immediately before each presentation rehearsal or live demo:

1. **Reset Demo State:**
   ```bash
   curl -X POST http://127.0.0.1:8000/api/v1/demo/reset -H "X-Actor-Id: USR-PRIYA"
   ```
   Confirm response: `"scenario_id": "SCN-DEMO-001"`, `"counters_reset": true`.

2. **Trigger Evaluation:**
   Click **Run evaluation** on the Command Center UI (or call `POST /api/v1/evaluations`: `curl -X POST http://127.0.0.1:8000/api/v1/evaluations -H "X-Actor-Id: USR-PRIYA" -H "Idempotency-Key: demo-eval-0001" -H "Content-Type: application/json" -d '{"disruption_id":"DIS-2026-0042"}'`).

3. **Verify Demo Acceptance Items (`docs/00-source-of-truth.md` §14.2):**
   - **DA-01:** Persistent `SYNTHETIC DATA` banner visible on all views.
   - **DA-02:** Command Center displays 3 orders, 6/4/2 days late, baseline loss ₹11,60,000.
   - **DA-03:** 7-step timeline auto-advances through completion.
   - **DA-04:** Plan Comparison: P1 ₹3,34,000 / ₹0 / ₹8,26,000 (BLOCKED, 2 blocking findings, "on paper"); P2 ₹4,92,000 / ₹50,000 / ₹6,18,000 (PASSED, recommended).
   - **DA-05:** Graph view on `SUP-B` highlights disruption path `Chonburi ← Kedah ← Zenith` with keyboard-accessible text alternative.
   - **DA-06:** LC finding (RT-C-SIN) displays 43T transhipment NOT ALLOWED and 47A UCP 600 20(c) exclusion, with remedy "request amendment".
   - **DA-07:** FTA finding (Colombo) displays needs review, ₹3,87,600 duty at risk at 15% (TR-0003), TR-0002 superseded, TR-0004 draft, TR-0006 lower authority.
   - **DA-08:** PLAN_BLOCKED is an API-level refusal, the UI disables Approve on blocked plans.
   - **DA-09:** Priya approves P2; repeated approval shows "already decided"; Arjun cannot re-approve.
   - **DA-10:** Execute triggers 6 simulated steps, all labelled simulated; second execute refused.
   - **DA-11:** Audit trail records decisions and executions; "Verify audit chain" returns valid.
   - **DA-12:** Network unplugged + LLM off: identical numbers and outcomes; badge reads `LLM: off (templates)`.
   - **DA-13:** Full approval flow operable via keyboard with visible focus indicators.
   - **DA-14:** Every number presented matches pitch slides.
   - **DA-15:** Second evaluation run after reset produces identical plan hashes (`VC-LLM-01`).

4. **Identical Hashes Verification (Reproducibility):**
   Reset again (`POST /api/v1/demo/reset`), re-run evaluation, and confirm the plan hash matches the previous run exactly.

5. **Offline Drill (Wi-Fi Off):**
   Disconnect Wi-Fi / ethernet. Verify the app continues to operate locally without errors or delays.

---

## 8. Verification Commands

Run all automated verification gates:

```bash
# 1. Contract & Schema Checker (integrity, schemas, goldens, hand calculations, OpenAPI)
python tools/check_contracts.py

# 2. Backend Agent, Rule, and LLM Tests
python -m pytest -q backend

# 3. API Conformance and e2e Integration Tests
python -m pytest -q tests

# 4. Frontend TypeScript Typecheck
cd frontend
npx tsc -b
cd ..

# 5. Frontend ESLint
cd frontend
npm run lint
cd ..

# 6. Playwright UI Tests (Fixture Stubs)
cd frontend
npm test
cd ..

# 7. Playwright Full-Stack Test (Live Backend + Vite)
cd frontend
npm run test:live
cd ..
```

---

## 9. Failure Drills and Recovery

### Simulated execution failure (VC-EXE-01)

Use a disposable local demo run. The injected failure is deterministic and does not call SAP or any external system.

```powershell
# Stop the normal demo server first, then start a drill instance:
$env:AEGIS_LLM_MODE = "off"
$env:AEGIS_SIMULATE_FAIL_AT_STEP = "3"
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Reset the demo, evaluate, approve P2, and execute it. The execution should show two succeeded steps, step 3 failed, and all later steps skipped; the plan status becomes `failed`, and the audit chain remains valid. No retry or compensation is performed. After the drill, stop the server and clear the injection before restarting normally:

```powershell
Remove-Item Env:AEGIS_SIMULATE_FAIL_AT_STEP -ErrorAction SilentlyContinue
powershell -ExecutionPolicy Bypass -File ops/demo.ps1
```

### Backup recording

The 1 min 51 s backup recording is `demo-backup.mp4`. As of 2026-11-01 it is kept outside Git (17 MB) and was shared by M3; keep a copy on both demo devices and the presentation USB. The intended repository staging location is `pitch/finale/demo-backup.mp4`, but that file is not present in this checkout. Use it with the deck if the live backend is unavailable; do not substitute fixture stubs for a live screen.

---

## 10. Troubleshooting

### LLM Badge Shows "Degraded" or Unexpected Mode
- The launcher (`ops/demo.ps1`) sets the mode explicitly, overriding `.env`.
- The sidebar badge should display `LLM: off (templates)`.
- If set to `live` without credentials or with an invalid model, the system degrades to templates only.
- Query `GET /api/v1/health` to inspect the reported `llm_mode`.

### Port in Use
- Port 8000 (backend), 8010 (playwright.live.config.ts backend), 5173 (frontend dev), or 4174 (Playwright live test runner):
  - **Windows PowerShell:**
    ```powershell
    Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object OwningProcess
    Stop-Process -Id <PID> -Force
    ```
  - **Linux/macOS:**
    ```bash
    lsof -ti :8000 | xargs kill -9
    ```
  - Alternatively, pass a different port to uvicorn (`--port 8001`) and update `VITE_API_BASE_URL`.

### Stale Database State (`work/aegis-demo.sqlite3`)
- If previous test runs or manual actions left residual decisions or executions in SQLite:
  - Reset via API:
    ```bash
    curl -X POST http://127.0.0.1:8000/api/v1/demo/reset -H "X-Actor-Id: USR-PRIYA"
    ```
  - Or stop uvicorn and delete the SQLite database file:
    ```powershell
    Remove-Item work/aegis-demo.sqlite3
    ```
    The server will re-initialize a clean database from fixtures on next startup.
