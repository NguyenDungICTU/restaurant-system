from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_manager
from app.models.nhan_vien import NhanVien
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.models.phien_dang_nhap import PhienDangNhap
from app.schemas.audit import AuditLogResponse, AuditSessionResponse
from app.services.auth_service import utc_now


router = APIRouter(prefix="/api/audit-logs", tags=["Audit Logs"])
LOCAL_TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")


@router.get("/actions", response_model=list[AuditLogResponse], include_in_schema=False)
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


@router.get(
    "/sessions",
    response_model=list[AuditSessionResponse],
    include_in_schema=False,
)
def list_login_sessions(
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
        select(PhienDangNhap, NhanVien)
        .join(NhanVien, PhienDangNhap.nhan_vien_id == NhanVien.id)
        .where(
            PhienDangNhap.created_at >= start_at.astimezone(timezone.utc),
            PhienDangNhap.created_at < end_at.astimezone(timezone.utc),
        )
        .order_by(PhienDangNhap.created_at.desc(), PhienDangNhap.id.desc())
    )
    if account:
        pattern = f"%{account.strip()}%"
        statement = statement.where(
            or_(
                NhanVien.ten_dang_nhap.ilike(pattern),
                NhanVien.ho_ten.ilike(pattern),
            )
        )

    return [
        AuditSessionResponse(
            id=session.id,
            account=employee.ten_dang_nhap,
            role=employee.vai_tro,
            ip_address=session.ip_address,
            user_agent=session.user_agent,
            created_at=session.created_at,
            last_activity_at=session.last_activity_at,
            expires_at=session.expires_at,
            revoked_at=session.revoked_at,
        )
        for session, employee in db.execute(statement).all()
    ]
