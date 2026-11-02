"""Boundary tests for architecture isolation rules (docs/00-source-of-truth.md §14.1).

Boundary rules tested:
- §7.4 Rule 7: Production code under backend/app never imports aegis_oracle or anything from tools.
- §7.4 Rule 6: Early-warning code (MOD-21) is advisory; plan/orchestration/execution code
  (services/evaluation.py, services/decisions.py, services/executions.py, agents/**, rules/**)
  must not import it.
- §7.4 Rule 6 & §10.9: external_signals is never part of plan inputs; load_fixtures() excludes it,
  retaining canonical input_snapshot_id matching golden evaluation_EVAL-0001.json, while
  load_signals() loads external signals.
"""

import ast
import json
import sys
from pathlib import Path
from typing import Generator, Tuple

# Root path resolution
TESTS_DIR = Path(__file__).resolve().parent
BACKEND_DIR = TESTS_DIR.parent
REPO_ROOT = BACKEND_DIR.parent
APP_DIR = BACKEND_DIR / "app"
FIXTURES_DIR = REPO_ROOT / "fixtures"

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def _extract_ast_imports(file_path: Path) -> Generator[Tuple[int, str, str | None], None, None]:
    """Yields (lineno, module_name, imported_name) from a Python source file using AST."""
    tree = ast.parse(file_path.read_text(encoding="utf-8"), filename=str(file_path))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                yield node.lineno, alias.name, None
        elif isinstance(node, ast.ImportFrom):
            mod = node.module or ""
            for alias in node.names:
                yield node.lineno, mod, alias.name


def test_no_oracle_or_tools_imported_by_production_code():
    """(a) No Python module under backend/app imports aegis_oracle or anything from tools."""
    violations = []
    py_files = sorted(APP_DIR.rglob("*.py"))
    assert py_files, f"Expected Python files under {APP_DIR}"

    for py_file in py_files:
        for lineno, mod, name in _extract_ast_imports(py_file):
            mod_parts = mod.split(".") if mod else []
            name_parts = name.split(".") if name else []

            # Check if importing aegis_oracle or tools
            is_oracle = "aegis_oracle" in mod_parts or "aegis_oracle" in name_parts
            is_tools = "tools" in mod_parts or "tools" in name_parts

            if is_oracle or is_tools:
                rel_path = py_file.relative_to(REPO_ROOT)
                import_stmt = f"from {mod} import {name}" if name else f"import {mod}"
                violations.append(f"{rel_path}:{lineno} -> {import_stmt}")

    assert not violations, (
        f"Production code under backend/app must not import aegis_oracle or tools:\n"
        + "\n".join(violations)
    )


