from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.models.ban import Ban, BanQRToken
from app.models.dat_ban import DatBan
from app.models.dong_goi_mon import DongGoiMon
from app.models.dot_goi_mon import DotGoiMon
from app.models.mon_an import MonAn
from app.models.phien_ban import PhienBan
from app.schemas.customer_order import (
    CustomerOrderCreate,
    CustomerOrderLineResponse,
    CustomerOrderResponse,
    CustomerTableResponse,
)
from app.services.booking_decision import appointment_at

router = APIRouter(prefix="/api/customer", tags=["Khách hàng - QR"])
VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
RESERVATION_GUARD_MINUTES = 90
ACTIVE_SESSION_STATES = {"DANG_PHUC_VU", "CHO_THANH_TOAN"}


def _now() -> datetime:
    return datetime.now(VIETNAM_TZ)


def _next_reservation(db: Session, table_id: int, now: datetime):
    bookings = db.scalars(
        select(DatBan)
        .where(
            DatBan.ban_id == table_id,
            DatBan.trang_thai == "DA_XAC_NHAN",
            DatBan.khach_toi_at.is_(None),
        )
        .order_by(DatBan.ngay_dat, DatBan.gio_bat_dau, DatBan.id)
    ).all()
    for booking in bookings:
        start = appointment_at(booking)
        if start > now:
            return booking, start
    return None, None


def _get_table_by_qr(db: Session, qr_token: str, lock: bool = False) -> Ban:
    issued = db.get(BanQRToken, qr_token)
    if issued is None:
        raise HTTPException(status_code=404, detail="Mã QR không hợp lệ.")
    query = select(Ban).where(Ban.id == issued.ban_id)
    if lock:
        query = query.with_for_update()
    table = db.scalar(query)
    if table is None or table.qr_token != qr_token:
        raise HTTPException(status_code=410, detail="Mã QR đã thay đổi. Vui lòng quét mã mới.")
    if not table.da_cau_hinh:
        raise HTTPException(status_code=409, detail="Bàn chưa được cấu hình.")
    if table.trang_thai == "NGUNG_SU_DUNG":
        raise HTTPException(status_code=409, detail="Bàn đang ngừng sử dụng.")
    return table


def _active_session(db: Session, table_id: int, lock: bool = False):
    query = select(PhienBan).where(
        PhienBan.ban_id == table_id,
        PhienBan.trang_thai.in_(ACTIVE_SESSION_STATES),
    ).order_by(PhienBan.bat_dau_at.desc(), PhienBan.id.desc()).limit(1)
    if lock:
        query = query.with_for_update()
    return db.scalar(query)


