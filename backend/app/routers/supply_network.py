from pathlib import Path
from typing import Any
from fastapi import APIRouter
from ..config import FIXTURES
from ..services.fixtures import load_supply_network

router = APIRouter(prefix="/api/v1", tags=["network"])


@router.get("/supply-network")
def get_supply_network() -> dict[str, Any]:
    """Returns the supply network flowchart topology with node status, on-hand inventory,

    stock in transit, and movement over time (FB-18).
    """
    return load_supply_network(FIXTURES)
