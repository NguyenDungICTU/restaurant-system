from datetime import datetime
from decimal import Decimal
from zoneinfo import ZoneInfo
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func, text
from sqlalchemy.orm import Session
from app.database.session import get_db
from app.dependencies.roles import require_roles
from app.models.ban import Ban
from app.models.ca_lam_viec import CaLamViec
from app.models.dot_goi_mon import DotGoiMon
from app.models.dong_goi_mon import DongGoiMon
from app.models.hoa_don import HoaDon
from app.models.mon_an import MonAn
from app.models.nhan_vien import NhanVien
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.models.phien_ban import PhienBan
from app.services.provisional_bill import is_billable_line, line_amount
from app.services.billing import calculate_discount, validate_payment
from app.services.shift_close import calculate_cash_difference, validate_variance_explanation

router = APIRouter(prefix="/api/billing", tags=["Thanh toán - Hóa đơn"])
TZ = ZoneInfo("Asia/Ho_Chi_Minh")

class CheckoutRequest(BaseModel):
    phien_ban_id: int
    loai_giam_gia: str = "NONE"
    gia_tri_giam_gia: Decimal = Field(default=Decimal("0"), ge=0)
    ly_do_giam_gia: str | None = Field(default=None, max_length=255)
    phuong_thuc: str
    tien_khach_dua: Decimal | None = Field(default=None, ge=0)
    ma_tham_chieu: str | None = Field(default=None, max_length=100)

class ShiftCloseRequest(BaseModel):
    tien_mat_thuc_te: Decimal = Field(ge=0)
    giai_trinh: str | None = Field(default=None, max_length=2000)

class ReopenShiftRequest(BaseModel):
    ly_do: str = Field(min_length=3, max_length=1000)

class CancelInvoiceRequest(BaseModel):
    ly_do: str = Field(min_length=3, max_length=1000)

def _invoice_dict(inv, session=None, table=None):
    return {"id": inv.id, "so_hoa_don": inv.so_hoa_don, "phien_ban_id": inv.phien_ban_id, "ca_lam_viec_id": inv.ca_lam_viec_id,
            "ban_id": table.id if table else None, "ma_ban": table.ma_ban if table else None,
            "tong_tien_hang": int(inv.tong_tien_hang), "giam_gia_phan_tram": float(inv.giam_gia_phan_tram),
            "giam_gia_so_tien": int(inv.giam_gia_so_tien), "ly_do_giam_gia": inv.ly_do_giam_gia,
            "tong_thanh_toan": int(inv.tong_thanh_toan), "phuong_thuc": inv.phuong_thuc,
            "tien_khach_dua": int(inv.tien_khach_dua) if inv.tien_khach_dua is not None else None,
            "tien_thoi": int(inv.tien_thoi) if inv.tien_thoi is not None else None,
            "ma_tham_chieu": inv.ma_tham_chieu, "trang_thai": inv.trang_thai,
            "chot_at": inv.chot_at, "ly_do_huy": inv.ly_do_huy}

def _merged_table_names(db, session, primary_table):
    """Return all table codes billed together under this primary session."""
    members = db.execute(
        select(Ban.ma_ban)
        .join(PhienBan, PhienBan.ban_id == Ban.id)
        .where(
            PhienBan.phien_chinh_id == session.id,
            PhienBan.trang_thai.in_({"DA_GOP", "DA_DONG"}),
        )
        .order_by(Ban.ma_ban)
    ).scalars().all()
    names = [primary_table.ma_ban] if primary_table is not None else []
    names.extend(name for name in members if name not in names)
    return " + ".join(names) if names else None


def _session_bill(db, session):
    # Merged order batches are consolidated under the primary session.
    # Use the session ID directly; the previous implementation referenced an
    # undefined `session_ids` variable, causing HTTP 500 on both billing APIs.
    rows = db.execute(select(DongGoiMon, MonAn).join(DotGoiMon, DotGoiMon.id == DongGoiMon.dot_goi_mon_id)
        .join(MonAn, MonAn.id == DongGoiMon.mon_an_id)
        .where(DotGoiMon.phien_ban_id == session.id)
        .order_by(DongGoiMon.thoi_diem_tiep_nhan, DongGoiMon.id)).all()
    items=[]; subtotal=0
    for line,dish in rows:
        if not is_billable_line(line.trang_thai, bool(line.tinh_tien)): continue
        amount=line_amount(line.don_gia,line.so_luong); subtotal += amount
        items.append({"dong_mon_id":line.id,"ten_mon":dish.ten_mon,"so_luong":line.so_luong,
                      "don_gia":int(line.don_gia),"thanh_tien":amount,"ghi_chu":line.ghi_chu or "",
                      "da_huy":line.trang_thai=="DA_HUY"})
    return items, subtotal

