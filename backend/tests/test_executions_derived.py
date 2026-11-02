import copy
import json
import sqlite3
import pytest
from conftest import golden, load_fx

from backend.app.services.executions import generate_execution_steps, execute_plan
from backend.app.db.sqlite import init_schema


def test_steps_derive_values_from_plan_and_fixtures():
    fx = load_fx()
    eval_data = golden("evaluation_EVAL-0001.json")
    plan = next(p for p in eval_data["plans"] if p["plan_id"] == "PLN-0002")

    steps = generate_execution_steps(fx, plan, eval_data)
    assert len(steps) == 6

    # 1. REDUCE_PO derived from disruption gold_extraction and orders purchase_order
    s1 = steps[0]
    assert s1["step_type"] == "REDUCE_PO"
    assert s1["refs"] == {"po_id": "PO-7001", "from_qty": 900, "to_qty": 300}
    assert "PO-7001" in s1["description"]
    assert "900 to 300" in s1["description"]

    # 2. CREATE_PO derived from quote QT-C-01 and master_data suppliers
    s2 = steps[1]
    assert s2["step_type"] == "CREATE_PO"
    assert s2["refs"] == {
        "supplier_id": "SUP-C",
        "quote_id": "QT-C-01",
        "qty": 600,
        "unit_price_inr": 6600,
        "lc_id": "LC-SYN-0117",
        "lc_drawing_inr": 3960000,
    }
    assert "Saigon Precision Electronics JSC (synthetic)" in s2["description"]
    assert "LC-SYN-0117" in s2["description"]

    # 3. BOOK_FREIGHT derived from route RT-C-DIR
    s3 = steps[2]
    assert s3["step_type"] == "BOOK_FREIGHT"
    assert s3["refs"] == {"route_option_id": "RT-C-DIR", "qty": 600}
    assert "VNSGN to INMAA ETD 2026-10-29" in s3["description"]

    # 4. CREATE_STOCK_TRANSFER derived from INV-PNQ and scenario buyer plant
    s4 = steps[3]
    assert s4["step_type"] == "CREATE_STOCK_TRANSFER"
    assert s4["refs"] == {
        "inventory_source_id": "INV-PNQ",
        "to_location_id": "LOC-KAV-BLR",
        "qty": 150,
    }
    assert "Kaveri Pune DC (synthetic)" in s4["description"]
    assert "Kaveri Bengaluru plant (synthetic)" in s4["description"]

    # 5. RESERVE_STOCK derived from INV-BLR and customer order
    s5 = steps[4]
    assert s5["step_type"] == "RESERVE_STOCK"
    assert s5["refs"] == {
        "inventory_source_id": "INV-BLR",
        "order_id": "SO-1001",
        "qty": 150,
    }

    # 6. NOTIFY_CUSTOMER derived from late order SO-1001
    s6 = steps[5]
    assert s6["step_type"] == "NOTIFY_CUSTOMER"
    assert s6["refs"] == {"order_id": "SO-1001", "qty_late": 100, "days_late": 2}


