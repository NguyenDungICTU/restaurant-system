python
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.roles import require_roles
from app.models.ban import Ban
from app.models.dat_ban import DatBan
from app.models.dot_goi_mon import DotGoiMon
from app.models.dong_goi_mon import DongGoiMon
from app.models.mon_an import MonAn
from app.models.nhan_vien import NhanVien
from app.models.nhat_ky_thao_tac import NhatKyThaoTac
from app.models.phien_ban import PhienBan
from app.schemas.customer_order import (
    CancelOrderLineRequest,
    StaffAdditionalOrderCreate,
    StaffOrderCreate,
    StaffOrderLineResponse,
    StaffOrderStatusUpdate,
)

router = APIRouter(
    prefix="/api/order-ops",
    tags=["Gọi món - Bếp/Phục vụ"],
)

VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")

VALID_STATUSES = {
    "CHO_BEP",
    "DANG_CHE_BIEN",
    "DA_XONG",
    "DA_PHUC_VU",
    "DA_HUY",
}

STATUS_ORDER = {
    "CHO_BEP": 0,
    "DANG_CHE_BIEN": 1,
    "DA_XONG": 2,
    "DA_PHUC_VU": 3,
}

STATUS_TRANSITIONS = {
    "CHO_BEP": {"DANG_CHE_BIEN"},
    "DANG_CHE_BIEN": {"DA_XONG"},
    "DA_XONG": {"DA_PHUC_VU"},
}

KITCHEN_STATUSES = {
    "CHO_BEP",
    "DANG_CHE_BIEN",
}

CANCEL_REASONS = {
    "KHACH_DOI_Y": "Khách đổi ý",
    "GOI_NHAM": "Gọi nhầm",
    "HET_NGUYEN_LIEU": "Hết nguyên liệu",
}


def _validate_forward_transition(
    current: str,
    target: str,
) -> None:
    if target == "DA_HUY":
        return

    if current not in STATUS_ORDER or target not in STATUS_ORDER:
        raise HTTPException(
            status_code=422,
            detail="Trạng thái chuyển món không hợp lệ.",
        )

    if STATUS_ORDER[target] <= STATUS_ORDER[current]:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Không thể chuyển món lùi từ {current} "
                f"sang {target}."
            ),
        )


def _rows(
    db: Session,
    statuses: set[str] | None = None,
    include_cancelled: bool = False,
):
    statement = (
        select(
            DongGoiMon,
            DotGoiMon,
            PhienBan,
            Ban,
            MonAn,
        )
        .join(
            DotGoiMon,
            DotGoiMon.id == DongGoiMon.dot_goi_mon_id,
        )
        .join(
            PhienBan,
            PhienBan.id == DotGoiMon.phien_ban_id,
        )
        .join(
            Ban,
            Ban.id == PhienBan.ban_id,
        )
        .join(
            MonAn,
            MonAn.id == DongGoiMon.mon_an_id,
        )
        .where(
            PhienBan.trang_thai.in_({
                "DANG_PHUC_VU",
                "CHO_THANH_TOAN",
            })
        )
    )

    if statuses is not None:
        statement = statement.where(
            DongGoiMon.trang_thai.in_(statuses)
        )
    elif not include_cancelled:
        statement = statement.where(
            DongGoiMon.trang_thai != "DA_HUY"
        )

    return db.execute(
        statement.order_by(
            DongGoiMon.thoi_diem_tiep_nhan,
            DongGoiMon.id,
        )
    ).all()


