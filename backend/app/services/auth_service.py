from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from sqlalchemy import or_, select, update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    generate_session_token,
    hash_password,
    hash_session_token,
    verify_password,
)
from app.models.nhan_vien import NhanVien
from app.models.phien_dang_nhap import PhienDangNhap


GENERIC_LOGIN_ERROR = (
    "Tên đăng nhập/số điện thoại hoặc mật khẩu không đúng."
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_employee_by_identifier(
    db: Session,
    identifier: str,
    *,
    for_update: bool = False,
) -> NhanVien | None:

    statement = select(NhanVien).where(
        or_(
            NhanVien.ten_dang_nhap == identifier,
            NhanVien.so_dien_thoai == identifier,
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
        or now - employee.cua_so_bat_dau_sai > window
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

    return max(0, int(remaining))


def authenticate_employee(
    db: Session,
    identifier: str,
    password: str,
) -> NhanVien:

    now = utc_now()

    employee = get_employee_by_identifier(
        db,
        identifier,
        for_update=True,
    )

    dummy_hash = (
        "$2b$12$"
        "LQv3c1yqBWJZQfXQzj3F7."
        "JjH0qXxJQW3Q1qH8QvK2C2"
    )

    password_hash = (
        employee.mat_khau
        if employee is not None
        else dummy_hash
    )

    password_valid = verify_password(
        password,
        password_hash,
    )

    if employee is None:
        raise HTTPException(
            status_code=401,
            detail=GENERIC_LOGIN_ERROR,
        )

    if employee.trang_thai != "HOAT_DONG":
        raise HTTPException(
            status_code=401,
            detail=GENERIC_LOGIN_ERROR,
        )

    remaining = get_remaining_lock_seconds(
        employee,
        now,
    )

    if remaining > 0:
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


def validate_new_password(
    current_password: str,
    new_password: str,
    confirm_password: str,
) -> None:
    if new_password != confirm_password:
        raise HTTPException(
            status_code=422,
            detail="Xác nhận mật khẩu không khớp.",
        )

    if len(new_password) < 8:
        raise HTTPException(
            status_code=422,
            detail="Mật khẩu mới phải có ít nhất 8 ký tự.",
        )

    if not any(character.isalpha() for character in new_password):
        raise HTTPException(
            status_code=422,
            detail="Mật khẩu mới phải có ít nhất một chữ cái.",
        )

    if not any(character.isdigit() for character in new_password):
        raise HTTPException(
            status_code=422,
            detail="Mật khẩu mới phải có ít nhất một chữ số.",
        )

    if new_password == current_password:
        raise HTTPException(
            status_code=422,
            detail="Mật khẩu mới không được trùng mật khẩu hiện tại.",
        )


def change_employee_password(
    db: Session,
    *,
    employee: NhanVien,
    current_password: str,
    new_password: str,
    confirm_password: str,
) -> None:
    # This check is deliberately separate from authenticate_employee().
    # Therefore a wrong current password here NEVER increments the
    # login-failure counter and NEVER locks the account.
    if not verify_password(
        current_password,
        employee.mat_khau,
    ):
        raise HTTPException(
            status_code=400,
            detail="Mật khẩu hiện tại không đúng.",
        )

    validate_new_password(
        current_password=current_password,
        new_password=new_password,
        confirm_password=confirm_password,
    )

    now = utc_now()

    employee.mat_khau = hash_password(new_password)
    employee.su_dung_mat_khau_tam = False

    # AC: after changing password, every old login session is invalid.
    # This includes the session that performed the password change.
    db.execute(
        update(PhienDangNhap)
        .where(
            PhienDangNhap.nhan_vien_id == employee.id,
            PhienDangNhap.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )

    db.commit()
