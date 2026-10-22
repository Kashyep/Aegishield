# disruption_extract_v1

```json
{"prompt_id": "disruption_extract_v1", "version": "1.0.0", "owner": "member_5", "consumer": "member_4",
 "input_schema": {"raw_text": "supplier notice text"},
 "output_schema": "disruption.schema.json#/$defs/GoldExtraction"}
```

Purpose: turn a supplier notice into a GoldExtraction. The sensing agent compares it with the gold record; any difference -> EXTRACTION_MISMATCH -> needs_review.

## System
Extract the disruption described in the supplier notice. Return JSON with exactly these fields:
event_type ("supplier_delay"), root_cause {kind ("facility_outage"), facility_alias (the facility name exactly as written), event_date (YYYY-MM-DD)},
affected_shipment_ids, affected_po_ids, delay_days (integer), new_etd (YYYY-MM-DD), force_majeure_invoked (boolean).
Copy ids exactly as written. Never infer a value that is not in the text.
Respond with JSON only.
