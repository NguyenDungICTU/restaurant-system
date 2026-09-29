"""Yêu cầu đặt bàn, xác nhận, từ chối và phân bàn."""

from datetime import datetime
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.roles import require_roles
from app.models.ban import Ban
from app.models.dat_ban import DatBan
from app.models.lich_hoat_dong import CauHinhDatBan, LichHoatDong, NgayNghiDacBiet
from app.models.nhan_vien import NhanVien
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.schemas.dat_ban import (
    DatBanCreate,
    DatBanHomNayResponse,
    DatBanResponse,
    DoiBanDatBan,
    TraCuuDatBanResponse,
    TuChoiDatBan,
    XacNhanDatBan,
)
from app.services.booking_decision import (
    REJECTION_REASON_LABELS,
    appointment_at,
    can_move_booking,
    confirmation_message,
    minutes,
    moved_message,
    overlaps,
    rejection_message,
)
from app.services.today_bookings import build_today_booking_list

router = APIRouter(prefix="/api/dat-ban", tags=["Đặt bàn"])
VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def _minutes(value) -> int:
    return minutes(value)


def _available_tables(
    db: Session,
    booking: DatBan,
    *,
    exclude_booking_id: int | None = None,
):
    start = _minutes(booking.gio_bat_dau)
    end = start + booking.thoi_luong_giu_ban

    confirmed_query = select(DatBan).where(
        DatBan.ngay_dat == booking.ngay_dat,
        DatBan.trang_thai == "DA_XAC_NHAN",
        DatBan.ban_id.is_not(None),
    )

    if exclude_booking_id is not None:
        confirmed_query = confirmed_query.where(
            DatBan.id != exclude_booking_id
        )

    occupied_ids = set()

    for existing in db.scalars(confirmed_query).all():
        existing_start = _minutes(existing.gio_bat_dau)
        existing_end = existing_start + existing.thoi_luong_giu_ban

        if overlaps(start, end, existing_start, existing_end):
            occupied_ids.add(existing.ban_id)

    table_query = select(Ban).where(
        Ban.trang_thai != "NGUNG_SU_DUNG",
        Ban.suc_chua_toi_da >= booking.so_luong_khach,
    )

    if booking.khu_vuc_yeu_cau_id is not None:
        table_query = table_query.where(
            Ban.khu_vuc_id == booking.khu_vuc_yeu_cau_id
        )

    tables = db.scalars(
        table_query.order_by(
            Ban.suc_chua_toi_da,
            Ban.ma_ban,
        )
    ).all()

    return [
        table
        for table in tables
        if table.id not in occupied_ids
    ]


def _audit(
    db: Session,
    user: NhanVien,
    action: str,
    booking_id: int,
    old_data: dict | None,
    new_data: dict | None,
):
    db.add(
        NhatKyThaoTac(
            nhan_vien_id=user.id,
            hanh_dong=action,
            doi_tuong="DAT_BAN",
            doi_tuong_id=booking_id,
            du_lieu_cu=old_data,
            du_lieu_moi=new_data,
        )
    )


def _notify_customer(booking: DatBan, message: str):
    booking.thong_bao_khach = message
    booking.thong_bao_gui_luc = datetime.now(VIETNAM_TZ)


@router.get("", response_model=list[DatBanResponse])
def lay_danh_sach_dat_ban(
    current_user: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU")),
    db: Session = Depends(get_db),
):
    statement = select(DatBan).order_by(
        DatBan.ngay_dat.desc(),
        DatBan.gio_bat_dau.desc(),
        DatBan.id.desc(),
    )
    return list(db.scalars(statement).all())


@router.get(
    "/hom-nay",
    response_model=list[DatBanHomNayResponse],
)
def lay_danh_sach_dat_ban_hom_nay(
    trang_thai: Literal[
        "CHO_XAC_NHAN",
        "DA_XAC_NHAN",
        "DA_HUY",
        "KHACH_KHONG_TOI",
    ]
    | None = Query(default=None),
    current_user: NhanVien = Depends(
        require_roles("QUAN_LY", "PHUC_VU")
    ),
    db: Session = Depends(get_db),
):
    now = datetime.now(VIETNAM_TZ)

    statement = select(DatBan).where(
        DatBan.ngay_dat == now.date()
    )

    if trang_thai is not None:
        statement = statement.where(
            DatBan.trang_thai == trang_thai
        )

    statement = statement.order_by(
        DatBan.gio_bat_dau.asc(),
        DatBan.id.asc(),
    )

    rows = list(db.scalars(statement).all())
    return build_today_booking_list(rows, now, trang_thai)


