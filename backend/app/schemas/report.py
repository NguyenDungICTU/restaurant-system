from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class ReportRankItem(BaseModel):
    rank: int
    mon_an_id: int
    ten_mon: str
    trang_thai_hien_tai: str
    ngung_ban: bool
    so_luong_ban: int
    doanh_thu: Decimal


class CancelledDishItem(BaseModel):
    rank: int
    mon_an_id: int
    ten_mon: str
    trang_thai_hien_tai: str
    ngung_ban: bool
    so_luong_huy: int
    ly_do_pho_bien: str
    ly_do_dong_hang: list[str]


class DishReportSummary(BaseModel):
    tong_so_luong_ban: int
    tong_doanh_thu: Decimal
    tong_so_luong_huy: int


class DishReportResponse(BaseModel):
    from_date: date
    to_date: date
    top_by_quantity: list[ReportRankItem]
    top_by_revenue: list[ReportRankItem]
    cancelled_items: list[CancelledDishItem]
    summary: DishReportSummary
