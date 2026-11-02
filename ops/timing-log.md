# D8 timing log

Targets: dependency check p95 <= 50 ms; full evaluation (POST to completed) <= 5 s.
Run `python ops/timing.py --label "demo laptop"` on the demo machine before D8.

| When | Machine | OS | Python | LLM mode | Dependency check p50 / p95 | Evaluation p50 / max |
|---|---|---|---|---|---|---|
| 2026-10-22T23:44:49 | dev machine (not the demo laptop) | Windows 11 | Python 3.14.3 | off | 0.04 / 0.06 ms PASS | 0.02 / 0.02 s PASS |
| 2026-11-01T23:11:07 | Codex workstation | Windows 11 | Python 3.14.7 | recorded | 0.04 / 0.06 ms PASS | 0.03 / 0.03 s PASS |