def _view(
    line,
    batch,
    session,
    table,
    dish,
):
    eta = None

    if batch.gui_at is not None:
        eta = batch.gui_at + timedelta(
            minutes=max(
                dish.thoi_gian_che_bien_phut or 0,
                0,
            )
        )

    return StaffOrderLineResponse(
        id=line.id,
        dot_id=batch.id,
        phien_ban_id=session.id,
        ban_id=table.id,
        ma_ban=table.ma_ban,
        ten_mon=dish.ten_mon,
        so_luong=line.so_luong,
        don_gia=line.don_gia,
        ghi_chu=line.ghi_chu,
        trang_thai=line.trang_thai,
        tinh_tien=bool(line.tinh_tien),
        ly_do_huy=line.ly_do_huy,
        huy_at=line.huy_at,
        thoi_diem_tiep_nhan=line.thoi_diem_tiep_nhan,
        bat_dau_che_bien_at=line.bat_dau_che_bien_at,
        hoan_thanh_at=line.hoan_thanh_at,
        phuc_vu_at=line.phuc_vu_at,
        du_kien_hoan_thanh_at=eta,
    )


@router.get(
    "/kitchen",
    response_model=list[StaffOrderLineResponse],
)
def kitchen_orders(
    db: Session = Depends(get_db),
    _: NhanVien = Depends(
        require_roles("BEP", "QUAN_LY")
    ),
):
    return [
        _view(*row)
        for row in _rows(db, statuses=KITCHEN_STATUSES)
    ]


@router.get(
    "/service",
    response_model=list[StaffOrderLineResponse],
)
def service_orders(
    db: Session = Depends(get_db),
    _: NhanVien = Depends(
        require_roles("PHUC_VU", "QUAN_LY")
    ),
):
    return _rows_as_views(
        _rows(db, include_cancelled=True)
    )


def _rows_as_views(rows):
    return [
        _view(*row)
        for row in rows
    ]


@router.post(
    "/tables/{table_id}/orders",
    status_code=201,
)
def create_staff_order(
    table_id: int,
    payload: StaffOrderCreate,
    db: Session = Depends(get_db),
    current_user: NhanVien = Depends(
        require_roles("PHUC_VU", "QUAN_LY")
    ),
):
    table = db.scalar(
        select(Ban)
        .where(Ban.id == table_id)
        .with_for_update()
    )

    if table is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy bàn.",
        )

    if table.trang_thai != "DANG_SU_DUNG":
        raise HTTPException(
            status_code=409,
            detail=(
                "Bàn chưa ở trạng thái đang phục vụ. "
                "Hãy nhận khách trước khi gọi món."
            ),
        )

    session = db.scalar(
        select(PhienBan)
        .where(
            PhienBan.ban_id == table.id,
            PhienBan.trang_thai == "DANG_PHUC_VU",
        )
        .order_by(
            PhienBan.bat_dau_at.desc(),
            PhienBan.id.desc(),
        )
        .limit(1)
        .with_for_update()
    )

    if session is None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Bàn chưa có phiên phục vụ. "
                "Hãy nhận khách tại Sơ đồ bàn trước."
            ),
        )

    if not payload.items:
        raise HTTPException(
            status_code=422,
            detail="Vui lòng chọn ít nhất một món.",
        )

    dish_ids = [
        item.mon_an_id
        for item in payload.items
    ]

    dishes = {
        dish.id: dish
        for dish in db.scalars(
            select(MonAn)
            .where(
                MonAn.id.in_(dish_ids),
                MonAn.trang_thai == "DANG_BAN",
            )
            .with_for_update()
        ).all()
    }

    if len(dishes) != len(set(dish_ids)):
        raise HTTPException(
            status_code=409,
            detail=(
                "Một hoặc nhiều món vừa chuyển sang trạng thái "
                "tạm hết/ngừng bán. Vui lòng chọn lại."
            ),
        )

    now = datetime.now(VIETNAM_TZ)

    max_batch = db.scalar(
        select(func.max(DotGoiMon.so_dot))
        .where(DotGoiMon.phien_ban_id == session.id)
    ) or 0

    batch = DotGoiMon(
        phien_ban_id=session.id,
        so_dot=max_batch + 1,
        gui_at=now,
        created_by=current_user.id,
    )

    db.add(batch)
    db.flush()

    for item in payload.items:
        dish = dishes[item.mon_an_id]

        db.add(
            DongGoiMon(
                dot_goi_mon_id=batch.id,
                mon_an_id=dish.id,
                so_luong=item.so_luong,
                don_gia=dish.gia,
                ghi_chu=item.ghi_chu,
                trang_thai="CHO_BEP",
                thoi_diem_tiep_nhan=now,
                ban_goc_id=table.id,
                tinh_tien=True,
            )
        )

    db.commit()

    return {
        "dot_id": batch.id,
        "phien_ban_id": session.id,
        "ban_id": table.id,
        "ma_ban": table.ma_ban,
        "so_dong_mon": len(payload.items),
    }