def _shift_summary(db: Session, shift: CaLamViec):
    invoices = list(db.scalars(select(HoaDon).where(
        HoaDon.ca_lam_viec_id == shift.id,
        HoaDon.trang_thai == "DA_CHOT",
    )))
    invoice_ids = [x.id for x in invoices]
    session_ids = [x.phien_ban_id for x in invoices]
    sessions = list(db.scalars(select(PhienBan).where(PhienBan.id.in_(session_ids)))) if session_ids else []
    by_id = {x.id: x for x in sessions}
    return {
        "id": shift.id,
        "nhan_vien_id": shift.nhan_vien_id,
        "bat_dau_at": shift.bat_dau_at,
        "ket_thuc_at": shift.ket_thuc_at,
        "trang_thai": shift.trang_thai,
        "so_hoa_don": len(invoices),
        "doanh_thu": sum(int(x.tong_thanh_toan) for x in invoices),
        "tien_mat": sum(int(x.tong_thanh_toan) for x in invoices if x.phuong_thuc == "TIEN_MAT"),
        "chuyen_khoan": sum(int(x.tong_thanh_toan) for x in invoices if x.phuong_thuc == "CHUYEN_KHOAN"),
        "tong_giam_gia": sum(int(x.tong_tien_hang) - int(x.tong_thanh_toan) for x in invoices),
        "so_ban": len({by_id[x.phien_ban_id].ban_id for x in invoices if x.phien_ban_id in by_id}),
        "tien_mat_thuc_te": int(shift.tien_mat_thuc_te) if shift.tien_mat_thuc_te is not None else None,
        "chenh_lech": int(shift.chenh_lech) if shift.chenh_lech is not None else None,
        "giai_trinh": shift.giai_trinh,
        "chot_at": shift.chot_at,
        "hoa_don": [{"id": x.id, "so_hoa_don": x.so_hoa_don, "tong_thanh_toan": int(x.tong_thanh_toan),
                     "phuong_thuc": x.phuong_thuc, "chot_at": x.chot_at} for x in invoices],
    }

@router.get("/shift/current")
def current_shift(db: Session=Depends(get_db), user: NhanVien=Depends(require_roles("THU_NGAN","QUAN_LY"))):
    shift = db.scalar(select(CaLamViec).where(CaLamViec.nhan_vien_id == user.id,
        CaLamViec.trang_thai == "DANG_MO").order_by(CaLamViec.bat_dau_at.desc()).with_for_update())
    if shift is None:
        shift = CaLamViec(nhan_vien_id=user.id, trang_thai="DANG_MO", bat_dau_at=datetime.now(TZ))
        db.add(shift); db.commit(); db.refresh(shift)
    return _shift_summary(db, shift)

@router.get("/shift/history")
def shift_history(db: Session=Depends(get_db), user: NhanVien=Depends(require_roles("THU_NGAN","QUAN_LY"))):
    q = select(CaLamViec).order_by(CaLamViec.bat_dau_at.desc()).limit(100)
    if user.vai_tro != "QUAN_LY":
        q = q.where(CaLamViec.nhan_vien_id == user.id)
    return [_shift_summary(db, x) for x in db.scalars(q)]

