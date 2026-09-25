from datetime import datetime

from pydantic import BaseModel


class AuditActionResponse(BaseModel):
    id: int
    actor_id: int
    actor_name: str
    action: str
    object_type: str
    object_id: int | None
    old_data: dict | None
    new_data: dict | None
    ip_address: str | None
    user_agent: str | None
    created_at: datetime


class LoginSessionResponse(BaseModel):
    id: int
    employee_id: int
    employee_name: str
    username: str
    ip_address: str | None
    user_agent: str | None
    created_at: datetime
    last_activity_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