@router.patch(
    "/lines/{line_id}/status",
    response_model=StaffOrderLineResponse,
)
def update_order_line_status(
    line_id: int,
    payload: StaffOrderStatusUpdate,
    db: Session = Depends(get_db),
    current_user: NhanVien = Depends(
        require_roles("BEP", "QUAN_LY")
    ),
):
    target = payload.trang_thai

    if target not in VALID_STATUSES:
        raise HTTPException(
            status_code=422,
            detail="Trạng thái món không hợp lệ.",
        )

    if target == "DA_HUY":
        raise HTTPException(
            status_code=422,
            detail=(
                "Dùng chức năng huỷ dòng món "
                "và cung cấp lý do huỷ."
            ),
        )

    row = db.execute(
        select(
            DongGoiMon,
            DotGoiMon,
            PhienBan,
            Ban,
            MonAn,
        )
        .join(
            DotGoiMon,
            DotGoiMon.id == DongGoiMon.dot_goi_mon_id,
        )
        .join(
            PhienBan,
            PhienBan.id == DotGoiMon.phien_ban_id,
        )
        .join(
            Ban,
            Ban.id == PhienBan.ban_id,
        )
        .join(
            MonAn,
            MonAn.id == DongGoiMon.mon_an_id,
        )
        .where(DongGoiMon.id == line_id)
        .with_for_update()
    ).first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy món gọi.",
        )

    line, batch, session, table, dish = row

    if session.trang_thai not in {
        "DANG_PHUC_VU",
        "CHO_THANH_TOAN",
    }:
        raise HTTPException(
            status_code=409,
            detail="Phiên phục vụ đã kết thúc.",
        )

    if line.trang_thai == "DA_HUY":
        raise HTTPException(
            status_code=409,
            detail="Món đã được huỷ.",
        )

    if target == line.trang_thai:
        raise HTTPException(
            status_code=409,
            detail="Món đã ở trạng thái này.",
        )

    allowed_targets = STATUS_TRANSITIONS.get(
        line.trang_thai,
        set(),
    )

    if target not in allowed_targets:
        raise HTTPException(
            status_code=409,
            detail=(
                f"Không thể chuyển món từ {line.trang_thai} "
                f"sang {target}."
            ),
        )

    _validate_forward_transition(
        line.trang_thai,
        target,
    )

    if (
        current_user.vai_tro == "BEP"
        and target not in {"DANG_CHE_BIEN", "DA_XONG"}
    ):
        raise HTTPException(
            status_code=403,
            detail=(
                "Bếp chỉ được chuyển món sang "
                "Đang chế biến hoặc Đã xong."
            ),
        )

    now = datetime.now(VIETNAM_TZ)

    if target == "DANG_CHE_BIEN":
        line.bat_dau_che_bien_at = (
            line.bat_dau_che_bien_at or now
        )

    if target == "DA_XONG":
        line.bat_dau_che_bien_at = (
            line.bat_dau_che_bien_at or now
        )
        line.hoan_thanh_at = (
            line.hoan_thanh_at or now
        )

    if target == "DA_PHUC_VU":
        line.phuc_vu_at = line.phuc_vu_at or now

    line.trang_thai = target

    db.commit()
    db.refresh(line)

    return _view(
        line,
        batch,
        session,
        table,
        dish,
    )


