from pathlib import Path
import os
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")
FIXTURES = ROOT / "fixtures"
DB_PATH = Path(os.getenv("AEGIS_DB_PATH", str(ROOT / "work" / "aegis-demo.sqlite3")))
DEMO_MODE = os.getenv("AEGIS_DEMO_MODE", "1").lower() in {"1", "true", "yes"}
LLM_MODE = os.getenv("AEGIS_LLM_MODE", "off")
CONTRACT_VERSION = "1.0.0"
# Comma-separated browser origins allowed to call the API (dev servers; same-origin deployments need none).
CORS_ORIGINS = [o.strip() for o in os.getenv(
    "AEGIS_CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:4174").split(",") if o.strip()]
# Built frontend served at / when present (see Dockerfile / ops/btp).
FRONTEND_DIST = Path(os.getenv("AEGIS_FRONTEND_DIST", str(ROOT / "frontend" / "dist")))