@router.post("", response_model=DatBanResponse, status_code=201)
def tao_yeu_cau_dat_ban(
    payload: DatBanCreate,
    current_user: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU")),
    db: Session = Depends(get_db),
):
    start_at = datetime.combine(
        payload.ngay_dat,
        payload.gio_bat_dau,
        VIETNAM_TZ,
    )
    if start_at <= datetime.now(VIETNAM_TZ):
        raise HTTPException(
            status_code=400,
            detail="Ngày và giờ đặt bàn phải ở tương lai.",
        )

    holiday = db.get(NgayNghiDacBiet, payload.ngay_dat)
    if holiday is not None:
        raise HTTPException(
            status_code=400,
            detail=f"Nhà hàng nghỉ đặc biệt: {holiday.ten_ngay_nghi}.",
        )

    schedule = db.get(LichHoatDong, payload.ngay_dat.weekday())
    if schedule is None:
        raise HTTPException(
            status_code=409,
            detail="Chưa cấu hình lịch mở cửa cho ngày này.",
        )
    if schedule.la_ngay_nghi:
        raise HTTPException(
            status_code=400,
            detail="Nhà hàng nghỉ theo lịch tuần vào ngày này.",
        )
    if schedule.gio_mo_cua is None or schedule.gio_dong_cua is None:
        raise HTTPException(
            status_code=409,
            detail="Lịch mở cửa chưa hợp lệ.",
        )

    start = _minutes(payload.gio_bat_dau)
    opening = _minutes(schedule.gio_mo_cua)
    closing = _minutes(schedule.gio_dong_cua)
    if start < opening or (start - opening) % 30:
        raise HTTPException(
            status_code=400,
            detail="Giờ bắt đầu phải nằm trong giờ mở cửa và đúng mốc 30 phút kể từ giờ mở.",
        )

    config = db.get(CauHinhDatBan, 1)
    duration = config.thoi_luong_giu_ban if config else 90
    if duration < 30 or duration > 720 or duration % 30:
        raise HTTPException(
            status_code=409,
            detail="Thời lượng giữ bàn chưa hợp lệ.",
        )
    if start + duration > closing:
        raise HTTPException(
            status_code=400,
            detail=f"Không đủ {duration} phút giữ bàn trước giờ đóng cửa.",
        )

    booking = DatBan(
        ho_ten_khach=payload.ho_ten_khach,
        so_dien_thoai=payload.so_dien_thoai,
        so_luong_khach=payload.so_luong_khach,
        ngay_dat=payload.ngay_dat,
        gio_bat_dau=payload.gio_bat_dau,
        thoi_luong_giu_ban=duration,
        trang_thai="CHO_XAC_NHAN",
        khu_vuc_yeu_cau_id=payload.khu_vuc_yeu_cau_id,
        ghi_chu=payload.ghi_chu,
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


@router.patch("/{booking_id}/huy", response_model=DatBanResponse)
def huy_yeu_cau_dat_ban(
    booking_id: int,
    current_user: NhanVien = Depends(require_roles("QUAN_LY", "PHUC_VU")),
    db: Session = Depends(get_db),
):
    booking = db.get(DatBan, booking_id)
    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy yêu cầu đặt bàn.",
        )
    if booking.trang_thai not in {"CHO_XAC_NHAN", "DA_HUY"}:
        raise HTTPException(
            status_code=409,
            detail="Không thể hủy đơn ở trạng thái hiện tại.",
        )
    booking.trang_thai = "DA_HUY"
    db.commit()
    db.refresh(booking)
    return booking


@router.get("/{booking_id}/ban-trong")
def lay_ban_trong(
    booking_id: int,
    current_user: NhanVien = Depends(
        require_roles("QUAN_LY", "PHUC_VU")
    ),
    db: Session = Depends(get_db),
):
    booking = db.get(DatBan, booking_id)

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy yêu cầu đặt bàn.",
        )

    if booking.trang_thai not in {"CHO_XAC_NHAN", "DA_XAC_NHAN"}:
        raise HTTPException(
            status_code=409,
            detail="Trạng thái đơn không cho phép gợi ý bàn.",
        )

    if appointment_at(booking) <= datetime.now(VIETNAM_TZ):
        raise HTTPException(
            status_code=409,
            detail="Đơn đã tới hoặc quá giờ hẹn.",
        )

    tables = _available_tables(
        db,
        booking,
        exclude_booking_id=(
            booking.id
            if booking.trang_thai == "DA_XAC_NHAN"
            else None
        ),
    )

    available = [
        {
            "id": table.id,
            "ma_ban": table.ma_ban,
            "suc_chua_toi_da": table.suc_chua_toi_da,
            "khu_vuc_id": table.khu_vuc_id,
        }
        for table in tables
    ]

    return {
        "booking_id": booking.id,
        "so_luong_khach": booking.so_luong_khach,
        "khu_vuc_yeu_cau_id": booking.khu_vuc_yeu_cau_id,
        "so_ban_trong": len(available),
        "ban_trong": available,
    }


