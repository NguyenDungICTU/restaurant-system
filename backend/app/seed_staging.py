"""Reset/reseed repeatable staging demo data. Run inside backend container.
Only deletes demo bookings identified by phone prefix 09999; never run against production.
"""
import os
from datetime import date, datetime, time, timedelta
from sqlalchemy import select, delete
from app.core.security import hash_password
from app.database.session import SessionLocal
from app.models.nhan_vien import NhanVien
from app.models.dat_ban import DatBan
from app.models.ban import Ban
from app.models.khu_vuc import KhuVuc
from app.seed_demo import seed_restaurant_sample
from app.seed_table_map_demo import seed_table_map_demo

DEMO_USERS = [
    ("stg_manager", "0999900001", "QUAN_LY", "Staging Quản lý"),
    ("stg_waiter", "0999900002", "PHUC_VU", "Staging Phục vụ"),
    ("stg_kitchen", "0999900003", "BEP", "Staging Bếp"),
    ("stg_cashier", "0999900004", "THU_NGAN", "Staging Thu ngân"),
]
PASSWORD = os.getenv("STAGING_DEMO_PASSWORD", "StagingDemo123!")

def main():
    if len(PASSWORD) < 8:
        raise ValueError("STAGING_DEMO_PASSWORD must be at least 8 characters")
    seed_table_map_demo()
    seed_restaurant_sample()
    db = SessionLocal()
    try:
        # Reset only records created by this script, then recreate the known baseline.
        db.execute(delete(DatBan).where(DatBan.so_dien_thoai.like("09999%")))
        for username, phone, role, full_name in DEMO_USERS:
            user = db.scalar(select(NhanVien).where(NhanVien.ten_dang_nhap == username))
            if user is None:
                user = NhanVien(ten_dang_nhap=username, so_dien_thoai=phone,
                    mat_khau=hash_password(PASSWORD), ho_ten=full_name,
                    vai_tro=role, trang_thai="HOAT_DONG")
                db.add(user)
            else:
                user.so_dien_thoai=phone
                user.mat_khau=hash_password(PASSWORD)
                user.ho_ten=full_name
                user.vai_tro=role
                user.trang_thai="HOAT_DONG"
                if hasattr(user, "su_dung_mat_khau_tam"):
                    user.su_dung_mat_khau_tam=False
        areas = list(db.scalars(select(KhuVuc).where(KhuVuc.ten_khu_vuc.in_(
            ["Demo - Tầng 1", "Demo - Tầng 2", "Demo - Sân vườn"]))))
        tables = list(db.scalars(select(Ban).where(Ban.ma_ban.like("DEMO-%")).order_by(Ban.id)))
        for table in tables:
            table.trang_thai = "TRONG"
        today = date.today()
        for i in range(20):
            table = tables[i % len(tables)] if tables else None
            area = next((a for a in areas if table and a.id == table.khu_vuc_id), areas[i % len(areas)] if areas else None)
            db.add(DatBan(
                ma_dat_ban=f"S{i:05d}",
                ho_ten_khach=f"Khách diễn tập {i+1:02d}",
                so_dien_thoai=f"09999{i+100:05d}"[-10:],
                so_luong_khach=2 + (i % 5),
                ngay_dat=today + timedelta(days=(i % 7) - 3),
                gio_bat_dau=time(11 + (i % 9), (i % 4) * 15),
                thoi_luong_giu_ban=90,
                trang_thai="DA_XAC_NHAN" if i % 3 else "CHO_XAC_NHAN",
                ban_id=table.id if table else None,
                khu_vuc_id=area.id if area else None,
                ghi_chu="Dữ liệu staging có thể reset",
                email=f"staging.guest{i+1}@example.com",
            ))
        db.commit()
        print("STAGING_RESET_OK: 4 roles, 3 demo areas, 25 demo tables, 60 dishes, 20 bookings.")
        print("Accounts: stg_manager / stg_waiter / stg_kitchen / stg_cashier")
        print("Password: STAGING_DEMO_PASSWORD (default StagingDemo123!)")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    main()
