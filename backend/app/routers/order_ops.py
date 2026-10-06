from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.roles import require_roles
from app.models.dong_goi_mon import DongGoiMon
from app.models.dat_ban import DatBan
from app.models.dot_goi_mon import DotGoiMon
from app.models.mon_an import MonAn
from app.models.phien_ban import PhienBan
from app.models.ban import Ban
from app.models.nhan_vien import NhanVien
from app.schemas.customer_order import StaffOrderLineResponse, StaffOrderStatusUpdate

router = APIRouter(prefix="/api/order-ops", tags=["Gọi món - Bếp/Phục vụ"])
VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
VALID_STATUSES = {"CHO_BEP", "DANG_CHE_BIEN", "DA_XONG", "DA_PHUC_VU", "DA_HUY"}


def _rows(db: Session):
    return db.execute(
        select(DongGoiMon, DotGoiMon, PhienBan, Ban, MonAn)
        .join(DotGoiMon, DotGoiMon.id == DongGoiMon.dot_goi_mon_id)
        .join(PhienBan, PhienBan.id == DotGoiMon.phien_ban_id)
        .join(Ban, Ban.id == PhienBan.ban_id)
        .join(MonAn, MonAn.id == DongGoiMon.mon_an_id)
        .where(
            PhienBan.trang_thai.in_({"DANG_PHUC_VU", "CHO_THANH_TOAN"}),
            DongGoiMon.trang_thai != "DA_HUY",
        )
        .order_by(DongGoiMon.thoi_diem_tiep_nhan, DongGoiMon.id)
    ).all()


def _view(line, batch, session, table, dish):
    eta = batch.gui_at + timedelta(minutes=max(dish.thoi_gian_che_bien_phut, 0))
    return StaffOrderLineResponse(
        id=line.id, dot_id=batch.id, phien_ban_id=session.id, ban_id=table.id,
        ma_ban=table.ma_ban, ten_mon=dish.ten_mon, so_luong=line.so_luong,
        don_gia=line.don_gia, ghi_chu=line.ghi_chu, trang_thai=line.trang_thai,
        thoi_diem_tiep_nhan=line.thoi_diem_tiep_nhan,
        du_kien_hoan_thanh_at=eta,
    )


@router.get("/kitchen", response_model=list[StaffOrderLineResponse])
def kitchen_orders(
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_roles("BEP", "QUAN_LY")),
):
    return [_view(*row) for row in _rows(db)]


@router.get("/service", response_model=list[StaffOrderLineResponse])
def service_orders(
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_roles("PHUC_VU", "QUAN_LY")),
):
    return [_view(*row) for row in _rows(db)]


@router.patch("/lines/{line_id}/status", response_model=StaffOrderLineResponse)
def update_order_line_status(
    line_id: int,
    payload: StaffOrderStatusUpdate,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_roles("BEP", "QUAN_LY")),
):
    if payload.trang_thai not in VALID_STATUSES:
        raise HTTPException(status_code=422, detail="Trạng thái món không hợp lệ.")

    row = db.execute(
        select(DongGoiMon, DotGoiMon, PhienBan, Ban, MonAn)
        .join(DotGoiMon, DotGoiMon.id == DongGoiMon.dot_goi_mon_id)
        .join(PhienBan, PhienBan.id == DotGoiMon.phien_ban_id)
        .join(Ban, Ban.id == PhienBan.ban_id)
        .join(MonAn, MonAn.id == DongGoiMon.mon_an_id)
        .where(DongGoiMon.id == line_id)
        .with_for_update()
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy món gọi.")

    line, batch, session, table, dish = row
    now = datetime.now(VIETNAM_TZ)
    if payload.trang_thai == "DANG_CHE_BIEN":
        line.bat_dau_che_bien_at = line.bat_dau_che_bien_at or now
    if payload.trang_thai == "DA_XONG":
        line.bat_dau_che_bien_at = line.bat_dau_che_bien_at or now
        line.hoan_thanh_at = line.hoan_thanh_at or now
    if payload.trang_thai == "DA_PHUC_VU":
        line.phuc_vu_at = line.phuc_vu_at or now
    if payload.trang_thai == "DA_HUY":
        line.huy_at = line.huy_at or now

    line.trang_thai = payload.trang_thai
    db.commit()
    db.refresh(line)
    return _view(line, batch, session, table, dish)


@router.post("/sessions/{session_id}/close")
def close_service_session(
    session_id: int,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_roles("PHUC_VU", "QUAN_LY")),
):
    session = db.scalar(
        select(PhienBan).where(PhienBan.id == session_id).with_for_update()
    )
    if session is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên phục vụ.")

    table = db.scalar(select(Ban).where(Ban.id == session.ban_id).with_for_update())
    if table is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn.")

    unfinished = db.scalar(
        select(DongGoiMon.id)
        .join(DotGoiMon, DotGoiMon.id == DongGoiMon.dot_goi_mon_id)
        .where(
            DotGoiMon.phien_ban_id == session.id,
            DongGoiMon.trang_thai.not_in({"DA_XONG", "DA_PHUC_VU", "DA_HUY"}),
        )
        .limit(1)
    )
    if unfinished is not None:
        raise HTTPException(
            status_code=409,
            detail="Chưa thể kết thúc phiên vì vẫn còn món chưa hoàn thành.",
        )

    now = datetime.now(VIETNAM_TZ)
    session.trang_thai = "DA_DONG"
    session.dong_at = now

    upcoming = db.scalar(
        select(DatBan.id)
        .where(
            DatBan.ban_id == table.id,
            DatBan.trang_thai == "DA_XAC_NHAN",
            DatBan.khach_toi_at.is_(None),
            DatBan.ngay_dat >= now.date(),
        )
        .limit(1)
    )
    table.trang_thai = "DA_DAT" if upcoming is not None else "TRONG"
    table.trang_thai_changed_at = now

    db.commit()
    return {
        "session_id": session.id,
        "ban_id": table.id,
        "ma_ban": table.ma_ban,
        "trang_thai_phien": session.trang_thai,
        "trang_thai_ban": table.trang_thai,
    }
