from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_manager
from app.models.mon_an import MonAn
from app.models.nhan_vien import NhanVien
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.models.phien_dang_nhap import PhienDangNhap
from app.schemas.audit import AuditActionResponse, LoginSessionResponse

router = APIRouter(prefix="/api/audit-logs", tags=["Audit logs"])


@router.get("/actions", response_model=list[AuditActionResponse])
def list_actions(
    action: str | None = Query(default=None, max_length=50),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    statement = (
        select(NhatKyThaoTac, NhanVien, MonAn)
        .join(NhanVien, NhanVien.id == NhatKyThaoTac.nhan_vien_id)
        .outerjoin(
            MonAn,
            (MonAn.id == NhatKyThaoTac.doi_tuong_id)
            & (NhatKyThaoTac.doi_tuong == "MON_AN"),
        )
        .order_by(
            NhatKyThaoTac.created_at.desc(),
            NhatKyThaoTac.id.desc(),
        )
        .limit(limit)
    )
    if action:
        statement = statement.where(NhatKyThaoTac.hanh_dong == action)

    return [
        AuditActionResponse(
            id=log.id,
            actor_id=employee.id,
            actor_name=employee.ho_ten,
            action=log.hanh_dong,
            object_type=log.doi_tuong,
            object_id=log.doi_tuong_id,
            object_name=dish.ten_mon if dish else None,
            old_data=log.du_lieu_cu,
            new_data=log.du_lieu_moi,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            created_at=log.created_at,
        )
        for log, employee, dish in db.execute(statement).all()
    ]


@router.get("/sessions", response_model=list[LoginSessionResponse])
def list_sessions(
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    _: NhanVien = Depends(require_manager),
):
    statement = (
        select(PhienDangNhap, NhanVien)
        .join(NhanVien, NhanVien.id == PhienDangNhap.nhan_vien_id)
        .order_by(PhienDangNhap.created_at.desc(), PhienDangNhap.id.desc())
        .limit(limit)
    )
    return [
        LoginSessionResponse(
            id=session.id,
            employee_id=employee.id,
            employee_name=employee.ho_ten,
            username=employee.ten_dang_nhap,
            ip_address=session.ip_address,
            user_agent=session.user_agent,
            created_at=session.created_at,
            last_activity_at=session.last_activity_at,
            expires_at=session.expires_at,
            revoked_at=session.revoked_at,
        )
        for session, employee in db.execute(statement).all()
    ]