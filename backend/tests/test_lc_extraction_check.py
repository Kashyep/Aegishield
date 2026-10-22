"""MOD-08 LC.EXTRACTION_CONSISTENCY uses the same projection as llm.lc_extract (port_of_discharge is a port_id)."""
from conftest import apply_patches, load_fx

from app.llm.lc_extract import verified_values
from backend.app.services.evaluation import build_evaluation_payload


def _extraction_outcomes(extracted):
    patch = [{"file": "letters_of_credit", "collection": "letters_of_credit", "op": "set",
              "match": {"lc_id": "LC-SYN-0117"}, "set": {"extracted": extracted}}]
    fx = apply_patches(load_fx(), patch)
    ev = build_evaluation_payload(fx, "DIS-2026-0042", "EVAL-0001", ("PLN-0001", "PLN-0002"), "off",
                                  "2026-10-26T09:00:00+05:30", "2026-10-26T09:00:04+05:30")
    return {f["outcome"] for f in ev["findings"] if f["check_code"] == "LC.EXTRACTION_CONSISTENCY"}


def test_vc_lc_07_mismatch_needs_review():
    assert _extraction_outcomes({"transhipment": "allowed"}) == {"needs_review"}


def test_correct_extraction_including_port_passes():
    lc = load_fx()["letters_of_credit"]["letters_of_credit"][0]
    assert _extraction_outcomes(verified_values(lc)) == {"passed"}