@router.patch(
    "/lines/{line_id}/cancel",
    response_model=StaffOrderLineResponse,
)
def cancel_order_line(
    line_id: int,
    payload: CancelOrderLineRequest,
    db: Session = Depends(get_db),
    current_user: NhanVien = Depends(
        require_roles("PHUC_VU", "QUAN_LY")
    ),
):
    reason = payload.ly_do_huy.strip()

    if reason not in CANCEL_REASONS:
        raise HTTPException(
            status_code=422,
            detail=(
                "Lý do huỷ không hợp lệ. "
                "Chỉ chấp nhận: khách đổi ý, gọi nhầm "
                "hoặc hết nguyên liệu."
            ),
        )

    row = db.execute(
        select(
            DongGoiMon,
            DotGoiMon,
            PhienBan,
            Ban,
            MonAn,
        )
        .join(
            DotGoiMon,
            DotGoiMon.id == DongGoiMon.dot_goi_mon_id,
        )
        .join(
            PhienBan,
            PhienBan.id == DotGoiMon.phien_ban_id,
        )
        .join(
            Ban,
            Ban.id == PhienBan.ban_id,
        )
        .join(
            MonAn,
            MonAn.id == DongGoiMon.mon_an_id,
        )
        .where(DongGoiMon.id == line_id)
        .with_for_update()
    ).first()

    if row is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy dòng món.",
        )

    line, batch, session, table, dish = row

    if session.trang_thai not in {
        "DANG_PHUC_VU",
        "CHO_THANH_TOAN",
    }:
        raise HTTPException(
            status_code=409,
            detail=(
                "Phiên phục vụ đã kết thúc, "
                "không thể huỷ món."
            ),
        )

    if line.trang_thai == "DA_HUY":
        raise HTTPException(
            status_code=409,
            detail="Dòng món đã được huỷ.",
        )

    is_manager = current_user.vai_tro == "QUAN_LY"

    if line.trang_thai == "CHO_BEP":
        charge_line = False

    elif line.trang_thai == "DANG_CHE_BIEN":
        if not is_manager:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Bếp đã bắt đầu chế biến. "
                    "Chỉ quản lý mới được huỷ; "
                    "dòng món vẫn tính tiền."
                ),
            )

        charge_line = True

    else:
        raise HTTPException(
            status_code=409,
            detail=(
                "Chỉ có thể huỷ món khi đang chờ bếp "
                "hoặc đang chế biến."
            ),
        )

    current_shift_id = db.execute(
        text(
            """
            SELECT id
            FROM ca_lam_viec
            WHERE nhan_vien_id = :nhan_vien_id
              AND trang_thai = 'DANG_MO'
            ORDER BY bat_dau_at DESC, id DESC
            LIMIT 1
            """
        ),
        {
            "nhan_vien_id": current_user.id,
        },
    ).scalar_one_or_none()

    invoice = db.execute(
        text(
            """
            SELECT
                id,
                so_hoa_don,
                ca_lam_viec_id
            FROM hoa_don
            WHERE phien_ban_id = :phien_ban_id
            ORDER BY id DESC
            LIMIT 1
            """
        ),
        {
            "phien_ban_id": session.id,
        },
    ).mappings().first()

    invoice_id = invoice["id"] if invoice else None
    invoice_number = (
        invoice["so_hoa_don"]
        if invoice
        else None
    )

    shift_id = (
        invoice["ca_lam_viec_id"]
        if invoice
        and invoice["ca_lam_viec_id"] is not None
        else current_shift_id
    )

    line_total = line.don_gia * line.so_luong
    now = datetime.now(VIETNAM_TZ)

    old_data = {
        "dong_goi_mon_id": line.id,
        "dot_goi_mon_id": batch.id,
        "phien_ban_id": session.id,
        "ban_id": table.id,
        "ma_ban": table.ma_ban,
        "mon_an_id": dish.id,
        "ten_mon": dish.ten_mon,
        "so_luong": line.so_luong,
        "don_gia": str(line.don_gia),
        "thanh_tien": str(line_total),
        "trang_thai": line.trang_thai,
        "tinh_tien": bool(line.tinh_tien),
        "hoa_don_id": invoice_id,
        "so_hoa_don": invoice_number,
        "ca_lam_viec_id": shift_id,
    }

    line.trang_thai = "DA_HUY"
    line.huy_at = now
    line.ly_do_huy = reason
    line.tinh_tien = charge_line

    new_data = {
        **old_data,
        "trang_thai": "DA_HUY",
        "tinh_tien": bool(charge_line),
        "ly_do_huy": reason,
        "ly_do_huy_text": CANCEL_REASONS[reason],
        "huy_at": now.isoformat(),
        "nguoi_huy_id": current_user.id,
        "nguoi_huy": current_user.ho_ten,
        "quyen_huy": (
            "QUAN_LY"
            if is_manager
            else "PHUC_VU"
        ),
    }

    db.add(
        NhatKyThaoTac(
            nhan_vien_id=current_user.id,
            hanh_dong="HUY_MON",
            doi_tuong="DONG_GOI_MON",
            doi_tuong_id=line.id,
            du_lieu_cu=old_data,
            du_lieu_moi=new_data,
        )
    )

    db.commit()
    db.refresh(line)

    return _view(
        line,
        batch,
        session,
        table,
        dish,
    )


