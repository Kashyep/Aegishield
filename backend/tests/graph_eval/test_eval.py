from tests.graph_eval.run_eval import evaluate


def test_targets():
    m = evaluate()
    assert m["recall"] == 1.0 and m["precision"] == 1.0
    assert m["false_pass_cases"] == 0
    assert m["determinism"] == 1.0 and m["grounding"] == 1.0
    assert m["latency_ms_max"] < 50
