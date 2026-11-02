# SAP BTP Deployment Checklist & Runbook

This guide details the deployment and operational verification procedure for AegisShield on SAP BTP Cloud Foundry (trial or production).
It is written for operators deploying from either Windows (PowerShell) or Linux/macOS (bash).

---

## 1. Placeholders Used in This Document

- `<APP>`: Cloud Foundry application name defined in `ops/btp/manifest.yml` (default: `aegisshield-demo`).
- `<APP-ROUTE>`: Public hostname of the deployed app (e.g. `<APP>.cfapps.<REGION>.hana.ondemand.com`).
- `<REGION>`: Cloud Foundry API region (e.g. `ap21`, `eu10`, `us10`).
- `<ORG>`: Your SAP BTP Cloud Foundry organization.
- `<SPACE>`: Your SAP BTP Cloud Foundry space.

*Note: Never commit real credentials, organisation names, space names, or secret tokens.*

---

## 2. Prerequisites

Verify installed tools on your local operator workstation:

- **Git**: `git --version`
- **Node.js 20+**: `node -v` (and `npm -v`)
- **Python 3.12**: `python --version` (or `python3 --version`)
- **Cloud Foundry CLI v8**: `cf version`
- Active SAP BTP trial or enterprise account with Cloud Foundry space enabled.

---

## 3. Deployment Steps

Run all commands from the repository root unless stated otherwise.

### Step 1: Fetch and Checkout Target Branch

**PowerShell (Windows):**
```powershell
git fetch origin
git checkout fix/handoff-p1
git pull origin fix/handoff-p1
```

**Bash (Linux / macOS):**
```bash
git fetch origin
git checkout fix/handoff-p1
git pull origin fix/handoff-p1
```
*(Alternatively, check out the merged `main` branch or release tag as appropriate).*

---

### Step 2: Build the Frontend

Build the React frontend with live API configuration pointing to the same-origin backend (`/`).

**PowerShell (Windows):**
```powershell
cd frontend; npm ci; $env:VITE_API_MODE='live'; $env:VITE_API_BASE_URL='/'; npm run build; cd ..
```

**Bash (Linux / macOS):**
```bash
cd frontend && npm ci && VITE_API_MODE='live' VITE_API_BASE_URL='/' npm run build && cd ..
```

---

### Step 3: Verify Frontend Build Output

Confirm that `frontend/dist/index.html` was created and is non-empty before deploying.

**PowerShell (Windows):**
```powershell
Test-Path frontend/dist/index.html
# Must output: True
```

**Bash (Linux / macOS):**
```bash
test -f frontend/dist/index.html && echo "OK: frontend/dist/index.html exists" || echo "FAIL: missing dist/index.html"
# Must output: OK: frontend/dist/index.html exists
```

---

### Step 4: Authenticate to Cloud Foundry

Log in interactively to SAP BTP Cloud Foundry:

**PowerShell or Bash:**
```bash
cf login -a https://api.cf.<REGION>.hana.ondemand.com -o <ORG> -s <SPACE>
# Or run bare `cf login` for an interactive prompt
```

---

### Step 5: Push Application to BTP

Deploy the combined backend and static frontend using the BTP manifest:

**PowerShell or Bash:**
```bash
cf push -f ops/btp/manifest.yml
```

---

### Step 6: Configure Environment Variables

1. Set `AEGIS_LLM_MODE` to `off` (uses synthetic offline templates).
2. (Optional) Set `AEGIS_RESET_TOKEN` to protect the demo reset endpoint from unauthorized web clicks.

**PowerShell (Windows):**
```powershell
# Set LLM mode
cf set-env <APP> AEGIS_LLM_MODE off

# Optional: Generate a random 32-character token and set AEGIS_RESET_TOKEN
$resetToken = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
cf set-env <APP> AEGIS_RESET_TOKEN $resetToken
```

**Bash (Linux / macOS):**
```bash
# Set LLM mode
cf set-env <APP> AEGIS_LLM_MODE off

# Optional: Generate a random 24-byte hex token and set AEGIS_RESET_TOKEN
RESET_TOKEN=$(openssl rand -hex 24)
cf set-env <APP> AEGIS_RESET_TOKEN "$RESET_TOKEN"
```

---

### Step 7: Restage Application

Apply the environment configuration by restaging:

**PowerShell or Bash:**
```bash
cf restage <APP>
```

