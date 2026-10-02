from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.mon_an import MonAn

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
