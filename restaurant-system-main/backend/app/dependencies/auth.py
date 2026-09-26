from datetime import timedelta

from fastapi import Cookie, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_session_token
from app.database.session import get_db
from app.models.nhan_vien import NhanVien
from app.models.phien_dang_nhap import PhienDangNhap
from app.services.auth_service import utc_now


def get_session_user(
    request: Request,
    session_token: str | None = Cookie(
        default=None,
        alias=settings.session_cookie_name,
    ),
    db: Session = Depends(get_db),
) -> NhanVien:

    if not session_token:
        raise HTTPException(
            status_code=401,
            detail="SESSION_REQUIRED",
        )

    token_hash = hash_session_token(
        session_token
    )

    session = db.scalar(
        select(PhienDangNhap).where(
            PhienDangNhap.token_hash == token_hash
        )
    )

    if session is None or session.revoked_at is not None:
        raise HTTPException(
            status_code=401,
            detail="SESSION_EXPIRED",
        )

    now = utc_now()

    idle_limit = timedelta(
        minutes=settings.session_idle_minutes
    )

    if now - session.last_activity_at >= idle_limit:
        session.revoked_at = now
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="SESSION_EXPIRED",
        )

    if session.expires_at <= now:
        session.revoked_at = now
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="SESSION_EXPIRED",
        )

    employee = db.get(
        NhanVien,
        session.nhan_vien_id,
    )

    if employee is None:
        session.revoked_at = now
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="SESSION_EXPIRED",
        )

    if employee.trang_thai != "HOAT_DONG":
        session.revoked_at = now
        db.commit()

        raise HTTPException(
            status_code=401,
            detail="SESSION_EXPIRED",
        )

    # Rolling 30-minute inactivity timeout.
    session.last_activity_at = now
    session.expires_at = now + idle_limit

    db.commit()

    return employee


def get_current_user(
    current_user: NhanVien = Depends(get_session_user),
) -> NhanVien:
    if current_user.doi_mat_khau_lan_dau:
        raise HTTPException(
            status_code=403,
            detail="PASSWORD_CHANGE_REQUIRED",
        )
    return current_user


def require_manager(
    current_user: NhanVien = Depends(
        get_current_user
    ),
) -> NhanVien:

    if current_user.vai_tro != "QUAN_LY":
        raise HTTPException(
            status_code=403,
            detail="Bạn không có quyền thực hiện thao tác này.",
        )

    return current_user


def require_roles(*allowed_roles: str):
    def dependency(
        current_user: NhanVien = Depends(get_current_user),
    ) -> NhanVien:
        if current_user.vai_tro not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Bạn không có quyền truy cập chức năng này.",
            )
        return current_user

    return dependency