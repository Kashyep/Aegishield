from pathlib import Path
import os

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = ROOT / "fixtures"
DB_PATH = Path(os.getenv("AEGIS_DB_PATH", str(ROOT / "work" / "aegis-demo.sqlite3")))
DEMO_MODE = os.getenv("AEGIS_DEMO_MODE", "1").lower() in {"1", "true", "yes"}
LLM_MODE = os.getenv("AEGIS_LLM_MODE", "off")
CONTRACT_VERSION = "1.0.0"
