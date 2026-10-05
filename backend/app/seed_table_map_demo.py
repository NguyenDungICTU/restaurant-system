import secrets

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import SessionLocal
from app.models.ban import Ban, BanQRToken
from app.models.khu_vuc import KhuVuc


AREA_NAMES = ("S2-07 Demo A", "S2-07 Demo B")
TABLE_STATUSES = ("TRONG", "DA_DAT", "DANG_SU_DUNG", "DANG_DON")


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

        table_codes = {
            f"S207-DEMO-{area_suffix}-{table_number:02d}"
            for area_suffix in ("A", "B")
            for table_number in range(1, 5)
        }
        existing_codes = set(
            db.scalars(
                select(Ban.ma_ban).where(Ban.ma_ban.in_(table_codes))
            )
        )

        for area_suffix, area_name in zip(("A", "B"), AREA_NAMES):
            for table_number, table_status in enumerate(
                TABLE_STATUSES,
                start=1,
            ):
                table_code = (
                    f"S207-DEMO-{area_suffix}-{table_number:02d}"
                )
                if table_code in existing_codes:
                    continue

                table = Ban(
                    ma_ban=table_code,
                    khu_vuc_id=areas[area_name].id,
                    suc_chua_toi_thieu=1,
                    suc_chua_toi_da=4,
                    loai_ban="THUONG",
                    trang_thai=table_status,
                    qr_token=create_unique_qr_token(db),
                )
                db.add(table)
                db.flush()
                db.add(
                    BanQRToken(
                        token=table.qr_token,
                        ban_id=table.id,
                    )
                )
                tables_created += 1

    print(
        f"Đã tạo {areas_created} khu vực demo và "
        f"{tables_created} bàn demo mới."
    )
    return areas_created, tables_created


if __name__ == "__main__":
    seed_table_map_demo()
