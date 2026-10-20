"""MOD-06 Routing Agent (M4-D4): deterministic eligibility, no optimisation, no LLM."""
from __future__ import annotations


def eligible_routes(quote: dict, routes: list[dict]) -> list[dict]:
    """Same origin port and ETD on/after quote ready date; sorted by route_option_id."""
    ok = [r for r in routes
          if r["origin_port_id"] == quote["origin_port_id"] and r["etd"] >= quote["ready_date"]]
    return sorted(ok, key=lambda r: r["route_option_id"])


def transhipment_countries(route: dict, locations: dict) -> list[dict]:
    """Transhipment ports with their countries (locations: location_id -> location)."""
    return [{"port_id": p, "country": locations[p]["country"]} for p in route["transshipment_port_ids"]]
