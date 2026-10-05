from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_session_token
from app.database.session import get_db
from app.dependencies.auth import (
    get_current_user,
    get_request_session_token,
)
from app.dependencies.roles import require_roles
from app.models.nhan_vien import NhanVien
from app.services.table_map_events import stream_table_map_events


router = APIRouter(prefix="/api/ban", tags=["Sơ đồ bàn"])


def get_table_events_user(
    request: Request,
    session_token: str | None = Depends(get_request_session_token),
    db: Session = Depends(get_db, scope="function"),
) -> NhanVien:
    current_user = get_current_user(
        request,
        session_token=session_token,
        db=db,
    )
    return require_roles("QUAN_LY", "PHUC_VU")(
        current_user=current_user
    )


@router.get("/events")
def table_map_events(
    current_user: NhanVien = Depends(
        get_table_events_user,
        scope="function",
    ),
    session_token: str | None = Depends(get_request_session_token),
):
    if not session_token:
        raise HTTPException(
            status_code=401,
            detail="SESSION_REQUIRED",
        )
    require_roles("QUAN_LY", "PHUC_VU")(
        current_user=current_user
    )

    if make_url(settings.database_url).get_backend_name() != "postgresql":
        raise HTTPException(
            status_code=503,
            detail="Sơ đồ bàn cần PostgreSQL để đồng bộ sự kiện.",
        )

    return StreamingResponse(
        stream_table_map_events(
            hash_session_token(session_token),
            current_user.id,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