def test_no_early_warning_imported_by_plan_orchestration_execution_code():
    """(b) Early-warning code is not imported by plan/orchestration/execution code.

    Early-warning modules: any module under backend/app whose path or module name
    contains 'early_warning', 'early_warnings', 'signals' or 'ews'.
    Plan/orchestration/execution code:
    - backend/app/services/evaluation.py
    - backend/app/services/decisions.py
    - backend/app/services/executions.py
    - backend/app/agents/**
    - backend/app/rules/**
    - backend/app/audit/** (MOD-11 audit chain)
    (main.py is skipped per spec: allowed only for GET /early-warnings route).
    If no early-warning module exists yet, the test passes (vacuous) and remains enforceable.
    """
    tokens = ("early_warning", "early_warnings", "signals", "ews")

    # Discover any early-warning modules/packages under backend/app
    app_py_files = sorted(APP_DIR.rglob("*.py"))
    early_warning_modules = set()
    for py_file in app_py_files:
        rel_parts = py_file.relative_to(APP_DIR).parts
        if any(any(tok in part.lower() for tok in tokens) for part in rel_parts):
            mod_rel = ".".join(rel_parts)
            if mod_rel.endswith(".py"):
                mod_rel = mod_rel[:-3]
            if mod_rel.endswith(".__init__"):
                mod_rel = mod_rel[:-9]
            early_warning_modules.add(mod_rel)
            early_warning_modules.add(py_file.stem)
            early_warning_modules.add(f"backend.app.{mod_rel}")
            early_warning_modules.add(f"app.{mod_rel}")

    # Gather target files to verify
    target_files = [
        APP_DIR / "services" / "evaluation.py",
        APP_DIR / "services" / "decisions.py",
        APP_DIR / "services" / "executions.py",
    ]
    target_files.extend(sorted((APP_DIR / "agents").rglob("*.py")))
    target_files.extend(sorted((APP_DIR / "rules").rglob("*.py")))
    target_files.extend(sorted((APP_DIR / "audit").rglob("*.py")))

    existing_targets = [f for f in target_files if f.is_file()]
    assert existing_targets, f"Expected target files under {APP_DIR}"

    violations = []
    for py_file in existing_targets:
        for lineno, mod, name in _extract_ast_imports(py_file):
            mod_parts = [p.lower() for p in mod.split(".")] if mod else []
            name_parts = [p.lower() for p in name.split(".")] if name else []

            # Check if import matches any discovered early warning module
            is_known_mod = bool(
                (mod and (mod in early_warning_modules or any(m in early_warning_modules for m in mod_parts)))
                or (name and (name in early_warning_modules or any(m in early_warning_modules for m in name_parts)))
            )

            # Check if import references early warning tokens
            # For 'ews', check exact match in part or part split by '_' (e.g. 'ews', 'ews_score')
            # For 'signals', check 'signals' (note: stdlib 'signal' must not trigger)
            # For 'early_warning' / 'early_warnings', check substring
            has_ews = any(p == "ews" or "ews" in p.split("_") for p in mod_parts + name_parts)
            has_signals = any("signals" in p for p in mod_parts + name_parts)
            has_early_warning = any("early_warning" in p for p in mod_parts + name_parts)

            if is_known_mod or has_ews or has_signals or has_early_warning:
                rel_path = py_file.relative_to(REPO_ROOT)
                import_stmt = f"from {mod} import {name}" if name else f"import {mod}"
                violations.append(f"{rel_path}:{lineno} -> {import_stmt}")

    assert not violations, (
        f"Early-warning code must not be imported by plan/orchestration/execution code:\n"
        + "\n".join(violations)
    )


def test_external_signals_isolated_from_plan_inputs():
    """(c) external_signals is never part of plan inputs.

    Asserts:
    1. backend.app.services.fixtures.load_fixtures(<repo>/fixtures) has no key 'external_signals'.
    2. snapshot_id(fixtures) equals the golden input_snapshot_id in
       fixtures/expected/evaluation_EVAL-0001.json (sha256:d52c7ecc366a66470bd9e04cf43d4f913d31b729c5f2bf1ce3932622b9f3d6c0).
    3. backend.app.services.fixtures.load_signals(<repo>/fixtures) returns a dict with key 'signals'.
    """
    from backend.app.services.fixtures import load_fixtures, load_signals, snapshot_id

    # 1. Assert load_fixtures has no key 'external_signals'
    plan_fixtures = load_fixtures(FIXTURES_DIR)
    assert "external_signals" not in plan_fixtures, (
        "external_signals must not be present in load_fixtures result"
    )

    # 2. Assert snapshot_id matches golden input_snapshot_id
    expected_eval_path = FIXTURES_DIR / "expected" / "evaluation_EVAL-0001.json"
    assert expected_eval_path.is_file(), f"Golden file not found at {expected_eval_path}"
    with open(expected_eval_path, "r", encoding="utf-8") as f:
        expected_eval = json.load(f)

    golden_snapshot_id = expected_eval["input_snapshot_id"]
    assert golden_snapshot_id == "sha256:d52c7ecc366a66470bd9e04cf43d4f913d31b729c5f2bf1ce3932622b9f3d6c0", (
        f"Expected golden sha256:d52c7ecc...d6c0, got {golden_snapshot_id}"
    )

    computed_snapshot_id = snapshot_id(plan_fixtures)
    assert computed_snapshot_id == golden_snapshot_id, (
        f"Snapshot ID mismatch: computed {computed_snapshot_id} != golden {golden_snapshot_id}"
    )

    # 3. Assert load_signals returns dict with key 'signals'
    signals_data = load_signals(FIXTURES_DIR)
    assert isinstance(signals_data, dict), "load_signals must return a dict"
    assert "signals" in signals_data, "load_signals result must contain key 'signals'"
    assert isinstance(signals_data["signals"], list), "signals key must be a list"
