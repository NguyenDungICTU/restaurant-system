import secrets

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_manager
from app.models.ban import Ban, BanQRToken
from app.models.khu_vuc import KhuVuc
from app.schemas.ban import BanPayload, BanResponse, BanScanResponse
from app.services.ban_qr import area_pdf, qr_png

router = APIRouter(prefix="/api/ban", tags=["Bàn"])
manager = [Depends(require_manager)]


def get_table(db, table_id, *, lock=False):
    query = select(Ban).where(Ban.id == table_id)
    if lock:
        query = query.with_for_update()
    table = db.scalar(query)
    if table is None:
        raise HTTPException(404, "Không tìm thấy bàn.")
    return table


def validate_area(db, area_id, *, require_active=False):
    area = db.get(KhuVuc, area_id)
    if area is None:
        raise HTTPException(404, "Không tìm thấy khu vực.")
    if require_active and area.trang_thai != "HOAT_DONG":
        raise HTTPException(409, "Khu vực đã ngừng sử dụng. Vui lòng chọn khu vực đang hoạt động.")
    return area


def commit(db, snapshot=None):
    try:
        if snapshot is not None:
            db.flush()
            db.refresh(snapshot)
            result = BanResponse.model_validate(snapshot)
        db.commit()
        if snapshot is not None:
            return result
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Mã bàn đã tồn tại hoặc dữ liệu xung đột. Vui lòng thử lại.")


@router.get("", response_model=list[BanResponse], dependencies=manager)
def list_tables(khu_vuc_id: int | None = None, db: Session = Depends(get_db)):
    query = select(Ban).order_by(Ban.ma_ban)
    if khu_vuc_id is not None:
        query = query.where(Ban.khu_vuc_id == khu_vuc_id)
    return list(db.scalars(query))


@router.post("", response_model=BanResponse, status_code=201, dependencies=manager)
def create_table(payload: BanPayload, db: Session = Depends(get_db)):
    validate_area(db, payload.khu_vuc_id, require_active=True)
    table = Ban(**payload.model_dump(), qr_token=secrets.token_urlsafe(32))
    db.add(table)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Mã bàn đã tồn tại.")
    db.add(BanQRToken(token=table.qr_token, ban_id=table.id))
    commit(db)
    db.refresh(table)
    return table


@router.get("/qr/{token}", response_model=BanScanResponse)
def scan_qr(token: str, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    issued = db.get(BanQRToken, token)
    if issued is None:
        raise HTTPException(404, "Mã QR không hợp lệ.", headers={"Cache-Control": "no-store"})
    table = get_table(db, issued.ban_id)
    if table.qr_token != token:
        raise HTTPException(410, "Mã QR đã thay đổi. Vui lòng quét mã mới tại bàn.", headers={"Cache-Control": "no-store"})
    area = validate_area(db, table.khu_vuc_id)
    if table.trang_thai == "NGUNG_SU_DUNG" or area.trang_thai != "HOAT_DONG":
        raise HTTPException(409, "Bàn hoặc khu vực đang ngừng sử dụng.", headers={"Cache-Control": "no-store"})
    return table


@router.get("/khu-vuc/{area_id}/qr.pdf", dependencies=manager)
def download_area_qr(area_id: int, db: Session = Depends(get_db)):
    area = validate_area(db, area_id)
    tables = list(db.scalars(select(Ban).where(Ban.khu_vuc_id == area_id).order_by(Ban.ma_ban)))
    if not tables:
        raise HTTPException(404, "Khu vực chưa có bàn để xuất QR.")
    return Response(area_pdf(area, tables), media_type="application/pdf", headers={
        "Content-Disposition": f'attachment; filename="khu-vuc-{area_id}-qr.pdf"', "Cache-Control": "no-store",
    })


@router.get("/{table_id}", response_model=BanResponse, dependencies=manager)
def read_table(table_id: int, db: Session = Depends(get_db)):
    return get_table(db, table_id)


@router.delete("/{table_id}", status_code=204, dependencies=manager)
def delete_table(table_id: int, db: Session = Depends(get_db)):
    table = get_table(db, table_id, lock=True)
    # Remove only this table's dependent tokens and table atomically.
    try:
        db.execute(delete(BanQRToken).where(BanQRToken.ban_id == table.id))
        db.delete(table)
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(409, "Không thể xóa bàn vì có dữ liệu liên quan.") from error
    return Response(status_code=204)


@router.put("/{table_id}", response_model=BanResponse, dependencies=manager)
def update_table(table_id: int, payload: BanPayload, db: Session = Depends(get_db)):
    table = get_table(db, table_id, lock=True)
    validate_area(db, payload.khu_vuc_id, require_active=payload.khu_vuc_id != table.khu_vuc_id)
    for key, value in payload.model_dump().items():
        setattr(table, key, value)
    commit(db)
    db.refresh(table)
    return table


@router.post("/{table_id}/qr/regenerate", response_model=BanResponse, dependencies=manager)
def regenerate_qr(table_id: int, db: Session = Depends(get_db)):
    # Serialize rotations; history and current token change in one transaction.
    table = get_table(db, table_id, lock=True)
    table.qr_token = secrets.token_urlsafe(32)
    db.add(BanQRToken(token=table.qr_token, ban_id=table.id))
    return commit(db, snapshot=table)


@router.get("/{table_id}/qr.png", dependencies=manager)
def download_table_qr(table_id: int, db: Session = Depends(get_db)):
    table = get_table(db, table_id)
    return Response(qr_png(table.qr_token), media_type="image/png", headers={
        "Content-Disposition": f'attachment; filename="ban-{table_id}-qr.png"', "Cache-Control": "no-store",
    })