@router.post("/shift/close")
def close_shift(payload: ShiftCloseRequest, db: Session=Depends(get_db),
                user: NhanVien=Depends(require_roles("THU_NGAN","QUAN_LY"))):
    shift = db.scalar(select(CaLamViec).where(CaLamViec.nhan_vien_id == user.id,
        CaLamViec.trang_thai == "DANG_MO").order_by(CaLamViec.bat_dau_at.desc()).with_for_update())
    if shift is None:
        raise HTTPException(409, "Không có ca đang mở.")
    active = db.execute(select(PhienBan, Ban).join(Ban, Ban.id == PhienBan.ban_id)
        .where(PhienBan.trang_thai.in_({"DANG_PHUC_VU", "CHO_THANH_TOAN"}))
        .order_by(Ban.ma_ban)).all()
    if active:
        details = [{"phien_ban_id": x.id, "ma_ban": b.ma_ban,
                    "trang_thai": "Đang phục vụ" if x.trang_thai == "DANG_PHUC_VU" else "Chờ thanh toán"}
                   for x,b in active]
        raise HTTPException(409, detail={"message":"Không thể chốt ca khi còn bàn đang phục vụ hoặc chờ thanh toán.",
                                         "ban_chua_dong":details})
    summary = _shift_summary(db, shift)
    difference = calculate_cash_difference(summary["tien_mat"], payload.tien_mat_thuc_te)
    try:
        validate_variance_explanation(difference, payload.giai_trinh)
    except ValueError as e:
        raise HTTPException(422, str(e))
    now = datetime.now(TZ)
    shift.so_hoa_don = summary["so_hoa_don"]
    shift.doanh_thu = summary["doanh_thu"]
    shift.tien_mat = summary["tien_mat"]
    shift.chuyen_khoan = summary["chuyen_khoan"]
    shift.tong_giam_gia = summary["tong_giam_gia"]
    shift.so_ban = summary["so_ban"]
    shift.tien_mat_thuc_te = payload.tien_mat_thuc_te
    shift.chenh_lech = difference
    shift.giai_trinh = (payload.giai_trinh or "").strip() or None
    shift.trang_thai = "DA_CHOT"
    shift.ket_thuc_at = now
    shift.chot_at = now
    shift.chot_boi_id = user.id
    db.add(NhatKyThaoTac(nhan_vien_id=user.id, hanh_dong="CHOT_CA", doi_tuong="CA_LAM_VIEC",
        doi_tuong_id=shift.id, du_lieu_cu={"trang_thai":"DANG_MO"},
        du_lieu_moi={"trang_thai":"DA_CHOT","chenh_lech":difference,"giai_trinh":shift.giai_trinh}))
    db.commit(); db.refresh(shift)
    return _shift_summary(db, shift)

@router.post("/shift/{shift_id}/reopen")
def reopen_shift(shift_id: int, payload: ReopenShiftRequest, db: Session=Depends(get_db),
                 user: NhanVien=Depends(require_roles("QUAN_LY"))):
    shift = db.scalar(select(CaLamViec).where(CaLamViec.id == shift_id).with_for_update())
    if shift is None: raise HTTPException(404, "Không tìm thấy ca.")
    if shift.trang_thai != "DA_CHOT": raise HTTPException(409, "Chỉ có thể mở lại ca đã chốt.")
    reason = payload.ly_do.strip()
    if len(reason) < 3: raise HTTPException(422, "Lý do mở lại ca cần ít nhất 3 ký tự.")
    old_status = shift.trang_thai
    shift.trang_thai = "MO_LAI"
    db.add(NhatKyThaoTac(nhan_vien_id=user.id, hanh_dong="MO_LAI_CA", doi_tuong="CA_LAM_VIEC",
        doi_tuong_id=shift.id, du_lieu_cu={"trang_thai":old_status},
        du_lieu_moi={"trang_thai":"MO_LAI","ly_do":reason}))
    db.commit()
    return _shift_summary(db, shift)

@router.get("/open-sessions")
def open_sessions(db: Session=Depends(get_db), _: NhanVien=Depends(require_roles("THU_NGAN","QUAN_LY"))):
    sessions=db.execute(select(PhienBan,Ban).join(Ban,Ban.id==PhienBan.ban_id)
        .where(PhienBan.trang_thai.in_({"DANG_PHUC_VU","CHO_THANH_TOAN"}))
        .order_by(PhienBan.bat_dau_at)).all()
    result=[]
    for session,table in sessions:
        if db.scalar(select(HoaDon.id).where(HoaDon.phien_ban_id==session.id,HoaDon.trang_thai=="DA_CHOT")): continue
        items,total=_session_bill(db,session)
        result.append({"phien_ban_id":session.id,"ban_id":table.id,"ma_ban":table.ma_ban,
                       "trang_thai_phien":session.trang_thai,"bat_dau_at":session.bat_dau_at,
                       "items":items,"tong_tien_hang":total})
    return result

