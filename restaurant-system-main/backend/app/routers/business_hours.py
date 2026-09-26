from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import get_current_user, require_manager
from app.models.dat_ban import DatBan
from app.models.gio_hoat_dong import (
    CauHinhDatBan,
    GioHoatDong,
    NgayNghiDacBiet,
)
from app.models.nhan_vien import NhanVien
from app.schemas.business_hours import (
    AvailableSlotsResponse,
    DailyHoursResponse,
    HolidayCreate,
    HolidayResponse,
    ReservationCreate,
    ReservationResponse,
    WeeklyHoursResponse,
    WeeklyHoursUpdate,
)


router = APIRouter(tags=["Business Hours and Reservations"])
LOCAL_TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")


def hours_response(db: Session) -> WeeklyHoursResponse:
    days = db.scalars(
        select(GioHoatDong).order_by(GioHoatDong.thu_trong_tuan)
    ).all()
    config = db.get(CauHinhDatBan, 1)
    if len(days) != 7 or config is None:
        raise HTTPException(
            status_code=500,
            detail="Lịch hoạt động chưa được khởi tạo đầy đủ.",
        )
    return WeeklyHoursResponse(
        days=[
            DailyHoursResponse(
                weekday=day.thu_trong_tuan,
                is_closed=day.ngay_nghi,
                open_time=day.gio_mo_cua,
                close_time=day.gio_dong_cua,
            )
            for day in days
        ],
        reservation_duration_minutes=config.thoi_luong_phut,
    )


