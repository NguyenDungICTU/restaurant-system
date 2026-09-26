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
