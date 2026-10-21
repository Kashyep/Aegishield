from typing import Any
from fastapi.responses import JSONResponse


def problem_response(
    status: int,
    code: str,
    detail: str,
    title: str | None = None,
    instance: str | None = None,
    current: dict[str, Any] | None = None,
    errors: list[dict[str, Any]] | None = None,
) -> JSONResponse:
    kebab = code.lower().replace("_", "-")
    content: dict[str, Any] = {
        "type": f"https://aegisshield.local/problems/{kebab}",
        "title": title or code.replace("_", " ").title(),
        "status": status,
        "code": code,
        "detail": detail,
    }
    if instance is not None:
        content["instance"] = instance
    if current is not None:
        content["current"] = current
    if errors is not None:
        content["errors"] = errors

    return JSONResponse(
        status_code=status,
        content=content,
        media_type="application/problem+json",
    )
