from tests.rules_eval.run_eval import evaluate


def test_targets():
    m = evaluate()
    assert m["exactness"] == 1.0 and m["reason_accuracy"] == 1.0
    assert m["leakage"] == 0 and m["unresolved_detected"] is True
    assert m["citation_integrity"] == 1.0
