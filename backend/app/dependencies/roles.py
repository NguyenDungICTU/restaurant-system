from fastapi import Depends, HTTPException

from app.dependencies.auth import get_current_user
from app.models.nhan_vien import NhanVien


ROLE_LABELS = {
    "QUAN_LY": "Quản lý",
    "PHUC_VU": "Phục vụ",
    "BEP": "Bếp",
    "THU_NGAN": "Thu ngân",
}


def require_roles(*allowed_roles: str):
    """
    Reusable server-side authorization dependency.

    Usage:
        current_user: NhanVien = Depends(require_roles("QUAN_LY"))
        current_user: NhanVien = Depends(require_roles("PHUC_VU", "QUAN_LY"))
    """

    allowed = set(allowed_roles)

    def dependency(
        current_user: NhanVien = Depends(get_current_user),
    ) -> NhanVien:
        if current_user.vai_tro not in allowed:
            role_label = ROLE_LABELS.get(
                current_user.vai_tro,
                current_user.vai_tro,
            )

            raise HTTPException(
                status_code=403,
                detail={
                    "code": "FORBIDDEN",
                    "message": (
                        f"Vai trò {role_label} không có quyền "
                        "truy cập chức năng này."
                    ),
                },
            )

        return current_user

    return dependency