def test_modified_plan_and_fixtures_dynamically_change_payloads():
    fx = copy.deepcopy(load_fx())
    eval_data = copy.deepcopy(golden("evaluation_EVAL-0001.json"))

    # Modify PO: new PO-8888 with 2000 units
    fx["orders"]["purchase_orders"] = [
        {"po_id": "PO-8888", "supplier_id": "SUP-A", "part_id": "PRT-PM750", "qty": 2000}
    ]
    fx["disruptions"]["events"][0]["gold_extraction"]["affected_po_ids"] = ["PO-8888"]

    # Add custom quote QT-ALT-99
    fx["supplier_quotes"]["quotes"].append({
        "quote_id": "QT-ALT-99",
        "supplier_id": "SUP-B",
        "part_id": "PRT-PM750",
        "unit_price_inr": 7200,
        "lc_id": "LC-ALT-9999",
    })

    # Add custom route RT-ALT-SEA
    fx["route_options"]["route_options"].append({
        "route_option_id": "RT-ALT-SEA",
        "origin_port_id": "MYPKG",
        "destination_port_id": "INMAA",
        "etd": "2026-11-05",
    })

    # Add custom buyer plant location
    fx["scenario"]["buyer"]["plant_location_id"] = "LOC-KAV-MYS"
    fx["master_data"]["locations"].append({
        "location_id": "LOC-KAV-MYS",
        "kind": "plant",
        "name": "Kaveri Mysuru Plant (synthetic)",
        "country": "IN",
    })

    # Update evaluation option to use new quote and route
    for opt in eval_data["options"]:
        if opt["option_id"] == "OPT-RT-C-DIR":
            opt["quote_id"] = "QT-ALT-99"
            opt["route_option_id"] = "RT-ALT-SEA"

    # Plan with customized line quantities: total supplier units = 450
    plan = {
        "plan_id": "PLN-CUSTOM",
        "lines": [
            {"line_id": "L1", "order_id": "SO-1001", "option_id": "OPT-INV-PNQ", "qty": 80, "days_late": 0},
            {"line_id": "L2", "order_id": "SO-1001", "option_id": "OPT-RT-C-DIR", "qty": 450, "days_late": 0},
        ],
    }

    steps = generate_execution_steps(fx, plan, eval_data)
    assert len(steps) == 4

    # Step 1: REDUCE_PO for PO-8888: 2000 - 450 = 1550
    assert steps[0]["step_type"] == "REDUCE_PO"
    assert steps[0]["refs"] == {"po_id": "PO-8888", "from_qty": 2000, "to_qty": 1550}

    # Step 2: CREATE_PO for QT-ALT-99
    assert steps[1]["step_type"] == "CREATE_PO"
    assert steps[1]["refs"] == {
        "supplier_id": "SUP-B",
        "quote_id": "QT-ALT-99",
        "qty": 450,
        "unit_price_inr": 7200,
        "lc_id": "LC-ALT-9999",
        "lc_drawing_inr": 450 * 7200,
    }
    assert "Chao Phraya Power Devices Co (synthetic)" in steps[1]["description"]

    # Step 3: BOOK_FREIGHT for RT-ALT-SEA
    assert steps[2]["step_type"] == "BOOK_FREIGHT"
    assert steps[2]["refs"] == {"route_option_id": "RT-ALT-SEA", "qty": 450}
    assert "MYPKG to INMAA ETD 2026-11-05" in steps[2]["description"]

    # Step 4: CREATE_STOCK_TRANSFER to LOC-KAV-MYS
    assert steps[3]["step_type"] == "CREATE_STOCK_TRANSFER"
    assert steps[3]["refs"] == {
        "inventory_source_id": "INV-PNQ",
        "to_location_id": "LOC-KAV-MYS",
        "qty": 80,
    }
    assert "Kaveri Mysuru Plant (synthetic)" in steps[3]["description"]


def test_quote_without_lc_generates_valid_po_step():
    fx = copy.deepcopy(load_fx())
    eval_data = copy.deepcopy(golden("evaluation_EVAL-0001.json"))

    # QT-B-01 has lc_id: null
    for opt in eval_data["options"]:
        if opt["option_id"] == "OPT-RT-C-DIR":
            opt["quote_id"] = "QT-B-01"

    plan = {
        "plan_id": "PLN-NOLC",
        "lines": [
            {"line_id": "L1", "order_id": "SO-1001", "option_id": "OPT-RT-C-DIR", "qty": 200, "days_late": 0},
        ],
    }

    steps = generate_execution_steps(fx, plan, eval_data)
    create_po = next(s for s in steps if s["step_type"] == "CREATE_PO")
    assert create_po["refs"]["lc_id"] is None
    assert "under None" not in create_po["description"]
    assert create_po["proposed_sap_mapping"] == "S/4HANA purchase order"


def test_missing_affected_po_raises_value_error():
    fx = copy.deepcopy(load_fx())
    eval_data = copy.deepcopy(golden("evaluation_EVAL-0001.json"))
    plan = {"plan_id": "PLN-ERR", "lines": []}

    # Empty affected_po_ids
    fx["disruptions"]["events"][0]["gold_extraction"]["affected_po_ids"] = []
    with pytest.raises(ValueError, match="Disruption does not specify affected_po_ids"):
        generate_execution_steps(fx, plan, eval_data)

    # Disruption missing completely
    fx["disruptions"]["events"] = []
    with pytest.raises(ValueError, match="Disruption does not specify affected_po_ids"):
        generate_execution_steps(fx, plan, eval_data)


def test_missing_po_in_orders_raises_value_error():
    fx = copy.deepcopy(load_fx())
    eval_data = copy.deepcopy(golden("evaluation_EVAL-0001.json"))
    plan = {"plan_id": "PLN-ERR", "lines": []}

    fx["orders"]["purchase_orders"] = []
    with pytest.raises(ValueError, match="Purchase order PO-7001 not found in orders fixture"):
        generate_execution_steps(fx, plan, eval_data)


def test_missing_quote_raises_value_error():
    fx = copy.deepcopy(load_fx())
    eval_data = copy.deepcopy(golden("evaluation_EVAL-0001.json"))
    plan = {
        "plan_id": "PLN-ERR",
        "lines": [{"line_id": "L1", "order_id": "SO-1001", "option_id": "OPT-RT-C-DIR", "qty": 100}],
    }

    # Delete quote
    fx["supplier_quotes"]["quotes"] = []
    with pytest.raises(ValueError, match="Quote QT-C-01 not found"):
        generate_execution_steps(fx, plan, eval_data)