> **Important Note on Storage**:
> SQLite is located at `/tmp/aegis-demo.sqlite3` on Cloud Foundry ephemeral container storage.
> Container restaging or restarting wipes the `/tmp` volume and automatically provisions a fresh database on startup.

---

### Step 8: Run Smoke Tests

Verify the deployment using the automated smoke suite.

**PowerShell (Windows):**
```powershell
# If AEGIS_RESET_TOKEN is not configured:
python ops/smoke.py https://<APP-ROUTE>

# If AEGIS_RESET_TOKEN was configured:
python ops/smoke.py https://<APP-ROUTE> --reset-token $resetToken
```

**Bash (Linux / macOS):**
```bash
# If AEGIS_RESET_TOKEN is not configured:
python ops/smoke.py https://<APP-ROUTE>

# If AEGIS_RESET_TOKEN was configured:
python ops/smoke.py https://<APP-ROUTE> --reset-token "$RESET_TOKEN"
```

Expected output:
```
PASS health (llm_mode=off, demo_mode=True, contract_version=1.0.0)
PASS scenario
PASS reset
PASS evaluation
PASS comparison
PASS approve
PASS execute
PASS audit verify
```
Exit code will be `0` when all checks succeed.

---

## 4. Resetting Demo State

When `AEGIS_RESET_TOKEN` is configured on BTP, clicking the in-app **"Reset demo"** button in the web UI will intentionally return HTTP 403 (`RESET_TOKEN_INVALID`).
This prevents spectators or unintentional clicks from disrupting an active presentation.

To reset demo state, operators must use `ops/smoke.py` or run a direct HTTP POST with the `X-Reset-Token` header:

**PowerShell (Windows):**
```powershell
Invoke-RestMethod -Uri "https://<APP-ROUTE>/api/v1/demo/reset" -Method Post -Headers @{ "X-Actor-Id" = "USR-PRIYA"; "X-Reset-Token" = $resetToken }
```

**Bash (Linux / macOS):**
```bash
curl -s -X POST "https://<APP-ROUTE>/api/v1/demo/reset" -H "X-Actor-Id: USR-PRIYA" -H "X-Reset-Token: $RESET_TOKEN"
```

*(If `AEGIS_RESET_TOKEN` is not set, the `X-Reset-Token` header can be omitted, and the UI button functions normally).*

---

## 5. Pre-Pitch / Demo Verification Checklist

Execute these 4 verification steps 15 minutes before the live pitch:

1. **Initial Reset**:
   Execute a demo reset via `Invoke-RestMethod` or `curl` (see Section 4).
2. **Health Check**:
   Open `https://<APP-ROUTE>/api/v1/health` in a browser or curl. Verify:
   - `status: "ok"`
   - `llm_mode: "off"`
   - `demo_mode: true`
   Open `https://<APP-ROUTE>/` and check the sidebar footer badge displays: `LLM: off (templates)`.
3. **Run Smoke Test**:
   Execute `python ops/smoke.py https://<APP-ROUTE> [--reset-token <TOKEN>]` once to ensure all subsystems (evaluations, rules, executions, audit chain) respond cleanly on the target route.
4. **Final Demo Reset**:
   Run the reset command one more time immediately prior to handing the screen to the presenter so the presentation begins with empty counters and undisturbed baseline state.

---

## 6. Rollback Procedure

If unexpected regressions occur after a deployment:

### Option A: Cloud Foundry Revision Rollback (if enabled)
```bash
cf rollback <APP>
```

### Option B: Redeploy Previous Known-Good Commit (`main@9778612`)

`ops/smoke.py` does not exist at `9778612`, so verify with a plain health check instead. That commit also has no reset-token guard: `AEGIS_RESET_TOKEN` is ignored and any demo actor can reset.

**PowerShell (Windows):**
```powershell
git checkout 9778612
cd frontend; npm ci; $env:VITE_API_MODE='live'; $env:VITE_API_BASE_URL='/'; npm run build; cd ..
cf push -f ops/btp/manifest.yml
Invoke-RestMethod -Uri "https://<APP-ROUTE>/api/v1/health"
```

**Bash (Linux / macOS):**
```bash
git checkout 9778612
cd frontend && npm ci && VITE_API_MODE='live' VITE_API_BASE_URL='/' npm run build && cd ..
cf push -f ops/btp/manifest.yml
curl -fsS "https://<APP-ROUTE>/api/v1/health"
```
