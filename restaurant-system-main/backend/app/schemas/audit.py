from datetime import datetime

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: int
    timestamp: datetime
    account: str | None
    role: str | None
    action: str
    ip_address: str | None
    old_data: dict | None
    new_data: dict | None


class AuditSessionResponse(BaseModel):
    id: int
    account: str
    role: str
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    last_activity_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
