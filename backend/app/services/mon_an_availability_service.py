from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.mon_an import MonAn

from fastapi import HTTPException
HO_CHI_MINH = ZoneInfo("Asia/Ho_Chi_Minh")


def next_midnight_vietnam(now: datetime | None = None) -> datetime:
    local_now = (now or datetime.now(HO_CHI_MINH)).astimezone(HO_CHI_MINH)
    tomorrow = (local_now + timedelta(days=1)).date()
    return datetime(
        tomorrow.year,
        tomorrow.month,
        tomorrow.day,
        tzinfo=HO_CHI_MINH,
    )


def reset_expired_temporary_sold_out(db: Session) -> int:
    """Safety net for requests after midnight and after an app restart.

    The normal reset is performed by the background job at 00:00 Asia/Ho_Chi_Minh.
    This lazy reset guarantees stale TAM_HET rows are never exposed if the
    process was down at midnight.
    """
    now = datetime.now(HO_CHI_MINH)
    dishes = db.scalars(
        select(MonAn).where(MonAn.trang_thai == "TAM_HET")
    ).all()

    changed = 0
    for dish in dishes:
        updated_at = dish.updated_at
        if updated_at is None:
            dish.trang_thai = "DANG_BAN"
            changed += 1
            continue

        if updated_at.tzinfo is None:
            updated_at = updated_at.replace(tzinfo=ZoneInfo("UTC"))
        updated_local = updated_at.astimezone(HO_CHI_MINH)
        if updated_local.date() < now.date():
            dish.trang_thai = "DANG_BAN"
            changed += 1

    if changed:
        db.commit()
    return changed


def set_temporary_sold_out(
    db: Session,
    dish: MonAn,
    sold_out: bool,
) -> tuple[str, str | None]:
    old_status = dish.trang_thai

    dish.trang_thai = "TAM_HET" if sold_out else "DANG_BAN"
    return old_status, None
# --- BỔ SUNG CHO S3-10 VÀO CUỐI FILE ---

def validate_mon_an_availability(db: Session, mon_an_ids: list[int]) -> None:
    if not mon_an_ids:
        return

    # Tự động reset các món tạm hết đã qua ngày mới trước khi kiểm tra
    reset_expired_temporary_sold_out(db)

    # Truy vấn trạng thái các món từ Database
    dishes = db.scalars(
        select(MonAn).where(MonAn.id.in_(mon_an_ids))
    ).all()
    dish_map = {dish.id: dish for dish in dishes}

    unavailable_dishes = []
    for dish_id in mon_an_ids:
        dish = dish_map.get(dish_id)
        if not dish:
            raise HTTPException(
                status_code=404,
                detail=f"Món ăn ID {dish_id} không tồn tại."
            )
        # Kiểm tra nếu trạng thái là TAM_HET
        if dish.trang_thai == "TAM_HET":
            unavailable_dishes.append(dish)

    # Ném lỗi 400 kèm thông tin chi tiết nếu có món tạm hết
    if unavailable_dishes:
        unavailable_ids = [d.id for d in unavailable_dishes]
        unavailable_names = [getattr(d, 'ten_mon', getattr(d, 'name', f"Món #{d.id}")) for d in unavailable_dishes]
        names_str = ", ".join([f"'{name}'" for name in unavailable_names])

        raise HTTPException(
            status_code=400,
            detail={
                "code": "ITEM_UNAVAILABLE",
                "message": f"Món {names_str} hiện đã tạm hết.",
                "unavailable_item_ids": unavailable_ids,
                "unavailable_item_names": unavailable_names
            }
        )