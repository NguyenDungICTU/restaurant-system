import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.ban import Ban, BanQRToken
from app.models.khu_vuc import KhuVuc


AREA_NAMES = ("Demo - Tầng 1", "Demo - Tầng 2", "Demo - Sân vườn")
TABLE_STATUSES = ("TRONG",)


def create_unique_qr_token(db: Session) -> str:
    while True:
        token = secrets.token_urlsafe(32)
        table_exists = db.scalar(
            select(Ban.id).where(Ban.qr_token == token)
        )
        token_exists = db.get(BanQRToken, token)

        if table_exists is None and token_exists is None:
            return token


def seed_table_map_demo() -> tuple[int, int]:
    areas_created = 0
    tables_created = 0

    with SessionLocal.begin() as db:
        areas = {
            area.ten_khu_vuc: area
            for area in db.scalars(
                select(KhuVuc).where(
                    KhuVuc.ten_khu_vuc.in_(AREA_NAMES)
                )
            )
        }

        for name in AREA_NAMES:
            if name not in areas:
                area = KhuVuc(ten_khu_vuc=name)
                db.add(area)
                db.flush()
                areas[name] = area
                areas_created += 1

        # Idempotently ensure 25 tables spread across the three demo areas.
        for area_index, area_name in enumerate(AREA_NAMES, start=1):
            area = areas[area_name]
            count_for_area = (9, 8, 8)[area_index - 1]
            for local_number in range(1, count_for_area + 1):
                table_code = f"DEMO-{area_index}-{local_number:02d}"
                exists = db.scalar(select(Ban.id).where(Ban.ma_ban == table_code))
                if exists is not None:
                    continue
                table = Ban(
                    ma_ban=table_code,
                    khu_vuc_id=area.id,
                    suc_chua_toi_thieu=1,
                    suc_chua_toi_da=4 if local_number % 3 else 6,
                    loai_ban="PHONG_RIENG" if local_number % 7 == 0 else "THUONG",
                    trang_thai="TRONG",
                    qr_token=create_unique_qr_token(db),
                )
                db.add(table)
                db.flush()
                db.add(BanQRToken(token=table.qr_token, ban_id=table.id))
                tables_created += 1

    print(
        f"Đã tạo {areas_created} khu vực demo và "
        f"{tables_created} bàn demo mới."
    )
    return areas_created, tables_created


if __name__ == "__main__":
    seed_table_map_demo()
