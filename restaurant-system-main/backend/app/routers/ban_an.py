from io import BytesIO
import secrets

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, RedirectResponse, StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import get_db
from app.dependencies.auth import get_current_user, require_manager
from app.models.ban_an import BanAn
from app.models.khu_vuc import KhuVuc
from app.models.nhan_vien import NhanVien
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.schemas.ban_an import BanAnCreate, BanAnResponse, BanAnUpdate


router = APIRouter(prefix="/api/tables", tags=["Tables"])
public_qr_router = APIRouter(prefix="/api/public/table-qr", tags=["Public QR"])


def qr_target(token: str) -> str:
    return f"{settings.backend_public_url.rstrip('/')}/api/public/table-qr/{token}"


def qr_image(token: str) -> BytesIO:
    image = qrcode.make(qr_target(token))
    content = BytesIO()
    image.save(content, format="PNG")
    content.seek(0)
    return content


def audit_table(
    db: Session,
    *,
    actor: NhanVien,
    action: str,
    table: BanAn,
    old: dict | None,
    new: dict | None,
    request: Request,
) -> None:
    db.add(
        NhatKyThaoTac(
            nhan_vien_id=actor.id,
            vai_tro=actor.vai_tro,
            tai_khoan=actor.ten_dang_nhap,
            hanh_dong=action,
            doi_tuong="BAN_AN",
            doi_tuong_id=table.id,
            du_lieu_cu=old,
            du_lieu_moi=new,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        )
    )


def table_data(table: BanAn) -> dict:
    return {
        "ma_ban": table.ma_ban,
        "khu_vuc_id": table.khu_vuc_id,
        "suc_chua_toi_thieu": table.suc_chua_toi_thieu,
        "suc_chua_toi_da": table.suc_chua_toi_da,
        "loai_ban": table.loai_ban,
        "trang_thai": table.trang_thai,
    }


def ensure_area_active(db: Session, area_id: int) -> None:
    area = db.get(KhuVuc, area_id)
    if area is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy khu vực.")
    if area.trang_thai != "HOAT_DONG":
        raise HTTPException(status_code=409, detail="Không thể gán bàn mới vào khu vực đã ngừng sử dụng.")


def find_table(db: Session, table_id: int) -> BanAn:
    table = db.get(BanAn, table_id)
    if table is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy bàn.")
    return table


