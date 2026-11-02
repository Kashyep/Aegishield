"""Early warning agent package (MOD-21)."""

import importlib
from typing import Any

__all__ = ["compute_early_warnings"]


def __getattr__(name: str) -> Any:
    if name == "compute_early_warnings":
        mod = importlib.import_module(f"{__name__}.index")
        return getattr(mod, name)
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
