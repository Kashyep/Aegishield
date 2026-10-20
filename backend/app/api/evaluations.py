"""GraphView endpoint (M4-D8). Persistence is M3's: they supply `get_evaluation` and `get_graph` when mounting."""
from __future__ import annotations

from typing import Callable

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.agents.dependency.graph import SupplyGraph
from app.agents.dependency.view import GraphViewError, graph_view_for_evaluation


def graph_router(get_evaluation: Callable[[str], dict | None], get_graph: Callable[[], SupplyGraph]) -> APIRouter:
    router = APIRouter(prefix="/api/v1")

    @router.get("/evaluations/{evaluation_id}/graph")
    def get_evaluation_graph(evaluation_id: str, focus_supplier_id: str = Query(pattern=r"^SUP-[A-Z0-9]+$")):
        try:
            return graph_view_for_evaluation(get_evaluation(evaluation_id), get_graph(), focus_supplier_id)
        except GraphViewError as e:
            return JSONResponse({"type": "about:blank", "title": e.code, "status": e.status, "code": e.code,
                                 "detail": e.detail}, status_code=e.status, media_type="application/problem+json")

    return router