@router.get("/invoices")
def invoices(db: Session=Depends(get_db), _: NhanVien=Depends(require_roles("THU_NGAN","QUAN_LY"))):
    rows=db.execute(select(HoaDon,PhienBan,Ban).join(PhienBan,PhienBan.id==HoaDon.phien_ban_id)
                    .join(Ban,Ban.id==PhienBan.ban_id).order_by(HoaDon.chot_at.desc()).limit(500)).all()
    result = []
    for inv, session, table in rows:
        invoice = _invoice_dict(inv, session, table)
        invoice["ma_ban"] = _merged_table_names(db, session, table)
        # Include line items in search/list so details and reprints remain
        # available after checkout and table cleanup.
        invoice["items"], _ = _session_bill(db, session)
        result.append(invoice)
    return result

@router.post("/checkout", status_code=201)
def checkout(payload: CheckoutRequest, db: Session=Depends(get_db),
             user: NhanVien=Depends(require_roles("THU_NGAN","QUAN_LY"))):
    session=db.scalar(select(PhienBan).where(PhienBan.id==payload.phien_ban_id).with_for_update())
    if session is None: raise HTTPException(404,"Không tìm thấy phiên bàn.")
    if session.trang_thai not in {"DANG_PHUC_VU","CHO_THANH_TOAN"}:
        raise HTTPException(409,"Phiên bàn đã đóng hoặc không thể thanh toán.")
    table=db.scalar(select(Ban).where(Ban.id==session.ban_id).with_for_update())
    existing=db.scalar(select(HoaDon).where(HoaDon.phien_ban_id==session.id,HoaDon.trang_thai=="DA_CHOT"))
    if existing: raise HTTPException(409,"Phiên này đã có hóa đơn được chốt.")
    items,subtotal=_session_bill(db,session)
    if not items: raise HTTPException(409,"Phiên chưa có món đủ điều kiện thanh toán.")
    try:
        disc=calculate_discount(subtotal,payload.loai_giam_gia,payload.gia_tri_giam_gia)
        if disc["discount"] > 0 and not (payload.ly_do_giam_gia or "").strip():
            raise ValueError("Bắt buộc nhập lý do giảm giá.")
        pay=validate_payment(payload.phuong_thuc,disc["total"],payload.tien_khach_dua,payload.ma_tham_chieu)
    except ValueError as e: raise HTTPException(422,str(e))
    now=datetime.now(TZ); day=now.strftime("%Y%m%d")
    prefix=f"HD-{day}-"
    last=db.scalar(select(func.max(HoaDon.so_hoa_don)).where(HoaDon.so_hoa_don.like(prefix+"%")))
    seq=int(last.rsplit("-",1)[1])+1 if last else 1
    active_shift = db.scalar(select(CaLamViec).where(
        CaLamViec.nhan_vien_id == user.id, CaLamViec.trang_thai == "DANG_MO"
    ).order_by(CaLamViec.bat_dau_at.desc()).with_for_update())
    if active_shift is None:
        active_shift = CaLamViec(nhan_vien_id=user.id, trang_thai="DANG_MO", bat_dau_at=now)
        db.add(active_shift); db.flush()
    inv=HoaDon(so_hoa_don=f"{prefix}{seq:04d}",phien_ban_id=session.id,ca_lam_viec_id=active_shift.id,
        tong_tien_hang=subtotal,giam_gia_phan_tram=disc["percent"],giam_gia_so_tien=disc["amount"],
        ly_do_giam_gia=(payload.ly_do_giam_gia or "").strip() or None,tong_thanh_toan=disc["total"],
        phuong_thuc=payload.phuong_thuc,tien_khach_dua=pay["cash_received"],tien_thoi=pay["change"],
        ma_tham_chieu=pay["reference"],trang_thai="DA_CHOT",nguoi_chot_id=user.id,chot_at=now)
    db.add(inv); db.flush()
    old_status=session.trang_thai
    session.trang_thai="DA_DONG"; session.dong_at=now
    table.trang_thai="DANG_DON"; table.trang_thai_changed_at=now
    # A merged bill belongs to every member table. Close their source sessions
    # and put every physical table into cleanup, not just the primary table.
    member_sessions = list(db.scalars(
        select(PhienBan).where(
            PhienBan.phien_chinh_id == session.id,
            PhienBan.trang_thai == "DA_GOP",
        ).with_for_update()
    ))
    member_table_ids = [member.ban_id for member in member_sessions]
    for member in member_sessions:
        member.trang_thai = "DA_DONG"
        member.dong_at = now
    if member_table_ids:
        member_tables = list(db.scalars(
            select(Ban).where(Ban.id.in_(member_table_ids)).with_for_update()
        ))
        for member_table in member_tables:
            member_table.trang_thai = "DANG_DON"
            member_table.trang_thai_changed_at = now
    db.add(NhatKyThaoTac(nhan_vien_id=user.id,hanh_dong="CHOT_HOA_DON",doi_tuong="HOA_DON",
        doi_tuong_id=inv.id,du_lieu_cu={"phien_ban_id":session.id,"trang_thai_phien":old_status,"tong_tien_hang":subtotal},
        du_lieu_moi={"so_hoa_don":inv.so_hoa_don,"tong_thanh_toan":disc["total"],"giam_gia":disc["discount"],
                     "ly_do_giam_gia":inv.ly_do_giam_gia,"phuong_thuc":inv.phuong_thuc,"ma_tham_chieu":inv.ma_tham_chieu}))
    db.commit(); db.refresh(inv)
    invoice = _invoice_dict(inv,session,table)
    invoice["ma_ban"] = " + ".join([table.ma_ban] + [
        t.ma_ban for t in db.scalars(select(Ban).where(Ban.id.in_(member_table_ids)).order_by(Ban.ma_ban))
    ]) if member_table_ids else table.ma_ban
    return {**invoice,"items":items}