@router.get("", response_model=list[BanAnResponse])
def list_tables(
    area_id: int | None = None,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    statement = select(BanAn).order_by(BanAn.khu_vuc_id, BanAn.ma_ban)
    if area_id is not None:
        statement = statement.where(BanAn.khu_vuc_id == area_id)
    return list(db.scalars(statement).all())


@router.get("/active", response_model=list[BanAnResponse])
def list_active_tables(
    db: Session = Depends(get_db),
    _: NhanVien = Depends(get_current_user),
):
    return list(
        db.scalars(
            select(BanAn)
            .join(KhuVuc, BanAn.khu_vuc_id == KhuVuc.id)
            .where(
                KhuVuc.trang_thai == "HOAT_DONG",
                BanAn.trang_thai != "TAM_NGUNG",
            )
            .order_by(BanAn.khu_vuc_id, BanAn.ma_ban)
        ).all()
    )


@router.post("", response_model=BanAnResponse, status_code=201)
def create_table(
    payload: BanAnCreate,
    request: Request,
    db: Session = Depends(get_db),
    manager: NhanVien = Depends(require_manager),
):
    ensure_area_active(db, payload.khu_vuc_id)
    table = BanAn(
        **payload.model_dump(),
        qr_token=secrets.token_urlsafe(32),
    )
    db.add(table)
    try:
        db.flush()
        audit_table(
            db,
            actor=manager,
            action="TAO_BAN",
            table=table,
            old=None,
            new=table_data(table),
            request=request,
        )
        db.commit()
        db.refresh(table)
    except IntegrityError as error:
        db.rollback()
        if db.scalar(
            select(BanAn.id).where(
                func.lower(func.trim(BanAn.ma_ban)) == payload.ma_ban.lower()
            )
        ):
            raise HTTPException(status_code=409, detail="Mã bàn đã được sử dụng.") from error
        raise
    return table


@router.put("/{table_id}", response_model=BanAnResponse)
def update_table(
    table_id: int,
    payload: BanAnUpdate,
    request: Request,
    db: Session = Depends(get_db),
    manager: NhanVien = Depends(require_manager),
):
    table = find_table(db, table_id)
    ensure_area_active(db, payload.khu_vuc_id)
    old = table_data(table)
    for field, value in payload.model_dump().items():
        setattr(table, field, value)
    audit_table(
        db,
        actor=manager,
        action="CAP_NHAT_BAN",
        table=table,
        old=old,
        new=table_data(table),
        request=request,
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(status_code=409, detail="Mã bàn đã được sử dụng.") from error
    db.refresh(table)
    return table


@router.post("/{table_id}/qr/regenerate", response_model=BanAnResponse)
def regenerate_qr(
    table_id: int,
    request: Request,
    db: Session = Depends(get_db),
    manager: NhanVien = Depends(require_manager),
):
    table = find_table(db, table_id)
    old = {"qr_regenerated": False}
    table.qr_token = secrets.token_urlsafe(32)
    audit_table(
        db,
        actor=manager,
        action="TAO_LAI_QR_BAN",
        table=table,
        old=old,
        new={"qr_regenerated": True},
        request=request,
    )
    db.commit()
    db.refresh(table)
    return table


@router.get("/area/{area_id}/qr.pdf")
def download_area_qr_pdf(
    area_id: int,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    area = db.get(KhuVuc, area_id)
    if area is None:
        raise HTTPException(status_code=404, detail="Không tìm thấy khu vực.")
    tables = list(
        db.scalars(
            select(BanAn).where(BanAn.khu_vuc_id == area_id).order_by(BanAn.ma_ban)
        ).all()
    )
    output = BytesIO()
    pdf = canvas.Canvas(output, pagesize=A4)
    page_width, page_height = A4
    cell_width = page_width / 3
    cell_height = page_height / 3
    for index, table in enumerate(tables):
        cell_index = index % 9
        if index and cell_index == 0:
            pdf.showPage()
        column = cell_index % 3
        row = cell_index // 3
        x = column * cell_width
        y = page_height - (row + 1) * cell_height
        image = qr_image(table.qr_token)
        pdf.drawImage(
            ImageReader(image),
            x + 25,
            y + 45,
            width=cell_width - 50,
            height=cell_width - 50,
            preserveAspectRatio=True,
        )
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawCentredString(x + cell_width / 2, y + 25, table.ma_ban)
    pdf.save()
    output.seek(0)
    return StreamingResponse(
        output,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="qr-area-{area_id}.pdf"'},
    )


@router.get("/{table_id}/qr.png")
def download_table_qr(
    table_id: int,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    table = find_table(db, table_id)
    return StreamingResponse(
        qr_image(table.qr_token),
        media_type="image/png",
        headers={"Content-Disposition": f'attachment; filename="qr-table-{table.id}.png"'},
    )


@public_qr_router.get("/{token}")
def resolve_table_qr(
    token: str,
    db: Session = Depends(get_db),
):
    table = db.scalar(select(BanAn).where(BanAn.qr_token == token))
    if table is None:
        return HTMLResponse(
            status_code=410,
            content=(
                "<!doctype html><html lang='vi'><meta charset='utf-8'>"
                "<title>Mã QR đã thay đổi</title><main style='font-family:sans-serif;"
                "max-width:32rem;margin:15vh auto;padding:2rem;text-align:center'>"
                "<h1>Mã QR đã thay đổi</h1><p>Mã này đã hết hiệu lực. "
                "Vui lòng gọi nhân viên phục vụ để được hỗ trợ.</p></main></html>"
            ),
        )
    if table.trang_thai == "TAM_NGUNG":
        raise HTTPException(status_code=410, detail="Bàn đang tạm ngưng. Vui lòng gọi nhân viên phục vụ.")
    return RedirectResponse(
        url=f"{settings.frontend_url.rstrip('/')}/?table_token={table.qr_token}",
        status_code=302,
    )


@public_qr_router.get("/{token}/table")
def get_qr_table_info(
    token: str,
    db: Session = Depends(get_db),
):
    table = db.scalar(
        select(BanAn).where(
            BanAn.qr_token == token,
            BanAn.trang_thai != "TAM_NGUNG",
        )
    )
    if table is None:
        raise HTTPException(
            status_code=410,
            detail="Mã QR đã thay đổi hoặc bàn đang tạm ngưng. Vui lòng gọi nhân viên phục vụ.",
        )
    area = db.get(KhuVuc, table.khu_vuc_id)
    return {
        "table_code": table.ma_ban,
        "area_name": area.ten_khu_vuc if area else None,
        "minimum_capacity": table.suc_chua_toi_thieu,
        "maximum_capacity": table.suc_chua_toi_da,
    }
