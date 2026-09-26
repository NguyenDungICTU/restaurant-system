from datetime import datetime, timedelta, timezone
from math import ceil
import re

from fastapi import HTTPException, Request
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    generate_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)
from app.models.nhan_vien import NhanVien
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.models.phien_dang_nhap import PhienDangNhap


GENERIC_LOGIN_ERROR = (
    "Tên đăng nhập/số điện thoại hoặc mật khẩu không đúng."
)
_DUMMY_PASSWORD_HASH = hash_password("invalid-account-placeholder")


def _record_login_event(
    db: Session,
    *,
    employee: NhanVien | None,
    identifier: str,
    action: str,
    request: Request,
    now: datetime,
) -> None:
    db.add(
        NhatKyThaoTac(
            nhan_vien_id=employee.id if employee else None,
            vai_tro=employee.vai_tro if employee else None,
            tai_khoan=employee.ten_dang_nhap if employee else identifier[:100],
            hanh_dong=action,
            doi_tuong="DANG_NHAP",
            doi_tuong_id=employee.id if employee else None,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            created_at=now,
        )
    )


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_employee_by_identifier(
    db: Session,
    identifier: str,
    *,
    for_update: bool = False,
) -> NhanVien | None:

    normalized_username = identifier.strip().lower()
    normalized_phone = re.sub(r"[\s().-]", "", identifier.strip())
    if normalized_phone.startswith("+84"):
        normalized_phone = "0" + normalized_phone[3:]

    statement = select(NhanVien).where(
        or_(
            func.lower(NhanVien.ten_dang_nhap) == normalized_username,
            NhanVien.so_dien_thoai == normalized_phone,
        )
    )

    if for_update:
        statement = statement.with_for_update()

    return db.scalar(statement)


def register_failed_attempt(
    db: Session,
    employee: NhanVien,
    now: datetime,
) -> None:

    window = timedelta(
        minutes=settings.login_failed_window_minutes
    )

    lock_duration = timedelta(
        minutes=settings.login_lock_minutes
    )

    if (
        employee.cua_so_bat_dau_sai is None
        or now - employee.cua_so_bat_dau_sai >= window
    ):
        employee.cua_so_bat_dau_sai = now
        employee.so_lan_dang_nhap_sai = 1
    else:
        employee.so_lan_dang_nhap_sai += 1

    if (
        employee.so_lan_dang_nhap_sai
        >= settings.login_max_failed_attempts
    ):
        employee.khoa_den = now + lock_duration


def reset_failed_attempts(
    employee: NhanVien,
) -> None:

    employee.so_lan_dang_nhap_sai = 0
    employee.cua_so_bat_dau_sai = None
    employee.khoa_den = None


def get_remaining_lock_seconds(
    employee: NhanVien,
    now: datetime,
) -> int:

    if employee.khoa_den is None:
        return 0

    remaining = (
        employee.khoa_den - now
    ).total_seconds()

    return max(0, ceil(remaining))


def authenticate_employee(
    db: Session,
    identifier: str,
    password: str,
    request: Request,
) -> NhanVien:

    now = utc_now()

    employee = get_employee_by_identifier(
        db,
        identifier,
        for_update=True,
    )

    # Dummy hash prevents a simple timing difference
    # from revealing whether an account exists.
    password_hash = (
        employee.mat_khau
        if employee is not None
        else _DUMMY_PASSWORD_HASH
    )

    password_valid = verify_password(
        password,
        password_hash,
    )

    if employee is None:
        _record_login_event(
            db,
            employee=None,
            identifier=identifier,
            action="DANG_NHAP_THAT_BAI",
            request=request,
            now=now,
        )
        db.commit()
        raise HTTPException(
            status_code=401,
            detail=GENERIC_LOGIN_ERROR,
        )

    if employee.trang_thai != "HOAT_DONG":
        _record_login_event(
            db,
            employee=employee,
            identifier=identifier,
            action="DANG_NHAP_THAT_BAI",
            request=request,
            now=now,
        )
        db.commit()
        raise HTTPException(
            status_code=401,
            detail=GENERIC_LOGIN_ERROR,
        )

    remaining = get_remaining_lock_seconds(
        employee,
        now,
    )

    if remaining > 0:
        _record_login_event(
            db,
            employee=employee,
            identifier=identifier,
            action="DANG_NHAP_THAT_BAI",
            request=request,
            now=now,
        )
        db.commit()
        raise HTTPException(
            status_code=423,
            detail=(
                "Tài khoản đang bị khóa. "
                f"Vui lòng thử lại sau {remaining} giây."
            ),
        )

    if not password_valid:
        register_failed_attempt(
            db,
            employee,
            now,
        )

        _record_login_event(
            db,
            employee=employee,
            identifier=identifier,
            action="DANG_NHAP_THAT_BAI",
            request=request,
            now=now,
        )
        db.commit()

        remaining = get_remaining_lock_seconds(
            employee,
            now,
        )

        if remaining > 0:
            raise HTTPException(
                status_code=423,
                detail=(
                    "Tài khoản đã bị khóa do đăng nhập sai quá "
                    f"{settings.login_max_failed_attempts} lần. "
                    f"Vui lòng thử lại sau {remaining} giây."
                ),
            )

        raise HTTPException(
            status_code=401,
            detail=GENERIC_LOGIN_ERROR,
        )

    reset_failed_attempts(employee)

    _record_login_event(
        db,
        employee=employee,
        identifier=identifier,
        action="DANG_NHAP_THANH_CONG",
        request=request,
        now=now,
    )
    db.commit()
    db.refresh(employee)

    return employee


def create_login_session(
    db: Session,
    employee: NhanVien,
    request: Request,
) -> str:

    now = utc_now()

    token = generate_session_token()
    token_hash = hash_session_token(token)

    expires_at = now + timedelta(
        minutes=settings.session_idle_minutes
    )

    session = PhienDangNhap(
        nhan_vien_id=employee.id,
        token_hash=token_hash,
        ip_address=(
            request.client.host
            if request.client
            else None
        ),
        user_agent=request.headers.get("user-agent"),
        created_at=now,
        last_activity_at=now,
        expires_at=expires_at,
    )

    db.add(session)
    db.commit()

    return token


def hash_password_for_storage(password: str) -> str:
    return hash_password(password)