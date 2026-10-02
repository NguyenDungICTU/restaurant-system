from pathlib import Path
from uuid import uuid4
from io import BytesIO
from PIL import Image
from fastapi import HTTPException, UploadFile

UPLOAD_ROOT = Path("/app/uploads")
ALLOWED_TYPES = {"image/jpeg", "image/png"}
MAX_BYTES = 5 * 1024 * 1024
MAX_EDGE = 1024

async def save_image(file: UploadFile, folder: str) -> str:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Chỉ chấp nhận ảnh JPG hoặc PNG.")
    data = await file.read()
    if not data or len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="Ảnh phải nhỏ hơn 5 MB.")

    try:
        image = Image.open(BytesIO(data))
        image = image.convert("RGB")
        image.thumbnail((MAX_EDGE, MAX_EDGE), Image.Resampling.LANCZOS)
        filename = f"{uuid4().hex}.jpg"
        target_dir = UPLOAD_ROOT / folder
        target_dir.mkdir(parents=True, exist_ok=True)
        path = target_dir / filename
        image.save(path, "JPEG", quality=85, optimize=True)
    except Exception:
        raise HTTPException(status_code=400, detail="File ảnh không hợp lệ.")

    return f"/media/{folder}/{filename}"

def delete_image(url: str | None):
    if not url or not url.startswith("/media/"):
        return
    path = UPLOAD_ROOT / url.replace("/media/", "", 1)
    if path.exists():
        path.unlink()
