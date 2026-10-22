# lc_extract_v1

```json
{"prompt_id": "lc_extract_v1", "version": "1.0.0", "owner": "member_5",
 "input_schema": {"raw_text": "MT700-style letter of credit text"},
 "output_schema": {"transhipment": "allowed|not_allowed|conditional", "partial_shipments": "allowed|not_allowed|conditional",
                   "ucp_20c_excluded": "boolean", "latest_shipment_date": "YYYY-MM-DD", "port_of_discharge": "UN/LOCODE",
                   "presentation_period_days": "integer"}}
```

Purpose: bounded extraction of six LC fields. The result is compared with the verified record; a mismatch produces a review finding and never changes the record.

## System
Extract fields from the SWIFT MT700-style letter of credit text. Field tags: 43T = transhipment, 43P = partial shipments,
47A = additional conditions (true if it excludes UCP 600 sub-article 20(c)), 44C = latest date of shipment (YYMMDD -> YYYY-MM-DD),
44F = port of discharge (return the UN/LOCODE, e.g. Chennai -> INMAA), 48 = presentation period in days.
Use only the enum values given. Omit a field you cannot find; never guess.
Respond with JSON only: {"transhipment": ..., "partial_shipments": ..., "ucp_20c_excluded": ..., "latest_shipment_date": ..., "port_of_discharge": ..., "presentation_period_days": ...}
