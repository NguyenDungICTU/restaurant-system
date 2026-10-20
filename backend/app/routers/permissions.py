"""Manager-only permission matrix used for pre-handover review."""
from fastapi import APIRouter, Depends
from app.dependencies.roles import require_roles

router = APIRouter(prefix="/api/admin", tags=["permission-review"])

ROLES = [
    {"key": "QUAN_LY", "label": "Quản lý"},
    {"key": "PHUC_VU", "label": "Phục vụ"},
    {"key": "BEP", "label": "Bếp"},
    {"key": "THU_NGAN", "label": "Thu ngân"},
]
MODULES = [
    {"key": "menu_price", "label": "Quản lý món và sửa giá"},
    {"key": "revenue", "label": "Báo cáo doanh thu"},
    {"key": "employees", "label": "Tài khoản nhân viên"},
    {"key": "tables_bookings", "label": "Bàn và đặt bàn"},
    {"key": "orders", "label": "Gọi món / xử lý món"},
    {"key": "billing", "label": "Thanh toán / hóa đơn"},
    {"key": "audit", "label": "Nhật ký hệ thống"},
]
# Explicit review contract. Enforcement still belongs to each endpoint dependency.
ACCESS = {
    "QUAN_LY": {"menu_price", "revenue", "employees", "tables_bookings", "orders", "billing", "audit"},
    "PHUC_VU": {"tables_bookings", "orders"},
    "BEP": {"orders"},
    "THU_NGAN": {"billing"},
}

@router.get("/permission-matrix")
def permission_matrix(_user=Depends(require_roles("QUAN_LY"))):
    return {
        "roles": ROLES,
        "modules": MODULES,
        "matrix": [
            {"role": role["key"], "module": module["key"], "allowed": module["key"] in ACCESS[role["key"]]}
            for role in ROLES for module in MODULES
        ],
        "note": "Ma trận rà soát nghiệp vụ; API từng module vẫn phải có dependency phân quyền tương ứng.",
    }
