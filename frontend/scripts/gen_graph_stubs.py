"""Regenerate public/stubs/graph_view_<SUP>.json from the backend GraphView builder (same code as the live endpoint).

    python frontend/scripts/gen_graph_stubs.py   (from repo root)
SUP-B must equal the golden fixtures/expected/graph_view_SUP-B.json; the script fails otherwise.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from backend.app.config import FIXTURES  # noqa: E402
from backend.app.services.fixtures import load_fixtures  # noqa: E402
from backend.app.services.evaluation import build_evaluation_payload, graph_view  # noqa: E402

fx = load_fixtures(FIXTURES)
ev = build_evaluation_payload(fx, "DIS-2026-0042", "EVAL-0001", ("PLN-0001", "PLN-0002"), "off",
                              "2026-10-26T09:00:00+05:30", "2026-10-26T09:00:04+05:30")
golden = json.loads((ROOT / "fixtures/expected/graph_view_SUP-B.json").read_text(encoding="utf-8"))
for sup in ("SUP-B", "SUP-C"):
    view = graph_view(fx, ev["dependency_results"], sup)
    if sup == "SUP-B" and view != golden:
        sys.exit("SUP-B view differs from golden graph_view_SUP-B.json")
    out = ROOT / "frontend/public/stubs" / f"graph_view_{sup}.json"
    out.write_text(json.dumps(view, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(out.relative_to(ROOT))
