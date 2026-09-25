from fastapi import APIRouter, Depends, HTTPException

from app.dependencies.auth import get_current_user
from app.models.nhan_vien import NhanVien


router = APIRouter(
    prefix="/api/workspace",
    tags=["Role permissions"],
)


# PO permission matrix for this story.
# QUAN_LY is allowed to use all configured workspaces.
PERMISSIONS = {
    "QUAN_LY": {
        "dashboard",
        "bookings",
        "customers",
        "menu-management",
        "orders",
        "employees",
        "areas",
        "reports",
        "settings",
        "table-map",
        "order-entry",
        "kitchen",
        "daily-menu",
        "checkout",
        "invoices",
        "shift-close",
    },
    "PHUC_VU": {
        "table-map",
        "bookings",
        "order-entry",
    },
    "BEP": {
        "kitchen",
        "daily-menu",
    },
    "THU_NGAN": {
        "checkout",
        "invoices",
        "shift-close",
    },
}


RESOURCE_LABELS = {
    "dashboard": "Tổng quan",
    "bookings": "Danh sách đặt bàn",
    "customers": "Khách hàng",
    "menu-management": "Quản lý thực đơn",
    "orders": "Đơn hàng",
    "employees": "Tài khoản nhân viên",
    "areas": "Khu vực",
    "reports": "Báo cáo",
    "settings": "Cài đặt",
    "table-map": "Sơ đồ bàn",
    "order-entry": "Màn hình gọi món",
    "kitchen": "Màn hình bếp",
    "daily-menu": "Danh sách món trong ngày",
    "checkout": "Thanh toán",
    "invoices": "Hóa đơn",
    "shift-close": "Chốt ca",
}


@router.get("/{resource}")
def check_workspace_access(
    resource: str,
    current_user: NhanVien = Depends(get_current_user),
):
    """
    Server-side authorization gate used by the SPA before rendering
    a working screen. A direct request to a forbidden resource returns 403.
    """

    if resource not in RESOURCE_LABELS:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "WORKSPACE_NOT_FOUND",
                "message": "Không tìm thấy chức năng được yêu cầu.",
            },
        )

    role_permissions = PERMISSIONS.get(
        current_user.vai_tro,
        set(),
    )

    if resource not in role_permissions:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "FORBIDDEN",
                "message": (
                    "Bạn không có quyền truy cập "
                    f"{RESOURCE_LABELS[resource]}."
                ),
                "resource": resource,
                "role": current_user.vai_tro,
            },
        )

    return {
        "allowed": True,
        "resource": resource,
        "resource_label": RESOURCE_LABELS[resource],
        "role": current_user.vai_tro,
    }
