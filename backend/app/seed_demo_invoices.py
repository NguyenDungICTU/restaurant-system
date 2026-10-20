"""Idempotently seed 28 paid demo invoices across the last 14 calendar days.

Only DEMO-* rows are created/updated. Existing business records are never deleted.
"""
from datetime import datetime, timedelta, time, timezone
from decimal import Decimal

from sqlalchemy import select, func

from app.database.session import SessionLocal
from app.models.ban import Ban
from app.models.dong_goi_mon import DongGoiMon
from app.models.dot_goi_mon import DotGoiMon
from app.models.hoa_don import HoaDon
from app.models.mon_an import MonAn
from app.models.nhan_vien import NhanVien
from app.models.phien_ban import PhienBan

TARGET_DEMO_INVOICES = 28


def seed_demo_invoices() -> int:
    db = SessionLocal()
    created = 0
    try:
        manager = db.scalar(
            select(NhanVien).where(NhanVien.ten_dang_nhap == "manager")
        )
        if manager is None:
            manager = db.scalar(
                select(NhanVien).where(NhanVien.vai_tro == "QUAN_LY")
                .order_by(NhanVien.id)
            )
        if manager is None:
            print("Demo invoices skipped: no manager/cashier employee exists.")
            return 0

        tables = list(db.scalars(select(Ban).order_by(Ban.id)).all())
        dishes = list(db.scalars(
            select(MonAn).where(MonAn.trang_thai == "DANG_BAN").order_by(MonAn.id)
        ).all())
        if not tables or not dishes:
            print("Demo invoices skipped: tables or active dishes are missing.")
            return 0

        existing_demo = int(db.scalar(
            select(func.count(HoaDon.id)).where(HoaDon.so_hoa_don.like("DEMO-%"))
        ) or 0)
        missing = max(0, TARGET_DEMO_INVOICES - existing_demo)
        if missing == 0:
            print(f"Demo invoices already ready: {existing_demo}/{TARGET_DEMO_INVOICES}.")
            return 0

        vn_tz = timezone(timedelta(hours=7))
        now = datetime.now(vn_tz)
        # The deterministic slots cover each of the previous 14 calendar days.
        slots = []
        for day_offset in range(13, -1, -1):
            day = (now - timedelta(days=day_offset)).date()
            slots.extend([
                datetime.combine(day, time(11, 45), tzinfo=vn_tz),
                datetime.combine(day, time(19, 15), tzinfo=vn_tz),
            ])

        for slot_index, invoice_time in enumerate(slots):
            code = f"DEMO-{invoice_time.strftime('%Y%m%d')}-{1 if slot_index % 2 == 0 else 2:02d}"
            if db.scalar(select(HoaDon.id).where(HoaDon.so_hoa_don == code)) is not None:
                continue
            if existing_demo + created >= TARGET_DEMO_INVOICES:
                break

            table = tables[slot_index % len(tables)]
            session = PhienBan(
                ban_id=table.id,
                trang_thai="DA_DONG",
                bat_dau_at=invoice_time - timedelta(minutes=55),
                cho_thanh_toan_at=invoice_time - timedelta(minutes=5),
                dong_at=invoice_time,
                created_by=manager.id,
                created_at=invoice_time - timedelta(minutes=55),
                updated_at=invoice_time,
            )
            db.add(session)
            db.flush()

            order_batch = DotGoiMon(
                phien_ban_id=session.id,
                so_dot=1,
                gui_at=invoice_time - timedelta(minutes=40),
                created_by=manager.id,
            )
            db.add(order_batch)
            db.flush()

            selected_dishes = [dishes[slot_index % len(dishes)], dishes[(slot_index + 3) % len(dishes)]]
            subtotal = Decimal("0")
            for line_index, dish in enumerate(selected_dishes):
                quantity = 1 + ((slot_index + line_index) % 2)
                price = Decimal(str(dish.gia))
                subtotal += price * quantity
                db.add(DongGoiMon(
                    dot_goi_mon_id=order_batch.id,
                    mon_an_id=dish.id,
                    so_luong=quantity,
                    don_gia=price,
                    trang_thai="DA_PHUC_VU",
                    thoi_diem_tiep_nhan=invoice_time - timedelta(minutes=38),
                    bat_dau_che_bien_at=invoice_time - timedelta(minutes=32),
                    hoan_thanh_at=invoice_time - timedelta(minutes=18),
                    phuc_vu_at=invoice_time - timedelta(minutes=15),
                    tinh_tien=True,
                    ban_goc_id=table.id,
                    created_at=invoice_time - timedelta(minutes=38),
                    updated_at=invoice_time,
                ))

            # Store each historical invoice with matching session/order timestamps.
            db.add(HoaDon(
                so_hoa_don=code,
                phien_ban_id=session.id,
                ca_lam_viec_id=None,
                tong_tien_hang=subtotal,
                giam_gia_phan_tram=Decimal("0"),
                giam_gia_so_tien=Decimal("0"),
                tong_thanh_toan=subtotal,
                phuong_thuc="TIEN_MAT" if slot_index % 2 == 0 else "CHUYEN_KHOAN",
                tien_khach_dua=subtotal if slot_index % 2 == 0 else None,
                tien_thoi=Decimal("0") if slot_index % 2 == 0 else None,
                trang_thai="DA_CHOT",
                nguoi_chot_id=manager.id,
                chot_at=invoice_time,
                created_at=invoice_time,
            ))
            created += 1

        db.commit()
        total = int(db.scalar(select(func.count(HoaDon.id)).where(HoaDon.so_hoa_don.like("DEMO-%"))) or 0)
        print(f"Demo invoices seed complete: created {created}; total DEMO invoices {total}/{TARGET_DEMO_INVOICES}.")
        return created
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
