from getpass import getpass

from app.core.security import hash_password
from app.database.session import SessionLocal
from app.models.nhan_vien import NhanVien


def main():

    username = input(
        "Username: "
    ).strip()

    phone = input(
        "Phone: "
    ).strip()

    full_name = input(
        "Full name: "
    ).strip()

    password = getpass(
        "Password: "
    )

    if len(password) < 8:
        raise ValueError(
            "Password must have at least 8 characters."
        )

    db = SessionLocal()

    try:

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

        print(
            f"Manager '{username}' created successfully."
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()