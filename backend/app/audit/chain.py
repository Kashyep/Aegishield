import json
from datetime import datetime, timezone
from typing import Any
from ..services.fixtures import canonical_json, digest

GENESIS = "sha256:" + "0" * 64


def append_event(
    con,
    event_type: str,
    actor: dict[str, Any],
    subject: dict[str, Any],
    payload: dict[str, Any],
    evidence_ids: list[str] | None = None,
) -> dict[str, Any]:
    row = con.execute("SELECT seq, event_hash FROM audit_events ORDER BY seq DESC LIMIT 1").fetchone()
    seq = (row["seq"] + 1) if row else 1
    prev = row["event_hash"] if row else GENESIS
    event_id = f"AUD-{seq:06d}"
    occurred_at = datetime.now(timezone.utc).isoformat()
    ev_ids = evidence_ids or []

    event_body = {
        "schema_version": "1.0.0",
        "event_id": event_id,
        "seq": seq,
        "occurred_at": occurred_at,
        "actor": actor,
        "event_type": event_type,
        "subject": subject,
        "payload": payload,
        "evidence_ids": ev_ids,
        "prev_hash": prev,
    }
    event_hash = digest(event_body)
    full_event = event_body | {"event_hash": event_hash}

    con.execute(
        """
        INSERT INTO audit_events(
            seq, event_id, occurred_at, actor_json, event_type,
            subject_json, payload_json, evidence_ids_json, prev_hash, event_hash
        ) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            seq,
            event_id,
            occurred_at,
            canonical_json(actor),
            event_type,
            canonical_json(subject),
            canonical_json(payload),
            canonical_json(ev_ids),
            prev,
            event_hash,
        ),
    )
    return full_event


def verify(con) -> dict[str, Any]:
    prev = GENESIS
    checked = 0
    for row in con.execute(
        """
        SELECT seq, event_id, occurred_at, actor_json, event_type,
               subject_json, payload_json, evidence_ids_json, prev_hash, event_hash
        FROM audit_events ORDER BY seq ASC
        """
    ):
        seq = row["seq"]
        event_body = {
            "schema_version": "1.0.0",
            "event_id": row["event_id"],
            "seq": seq,
            "occurred_at": row["occurred_at"],
            "actor": json.loads(row["actor_json"]),
            "event_type": row["event_type"],
            "subject": json.loads(row["subject_json"]),
            "payload": json.loads(row["payload_json"]),
            "evidence_ids": json.loads(row["evidence_ids_json"]),
            "prev_hash": row["prev_hash"],
        }
        if row["prev_hash"] != prev or digest(event_body) != row["event_hash"]:
            return {
                "valid": False,
                "checked_events": checked,
                "first_invalid_seq": seq,
            }
        prev = row["event_hash"]
        checked += 1

    return {
        "valid": True,
        "checked_events": checked,
        "first_invalid_seq": None,
    }
