"""D8 timing log: dependency check (target <= 50 ms) and full evaluation via the API (target <= 5 s).

    python ops/timing.py [--label "demo laptop"]     (from repo root; appends to ops/timing-log.md)
Uses a throwaway SQLite file; does not touch work/aegis-demo.sqlite3.
"""
from __future__ import annotations

import argparse
import os
import platform
import statistics
import sys
import tempfile
import time
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["AEGIS_DB_PATH"] = str(Path(tempfile.mkdtemp()) / "timing.sqlite3")

from fastapi.testclient import TestClient  # noqa: E402

from backend.app.agents.dependency.check import check_dependency  # noqa: E402
from backend.app.agents.dependency.graph import build_graph  # noqa: E402
from backend.app.config import FIXTURES, LLM_MODE  # noqa: E402
from backend.app.main import app  # noqa: E402
from backend.app.services.fixtures import load_fixtures  # noqa: E402


def pct(xs, p):
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(p / 100 * (len(xs) - 1))))]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--label", default=platform.node())
    ap.add_argument("--runs", type=int, default=5)
    args = ap.parse_args()
    fx = load_fixtures(FIXTURES)
    g = build_graph(fx["supply_graph"], fx["master_data"])
    pol = fx["policies"]["dependency_policy"]
    dep = []
    for i in range(400):
        sup = ("SUP-B", "SUP-C")[i % 2]
        t = time.perf_counter()
        check_dependency({"supplier_id": sup, "part_id": "PRT-PM750", "disrupted_node_ids": ["FAC-FABZ"],
                          "max_depth": pol["max_depth"]}, g, fx["master_data"]["parts"], pol)
        dep.append((time.perf_counter() - t) * 1000)

    evals = []
    with TestClient(app) as c:
        h = {"X-Actor-Id": "USR-PRIYA"}
        for i in range(args.runs):
            c.post("/api/v1/demo/reset", headers=h)
            t = time.perf_counter()
            r = c.post("/api/v1/evaluations", headers={**h, "Idempotency-Key": f"timing-run-{i:04d}"},
                       json={"disruption_id": "DIS-2026-0042"})
            url = r.json()["poll_url"]
            while c.get(url).json()["status"] in ("queued", "running"):
                time.sleep(0.01)
            evals.append(time.perf_counter() - t)

    dep_p95, ev_max = pct(dep, 95), max(evals)
    row = (f"| {datetime.now().isoformat(timespec='seconds')} | {args.label} | {platform.system()} {platform.release()} | "
           f"Python {platform.python_version()} | {LLM_MODE} | {statistics.median(dep):.2f} / {dep_p95:.2f} ms "
           f"{'PASS' if dep_p95 <= 50 else 'FAIL'} | {statistics.median(evals):.2f} / {ev_max:.2f} s "
           f"{'PASS' if ev_max <= 5 else 'FAIL'} |")
    log = ROOT / "ops" / "timing-log.md"
    if not log.exists():
        log.write_text("# D8 timing log\n\nTargets: dependency check p95 <= 50 ms; full evaluation (POST to completed) <= 5 s.\n"
                       "Run `python ops/timing.py --label \"demo laptop\"` on the demo machine before D8.\n\n"
                       "| When | Machine | OS | Python | LLM mode | Dependency check p50 / p95 | Evaluation p50 / max |\n"
                       "|---|---|---|---|---|---|---|\n", encoding="utf-8")
    with log.open("a", encoding="utf-8") as f:
        f.write(row + "\n")
    print(row)


if __name__ == "__main__":
    main()