@router.post(
    "/batches/{batch_id}/complete",
)
def complete_order_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(
        require_roles("BEP", "QUAN_LY")
    ),
):
    rows = db.execute(
        select(
            DongGoiMon,
            DotGoiMon,
            PhienBan,
        )
        .join(
            DotGoiMon,
            DotGoiMon.id == DongGoiMon.dot_goi_mon_id,
        )
        .join(
            PhienBan,
            PhienBan.id == DotGoiMon.phien_ban_id,
        )
        .where(DotGoiMon.id == batch_id)
        .with_for_update()
    ).all()

    if not rows:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy phiếu gọi món.",
        )

    session = rows[0][2]
    lines = [row[0] for row in rows]

    active_lines = [
        line
        for line in lines
        if line.trang_thai != "DA_HUY"
    ]

    if session.trang_thai not in {
        "DANG_PHUC_VU",
        "CHO_THANH_TOAN",
    }:
        raise HTTPException(
            status_code=409,
            detail="Phiên phục vụ không còn hoạt động.",
        )

    if not active_lines:
        raise HTTPException(
            status_code=409,
            detail="Phiếu không có món cần hoàn thành.",
        )

    if any(
        line.trang_thai != "DA_XONG"
        for line in active_lines
    ):
        raise HTTPException(
            status_code=409,
            detail=(
                "Chỉ có thể đánh dấu phiếu đã xong "
                "khi toàn bộ món trong phiếu đã xong."
            ),
        )

    completion_times = [
        line.hoan_thanh_at
        for line in active_lines
        if line.hoan_thanh_at is not None
    ]

    return {
        "batch_id": batch_id,
        "trang_thai": "DA_XONG",
        "so_mon": len(active_lines),
        "hoan_thanh_at": (
            max(completion_times)
            if completion_times
            else None
        ),
    }