def test_missing_quote_required_data_raises_value_error():
    fx = copy.deepcopy(load_fx())
    eval_data = copy.deepcopy(golden("evaluation_EVAL-0001.json"))
    plan = {
        "plan_id": "PLN-ERR",
        "lines": [{"line_id": "L1", "order_id": "SO-1001", "option_id": "OPT-RT-C-DIR", "qty": 100}],
    }

    # Missing unit_price_inr
    q = next(q for q in fx["supplier_quotes"]["quotes"] if q["quote_id"] == "QT-C-01")
    del q["unit_price_inr"]
    with pytest.raises(ValueError, match="Quote QT-C-01 is missing required data"):
        generate_execution_steps(fx, plan, eval_data)


def test_missing_route_raises_value_error():
    fx = copy.deepcopy(load_fx())
    eval_data = copy.deepcopy(golden("evaluation_EVAL-0001.json"))
    plan = {
        "plan_id": "PLN-ERR",
        "lines": [{"line_id": "L1", "order_id": "SO-1001", "option_id": "OPT-RT-C-DIR", "qty": 100}],
    }

    fx["route_options"]["route_options"] = []
    with pytest.raises(ValueError, match="Route RT-C-DIR not found"):
        generate_execution_steps(fx, plan, eval_data)


def test_missing_route_required_data_raises_value_error():
    fx = copy.deepcopy(load_fx())
    eval_data = copy.deepcopy(golden("evaluation_EVAL-0001.json"))
    plan = {
        "plan_id": "PLN-ERR",
        "lines": [{"line_id": "L1", "order_id": "SO-1001", "option_id": "OPT-RT-C-DIR", "qty": 100}],
    }

    r = next(r for r in fx["route_options"]["route_options"] if r["route_option_id"] == "RT-C-DIR")
    del r["etd"]
    with pytest.raises(ValueError, match="Route RT-C-DIR is missing required data"):
        generate_execution_steps(fx, plan, eval_data)


def test_missing_inventory_position_raises_value_error():
    fx = copy.deepcopy(load_fx())
    eval_data = copy.deepcopy(golden("evaluation_EVAL-0001.json"))
    plan = {
        "plan_id": "PLN-ERR",
        "lines": [{"line_id": "L1", "order_id": "SO-1001", "option_id": "OPT-INV-UNKNOWN", "qty": 50}],
    }

    with pytest.raises(ValueError, match="Inventory position INV-UNKNOWN not found"):
        generate_execution_steps(fx, plan, eval_data)


def test_missing_buyer_plant_location_raises_value_error():
    fx = copy.deepcopy(load_fx())
    eval_data = copy.deepcopy(golden("evaluation_EVAL-0001.json"))
    plan = {
        "plan_id": "PLN-ERR",
        "lines": [{"line_id": "L1", "order_id": "SO-1001", "option_id": "OPT-INV-PNQ", "qty": 50}],
    }

    del fx["scenario"]["buyer"]["plant_location_id"]
    with pytest.raises(ValueError, match="Buyer plant_location_id not found in scenario"):
        generate_execution_steps(fx, plan, eval_data)


def test_execute_plan_audits_refusal_for_unknown_actor_and_viewer():
    fx = load_fx()
    con = sqlite3.connect(":memory:")
    con.row_factory = sqlite3.Row
    init_schema(con)

    # 1. Unknown actor refusal
    status_code, body, _ = execute_plan(
        con=con,
        fx=fx,
        plan_id="PLN-0002",
        x_actor_id="USR-NONEXISTENT",
        idempotency_key="test-key-12345",
        body={"decision_id": "DEC-0001"},
        path="/api/v1/plans/PLN-0002/executions",
        current_snapshot_id="test-snap",
    )
    assert status_code == 400
    row = con.execute("SELECT event_type, payload_json FROM audit_events ORDER BY seq DESC LIMIT 1").fetchone()
    assert row["event_type"] == "EXECUTION_REFUSED"
    assert json.loads(row["payload_json"]) == {"code": "ACTOR_REQUIRED"}

    # 2. Viewer role refusal (USR-VIEWER has role "viewer")
    status_code, body, _ = execute_plan(
        con=con,
        fx=fx,
        plan_id="PLN-0002",
        x_actor_id="USR-VIEW",
        idempotency_key="test-key-67890",
        body={"decision_id": "DEC-0001"},
        path="/api/v1/plans/PLN-0002/executions",
        current_snapshot_id="test-snap",
    )
    assert status_code == 403
    row = con.execute("SELECT event_type, payload_json FROM audit_events ORDER BY seq DESC LIMIT 1").fetchone()
    assert row["event_type"] == "EXECUTION_REFUSED"
    assert json.loads(row["payload_json"]) == {"code": "ROLE_FORBIDDEN"}
