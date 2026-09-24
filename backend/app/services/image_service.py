from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile

UPLOAD_ROOT = Path("/app/uploads")
ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
MAX_BYTES = 5 * 1024 * 1024

async def save_image(file: UploadFile, folder: str) -> str:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF.")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Ảnh tải lên đang rỗng.")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Ảnh không được vượt quá 5 MB.")
    target_dir = UPLOAD_ROOT / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4().hex}{ALLOWED_TYPES[file.content_type]}"
    path = target_dir / filename
    path.write_bytes(data)
    return f"/media/{folder}/{filename}"
