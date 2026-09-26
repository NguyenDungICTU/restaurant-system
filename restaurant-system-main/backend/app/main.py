from datetime import timedelta

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import shutil
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.security import hash_session_token
from app.database.session import SessionLocal
from app.models.nhan_vien import NhanVien
from app.models.phien_dang_nhap import PhienDangNhap
from app.services.auth_service import utc_now
from sqlalchemy import select
from app.routers.auth import router as auth_router

from app.routers.employees import router as employees_router
from app.routers.khu_vuc import router as khu_vuc_router

from app.routers.nhom_mon import (
    router as nhom_mon_router,
)
from app.routers.mon_an import router as mon_an_router
from app.routers.audit import router as audit_router
from app.routers.ban_an import router as ban_an_router, public_qr_router
from app.routers.business_hours import router as business_hours_router
from app.routers.orders import router as orders_router

app = FastAPI(
    title=settings.project_name,
)

Path("/app/uploads/categories").mkdir(parents=True, exist_ok=True)
Path("/app/uploads/dishes").mkdir(parents=True, exist_ok=True)
for default_name in ("default-category.svg", "default-dish.svg"):
    target = Path("/app/uploads") / default_name
    source = Path("/app/default-assets") / default_name
    if not target.exists() and source.exists():
        shutil.copyfile(source, target)
app.mount("/media", StaticFiles(directory="/app/uploads"), name="media")


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(auth_router)

app.include_router(employees_router)
app.include_router(khu_vuc_router)

app.include_router(nhom_mon_router)
app.include_router(mon_an_router)
app.include_router(audit_router)
app.include_router(ban_an_router)
app.include_router(public_qr_router)
app.include_router(business_hours_router)
app.include_router(orders_router)


@app.get("/")
def read_root():
    return {
        "message": "Welcome to Restaurant System API"
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "ok"
    }


class ConnectionManager:

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(
        self,
        websocket: WebSocket,
    ):
        await websocket.accept()

        self.active_connections.append(
            websocket
        )

    def disconnect(
        self,
        websocket: WebSocket,
    ):
        if websocket in self.active_connections:
            self.active_connections.remove(
                websocket
            )

    async def broadcast(
        self,
        message: str,
    ):
        for connection in self.active_connections:
            await connection.send_text(
                message
            )


manager = ConnectionManager()


@app.websocket("/ws/orders")
async def websocket_endpoint(
    websocket: WebSocket,
):
    token = websocket.cookies.get(settings.session_cookie_name)
    if not token:
        await websocket.close(code=4401)
        return
    token_hash = hash_session_token(token)
    with SessionLocal() as db:
        session = db.scalar(
            select(PhienDangNhap).where(
                PhienDangNhap.token_hash == token_hash
            )
        )
        now = utc_now()
        if (
            session is None
            or session.revoked_at is not None
            or session.expires_at <= now
            or now - session.last_activity_at
            >= timedelta(minutes=settings.session_idle_minutes)
        ):
            await websocket.close(code=4401)
            return
        employee = db.get(NhanVien, session.nhan_vien_id)
        if (
            employee is None
            or employee.trang_thai != "HOAT_DONG"
            or employee.doi_mat_khau_lan_dau
        ):
            await websocket.close(code=4403)
            return
    await manager.connect(websocket)

    try:
        while True:
            data = await websocket.receive_text()
            with SessionLocal() as db:
                session = db.scalar(
                    select(PhienDangNhap).where(
                        PhienDangNhap.token_hash == token_hash
                    )
                )
                now = utc_now()
                if (
                    session is None
                    or session.revoked_at is not None
                    or session.expires_at <= now
                    or now - session.last_activity_at
                    >= timedelta(minutes=settings.session_idle_minutes)
                ):
                    await websocket.close(code=4401)
                    break
                session.last_activity_at = now
                session.expires_at = now + timedelta(minutes=settings.session_idle_minutes)
                db.commit()
            await manager.broadcast(
                f"Order update: {data}"
            )

    except WebSocketDisconnect:

        manager.disconnect(websocket)