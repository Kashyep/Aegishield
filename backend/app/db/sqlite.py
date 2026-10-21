import sqlite3
from contextlib import contextmanager
from pathlib import Path
from ..config import DB_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS evaluations (
    evaluation_id TEXT PRIMARY KEY,
    disruption_id TEXT NOT NULL,
    status TEXT NOT NULL,
    llm_mode TEXT NOT NULL,
    input_snapshot_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_steps (
    evaluation_id TEXT NOT NULL,
    seq INTEGER NOT NULL,
    step TEXT NOT NULL,
    owner TEXT NOT NULL,
    status TEXT NOT NULL,
    attempts INTEGER NOT NULL,
    timeout_ms INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    duration_ms INTEGER,
    mode TEXT NOT NULL,
    error_json TEXT,
    PRIMARY KEY (evaluation_id, seq)
);

CREATE TABLE IF NOT EXISTS plans (
    plan_id TEXT PRIMARY KEY,
    evaluation_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    status TEXT NOT NULL,
    outcome TEXT NOT NULL,
    plan_hash TEXT NOT NULL,
    input_snapshot_id TEXT NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
    decision_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    plan_version INTEGER NOT NULL,
    action TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    role TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    decided_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS amendment_requests (
    amendment_request_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    lc_id TEXT NOT NULL,
    lc_version INTEGER NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lc_versions (
    lc_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    PRIMARY KEY (lc_id, version)
);

CREATE TABLE IF NOT EXISTS executions (
    execution_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    plan_version INTEGER NOT NULL,
    decision_id TEXT NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    UNIQUE(plan_id, plan_version)
);

CREATE TABLE IF NOT EXISTS idempotency (
    key TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
    seq INTEGER PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,
    occurred_at TEXT NOT NULL,
    actor_json TEXT NOT NULL,
    event_type TEXT NOT NULL,
    subject_json TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    evidence_ids_json TEXT NOT NULL,
    prev_hash TEXT NOT NULL,
    event_hash TEXT UNIQUE NOT NULL
);
"""


def connect():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript(SCHEMA)
    return con


@contextmanager
def read_connection():
    con = connect()
    try:
        yield con
    finally:
        con.close()


@contextmanager
def transaction():
    con = connect()
    try:
        con.execute("BEGIN IMMEDIATE")
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()