@router.get("/api/business-hours", response_model=WeeklyHoursResponse)
def get_weekly_hours(
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    return hours_response(db)


@router.put("/api/business-hours", response_model=WeeklyHoursResponse)
def update_weekly_hours(
    payload: WeeklyHoursUpdate,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    current = {
        item.thu_trong_tuan: item
        for item in db.scalars(select(GioHoatDong)).all()
    }
    for item in payload.days:
        row = current.get(item.weekday)
        if row is None:
            row = GioHoatDong(thu_trong_tuan=item.weekday)
            db.add(row)
        row.ngay_nghi = item.is_closed
        row.gio_mo_cua = item.open_time
        row.gio_dong_cua = item.close_time

    config = db.get(CauHinhDatBan, 1)
    if config is None:
        config = CauHinhDatBan(id=1)
        db.add(config)
    config.thoi_luong_phut = payload.reservation_duration_minutes
    db.commit()
    return hours_response(db)


@router.get("/api/special-closures", response_model=list[HolidayResponse])
def list_special_closures(
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    return [
        HolidayResponse(id=row.id, date=row.ngay, note=row.ghi_chu)
        for row in db.scalars(
            select(NgayNghiDacBiet).order_by(NgayNghiDacBiet.ngay)
        ).all()
    ]


@router.post("/api/special-closures", response_model=HolidayResponse, status_code=201)
def create_special_closure(
    payload: HolidayCreate,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    row = NgayNghiDacBiet(ngay=payload.date, ghi_chu=payload.note.strip() if payload.note else None)
    db.add(row)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Ngày nghỉ đặc biệt đã được khai báo.",
        ) from error
    db.refresh(row)
    return HolidayResponse(id=row.id, date=row.ngay, note=row.ghi_chu)


@router.delete("/api/special-closures/{closure_id}", status_code=204)
def delete_special_closure(
    closure_id: int,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    row = db.get(NgayNghiDacBiet, closure_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy ngày nghỉ.")
    db.delete(row)
    db.commit()
    return None


def reservation_rules(
    db: Session,
    requested_date: date,
) -> tuple[GioHoatDong | None, int, str | None]:
    closure = db.scalar(
        select(NgayNghiDacBiet).where(NgayNghiDacBiet.ngay == requested_date)
    )
    if closure is not None:
        return None, 0, closure.ghi_chu or "Nhà hàng nghỉ vào ngày này."

    schedule = db.scalar(
        select(GioHoatDong).where(
            GioHoatDong.thu_trong_tuan == requested_date.weekday()
        )
    )
    config = db.get(CauHinhDatBan, 1)
    if schedule is None or config is None:
        raise HTTPException(
            status_code=500,
            detail="Lịch nhận đặt bàn chưa được cấu hình.",
        )
    if schedule.ngay_nghi:
        return None, config.thoi_luong_phut, "Nhà hàng nghỉ vào ngày này trong tuần."
    return schedule, config.thoi_luong_phut, None


@router.get("/api/reservations/slots", response_model=AvailableSlotsResponse)
def get_available_slots(
    requested_date: date,
    db: Session = Depends(get_db),
):
    schedule, duration, closed_message = reservation_rules(db, requested_date)
    if schedule is None:
        return AvailableSlotsResponse(
            date=requested_date,
            time_slots=[],
            closed=True,
            message=closed_message,
        )

    open_at = datetime.combine(requested_date, schedule.gio_mo_cua)
    close_at = datetime.combine(requested_date, schedule.gio_dong_cua)
    candidate = open_at.replace(second=0, microsecond=0)
    remainder = candidate.minute % 30
    if remainder:
        candidate += timedelta(minutes=30 - remainder)
    last_start = close_at - timedelta(minutes=duration)
    slots = []
    while candidate <= last_start:
        slots.append(candidate.time())
        candidate += timedelta(minutes=30)

    return AvailableSlotsResponse(
        date=requested_date,
        time_slots=slots,
        closed=False,
        message=None,
    )


def normalize_requested_start(
    db: Session,
    requested_date: date,
    requested_time: time,
) -> tuple[datetime, int]:
    if requested_time.minute not in (0, 30) or requested_time.second or requested_time.microsecond:
        raise HTTPException(
            status_code=422,
            detail="Khung giờ đặt bàn phải cách nhau 30 phút.",
        )
    schedule, duration, closed_message = reservation_rules(db, requested_date)
    if schedule is None:
        raise HTTPException(status_code=409, detail=closed_message)
    if requested_date < datetime.now(LOCAL_TIMEZONE).date():
        raise HTTPException(status_code=422, detail="Không thể đặt bàn vào ngày đã qua.")

    start = datetime.combine(requested_date, requested_time)
    open_at = datetime.combine(requested_date, schedule.gio_mo_cua)
    close_at = datetime.combine(requested_date, schedule.gio_dong_cua)
    if start < open_at or start + timedelta(minutes=duration) > close_at:
        raise HTTPException(
            status_code=409,
            detail="Thời gian yêu cầu nằm ngoài giờ nhận đặt bàn.",
        )
    return start.replace(tzinfo=LOCAL_TIMEZONE).astimezone(timezone.utc), duration


@router.post(
    "/api/reservations",
    response_model=ReservationResponse,
    status_code=201,
)
def create_reservation(
    payload: ReservationCreate,
    db: Session = Depends(get_db),
):
    starts_at, duration = normalize_requested_start(
        db,
        payload.reservation_date,
        payload.reservation_time,
    )
    row = DatBan(
        ten_khach=" ".join(payload.guest_name.strip().split()),
        so_dien_thoai=payload.phone.strip(),
        so_khach=payload.guests,
        bat_dau_at=starts_at,
        thoi_luong_phut=duration,
        ghi_chu=payload.note.strip() if payload.note else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return ReservationResponse(
        id=row.id,
        guest_name=row.ten_khach,
        phone=row.so_dien_thoai,
        guests=row.so_khach,
        starts_at=row.bat_dau_at.isoformat(),
        duration_minutes=row.thoi_luong_phut,
        note=row.ghi_chu,
        status=row.trang_thai,
    )


@router.get("/api/reservations", response_model=list[ReservationResponse])
def list_reservations(
    requested_date: date | None = None,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(get_current_user),
):
    statement = select(DatBan).order_by(DatBan.bat_dau_at.asc())
    if requested_date is not None:
        start = datetime.combine(requested_date, time.min, tzinfo=LOCAL_TIMEZONE)
        end = start + timedelta(days=1)
        statement = statement.where(
            DatBan.bat_dau_at >= start.astimezone(timezone.utc),
            DatBan.bat_dau_at < end.astimezone(timezone.utc),
        )
    rows = db.scalars(statement).all()
    return [
        ReservationResponse(
            id=row.id,
            guest_name=row.ten_khach,
            phone=row.so_dien_thoai,
            guests=row.so_khach,
            starts_at=row.bat_dau_at.isoformat(),
            duration_minutes=row.thoi_luong_phut,
            note=row.ghi_chu,
            status=row.trang_thai,
        )
        for row in rows
    ]
