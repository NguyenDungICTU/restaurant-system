"""Create the development demo manager account if it does not exist.

This script is intentionally idempotent: restarting the backend will not create
another account or overwrite an existing manager password.
"""

import os

from sqlalchemy import or_

from app.core.security import hash_password
from app.database.session import SessionLocal
from app.models.nhan_vien import NhanVien


DEFAULT_USERNAME = "manager"
DEFAULT_PHONE = "0963217400"
DEFAULT_PASSWORD = "demo12345"
DEFAULT_FULL_NAME = "Quản lý nhà hàng"


def env(name: str, default: str) -> str:
    value = os.getenv(name, default).strip()
    return value or default


def seed_demo_account() -> bool:
    username = env("DEMO_USERNAME", DEFAULT_USERNAME)
    phone = env("DEMO_PHONE", DEFAULT_PHONE)
    password = os.getenv("DEMO_PASSWORD", DEFAULT_PASSWORD)
    full_name = env("DEMO_FULL_NAME", DEFAULT_FULL_NAME)

    if len(password) < 8:
        raise ValueError("DEMO_PASSWORD must contain at least 8 characters.")

    db = SessionLocal()
    try:
        employee = db.query(NhanVien).filter(
            or_(
                NhanVien.ten_dang_nhap == username,
                NhanVien.so_dien_thoai == phone,
            )
        ).first()

        if employee is not None:
            print("Demo account already exists; keeping the existing password.")
            return False

        employee = NhanVien(
            ten_dang_nhap=username,
            so_dien_thoai=phone,
            mat_khau=hash_password(password),
            ho_ten=full_name,
            vai_tro="QUAN_LY",
            trang_thai="HOAT_DONG",
        )

        db.add(employee)
        db.commit()
        print(f"Demo account created: username={username}, phone={phone}")
        return True
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_account()
