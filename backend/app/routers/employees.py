from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_manager
from app.models.nhan_vien import NhanVien
from app.schemas.employees import (
    AvailabilityResponse,
    EmployeeCreate,
    EmployeeCreatedResponse,
    EmployeeResponse,
    EmployeeStatusUpdate,
)
from app.services.employee_service import (
    create_employee,
    phone_exists,
    update_employee_status,
    username_exists,
)


router = APIRouter(
    prefix="/api/employees",
    tags=["Employees"],
)


def employee_to_response(employee: NhanVien) -> EmployeeResponse:
    return EmployeeResponse(
        id=employee.id,
        full_name=employee.ho_ten,
        phone=employee.so_dien_thoai,
        username=employee.ten_dang_nhap,
        role=employee.vai_tro,
        status=employee.trang_thai,
    )


@router.get("/availability/username", response_model=AvailabilityResponse)
def check_username(
    username: str = Query(min_length=3, max_length=50),
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    normalized = username.strip().lower()
    available = not username_exists(db, normalized)
    return AvailabilityResponse(
        available=available,
        field="username",
        message=None if available else "Tên đăng nhập đã được sử dụng.",
    )


@router.get("/availability/phone", response_model=AvailabilityResponse)
def check_phone(
    phone: str = Query(min_length=9, max_length=20),
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    # Reuse request-model normalization/validation.
    probe = EmployeeCreate(
        full_name="Probe User",
        phone=phone,
        username="probe_user",
        role="PHUC_VU",
    )
    available = not phone_exists(db, probe.phone)
    return AvailabilityResponse(
        available=available,
        field="phone",
        message=None if available else "Số điện thoại đã được sử dụng.",
    )


@router.post("", response_model=EmployeeCreatedResponse, status_code=201)
def create_employee_account(
    payload: EmployeeCreate,
    request: Request,
    db: Session = Depends(get_db),
    manager: NhanVien = Depends(require_manager),
):
    employee, temporary_password = create_employee(
        db,
        payload=payload,
        manager=manager,
        request=request,
    )
    return EmployeeCreatedResponse(
        **employee_to_response(employee).model_dump(),
        temporary_password=temporary_password,
        message="Tạo tài khoản thành công. Hãy lưu mật khẩu tạm ngay; hệ thống sẽ không hiển thị lại.",
    )


@router.patch("/{employee_id}/status", response_model=EmployeeResponse)
def change_employee_status(
    employee_id: int,
    payload: EmployeeStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    manager: NhanVien = Depends(require_manager),
):
    employee = update_employee_status(
        db,
        employee_id=employee_id,
        status=payload.status,
        manager=manager,
        request=request,
    )
    return employee_to_response(employee)
