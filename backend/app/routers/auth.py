from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_session_token
from app.database.session import get_db
from app.dependencies.auth import get_current_user, get_request_session_token
from app.models.nhan_vien import NhanVien
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.models.phien_dang_nhap import PhienDangNhap
from app.schemas.auth import (
    ChangePasswordRequest,
    ChangePasswordResponse,
    LoginRequest,
    LoginResponse,
    UserResponse,
)
from app.services.auth_service import (
    authenticate_employee,
    change_employee_password,
    create_login_session,
    utc_now,
)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])


def user_to_response(user: NhanVien) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.ten_dang_nhap,
        full_name=user.ho_ten,
        role=user.vai_tro,
        must_change_password=user.su_dung_mat_khau_tam,
    )


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    employee = authenticate_employee(
        db=db,
        identifier=payload.identifier.strip(),
        password=payload.password,
    )
    session_token = create_login_session(db=db, employee=employee, request=request)

    db.add(
        NhatKyThaoTac(
            nhan_vien_id=employee.id,
            hanh_dong="DANG_NHAP",
            doi_tuong="PHIEN_DANG_NHAP",
            du_lieu_moi={"ket_qua": "THANH_CONG"},
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )
    db.commit()

    # Keep cookie for backward-compatible API clients. The React app uses the
    # returned bearer token in sessionStorage, which isolates tabs.
    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.session_idle_minutes * 60,
        path="/",
    )

    return LoginResponse(
        message="Đăng nhập thành công.",
        user=user_to_response(employee),
        access_token=session_token,
    )


@router.post("/change-password", response_model=ChangePasswordResponse)
def change_password(
    payload: ChangePasswordRequest,
    response: Response,
    current_user: NhanVien = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    change_employee_password(
        db,
        employee=current_user,
        current_password=payload.current_password,
        new_password=payload.new_password,
        confirm_password=payload.confirm_password,
    )
    response.delete_cookie(key=settings.session_cookie_name, path="/")
    return ChangePasswordResponse(
        message="Đổi mật khẩu thành công. Các phiên đăng nhập cũ đã bị vô hiệu.",
        logout_required=True,
    )


@router.post("/logout")
def logout(
    response: Response,
    request: Request,
    current_user: NhanVien = Depends(get_current_user),
    session_token: str | None = Depends(get_request_session_token),
    db: Session = Depends(get_db),
):
    if session_token:
        session = db.query(PhienDangNhap).filter(
            PhienDangNhap.token_hash == hash_session_token(session_token),
            PhienDangNhap.nhan_vien_id == current_user.id,
        ).first()
        if session:
            session.revoked_at = utc_now()
            db.add(
                NhatKyThaoTac(
                    nhan_vien_id=current_user.id,
                    hanh_dong="DANG_XUAT",
                    doi_tuong="PHIEN_DANG_NHAP",
                    doi_tuong_id=session.id,
                    du_lieu_moi={"ket_qua": "THANH_CONG"},
                    ip_address=request.client.host if request.client else None,
                    user_agent=request.headers.get("user-agent"),
                )
            )
            db.commit()

    response.delete_cookie(key=settings.session_cookie_name, path="/")
    return {"message": "Đăng xuất thành công."}


@router.get("/me", response_model=UserResponse)
def me(current_user: NhanVien = Depends(get_current_user)):
    return user_to_response(current_user)