@router.get("/invoices/{invoice_id}")
def invoice_detail(invoice_id: int, db: Session=Depends(get_db),
                   _: NhanVien=Depends(require_roles("THU_NGAN","QUAN_LY"))):
    row=db.execute(select(HoaDon,PhienBan,Ban).join(PhienBan,PhienBan.id==HoaDon.phien_ban_id)
                   .join(Ban,Ban.id==PhienBan.ban_id).where(HoaDon.id==invoice_id)).first()
    if row is None: raise HTTPException(404,"Không tìm thấy hóa đơn.")
    inv,session,table=row
    items,_=_session_bill(db,session)
    invoice = _invoice_dict(inv,session,table)
    invoice["ma_ban"] = _merged_table_names(db, session, table)
    return {**invoice,"items":items}

@router.post("/invoices/{invoice_id}/cancel")
def cancel_invoice(invoice_id:int,payload:CancelInvoiceRequest,db:Session=Depends(get_db),
                   user:NhanVien=Depends(require_roles("QUAN_LY"))):
    inv=db.scalar(select(HoaDon).where(HoaDon.id==invoice_id).with_for_update())
    if inv is None: raise HTTPException(404,"Không tìm thấy hóa đơn.")
    if inv.trang_thai=="DA_HUY": raise HTTPException(409,"Hóa đơn đã được hủy trước đó.")
    if inv.ca_lam_viec_id is not None:
        shift = db.scalar(select(CaLamViec).where(CaLamViec.id == inv.ca_lam_viec_id))
        if shift is not None and shift.trang_thai == "DA_CHOT":
            raise HTTPException(409, "Hóa đơn thuộc ca đã chốt; quản lý phải mở lại ca kèm lý do trước khi điều chỉnh.")
    reason=payload.ly_do.strip()
    if len(reason)<3: raise HTTPException(422,"Lý do hủy phải có ít nhất 3 ký tự.")
    inv.trang_thai="DA_HUY"; inv.huy_boi_id=user.id; inv.huy_at=datetime.now(TZ); inv.ly_do_huy=reason
    db.add(NhatKyThaoTac(nhan_vien_id=user.id,hanh_dong="HUY_HOA_DON",doi_tuong="HOA_DON",
        doi_tuong_id=inv.id,du_lieu_cu={"so_hoa_don":inv.so_hoa_don,"trang_thai":"DA_CHOT"},
        du_lieu_moi={"trang_thai":"DA_HUY","ly_do_huy":reason}))
    db.commit()
    return _invoice_dict(inv)
