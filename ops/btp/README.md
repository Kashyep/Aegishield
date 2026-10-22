# SAP BTP Cloud Foundry deployment (demo)

Hosts the API and the built frontend as **one** Cloud Foundry app on the SAP BTP trial, at the same origin.
OD-01 default (a); it stays provisional until Member 5 confirms D-021.
Not yet deployed: there is no BTP account in this repo and these steps have not been run against BTP.
The same artefacts are verified locally (see "Local check").

## Prerequisites
- SAP BTP trial account with a Cloud Foundry environment and space (the trial includes CF runtime memory).
- `cf` CLI v8: `cf login -a https://api.cf.<region>.hana.ondemand.com` (the region is shown in the BTP cockpit).
- Node 20+ and Python 3.12 locally.

## Deploy
```powershell
# 1. Build the frontend for same-origin live API calls
cd frontend; npm ci; $env:VITE_API_MODE='live'; $env:VITE_API_BASE_URL='/'; npx vite build; cd ..
# 2. Push (the python buildpack installs requirements.txt -> backend/requirements.txt; runtime.txt pins Python 3.12)
cf push -f ops/btp/manifest.yml
# 3. Verify, then reset before each demo
curl.exe https://<app-route>/api/v1/health
curl.exe -X POST https://<app-route>/api/v1/demo/reset -H "X-Actor-Id: USR-PRIYA"
```
Open `https://<app-route>/`. The sidebar badge must read `LLM: off (templates)`.

## Notes
- SQLite lives in `/tmp`: it is ephemeral and lost on restart or re-push. Reset before every demo.
- No secrets are needed in off mode. For OD-04 live mode, use `cf set-env aegisshield-demo AEGIS_LLM_API_KEY ...`; never put keys in the manifest.
- `.cfignore` excludes node_modules, work/ and .git, but uploads `frontend/dist`.
- Synthetic data only. Actor identity is simulated by `X-Actor-Id`, and there is no authentication.

## Local check (same artefacts, no BTP)
```powershell
cd frontend; $env:VITE_API_MODE='live'; $env:VITE_API_BASE_URL='/'; npx vite build; cd ..
python -m uvicorn backend.app.main:app --port 8000   # open http://127.0.0.1:8000/
```
