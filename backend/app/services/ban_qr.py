from io import BytesIO
from pathlib import Path

import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

from app.core.config import settings


def qr_url(token: str) -> str:
    return f"{str(settings.qr_frontend_url).rstrip('/')}/?qr={token}"


def qr_png(token: str) -> bytes:
    output = BytesIO()
    qrcode.make(qr_url(token)).save(output, format="PNG")
    return output.getvalue()


def area_pdf(area, tables) -> bytes:
    font = "QRUnicode"
    if font not in pdfmetrics.getRegisteredFontNames():
        paths = [settings.qr_pdf_font_path, "C:/Windows/Fonts/arial.ttf"]
        path = next((p for p in paths if Path(p).is_file()), None)
        if path is None:
            raise RuntimeError("Không tìm thấy font PDF. Cấu hình QR_PDF_FONT_PATH.")
        pdfmetrics.registerFont(TTFont(font, path))
    output = BytesIO()
    pdf = Canvas(output, pagesize=A4)
    width, height = A4

    def fitted(text, x, y, size, max_width):
        text_width = pdfmetrics.stringWidth(text, font, size)
        pdf.setFont(font, min(size, size * max_width / max(text_width, 1)))
        pdf.drawCentredString(x, y, text)

    for index, table in enumerate(tables):
        slot = index % 6
        if slot == 0:
            if index:
                pdf.showPage()
            fitted(f"QR bàn — {area.ten_khu_vuc}", width / 2, height - 40, 16, width - 60)
        x = width / 4 + (slot % 2) * width / 2
        y = height - 100 - (slot // 2) * 240
        fitted(table.ma_ban, x, y, 13, width / 2 - 40)
        pdf.drawImage(ImageReader(BytesIO(qr_png(table.qr_token))), x - 90, y - 190, 180, 180)
        fitted(f"{table.suc_chua_toi_thieu}–{table.suc_chua_toi_da} khách", x, y - 205, 10, 240)
    pdf.save()
    return output.getvalue()
