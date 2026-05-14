"""Belt-and-suspenders CSRF guard for destructive endpoints.

Telegram WebApp's initData already authenticates and is hard to leak (browsers
don't auto-attach Authorization headers cross-origin). This extra header
("X-Action-Confirm: yes") makes sure no naive HTML form / image-tag / iframe
can ever drive a destructive request, because non-fetch browsers won't send
custom headers.
"""
from __future__ import annotations

from fastapi import Header, HTTPException


def require_action_confirm(x_action_confirm: str | None = Header(None)) -> None:
    if (x_action_confirm or "").lower() != "yes":
        raise HTTPException(
            status_code=403,
            detail="Missing X-Action-Confirm header for destructive operation",
        )
