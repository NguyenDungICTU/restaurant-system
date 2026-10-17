from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.roles import require_roles
from app.models.ban import Ban
from app.models.phien_ban import PhienBan
from app.models.dot_goi_mon import DotGoiMon
from app.models.dong_goi_mon import DongGoiMon
from app.models.hoa_don import HoaDon
from app.models.nhan_vien import NhanVien

router = APIRouter(prefix="/api/gop-ban", tags=["Gộp bàn"])
TZ = ZoneInfo("Asia/Ho_Chi_Minh")


class MergeRequest(BaseModel):
    ban_ids: list[int] = Field(min_length=2, max_length=2)


def _active_session(db: Session, table_id: int, lock: bool = False):
    q = select(PhienBan).where(
        PhienBan.ban_id == table_id,
        PhienBan.trang_thai.in_(("DANG_PHUC_VU", "CHO_THANH_TOAN")),
    ).order_by(PhienBan.bat_dau_at.desc(), PhienBan.id.desc())
    if lock:
        q = q.with_for_update()
    return db.scalars(q).first()


@router.post("", status_code=200)
def merge_tables(
    payload: MergeRequest,
    db: Session = Depends(get_db),
    user: NhanVien = Depends(require_roles("PHUC_VU", "QUAN_LY")),
):
    ids = sorted(set(payload.ban_ids))
    if len(ids) != 2:
        raise HTTPException(422, "Chọn đúng hai bàn khác nhau.")
    try:
        tables = list(db.scalars(
            select(Ban).where(Ban.id.in_(ids)).order_by(Ban.id).with_for_update()
        ))
        if len(tables) != 2:
            raise HTTPException(404, "Không tìm thấy đủ hai bàn.")
        if tables[0].khu_vuc_id != tables[1].khu_vuc_id:
            raise HTTPException(409, "Chỉ gộp bàn trong cùng khu vực.")
        if any(t.trang_thai != "DANG_SU_DUNG" for t in tables):
            raise HTTPException(409, "Cả hai bàn phải đang phục vụ.")
        sessions = [_active_session(db, t.id, True) for t in tables]
        if any(s is None or s.trang_thai != "DANG_PHUC_VU" for s in sessions):
            raise HTTPException(409, "Cả hai bàn phải có phiên đang phục vụ và chưa chờ thanh toán.")
        if any(db.scalar(select(HoaDon.id).where(HoaDon.phien_ban_id == s.id).limit(1)) for s in sessions):
            raise HTTPException(409, "Không thể gộp phiên đã có hóa đơn.")
        # Existing merged sessions cannot be merged again; undo first to keep provenance clear.
        if any(s.phien_chinh_id is not None or s.trang_thai == "DA_GOP" for s in sessions):
            raise HTTPException(409, "Một bàn đã thuộc nhóm gộp. Hãy huỷ gộp trước.")
        main = sessions[0]
        secondary = sessions[1]
        # Consolidate order batches under the primary session so kitchen and
        # billing continue to use the normal active-session path. Preserve the
        # original session on every batch, and renumber batches to satisfy the
        # unique (phien_ban_id, so_dot) constraint after consolidation.
        main_batches = list(db.scalars(select(DotGoiMon).where(
            DotGoiMon.phien_ban_id == main.id
        ).order_by(DotGoiMon.gui_at, DotGoiMon.id).with_for_update()))
        for batch in main_batches:
            if batch.phien_ban_goc_id is None:
                batch.phien_ban_goc_id = main.id
        secondary_batches = list(db.scalars(select(DotGoiMon).where(
            DotGoiMon.phien_ban_id == secondary.id
        ).order_by(DotGoiMon.gui_at, DotGoiMon.id).with_for_update()))
        next_batch_number = max((batch.so_dot for batch in main_batches), default=0)
        for batch in secondary_batches:
            batch.phien_ban_goc_id = secondary.id
            batch.phien_ban_id = main.id
            next_batch_number += 1
            batch.so_dot = next_batch_number
        secondary.trang_thai = "DA_GOP"
        secondary.phien_chinh_id = main.id
        db.commit()
        return {
            "phien_chinh_id": main.id,
            "ban_chinh_id": tables[0].id,
            "ban_ids": ids,
            "nhan_nhom": " + ".join(t.ma_ban for t in tables),
            "message": "Đã gộp hai bàn vào một phiên chính."
        }
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise




