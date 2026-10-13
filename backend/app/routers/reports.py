from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_manager
from app.models.dong_goi_mon import DongGoiMon
from app.models.mon_an import MonAn
from app.models.nhan_vien import NhanVien
from app.schemas.report import (
    CancelledDishItem,
    DishReportResponse,
    DishReportSummary,
    ReportRankItem,
)

router = APIRouter(prefix="/api/reports", tags=["Reports"])
VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
TOP_LIMIT = 10


def _range(from_date: date, to_date: date) -> tuple[datetime, datetime]:
    if from_date > to_date:
        raise HTTPException(
            status_code=422,
            detail="Ngày bắt đầu không được lớn hơn ngày kết thúc.",
        )

    start = datetime.combine(from_date, time.min, tzinfo=VIETNAM_TZ)
    end = datetime.combine(
        to_date + timedelta(days=1),
        time.min,
        tzinfo=VIETNAM_TZ,
    )
    return start, end


def _is_discontinued(status: str | None) -> bool:
    return status not in {"DANG_BAN", "TAM_HET"}


def _rank_items(rows: list[dict], *, by: str) -> list[ReportRankItem]:
    if by == "quantity":
        ordered = sorted(
            rows,
            key=lambda row: (
                -row["so_luong_ban"],
                -row["doanh_thu"],
                row["ten_mon"].casefold(),
                row["mon_an_id"],
            ),
        )
    else:
        ordered = sorted(
            rows,
            key=lambda row: (
                -row["doanh_thu"],
                -row["so_luong_ban"],
                row["ten_mon"].casefold(),
                row["mon_an_id"],
            ),
        )

    return [
        ReportRankItem(
            rank=index,
            mon_an_id=row["mon_an_id"],
            ten_mon=row["ten_mon"],
            trang_thai_hien_tai=row["trang_thai_hien_tai"],
            ngung_ban=_is_discontinued(row["trang_thai_hien_tai"]),
            so_luong_ban=row["so_luong_ban"],
            doanh_thu=row["doanh_thu"],
        )
        for index, row in enumerate(ordered[:TOP_LIMIT], start=1)
    ]


@router.get("/dishes", response_model=DishReportResponse)
def dish_report(
    from_date: date = Query(...),
    to_date: date = Query(...),
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    start, end = _range(from_date, to_date)

    sold_at = func.coalesce(
        DongGoiMon.phuc_vu_at,
        DongGoiMon.updated_at,
    )

    sold_rows = db.execute(
        select(
            MonAn.id.label("mon_an_id"),
            MonAn.ten_mon.label("ten_mon"),
            MonAn.trang_thai.label("trang_thai_hien_tai"),
            func.sum(DongGoiMon.so_luong).label("so_luong_ban"),
            func.sum(
                DongGoiMon.don_gia * DongGoiMon.so_luong
            ).label("doanh_thu"),
        )
        .join(DongGoiMon, DongGoiMon.mon_an_id == MonAn.id)
        .where(
            DongGoiMon.trang_thai == "DA_PHUC_VU",
            DongGoiMon.tinh_tien.is_(True),
            sold_at >= start,
            sold_at < end,
        )
        .group_by(
            MonAn.id,
            MonAn.ten_mon,
            MonAn.trang_thai,
        )
    ).all()

    sold = [
        {
            "mon_an_id": row.mon_an_id,
            "ten_mon": row.ten_mon,
            "trang_thai_hien_tai": row.trang_thai_hien_tai,
            "so_luong_ban": int(row.so_luong_ban or 0),
            "doanh_thu": Decimal(row.doanh_thu or 0),
        }
        for row in sold_rows
    ]

    cancel_at = func.coalesce(
        DongGoiMon.huy_at,
        DongGoiMon.updated_at,
    )

    cancelled_rows = db.execute(
        select(DongGoiMon, MonAn)
        .join(MonAn, MonAn.id == DongGoiMon.mon_an_id)
        .where(
            DongGoiMon.trang_thai == "DA_HUY",
            cancel_at >= start,
            cancel_at < end,
        )
        .order_by(
            DongGoiMon.mon_an_id.asc(),
            DongGoiMon.id.asc(),
        )
    ).all()

    cancelled_quantity: dict[int, int] = defaultdict(int)
    cancellation_reasons: dict[int, Counter[str]] = defaultdict(Counter)
    cancellation_dishes: dict[int, MonAn] = {}

    for line, dish in cancelled_rows:
        cancellation_dishes[dish.id] = dish
        cancelled_quantity[dish.id] += int(line.so_luong or 0)

        reason = (line.ly_do_huy or "").strip() or "Không ghi lý do"
        cancellation_reasons[dish.id][reason] += 1

    cancelled_payload: list[dict] = []

    for dish_id, quantity in cancelled_quantity.items():
        dish = cancellation_dishes[dish_id]
        reason_counts = cancellation_reasons[dish_id]
        highest = max(reason_counts.values(), default=0)

        tied_reasons = sorted(
            reason
            for reason, count in reason_counts.items()
            if count == highest
        )

        cancelled_payload.append(
            {
                "mon_an_id": dish.id,
                "ten_mon": dish.ten_mon,
                "trang_thai_hien_tai": dish.trang_thai,
                "so_luong_huy": quantity,
                "ly_do_pho_bien": (
                    " / ".join(tied_reasons)
                    if tied_reasons
                    else "Không ghi lý do"
                ),
                "ly_do_dong_hang": tied_reasons,
            }
        )

    cancelled_payload.sort(
        key=lambda row: (
            -row["so_luong_huy"],
            row["ten_mon"].casefold(),
            row["mon_an_id"],
        )
    )

    cancelled_items = [
        CancelledDishItem(
            rank=index,
            mon_an_id=row["mon_an_id"],
            ten_mon=row["ten_mon"],
            trang_thai_hien_tai=row["trang_thai_hien_tai"],
            ngung_ban=_is_discontinued(row["trang_thai_hien_tai"]),
            so_luong_huy=row["so_luong_huy"],
            ly_do_pho_bien=row["ly_do_pho_bien"],
            ly_do_dong_hang=row["ly_do_dong_hang"],
        )
        for index, row in enumerate(
            cancelled_payload[:TOP_LIMIT],
            start=1,
        )
    ]

    return DishReportResponse(
        from_date=from_date,
        to_date=to_date,
        top_by_quantity=_rank_items(sold, by="quantity"),
        top_by_revenue=_rank_items(sold, by="revenue"),
        cancelled_items=cancelled_items,
        summary=DishReportSummary(
            tong_so_luong_ban=sum(
                item["so_luong_ban"] for item in sold
            ),
            tong_doanh_thu=sum(
                (item["doanh_thu"] for item in sold),
                start=Decimal("0"),
            ),
            tong_so_luong_huy=sum(cancelled_quantity.values()),
        ),
    )