def _table_state(db: Session, table: Ban, session_id: int | None = None) -> CustomerTableResponse:
    now = _now()
    session = _active_session(db, table.id)
    if session is not None and session.id != session_id:
        return CustomerTableResponse(
            qr_token=table.qr_token, ban_id=table.id, ma_ban=table.ma_ban,
            suc_chua_toi_thieu=table.suc_chua_toi_thieu or 1,
            suc_chua_toi_da=table.suc_chua_toi_da or 1, loai_ban=table.loai_ban or "THUONG",
            status="OCCUPIED", message="Bàn đang có khách. Vui lòng tìm nhân viên phục vụ để được sắp xếp bàn.",
            can_order=False, phien_ban_id=None,
        )

    booking, start = _next_reservation(db, table.id, now)
    if booking is not None:
        minutes = int((start - now).total_seconds() // 60)
        if minutes <= RESERVATION_GUARD_MINUTES:
            return CustomerTableResponse(
                qr_token=table.qr_token, ban_id=table.id, ma_ban=table.ma_ban,
                suc_chua_toi_thieu=table.suc_chua_toi_thieu or 1,
                suc_chua_toi_da=table.suc_chua_toi_da or 1, loai_ban=table.loai_ban or "THUONG",
                status="RESERVED_SOON",
                message=f"Bàn đã được đặt trước và còn khoảng {max(minutes, 0)} phút sẽ có khách đến. Vui lòng tìm nhân viên phục vụ để được dẫn sang bàn khác.",
                can_order=False, reservation_at=start, reservation_minutes=minutes,
                phien_ban_id=session.id if session else None,
            )

    return CustomerTableResponse(
        qr_token=table.qr_token, ban_id=table.id, ma_ban=table.ma_ban,
        suc_chua_toi_thieu=table.suc_chua_toi_thieu or 1,
        suc_chua_toi_da=table.suc_chua_toi_da or 1,
        loai_ban=table.loai_ban or "THUONG",
        status="AVAILABLE", message="Bàn có thể sử dụng. Bạn có thể xem menu và gọi món.",
        can_order=True, reservation_at=start,
        reservation_minutes=int((start-now).total_seconds() // 60) if start else None,
        phien_ban_id=session.id if session else None,
    )


def _line_response(line: DongGoiMon, dish: MonAn, batch_time: datetime) -> CustomerOrderLineResponse:
    eta = batch_time + timedelta(minutes=max(dish.thoi_gian_che_bien_phut, 0))
    return CustomerOrderLineResponse(
        id=line.id, mon_an_id=dish.id, ten_mon=dish.ten_mon, so_luong=line.so_luong,
        don_gia=line.don_gia,
        thanh_tien=(line.don_gia * line.so_luong) if line.tinh_tien else 0,
        ghi_chu=line.ghi_chu, trang_thai=line.trang_thai,
        du_kien_hoan_thanh_at=eta,
        tinh_tien=bool(line.tinh_tien),
        ly_do_huy=line.ly_do_huy,
        huy_at=line.huy_at,
    )


@router.get("/qr/{qr_token}", response_model=CustomerTableResponse)
def scan_customer_qr(
    qr_token: str,
    phien_ban_id: int | None = Query(default=None, gt=0),
    db: Session = Depends(get_db),
):
    table = _get_table_by_qr(db, qr_token)
    return _table_state(db, table, phien_ban_id)


@router.post("/orders", response_model=CustomerOrderResponse, status_code=201)
def create_customer_order(payload: CustomerOrderCreate, db: Session = Depends(get_db)):
    table = _get_table_by_qr(db, payload.qr_token, lock=True)
    now = _now()

    session = _active_session(db, table.id, lock=True)
    if payload.phien_ban_id is not None:
        if session is None or session.id != payload.phien_ban_id:
            db.rollback()
            raise HTTPException(status_code=409, detail="Phiên phục vụ không còn hợp lệ. Vui lòng quét lại mã QR.")
    elif session is not None:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Bàn đang có khách. Nếu bạn là khách của bàn này, hãy tiếp tục từ thiết bị đã mở trước đó.",
        )

    booking, start = _next_reservation(db, table.id, now)
    if booking is not None:
        minutes = int((start - now).total_seconds() // 60)
        if minutes <= RESERVATION_GUARD_MINUTES:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail=f"Bàn đã được đặt trước và còn {max(minutes, 0)} phút sẽ có khách đến. Vui lòng tìm nhân viên phục vụ.",
            )

    # Lock and validate every requested dish against the current menu state.
    dish_ids = [item.mon_an_id for item in payload.items]
    dishes = {
        dish.id: dish
        for dish in db.scalars(
            select(MonAn).where(
                MonAn.id.in_(dish_ids),
                MonAn.trang_thai == "DANG_BAN",
            ).with_for_update()
        ).all()
    }
    if len(dishes) != len(set(dish_ids)):
        db.rollback()
        raise HTTPException(status_code=409, detail="Một hoặc nhiều món vừa chuyển sang trạng thái tạm hết/ngừng bán. Vui lòng kiểm tra lại menu.")

    if session is None:
        session = PhienBan(
            ban_id=table.id, trang_thai="DANG_PHUC_VU",
            bat_dau_at=now, created_by=None,
        )
        db.add(session)
        db.flush()
        table.trang_thai = "DANG_SU_DUNG"

    max_dot = db.scalar(
        select(func.max(DotGoiMon.so_dot)).where(DotGoiMon.phien_ban_id == session.id)
    ) or 0
    batch = DotGoiMon(phien_ban_id=session.id, so_dot=max_dot + 1, gui_at=now, created_by=None)
    db.add(batch)
    db.flush()

    lines = []
    for item in payload.items:
        dish = dishes[item.mon_an_id]
        line = DongGoiMon(
            dot_goi_mon_id=batch.id, mon_an_id=dish.id, so_luong=item.so_luong,
            don_gia=dish.gia, ghi_chu=item.ghi_chu, trang_thai="CHO_BEP",
            thoi_diem_tiep_nhan=now, ban_goc_id=table.id, tinh_tien=True,
        )
        db.add(line)
        lines.append((line, dish))

    db.commit()
    for line, _ in lines:
        db.refresh(line)

    eta = max(
        (now + timedelta(minutes=max(dish.thoi_gian_che_bien_phut, 0)) for _, dish in lines),
        default=None,
    )
    total = sum((line.don_gia * line.so_luong for line, _ in lines), start=0)
    return CustomerOrderResponse(
        dot_id=batch.id, phien_ban_id=session.id, ban_id=table.id, ma_ban=table.ma_ban,
        gui_at=batch.gui_at, tong_tien=total, du_kien_hoan_thanh_at=eta,
        trang_thai="CHO_BEP",
        lines=[_line_response(line, dish, batch.gui_at) for line, dish in lines],
    )


@router.get("/orders/{phien_ban_id}", response_model=list[CustomerOrderResponse])
def get_customer_orders(phien_ban_id: int, qr_token: str = Query(...), db: Session = Depends(get_db)):
    table = _get_table_by_qr(db, qr_token)
    session = db.get(PhienBan, phien_ban_id)
    if session is None or session.ban_id != table.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên phục vụ.")
    batches = db.scalars(
        select(DotGoiMon).where(DotGoiMon.phien_ban_id == session.id).order_by(DotGoiMon.so_dot)
    ).all()
    result = []
    for batch in batches:
        rows = db.execute(
            select(DongGoiMon, MonAn).join(MonAn, MonAn.id == DongGoiMon.mon_an_id)
            .where(DongGoiMon.dot_goi_mon_id == batch.id)
            .order_by(DongGoiMon.id)
        ).all()
        lines = [_line_response(line, dish, batch.gui_at) for line, dish in rows]
        total = sum((line.don_gia * line.so_luong for line, _ in rows if line.tinh_tien), start=0)
        statuses = [line.trang_thai for line, _ in rows]
        if rows and all(status == "DA_HUY" for status in statuses):
            status = "DA_HUY"
        elif rows and all(status in {"DA_XONG", "DA_PHUC_VU", "DA_HUY"} for status in statuses):
            status = "DA_XONG"
        elif any(status == "DANG_CHE_BIEN" for status in statuses):
            status = "DANG_CHE_BIEN"
        else:
            status = "CHO_BEP"
        eta = max((item.du_kien_hoan_thanh_at for item in lines if item.du_kien_hoan_thanh_at), default=None)
        result.append(CustomerOrderResponse(
            dot_id=batch.id, phien_ban_id=session.id, ban_id=table.id, ma_ban=table.ma_ban,
            gui_at=batch.gui_at, tong_tien=total, du_kien_hoan_thanh_at=eta,
            trang_thai=status, lines=lines,
        ))
    return result
