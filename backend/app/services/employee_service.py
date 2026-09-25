import secrets

from fastapi import HTTPException, Request
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.models.nhan_vien import NhanVien
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.models.phien_dang_nhap import PhienDangNhap
from app.schemas.employees import EmployeeCreate
from app.services.auth_service import utc_now


ALLOWED_ROLES = {"QUAN_LY", "PHUC_VU", "BEP", "THU_NGAN"}
ALLOWED_STATUSES = {"HOAT_DONG", "DA_NGHI"}


def generate_temporary_password(length: int = 8) -> str:
    if length != 8:
        raise ValueError("Temporary password length must be exactly 8.")

    lower = "abcdefghijkmnopqrstuvwxyz"
    upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    digits = "23456789"
    alphabet = lower + upper + digits

    chars = [
        secrets.choice(lower),
        secrets.choice(upper),
        secrets.choice(digits),
    ]
    chars.extend(
        secrets.choice(alphabet)
        for _ in range(length - len(chars))
    )
    secrets.SystemRandom().shuffle(chars)
    return "".join(chars)


def username_exists(db: Session, username: str) -> bool:
    return db.scalar(
        select(NhanVien.id).where(
            NhanVien.ten_dang_nhap == username
        )
    ) is not None


def phone_exists(db: Session, phone: str) -> bool:
    return db.scalar(
        select(NhanVien.id).where(
            NhanVien.so_dien_thoai == phone
        )
    ) is not None


def _audit(
    db: Session,
    *,
    actor_id: int,
    action: str,
    target_id: int,
    old_data: dict | None,
    new_data: dict | None,
    request: Request,
) -> None:
    db.add(
        NhatKyThaoTac(
            nhan_vien_id=actor_id,
            hanh_dong=action,
            doi_tuong="NHAN_VIEN",
            doi_tuong_id=target_id,
            du_lieu_cu=old_data,
            du_lieu_moi=new_data,
            ip_address=(
                request.client.host
                if request.client
                else None
            ),
            user_agent=request.headers.get("user-agent"),
        )
    )


def create_employee(
    db: Session,
    *,
    payload: EmployeeCreate,
    manager: NhanVien,
    request: Request,
) -> tuple[NhanVien, str]:
    if username_exists(db, payload.username):
        raise HTTPException(
            status_code=409,
            detail={
                "field": "username",
                "code": "USERNAME_EXISTS",
                "message": "Tên đăng nhập đã được sử dụng.",
            },
        )

    if phone_exists(db, payload.phone):
        raise HTTPException(
            status_code=409,
            detail={
                "field": "phone",
                "code": "PHONE_EXISTS",
                "message": "Số điện thoại đã được sử dụng.",
            },
        )

    temporary_password = generate_temporary_password()

    employee = NhanVien(
        ho_ten=payload.full_name,
        so_dien_thoai=payload.phone,
        ten_dang_nhap=payload.username,
        mat_khau=hash_password(temporary_password),
        vai_tro=payload.role,
        trang_thai=payload.status,
        su_dung_mat_khau_tam=True,
    )

    try:
        db.add(employee)
        db.flush()

        _audit(
            db,
            actor_id=manager.id,
            action="TAO_TAI_KHOAN_NHAN_VIEN",
            target_id=employee.id,
            old_data=None,
            new_data={
                "ho_ten": employee.ho_ten,
                "so_dien_thoai": employee.so_dien_thoai,
                "ten_dang_nhap": employee.ten_dang_nhap,
                "vai_tro": employee.vai_tro,
                "trang_thai": employee.trang_thai,
                "su_dung_mat_khau_tam": True,
            },
            request=request,
        )

        db.commit()
        db.refresh(employee)

    except IntegrityError:
        db.rollback()

        if username_exists(db, payload.username):
            detail = {
                "field": "username",
                "code": "USERNAME_EXISTS",
                "message": "Tên đăng nhập đã được sử dụng.",
            }
        elif phone_exists(db, payload.phone):
            detail = {
                "field": "phone",
                "code": "PHONE_EXISTS",
                "message": "Số điện thoại đã được sử dụng.",
            }
        else:
            detail = {
                "code": "EMPLOYEE_CONFLICT",
                "message": "Dữ liệu tài khoản bị trùng.",
            }

        raise HTTPException(
            status_code=409,
            detail=detail,
        )

    return employee, temporary_password


def update_employee_status(
    db: Session,
    *,
    employee_id: int,
    status: str,
    manager: NhanVien,
    request: Request,
) -> NhanVien:
    if status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=422,
            detail="Trạng thái không hợp lệ.",
        )

    employee = db.scalar(
        select(NhanVien)
        .where(NhanVien.id == employee_id)
        .with_for_update()
    )

    if employee is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy nhân viên.",
        )

    if employee.id == manager.id and status == "DA_NGHI":
        raise HTTPException(
            status_code=400,
            detail=(
                "Không thể tự đặt tài khoản quản lý hiện tại "
                "thành đã nghỉ."
            ),
        )

    old_status = employee.trang_thai

    if old_status == status:
        return employee

    employee.trang_thai = status
    now = utc_now()

    if status == "DA_NGHI":
        db.execute(
            update(PhienDangNhap)
            .where(
                PhienDangNhap.nhan_vien_id == employee.id,
                PhienDangNhap.revoked_at.is_(None),
            )
            .values(revoked_at=now)
        )

    _audit(
        db,
        actor_id=manager.id,
        action="CAP_NHAT_TRANG_THAI_NHAN_VIEN",
        target_id=employee.id,
        old_data={"trang_thai": old_status},
        new_data={"trang_thai": status},
        request=request,
    )

    db.commit()
    db.refresh(employee)

    return employee
