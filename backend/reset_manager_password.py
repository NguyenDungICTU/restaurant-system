from getpass import getpass

from app.core.security import hash_password
from app.database.session import SessionLocal
from app.models.nhan_vien import NhanVien


def main():
    password = getpass("New password: ")

    if len(password) < 8:
        raise ValueError("Password must have at least 8 characters.")

    confirm = getpass("Confirm password: ")

    if password != confirm:
        raise ValueError("Passwords do not match.")

    db = SessionLocal()

    try:
        employee = (
            db.query(NhanVien)
            .filter(NhanVien.ten_dang_nhap == "manager")
            .first()
        )

        if employee is None:
            print("Manager account not found.")
            return

        employee.mat_khau = hash_password(password)
        employee.so_lan_dang_nhap_sai = 0
        employee.cua_so_bat_dau_sai = None
        employee.khoa_den = None

        db.commit()

        print("Manager password reset successfully.")

    finally:
        db.close()


if __name__ == "__main__":
    main()