@router.post("/{booking_id}/xac-nhan")
def xac_nhan_va_phan_ban(
    booking_id: int,
    payload: XacNhanDatBan,
    current_user: NhanVien = Depends(
        require_roles("QUAN_LY", "PHUC_VU")
    ),
    db: Session = Depends(get_db),
):
    booking = db.scalar(
        select(DatBan)
        .where(DatBan.id == booking_id)
        .with_for_update()
    )

    if booking is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy đơn đặt bàn.",
        )

    if booking.trang_thai != "CHO_XAC_NHAN":
        raise HTTPException(
            status_code=409,
            detail="Đơn không còn ở trạng thái chờ xác nhận.",
        )

    table = db.scalar(
        select(Ban)
        .where(Ban.id == payload.ban_id)
        .with_for_update()
    )

    if table is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn.")

    if appointment_at(booking) <= datetime.now(VIETNAM_TZ):
        raise HTTPException(status_code=409, detail="Đơn đã quá giờ bắt đầu.")

    if db.get(NgayNghiDacBiet, booking.ngay_dat) is not None:
        raise HTTPException(
            status_code=409,
            detail="Ngày đặt hiện là ngày nghỉ đặc biệt.",
        )

    schedule = db.get(LichHoatDong, booking.ngay_dat.weekday())
    if (
        schedule is None
        or schedule.la_ngay_nghi
        or schedule.gio_mo_cua is None
        or schedule.gio_dong_cua is None
    ):
        raise HTTPException(
            status_code=409,
            detail="Lịch mở cửa không còn phù hợp để xác nhận.",
        )

    start = _minutes(booking.gio_bat_dau)
    end = start + booking.thoi_luong_giu_ban
    opening = _minutes(schedule.gio_mo_cua)
    closing = _minutes(schedule.gio_dong_cua)

    if start < opening or end > closing or (start - opening) % 30 != 0:
        raise HTTPException(
            status_code=409,
            detail="Giờ đặt không còn phù hợp lịch hoạt động.",
        )

    available_ids = {
        candidate.id
        for candidate in _available_tables(db, booking)
    }
    if table.id not in available_ids:
        raise HTTPException(
            status_code=409,
            detail=(
                "Bàn không phù hợp hoặc không còn trống "
                "trong khung giờ này."
            ),
        )

    old_data = {
        "trang_thai": booking.trang_thai,
        "ban_id": booking.ban_id,
    }

    booking.ban_id = table.id
    booking.trang_thai = "DA_XAC_NHAN"
    booking.ly_do_tu_choi = None

    if table.trang_thai == "TRONG":
        table.trang_thai = "DA_DAT"

    _notify_customer(
        booking,
        confirmation_message(booking, table),
    )

    _audit(
        db,
        current_user,
        "XAC_NHAN_DAT_BAN",
        booking.id,
        old_data,
        {
            "trang_thai": booking.trang_thai,
            "ban_id": table.id,
            "ma_ban": table.ma_ban,
        },
    )

    db.commit()
    db.refresh(booking)

    return {
        "id": booking.id,
        "ban_id": table.id,
        "ma_ban": table.ma_ban,
        "trang_thai": booking.trang_thai,
        "thong_bao_khach": booking.thong_bao_khach,
        "message": "Đã phân bàn, xác nhận và tạo thông báo cho khách.",
    }


@router.post("/{booking_id}/tu-choi")
def tu_choi_dat_ban(
    booking_id: int,
    payload: TuChoiDatBan,
    current_user: NhanVien = Depends(
        require_roles("QUAN_LY", "PHUC_VU")
    ),
    db: Session = Depends(get_db),
):
    booking = db.scalar(
        select(DatBan)
        .where(DatBan.id == booking_id)
        .with_for_update()
    )

    if booking is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt bàn.")

    if booking.trang_thai != "CHO_XAC_NHAN":
        raise HTTPException(
            status_code=409,
            detail="Chỉ được từ chối đơn đang chờ xác nhận.",
        )

    old_data = {
        "trang_thai": booking.trang_thai,
        "ly_do_tu_choi": booking.ly_do_tu_choi,
    }

    booking.trang_thai = "DA_HUY"
    booking.ly_do_tu_choi = payload.ly_do
    _notify_customer(
        booking,
        rejection_message(booking, payload.ly_do),
    )

    _audit(
        db,
        current_user,
        "TU_CHOI_DAT_BAN",
        booking.id,
        old_data,
        {
            "trang_thai": booking.trang_thai,
            "ly_do_tu_choi": booking.ly_do_tu_choi,
        },
    )

    db.commit()
    db.refresh(booking)

    return {
        "id": booking.id,
        "trang_thai": booking.trang_thai,
        "ly_do": booking.ly_do_tu_choi,
        "ly_do_hien_thi": REJECTION_REASON_LABELS[booking.ly_do_tu_choi],
        "thong_bao_khach": booking.thong_bao_khach,
        "message": "Đã từ chối và tạo thông báo cho khách.",
    }


