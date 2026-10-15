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
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.roles import require_roles
from app.models.ban import Ban
from app.models.dat_ban import DatBan
from app.models.hoa_don import HoaDon
from app.models.lich_hoat_dong import LichHoatDong
from app.models.nhan_vien import NhanVien
from app.models.phien_ban import PhienBan
from app.services.revenue_report import build_hourly_revenue, summarize_invoices, validate_report_range

# Reuse the router declared above so both /dishes and /revenue are registered.
# Do not reassign `router` here: main.py imports this module-level object.
TZ = ZoneInfo("Asia/Ho_Chi_Minh")


@router.get("/revenue")
def revenue_report(
    start_date: date | None = Query(default=None, alias="from"),
    end_date: date | None = Query(default=None, alias="to"),
    db: Session = Depends(get_db),
    user: NhanVien = Depends(require_roles("QUAN_LY")),
):
    today = datetime.now(TZ).date()
    start = start_date or today
    end = end_date or start
    try:
        validate_report_range(start, end)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    start_at = datetime.combine(start, time.min, tzinfo=TZ)
    end_at = datetime.combine(end + timedelta(days=1), time.min, tzinfo=TZ)
    invoices = list(db.scalars(select(HoaDon).where(
        HoaDon.chot_at >= start_at,
        HoaDon.chot_at < end_at,
        HoaDon.trang_thai == "DA_CHOT",
    ).order_by(HoaDon.chot_at)))

    summary = summarize_invoices(invoices)
    schedules = list(db.scalars(select(LichHoatDong)))
    open_hours = [(item.thu, item.gio_mo_cua, item.gio_dong_cua)
                  for item in schedules if not item.la_ngay_nghi]
    hourly = build_hourly_revenue(invoices, start, end, TZ, open_hours)

    active_table_ids = set(db.scalars(select(PhienBan.ban_id).where(
        PhienBan.trang_thai.in_(("DANG_PHUC_VU", "CHO_THANH_TOAN"))
    )))
    # Guest counts are based on check-ins recorded by the booking workflow.
    # Walk-in sessions have no guest-count field in the current schema.
    guests = db.scalar(select(func.coalesce(
        func.sum(DatBan.so_luong_khach), 0
    )).where(
        DatBan.khach_toi_at >= start_at,
        DatBan.khach_toi_at < end_at,
        DatBan.khach_toi_at.is_not(None),
    )) or 0

    return {
        "from": start.isoformat(),
        "to": end.isoformat(),
        "days": (end - start).days + 1,
        **summary,
        "guest_count": int(guests),
        "active_tables": len(active_table_ids),
        "hourly": hourly,
        "no_data": not summary["has_transactions"],
        "updated_at": datetime.now(TZ).isoformat(),
        "guest_count_note": "Lượt khách từ đặt bàn đã ghi nhận khách đến; phiên khách vãng lai chưa có trường lưu số người.",
    }
