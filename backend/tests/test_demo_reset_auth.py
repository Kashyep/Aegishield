import importlib
import pytest
from fastapi.testclient import TestClient

from backend.app import config
from backend.app.main import app


@pytest.fixture(autouse=True)
def setup_test_env(tmp_path, monkeypatch):
    monkeypatch.setenv("AEGIS_LLM_MODE", "off")
    # Bind a temporary DB_PATH to keep test executions isolated
    monkeypatch.setattr("backend.app.db.sqlite.DB_PATH", tmp_path / "test_reset_auth.sqlite3")
    monkeypatch.setattr(config, "RESET_TOKEN", None)
    yield
    monkeypatch.delenv("AEGIS_RESET_TOKEN", raising=False)
    monkeypatch.setattr(config, "RESET_TOKEN", None)


def test_viewer_role_forbidden(monkeypatch):
    """USR-VIEW actor role cannot reset demo (403 ROLE_FORBIDDEN)."""
    monkeypatch.setattr(config, "RESET_TOKEN", None)
    c = TestClient(app)

    # Token unset: viewer is forbidden
    res = c.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-VIEW"})
    assert res.status_code == 403
    body = res.json()
    assert body["code"] == "ROLE_FORBIDDEN"
    assert body["detail"] == "Viewer role cannot reset demo"

    # Even with a token set and correct token provided, viewer check precedes token check
    monkeypatch.setattr(config, "RESET_TOKEN", "test-token-123")
    res_with_token = c.post(
        "/api/v1/demo/reset",
        headers={"X-Actor-Id": "USR-VIEW", "X-Reset-Token": "test-token-123"},
    )
    assert res_with_token.status_code == 403
    assert res_with_token.json()["code"] == "ROLE_FORBIDDEN"


def test_token_set_header_missing(monkeypatch):
    """When RESET_TOKEN is configured and X-Reset-Token is omitted -> 403 RESET_TOKEN_INVALID."""
    monkeypatch.setattr(config, "RESET_TOKEN", "super-secret-token")
    c = TestClient(app)

    res = c.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
    assert res.status_code == 403
    body = res.json()
    assert body["code"] == "RESET_TOKEN_INVALID"
    assert body["detail"] == "Invalid or missing reset token"


def test_token_set_wrong_header(monkeypatch):
    """When RESET_TOKEN is configured and X-Reset-Token is wrong -> 403 RESET_TOKEN_INVALID."""
    monkeypatch.setattr(config, "RESET_TOKEN", "super-secret-token")
    c = TestClient(app)

    res = c.post(
        "/api/v1/demo/reset",
        headers={"X-Actor-Id": "USR-PRIYA", "X-Reset-Token": "incorrect-token"},
    )
    assert res.status_code == 403
    body = res.json()
    assert body["code"] == "RESET_TOKEN_INVALID"
    assert body["detail"] == "Invalid or missing reset token"


def test_token_set_correct_header(monkeypatch):
    """When RESET_TOKEN is configured and X-Reset-Token matches -> 200."""
    monkeypatch.setattr(config, "RESET_TOKEN", "super-secret-token")
    c = TestClient(app)

    res = c.post(
        "/api/v1/demo/reset",
        headers={"X-Actor-Id": "USR-PRIYA", "X-Reset-Token": "super-secret-token"},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["scenario_id"] == "SCN-DEMO-001"
    assert body["counters_reset"] is True


def test_token_unset_priya_and_arjun(monkeypatch):
    """When RESET_TOKEN is unset, USR-PRIYA and USR-ARJUN succeed without X-Reset-Token."""
    monkeypatch.setattr(config, "RESET_TOKEN", None)
    c = TestClient(app)

    res_priya = c.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
    assert res_priya.status_code == 200
    assert res_priya.json()["counters_reset"] is True

    res_arjun = c.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-ARJUN"})
    assert res_arjun.status_code == 200
    assert res_arjun.json()["counters_reset"] is True


def test_token_from_env_var_reload(monkeypatch):
    """Verify AEGIS_RESET_TOKEN environment variable is loaded by backend/app/config.py."""
    monkeypatch.setenv("AEGIS_RESET_TOKEN", "env-loaded-token")
    importlib.reload(config)
    assert config.RESET_TOKEN == "env-loaded-token"

    c = TestClient(app)
    # Missing header -> 403
    res_bad = c.post("/api/v1/demo/reset", headers={"X-Actor-Id": "USR-PRIYA"})
    assert res_bad.status_code == 403
    assert res_bad.json()["code"] == "RESET_TOKEN_INVALID"

    # Valid header -> 200
    res_ok = c.post(
        "/api/v1/demo/reset",
        headers={"X-Actor-Id": "USR-PRIYA", "X-Reset-Token": "env-loaded-token"},
    )
    assert res_ok.status_code == 200

    # Cleanup: restore config module
    monkeypatch.delenv("AEGIS_RESET_TOKEN", raising=False)
    importlib.reload(config)
