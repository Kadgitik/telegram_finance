from __future__ import annotations

from fastapi import Header, HTTPException, Request

from backend.app.services.auth import get_telegram_id_from_init_data


async def telegram_user_id(request: Request, authorization: str | None = Header(None)) -> int:
    auth_val = authorization or request.query_params.get("authorization")
    if not auth_val or not auth_val.startswith("tma "):
        raise HTTPException(
            status_code=401,
            detail="Потрібен заголовок Authorization: tma <initData>",
        )
    init_data = auth_val[4:].strip()
    try:
        return get_telegram_id_from_init_data(init_data)
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
