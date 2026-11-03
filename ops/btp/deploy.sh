#!/usr/bin/env bash
# Build the frontend in LIVE mode, verify the bundle, push to SAP BTP Cloud Foundry, smoke-test.
# Run from anywhere after `cf login`. Usage:
#   ops/btp/deploy.sh                 # keeps the manifest's AEGIS_LLM_MODE (off)
#   AEGIS_LLM_MODE=live ops/btp/deploy.sh   # re-applies live LLM mode after the push
# The LLM key/base URL/model are set once with `cf set-env` and survive pushes; never put them here.
set -euo pipefail

APP=aegisshield-demo
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

cf target >/dev/null || { echo "Not logged in: run cf login first" >&2; exit 1; }

# 1. Build in live mode. Without VITE_API_MODE=live the UI silently uses /stubs/*.json.
rm -rf frontend/dist
(cd frontend && npm ci && VITE_API_MODE=live VITE_API_BASE_URL=/ npm run build)

# 2. Refuse to deploy a stub-mode bundle.
if ! command grep -qE 'VITE_API_MODE:"live"' frontend/dist/assets/index-*.js; then
  echo "ABORT: frontend/dist is not a live-mode build (VITE_API_MODE:\"live\" missing)" >&2
  exit 1
fi
echo "OK: live-mode bundle built"

# 3. Push (the manifest resets AEGIS_LLM_MODE to off).
cf push -f ops/btp/manifest.yml

# 4. Optionally restore live LLM mode.
if [ "${AEGIS_LLM_MODE:-}" = "live" ]; then
  cf set-env "$APP" AEGIS_LLM_MODE live
  cf restage "$APP"
fi

# 5. Verify.
ROUTE=$(cf app "$APP" | awk '/^routes:/ {print $2}' | cut -d, -f1)
URL="https://$ROUTE"
echo "Deployed at: $URL"
curl -fsS "$URL/api/v1/health"; echo
JS=$(curl -fsS "$URL/" | command grep -oE 'assets/index-[^"]+\.js' | head -1)
curl -fsS "$URL/$JS" | command grep -qE 'VITE_API_MODE:"live"' && echo "OK: deployed UI is in live mode"
python3 ops/smoke.py "$URL"
