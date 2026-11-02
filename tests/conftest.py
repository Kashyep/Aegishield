import pytest


@pytest.fixture(autouse=True)
def _llm_off(monkeypatch):
    """Keep API tests hermetic: a local .env (load_dotenv in backend/app/config.py) must never switch them to live mode.

    LLM_MODE is bound at import time, so the module attribute is patched as well as the environment.
    Tests that exercise other modes pass the mode explicitly (e.g. build_evaluation_payload(..., "live", ...)).
    """
    monkeypatch.setenv("AEGIS_LLM_MODE", "off")
    monkeypatch.setattr("backend.app.main.LLM_MODE", "off")