@router.post(
    "/sessions/{session_id}/additional-order",
)
def create_additional_order(
    session_id: int,
    payload: StaffAdditionalOrderCreate,
    db: Session = Depends(get_db),
    staff: NhanVien = Depends(
        require_roles("PHUC_VU", "QUAN_LY")
    ),
):
    if payload.phien_ban_id != session_id:
        raise HTTPException(
            status_code=400,
            detail="Phiên phục vụ không khớp.",
        )

    session = db.scalar(
        select(PhienBan)
        .where(PhienBan.id == session_id)
        .with_for_update()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy phiên phục vụ.",
        )

    if session.trang_thai == "CHO_THANH_TOAN":
        raise HTTPException(
            status_code=409,
            detail=(
                "Bàn đang chờ thanh toán, "
                "không thể gọi thêm món."
            ),
        )

    if session.trang_thai != "DANG_PHUC_VU":
        raise HTTPException(
            status_code=409,
            detail=(
                "Phiên phục vụ không còn nhận gọi thêm món."
            ),
        )

    table = db.scalar(
        select(Ban).where(Ban.id == session.ban_id)
    )

    if table is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy bàn.",
        )

    if not payload.items:
        raise HTTPException(
            status_code=422,
            detail="Vui lòng chọn ít nhất một món.",
        )

    dishes = {}

    for item in payload.items:
        dish = db.scalar(
            select(MonAn)
            .where(MonAn.id == item.mon_an_id)
        )

        if dish is None:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"Không tìm thấy món có id "
                    f"{item.mon_an_id}."
                ),
            )

        if dish.trang_thai != "DANG_BAN":
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Món '{dish.ten_mon}' đã ngừng bán."
                ),
            )

        dishes[item.mon_an_id] = dish

    max_batch = db.scalar(
        select(func.max(DotGoiMon.so_dot))
        .where(DotGoiMon.phien_ban_id == session.id)
    )

    next_batch_number = (max_batch or 0) + 1
    now = datetime.now(VIETNAM_TZ)

    batch = DotGoiMon(
        phien_ban_id=session.id,
        so_dot=next_batch_number,
        gui_at=now,
        created_by=staff.id,
    )

    db.add(batch)
    db.flush()

    for item in payload.items:
        dish = dishes[item.mon_an_id]

        db.add(
            DongGoiMon(
                dot_goi_mon_id=batch.id,
                mon_an_id=dish.id,
                so_luong=item.so_luong,
                don_gia=dish.gia,
                ghi_chu=item.ghi_chu,
                trang_thai="CHO_BEP",
                thoi_diem_tiep_nhan=now,
                ban_goc_id=table.id,
                tinh_tien=True,
            )
        )

    db.commit()
    db.refresh(batch)

    return {
        "dot_id": batch.id,
        "phien_ban_id": session.id,
        "ban_id": table.id,
        "ma_ban": table.ma_ban,
        "so_dot": batch.so_dot,
        "gui_at": batch.gui_at,
        "trang_thai": "CHO_BEP",
    }


@router.post(
    "/sessions/{session_id}/close",
)
def close_service_session(
    session_id: int,
    db: Session = Depends(get_db),
    _: NhanVien = Depends(
        require_roles("PHUC_VU", "QUAN_LY")
    ),
):
    session = db.scalar(
        select(PhienBan)
        .where(PhienBan.id == session_id)
        .with_for_update()
    )

    if session is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy phiên phục vụ.",
        )

    if session.trang_thai != "DANG_PHUC_VU":
        raise HTTPException(
            status_code=409,
            detail="Phiên phục vụ không còn hoạt động.",
        )

    table = db.scalar(
        select(Ban)
        .where(Ban.id == session.ban_id)
        .with_for_update()
    )

    if table is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy bàn.",
        )

    unfinished = db.scalar(
        select(DongGoiMon.id)
        .join(
            DotGoiMon,
            DotGoiMon.id == DongGoiMon.dot_goi_mon_id,
        )
        .where(
            DotGoiMon.phien_ban_id == session.id,
            DongGoiMon.trang_thai.not_in({
                "DA_XONG",
                "DA_PHUC_VU",
                "DA_HUY",
            }),
        )
        .limit(1)
    )

    if unfinished is not None:
        raise HTTPException(
            status_code=409,
            detail=(
                "Chưa thể kết thúc phiên vì vẫn còn "
                "món chưa hoàn thành."
            ),
        )

    now = datetime.now(VIETNAM_TZ)

    session.trang_thai = "DA_DONG"
    session.dong_at = now

    upcoming = db.scalar(
        select(DatBan.id)
        .where(
            DatBan.ban_id == table.id,
            DatBan.trang_thai == "DA_XAC_NHAN",
            DatBan.khach_toi_at.is_(None),
            DatBan.ngay_dat >= now.date(),
        )
        .limit(1)
    )

    table.trang_thai = (
        "DA_DAT"
        if upcoming is not None
        else "TRONG"
    )
    table.trang_thai_changed_at = now

    db.commit()

    return {
        "session_id": session.id,
        "ban_id": table.id,
        "ma_ban": table.ma_ban,
        "trang_thai_phien": session.trang_thai,
        "trang_thai_ban": table.trang_thai,
    }