@router.get("/groups")
def merged_groups(
    db: Session = Depends(get_db),
    user: NhanVien = Depends(require_roles("PHUC_VU", "QUAN_LY")),
):
    """List active reversible groups so staff do not need to remember a session ID."""
    mains = list(db.scalars(
        select(PhienBan).where(
            PhienBan.trang_thai == "DANG_PHUC_VU",
            PhienBan.id.in_(
                select(PhienBan.phien_chinh_id).where(
                    PhienBan.trang_thai == "DA_GOP",
                    PhienBan.phien_chinh_id.is_not(None),
                )
            ),
        ).order_by(PhienBan.bat_dau_at.desc())
    ))
    result = []
    for main in mains:
        main_table = db.get(Ban, main.ban_id)
        members = list(db.scalars(
            select(PhienBan).where(
                PhienBan.phien_chinh_id == main.id,
                PhienBan.trang_thai == "DA_GOP",
            ).order_by(PhienBan.id)
        ))
        member_tables = [db.get(Ban, member.ban_id) for member in members]
        tables = [t for t in [main_table, *member_tables] if t is not None]
        if main_table is None or not members:
            continue
        result.append({
            "phien_chinh_id": main.id,
            "khu_vuc_id": main_table.khu_vuc_id,
            "ban_ids": [t.id for t in tables],
            "ma_cac_ban": [t.ma_ban for t in tables],
            "label": " + ".join(t.ma_ban for t in tables),
        })
    return result


@router.post("/{session_id}/huy")
def unmerge_tables(
    session_id: int,
    db: Session = Depends(get_db),
    user: NhanVien = Depends(require_roles("PHUC_VU", "QUAN_LY")),
):
    main = db.scalar(select(PhienBan).where(PhienBan.id == session_id).with_for_update())
    if main is None or main.trang_thai != "DANG_PHUC_VU":
        raise HTTPException(409, "Chỉ huỷ gộp khi phiên chính vẫn đang phục vụ.")
    if db.scalar(select(HoaDon.id).where(HoaDon.phien_ban_id == main.id).limit(1)):
        raise HTTPException(409, "Không thể huỷ gộp sau khi đã có hóa đơn.")
    members = list(db.scalars(select(PhienBan).where(
        PhienBan.phien_chinh_id == main.id,
        PhienBan.trang_thai == "DA_GOP",
    ).with_for_update()))
    if not members:
        raise HTTPException(404, "Phiên này không có bàn đã gộp.")
    member_ids = {m.id for m in members}
    batches = list(db.scalars(select(DotGoiMon).where(
        DotGoiMon.phien_ban_id == main.id
    ).with_for_update()))
    for batch in batches:
        origin = batch.phien_ban_goc_id
        if origin in member_ids:
            batch.phien_ban_id = origin
            batch.phien_ban_goc_id = None
        elif origin == main.id:
            batch.phien_ban_goc_id = None
    # Re-number the restored batches in their original session, because the
    # merged group uses one shared sequence while active.
    for origin_id in member_ids:
        restored = list(db.scalars(select(DotGoiMon).where(
            DotGoiMon.phien_ban_id == origin_id
        ).order_by(DotGoiMon.gui_at, DotGoiMon.id).with_for_update()))
        for number, batch in enumerate(restored, start=1):
            batch.so_dot = number
    main_batches = list(db.scalars(select(DotGoiMon).where(
        DotGoiMon.phien_ban_id == main.id
    ).order_by(DotGoiMon.gui_at, DotGoiMon.id).with_for_update()))
    for number, batch in enumerate(main_batches, start=1):
        batch.so_dot = number
    # Restore the secondary sessions and make every member table usable again.
    table_ids = {main.ban_id, *(member.ban_id for member in members)}
    tables = list(db.scalars(select(Ban).where(Ban.id.in_(table_ids)).with_for_update()))
    now = datetime.now(TZ)
    for member in members:
        member.trang_thai = "DANG_PHUC_VU"
        member.phien_chinh_id = None
    for table in tables:
        table.trang_thai = "DANG_SU_DUNG"
        table.trang_thai_changed_at = now
    db.commit()
    return {"phien_chinh_id": main.id, "restored_session_ids": sorted(member_ids),
            "message": "Đã huỷ gộp; các đợt gọi món trở về phiên gốc."}