@router.post("/{booking_id}/doi-ban")
def doi_ban_dat_ban(
    booking_id: int,
    payload: DoiBanDatBan,
    current_user: NhanVien = Depends(
        require_roles("QUAN_LY", "PHUC_VU")
    ),
    db: Session = Depends(get_db),
):
    booking = db.scalar(
        select(DatBan)
        .where(DatBan.id == booking_id)
        .with_for_update()
    )

    if booking is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy đơn đặt bàn.")

    if not can_move_booking(booking, datetime.now(VIETNAM_TZ)):
        raise HTTPException(
            status_code=409,
            detail="Chỉ được đổi bàn cho đơn đã xác nhận và trước giờ hẹn.",
        )

    if booking.ban_id == payload.ban_id:
        raise HTTPException(status_code=409, detail="Đơn đang ở bàn này.")

    new_table = db.scalar(
        select(Ban)
        .where(Ban.id == payload.ban_id)
        .with_for_update()
    )
    if new_table is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn mới.")

    available_ids = {
        item.id
        for item in _available_tables(
            db,
            booking,
            exclude_booking_id=booking.id,
        )
    }
    if new_table.id not in available_ids:
        raise HTTPException(
            status_code=409,
            detail="Bàn mới không còn trống hoặc không phù hợp.",
        )

    old_table = db.get(Ban, booking.ban_id) if booking.ban_id else None
    old_id = booking.ban_id
    old_code = old_table.ma_ban if old_table else None

    booking.ban_id = new_table.id
    if new_table.trang_thai == "TRONG":
        new_table.trang_thai = "DA_DAT"

    if old_table is not None and old_table.trang_thai == "DA_DAT":
        another = db.scalar(
            select(DatBan.id)
            .where(
                DatBan.id != booking.id,
                DatBan.ban_id == old_table.id,
                DatBan.trang_thai == "DA_XAC_NHAN",
            )
            .limit(1)
        )
        if another is None:
            old_table.trang_thai = "TRONG"

    _notify_customer(
        booking,
        moved_message(booking, new_table),
    )

    _audit(
        db,
        current_user,
        "DOI_BAN_DAT_BAN",
        booking.id,
        {"ban_id": old_id, "ma_ban": old_code},
        {"ban_id": new_table.id, "ma_ban": new_table.ma_ban},
    )

    db.commit()
    db.refresh(booking)

    return {
        "id": booking.id,
        "ban_id_cu": old_id,
        "ma_ban_cu": old_code,
        "ban_id_moi": new_table.id,
        "ma_ban_moi": new_table.ma_ban,
        "trang_thai": booking.trang_thai,
        "thong_bao_khach": booking.thong_bao_khach,
        "message": "Đã đổi bàn và ghi nhật ký thao tác.",
    }


@router.get("/tra-cuu", response_model=TraCuuDatBanResponse)
def tra_cuu_dat_ban_cho_khach(
    ma_dat_ban: str = Query(min_length=1, max_length=30),
    so_dien_thoai: str = Query(min_length=10, max_length=10),
    db: Session = Depends(get_db),
):
    normalized = ma_dat_ban.strip().upper()
    if normalized.startswith("DB-"):
        normalized = normalized[3:]

    if not normalized.isdigit():
        raise HTTPException(status_code=400, detail="Mã đặt bàn không hợp lệ.")

    booking = db.get(DatBan, int(normalized))
    if booking is None or booking.so_dien_thoai != so_dien_thoai.strip():
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy lượt đặt bàn phù hợp.",
        )

    phone = booking.so_dien_thoai

    return TraCuuDatBanResponse(
        ma_dat_ban=f"DB-{booking.id:06d}",
        ho_ten_khach=booking.ho_ten_khach,
        so_dien_thoai_da_che=f"{phone[:3]}****{phone[-3:]}",
        ngay_dat=booking.ngay_dat,
        gio_bat_dau=booking.gio_bat_dau,
        so_luong_khach=booking.so_luong_khach,
        trang_thai=booking.trang_thai,
        ten_ban=booking.ten_ban,
        ly_do_tu_choi=booking.ly_do_tu_choi,
        ly_do_tu_choi_hien_thi=(
            REJECTION_REASON_LABELS.get(booking.ly_do_tu_choi)
            if booking.ly_do_tu_choi
            else None
        ),
        thong_bao_khach=booking.thong_bao_khach,
        thong_bao_gui_luc=booking.thong_bao_gui_luc,
    )
