from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    hash_password,
    hash_session_token,
    verify_password,
)
from app.database.session import get_db
from app.dependencies.auth import get_session_user
from app.models.nhan_vien import NhanVien
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.models.phien_dang_nhap import PhienDangNhap
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    UserResponse,
)
from app.services.auth_service import (
    authenticate_employee,
    create_login_session,
    utc_now,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)


def user_to_response(user: NhanVien) -> UserResponse:
    return UserResponse(
        id=user.id,
        username=user.ten_dang_nhap,
        full_name=user.ho_ten,
        role=user.vai_tro,
        password_change_required=user.doi_mat_khau_lan_dau,
    )


@router.post("/login", response_model=LoginResponse)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    employee = authenticate_employee(
        db=db,
        identifier=payload.identifier.strip(),
        password=payload.password,
        request=request,
    )

    session_token = create_login_session(
        db=db,
        employee=employee,
        request=request,
    )

    response.set_cookie(
        key=settings.session_cookie_name,
        value=session_token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        path="/",
    )

    return LoginResponse(
        message="Đăng nhập thành công.",
        user=user_to_response(employee),
    )


@router.post("/logout")
def logout(
    response: Response,
    request: Request,
    current_user: NhanVien = Depends(get_session_user),
    db: Session = Depends(get_db),
):
    token = request.cookies.get(settings.session_cookie_name)
    if token:
        token_hash = hash_session_token(token)
        session = db.query(PhienDangNhap).filter(
            PhienDangNhap.token_hash == token_hash,
            PhienDangNhap.nhan_vien_id == current_user.id,
        ).first()
        if session:
            session.revoked_at = utc_now()
            db.commit()

    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
    )
    return {"message": "Đăng xuất thành công."}


@router.get("/me", response_model=UserResponse)
def me(
    current_user: NhanVien = Depends(get_session_user),
):
    return user_to_response(current_user)


@router.post("/change-password")
def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    response: Response,
    current_user: NhanVien = Depends(get_session_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.mat_khau):
        raise HTTPException(
            status_code=400,
            detail="Mật khẩu hiện tại không đúng.",
        )
    if verify_password(payload.new_password, current_user.mat_khau):
        raise HTTPException(
            status_code=422,
            detail="Mật khẩu mới không được trùng mật khẩu hiện tại.",
        )

    now = utc_now()
    current_user.mat_khau = hash_password(payload.new_password)
    current_user.doi_mat_khau_lan_dau = False
    db.execute(
        update(PhienDangNhap)
        .where(
            PhienDangNhap.nhan_vien_id == current_user.id,
            PhienDangNhap.revoked_at.is_(None),
        )
        .values(revoked_at=now)
    )
    db.add(
        NhatKyThaoTac(
            nhan_vien_id=current_user.id,
            vai_tro=current_user.vai_tro,
            tai_khoan=current_user.ten_dang_nhap,
            hanh_dong="DOI_MAT_KHAU_LAN_DAU",
            doi_tuong="NHAN_VIEN",
            doi_tuong_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
            created_at=now,
        )
    )
    db.commit()
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
    )
    return {"message": "Đổi mật khẩu thành công. Vui lòng đăng nhập lại."}
