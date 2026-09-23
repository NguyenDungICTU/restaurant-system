from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers.auth import router as auth_router
from app.routers.employees import router as employees_router


app = FastAPI(
    title=settings.project_name,
)


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

    await manager.connect(websocket)

    try:
        while True:

            data = await websocket.receive_text()

            await manager.broadcast(
                f"Order update: {data}"
            )

    except WebSocketDisconnect:

        manager.disconnect(websocket)