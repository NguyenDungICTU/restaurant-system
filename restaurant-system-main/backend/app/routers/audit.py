from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_manager
from app.models.nhan_vien import NhanVien
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.schemas.audit import AuditLogResponse
from app.services.auth_service import utc_now


router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])
LOCAL_TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")


@router.get("", response_model=list[AuditLogResponse])
def list_audit_logs(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    account: str | None = Query(default=None, max_length=100),
    _: NhanVien = Depends(require_manager),
    db: Session = Depends(get_db),
):
    today = utc_now().astimezone(LOCAL_TIMEZONE).date()
    start = start_date or today - timedelta(days=6)
    end = end_date or today
    if end < start:
        raise HTTPException(
            status_code=422,
            detail="Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.",
        )

    start_at = datetime.combine(start, time.min, tzinfo=LOCAL_TIMEZONE)
    end_at = datetime.combine(end + timedelta(days=1), time.min, tzinfo=LOCAL_TIMEZONE)
    statement = (
        select(NhatKyThaoTac, NhanVien)
        .outerjoin(NhanVien, NhatKyThaoTac.nhan_vien_id == NhanVien.id)
        .where(
            NhatKyThaoTac.created_at >= start_at.astimezone(timezone.utc),
            NhatKyThaoTac.created_at < end_at.astimezone(timezone.utc),
        )
        .order_by(NhatKyThaoTac.created_at.desc(), NhatKyThaoTac.id.desc())
    )
    if account:
        pattern = f"%{account.strip()}%"
        statement = statement.where(
            or_(
                NhatKyThaoTac.tai_khoan.ilike(pattern),
                NhanVien.ten_dang_nhap.ilike(pattern),
            )
        )

    return [
        AuditLogResponse(
            id=log.id,
            timestamp=log.created_at,
            account=log.tai_khoan or (employee.ten_dang_nhap if employee else None),
            role=log.vai_tro or (employee.vai_tro if employee else None),
            action=log.hanh_dong,
            ip_address=log.ip_address,
            old_data=log.du_lieu_cu,
            new_data=log.du_lieu_moi,
        )
        for log, employee in db.execute(statement).all()
    ]
