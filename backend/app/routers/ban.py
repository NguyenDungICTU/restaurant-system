import secrets
from _thread import LockType
from datetime import datetime, timedelta
from threading import Lock
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import delete, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database.session import get_db
from app.dependencies.auth import require_manager
from app.dependencies.roles import require_roles
from app.models.ban import Ban, BanQRToken
from app.models.dat_ban import DatBan
from app.models.khu_vuc import KhuVuc
from app.models.nhan_vien import NhanVien
from app.models.phien_ban import PhienBan
from app.schemas.ban import (
    BanCodeAvailabilityResponse,
    BanConfigurationRequest,
    BanCreateRequest,
    BanDetailsResponse,
    BanResponse,
    BanScanResponse,
    SeatedGuestResponse,
    UpcomingTableBookingResponse,
)
from app.schemas.dat_ban import (
    DatBanChoNhanKhachResponse,
    NhanKhachBanRequest,
)
from app.services.ban_qr import area_pdf, qr_png


router = APIRouter(
    prefix="/api/ban",
    tags=["Bàn"],
)

manager = [Depends(require_manager)]
read_table_roles = [Depends(require_roles("QUAN_LY", "PHUC_VU"))]
VIETNAM_TZ = ZoneInfo("Asia/Ho_Chi_Minh")
_area_create_locks: dict[int, LockType] = {}
_area_create_locks_guard = Lock()


def area_create_lock(area_id: int) -> LockType:
    with _area_create_locks_guard:
        return _area_create_locks.setdefault(area_id, Lock())


def get_table(
    db: Session,
    table_id: int,
    *,
    lock: bool = False,
) -> Ban:
    query = select(Ban).where(Ban.id == table_id)

    if lock:
        query = query.with_for_update()

    table = db.scalar(query)

    if table is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy bàn.",
        )

    return table


def validate_area(
    db: Session,
    area_id: int,
    *,
    require_active: bool = False,
) -> KhuVuc:
    area = db.get(KhuVuc, area_id)

    if area is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy khu vực.",
        )

    if require_active and area.trang_thai != "HOAT_DONG":
        raise HTTPException(
            status_code=409,
            detail=(
                "Khu vực đã ngừng sử dụng. "
                "Vui lòng chọn khu vực đang hoạt động."
            ),
        )

    return area


def commit(
    db: Session,
    snapshot: Ban | None = None,
):
    try:
        if snapshot is not None:
            db.flush()
            db.refresh(snapshot)
            result = BanResponse.model_validate(snapshot)

        db.commit()

        if snapshot is not None:
            return result

    except IntegrityError as error:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail=(
                "Mã bàn đã tồn tại hoặc dữ liệu xung đột. "
                "Vui lòng thử lại."
            ),
        ) from error


@router.get(
    "",
    response_model=list[BanResponse],
    dependencies=read_table_roles,
)
def list_tables(
    khu_vuc_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(Ban).order_by(Ban.ma_ban)

    if khu_vuc_id is not None:
        query = query.where(Ban.khu_vuc_id == khu_vuc_id)

    return list(db.scalars(query))


def eligible_arrival_bookings(
    db: Session,
    table_id: int,
    now: datetime,
) -> list[DatBan]:
    bookings = db.scalars(
        select(DatBan)
        .where(
            DatBan.ban_id == table_id,
            DatBan.ngay_dat == now.date(),
            DatBan.trang_thai == "DA_XAC_NHAN",
            DatBan.khach_toi_at.is_(None),
        )
        .order_by(DatBan.gio_bat_dau, DatBan.id)
    ).all()
    eligible = []

    for booking in bookings:
        if is_arrival_booking(booking, now):
            eligible.append(booking)

    return eligible


def is_arrival_booking(booking: DatBan, now: datetime) -> bool:
    if (
        booking.ban_id is None
        or booking.trang_thai != "DA_XAC_NHAN"
        or booking.khach_toi_at is not None
        or booking.ngay_dat != now.date()
    ):
        return False

    start_at = datetime.combine(
        booking.ngay_dat,
        booking.gio_bat_dau,
        VIETNAM_TZ,
    )
    end_at = start_at + timedelta(
        minutes=booking.thoi_luong_giu_ban
    )

    return start_at <= now < end_at


@router.get(
    "/{table_id}/dat-ban-cho-nhan",
    response_model=list[DatBanChoNhanKhachResponse],
    dependencies=read_table_roles,
)
def list_arrival_bookings(
    table_id: int,
    db: Session = Depends(get_db),
):
    table = get_table(db, table_id)

    if not table.da_cau_hinh:
        raise HTTPException(
            status_code=409,
            detail="Bàn chưa được cấu hình và chưa thể nhận khách.",
        )

    if table.trang_thai != "DA_DAT":
        raise HTTPException(
            status_code=409,
            detail="Bàn không còn ở trạng thái đã đặt.",
        )

    return eligible_arrival_bookings(
        db,
        table.id,
        datetime.now(VIETNAM_TZ),
    )


@router.post(
    "/{table_id}/nhan-khach",
    status_code=201,
)
def receive_table_guests(
    table_id: int,
    payload: NhanKhachBanRequest,
    current_user: NhanVien = Depends(
        require_roles("QUAN_LY", "PHUC_VU")
    ),
    db: Session = Depends(get_db),
):
    table = get_table(db, table_id, lock=True)
    now = datetime.now(VIETNAM_TZ)

    if not table.da_cau_hinh:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Bàn chưa được cấu hình và chưa thể nhận khách.",
        )

    if table.trang_thai not in {"TRONG", "DA_DAT"}:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Trạng thái bàn đã thay đổi. Vui lòng tải lại sơ đồ.",
        )

    booking = None
    if table.trang_thai == "DA_DAT":
        if payload.dat_ban_id is None:
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail="Cần chọn đúng đơn đặt bàn trước khi nhận khách.",
            )

        booking = db.scalar(
            select(DatBan)
            .where(DatBan.id == payload.dat_ban_id)
            .with_for_update()
        )

        if (
            booking is None
            or booking.ban_id != table.id
            or not is_arrival_booking(booking, now)
        ):
            db.rollback()
            raise HTTPException(
                status_code=409,
                detail=(
                    "Đơn đặt bàn không còn phù hợp hoặc chưa đến giờ. "
                    "Vui lòng tải lại danh sách."
                ),
            )
    elif payload.dat_ban_id is not None:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Bàn trống không thể nhận khách theo đơn đặt bàn này.",
        )

    active_session = db.scalar(
        select(PhienBan)
        .where(
            PhienBan.ban_id == table.id,
            PhienBan.trang_thai.in_(
                {"DANG_PHUC_VU", "CHO_THANH_TOAN"}
            ),
        )
        .with_for_update()
    )

    if active_session is not None:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Bàn đã có phiên phục vụ đang hoạt động.",
        )

    table.trang_thai = "DANG_SU_DUNG"
    table.trang_thai_changed_at = now

    if booking is not None:
        booking.khach_toi_at = now

    service_session = PhienBan(
        ban_id=table.id,
        trang_thai="DANG_PHUC_VU",
        bat_dau_at=now,
        created_by=current_user.id,
    )
    db.add(service_session)

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Bàn vừa được thay đổi. Vui lòng tải lại sơ đồ.",
        ) from error

    return {
        "ban_id": table.id,
        "trang_thai": table.trang_thai,
        "bat_dau_at": service_session.bat_dau_at,
        "dat_ban_id": booking.id if booking is not None else None,
    }


@router.post(
    "",
    response_model=BanResponse,
    status_code=201,
    dependencies=manager,
)
def create_table(
    payload: BanCreateRequest,
    db: Session = Depends(get_db),
):
    with area_create_lock(payload.khu_vuc_id):
        for attempt in range(3):
            try:
                area = db.scalar(
                    select(KhuVuc)
                    .where(KhuVuc.id == payload.khu_vuc_id)
                    .with_for_update()
                )
                if area is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Không tìm thấy khu vực.",
                    )
                if area.trang_thai != "HOAT_DONG":
                    raise HTTPException(
                        status_code=409,
                        detail=(
                            "Khu vực đã ngừng sử dụng. "
                            "Vui lòng chọn khu vực đang hoạt động."
                        ),
                    )

                prefix = f"KV{area.id}-"
                existing_codes = db.scalars(
                    select(Ban.ma_ban).where(
                        Ban.ma_ban.like(f"{prefix}%")
                    )
                ).all()
                sequence_numbers = [
                    int(code[len(prefix):])
                    for code in existing_codes
                    if code.startswith(prefix)
                    and code[len(prefix):].isdigit()
                ]
                table = Ban(
                    ma_ban=f"{prefix}{max(sequence_numbers, default=0) + 1:03d}",
                    khu_vuc_id=area.id,
                    suc_chua_toi_thieu=None,
                    suc_chua_toi_da=None,
                    loai_ban=None,
                    da_cau_hinh=False,
                    trang_thai="TRONG",
                    qr_token=secrets.token_urlsafe(32),
                )
                db.add(table)
                db.flush()
                db.add(
                    BanQRToken(
                        token=table.qr_token,
                        ban_id=table.id,
                    )
                )
                db.flush()
                result = BanResponse.model_validate(table)
                db.commit()
                return result
            except IntegrityError as error:
                db.rollback()
                if attempt == 2:
                    raise HTTPException(
                        status_code=409,
                        detail="Không thể sinh mã bàn duy nhất. Vui lòng thử lại.",
                    ) from error
            except HTTPException:
                db.rollback()
                raise

    raise HTTPException(
        status_code=409,
        detail="Không thể sinh mã bàn duy nhất. Vui lòng thử lại.",
    )


@router.get(
    "/availability",
    response_model=BanCodeAvailabilityResponse,
    dependencies=manager,
)
def check_table_code_availability(
    ma_ban: str = Query(
        ...,
        min_length=1,
        max_length=50,
    ),
    exclude_id: int | None = Query(
        default=None,
        gt=0,
    ),
    db: Session = Depends(get_db),
):
    normalized = ma_ban.strip().upper()

    if not normalized:
        raise HTTPException(
            status_code=422,
            detail="Mã bàn không được để trống.",
        )

    query = select(Ban.id).where(
        Ban.ma_ban == normalized
    )

    if exclude_id is not None:
        query = query.where(
            Ban.id != exclude_id
        )

    exists = db.scalar(query) is not None

    return {
        "available": not exists,
        "normalized_code": normalized,
    }


@router.get(
    "/qr/{token}",
    response_model=BanScanResponse,
)
def scan_qr(
    token: str,
    response: Response,
    db: Session = Depends(get_db),
):
    response.headers["Cache-Control"] = "no-store"

    issued = db.get(BanQRToken, token)

    if issued is None:
        raise HTTPException(
            status_code=404,
            detail="Mã QR không hợp lệ.",
            headers={"Cache-Control": "no-store"},
        )

    table = get_table(
        db,
        issued.ban_id,
    )

    if table.qr_token != token:
        raise HTTPException(
            status_code=410,
            detail=(
                "Mã QR đã thay đổi. "
                "Vui lòng quét mã mới tại bàn."
            ),
            headers={"Cache-Control": "no-store"},
        )

    if not table.da_cau_hinh:
        raise HTTPException(
            status_code=409,
            detail="Bàn chưa được cấu hình và chưa thể sử dụng mã QR.",
            headers={"Cache-Control": "no-store"},
        )

    area = validate_area(
        db,
        table.khu_vuc_id,
    )

    if (
        table.trang_thai == "NGUNG_SU_DUNG"
        or area.trang_thai != "HOAT_DONG"
    ):
        raise HTTPException(
            status_code=409,
            detail="Bàn hoặc khu vực đang ngừng sử dụng.",
            headers={"Cache-Control": "no-store"},
        )

    return table


@router.get(
    "/khu-vuc/{area_id}/qr.pdf",
    dependencies=manager,
)
def download_area_qr(
    area_id: int,
    db: Session = Depends(get_db),
):
    area = validate_area(
        db,
        area_id,
    )

    tables = list(
        db.scalars(
            select(Ban)
            .where(
                Ban.khu_vuc_id == area_id,
                Ban.da_cau_hinh.is_(True),
            )
            .order_by(Ban.ma_ban)
        )
    )

    if not tables:
        raise HTTPException(
            status_code=404,
            detail="Khu vực chưa có bàn để xuất QR.",
        )

    return Response(
        area_pdf(area, tables),
        media_type="application/pdf",
        headers={
            "Content-Disposition": (
                f'attachment; filename="khu-vuc-{area_id}-qr.pdf"'
            ),
            "Cache-Control": "no-store",
        },
    )


def build_table_details(
    table: Ban,
    db: Session,
) -> dict:
    now = datetime.now(VIETNAM_TZ)

    active_session = None
    if table.trang_thai == "DANG_SU_DUNG":
        active_session = db.scalar(
            select(PhienBan)
            .where(
                PhienBan.ban_id == table.id,
                PhienBan.trang_thai.in_(
                    {"DANG_PHUC_VU", "CHO_THANH_TOAN"}
                ),
            )
            .order_by(PhienBan.bat_dau_at.desc(), PhienBan.id.desc())
            .limit(1)
        )

    current_booking = None
    subtotal = None
    service_started_at = None
    guests_seated = None

    if active_session is not None:
        service_started_at = active_session.bat_dau_at
        current_booking = db.scalar(
            select(DatBan)
            .where(
                DatBan.ban_id == table.id,
                DatBan.trang_thai == "DA_XAC_NHAN",
                DatBan.khach_toi_at.is_not(None),
                DatBan.khach_toi_at >= active_session.bat_dau_at,
            )
            .order_by(DatBan.khach_toi_at.desc(), DatBan.id.desc())
            .limit(1)
        )
        if current_booking is not None:
            guests_seated = SeatedGuestResponse(
                ho_ten_khach=current_booking.ho_ten_khach,
                so_luong_khach=current_booking.so_luong_khach,
            )

        subtotal = db.scalar(
            text(
                """
                SELECT COALESCE(
                    SUM(line.so_luong * line.don_gia),
                    0
                )
                FROM dot_goi_mon AS dgm
                JOIN dong_goi_mon AS line
                  ON line.dot_goi_mon_id = dgm.id
                WHERE dgm.phien_ban_id = :session_id
                  AND line.tinh_tien IS TRUE
                  AND line.trang_thai <> 'DA_HUY'
                """
            ),
            {"session_id": active_session.id},
        )

    upcoming_booking = None
    upcoming_candidates = db.scalars(
        select(DatBan)
        .where(
            DatBan.ban_id == table.id,
            DatBan.trang_thai == "DA_XAC_NHAN",
            DatBan.khach_toi_at.is_(None),
            DatBan.ngay_dat >= now.date(),
        )
        .order_by(DatBan.ngay_dat, DatBan.gio_bat_dau, DatBan.id)
    )
    for booking in upcoming_candidates:
        arrival_at = datetime.combine(
            booking.ngay_dat,
            booking.gio_bat_dau,
            VIETNAM_TZ,
        )
        if arrival_at > now:
            upcoming_booking = UpcomingTableBookingResponse(
                id=booking.id,
                ho_ten_khach=booking.ho_ten_khach,
                so_luong_khach=booking.so_luong_khach,
                thoi_gian_den_at=arrival_at,
            )
            break

    return {
        "id": table.id,
        "ma_ban": table.ma_ban,
        "khu_vuc_id": table.khu_vuc_id,
        "suc_chua_toi_thieu": table.suc_chua_toi_thieu,
        "suc_chua_toi_da": table.suc_chua_toi_da,
        "loai_ban": table.loai_ban,
        "trang_thai": table.trang_thai,
        "da_cau_hinh": table.da_cau_hinh,
        "qr_token": table.qr_token,
        "created_at": table.created_at,
        "updated_at": table.updated_at,
        "khach_dang_ngoi": guests_seated,
        "bat_dau_phuc_vu_at": service_started_at,
        "tam_tinh_hien_tai": subtotal,
        "dat_ban_sap_toi": upcoming_booking,
    }


@router.get(
    "/ma/{ma_ban}",
    response_model=BanDetailsResponse,
    dependencies=read_table_roles,
)
def read_table_by_code(
    ma_ban: str,
    db: Session = Depends(get_db),
):
    normalized_code = ma_ban.strip().upper()
    table = db.scalar(
        select(Ban).where(Ban.ma_ban == normalized_code)
    )
    if table is None:
        raise HTTPException(
            status_code=404,
            detail="Không tìm thấy bàn.",
        )

    return build_table_details(table, db)


@router.get(
    "/{table_id}",
    response_model=BanDetailsResponse,
    dependencies=read_table_roles,
)
def read_table(
    table_id: int,
    db: Session = Depends(get_db),
):
    return build_table_details(get_table(db, table_id), db)


@router.delete(
    "/{table_id}",
    status_code=204,
    dependencies=manager,
)
def delete_table(
    table_id: int,
    db: Session = Depends(get_db),
):
    table = get_table(
        db,
        table_id,
        lock=True,
    )

    try:
        db.execute(
            delete(BanQRToken).where(
                BanQRToken.ban_id == table.id
            )
        )

        db.delete(table)
        db.commit()

    except IntegrityError as error:
        db.rollback()

        raise HTTPException(
            status_code=409,
            detail="Không thể xóa bàn vì có dữ liệu liên quan.",
        ) from error

    return Response(status_code=204)


@router.put(
    "/{table_id}",
    response_model=BanResponse,
    dependencies=manager,
)
def update_table(
    table_id: int,
    payload: BanConfigurationRequest,
    db: Session = Depends(get_db),
):
    table = get_table(
        db,
        table_id,
        lock=True,
    )

    now = datetime.now(VIETNAM_TZ)
    capacity_changed = (
        table.suc_chua_toi_thieu != payload.suc_chua_toi_thieu
        or table.suc_chua_toi_da != payload.suc_chua_toi_da
    )

    if capacity_changed:
        active_sessions = db.scalars(
            select(PhienBan)
            .where(
                PhienBan.ban_id == table.id,
                PhienBan.trang_thai.in_(
                    {"DANG_PHUC_VU", "CHO_THANH_TOAN"}
                ),
            )
        ).all()

        for service_session in active_sessions:
            arrived_booking = db.scalar(
                select(DatBan)
                .where(
                    DatBan.ban_id == table.id,
                    DatBan.trang_thai == "DA_XAC_NHAN",
                    DatBan.khach_toi_at.is_not(None),
                    DatBan.khach_toi_at >= service_session.bat_dau_at,
                )
                .order_by(DatBan.khach_toi_at.desc())
                .limit(1)
            )

            if arrived_booking is None:
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Không thể xác minh số khách đang ngồi tại bàn. "
                        "Không thể thay đổi sức chứa khi phiên phục vụ "
                        "đang hoạt động."
                    ),
                )

            if not (
                payload.suc_chua_toi_thieu
                <= arrived_booking.so_luong_khach
                <= payload.suc_chua_toi_da
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Sức chứa mới không phù hợp với "
                        f"{arrived_booking.so_luong_khach} khách đang ngồi."
                    ),
                )

        confirmed_bookings = db.scalars(
            select(DatBan)
            .where(
                DatBan.ban_id == table.id,
                DatBan.trang_thai == "DA_XAC_NHAN",
                DatBan.khach_toi_at.is_(None),
                DatBan.ngay_dat >= now.date(),
            )
        ).all()

        for booking in confirmed_bookings:
            start_at = datetime.combine(
                booking.ngay_dat,
                booking.gio_bat_dau,
                VIETNAM_TZ,
            )
            end_at = start_at + timedelta(
                minutes=booking.thoi_luong_giu_ban
            )

            if end_at <= now:
                continue

            if not (
                payload.suc_chua_toi_thieu
                <= booking.so_luong_khach
                <= payload.suc_chua_toi_da
            ):
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Sức chứa mới không phù hợp với "
                        f"đơn đặt bàn #{booking.id} còn hiệu lực "
                        f"({booking.so_luong_khach} khách)."
                    ),
                )

    table.suc_chua_toi_thieu = payload.suc_chua_toi_thieu
    table.suc_chua_toi_da = payload.suc_chua_toi_da
    table.loai_ban = payload.loai_ban

    if not table.da_cau_hinh:
        table.trang_thai = "TRONG"
        table.trang_thai_changed_at = now
    table.da_cau_hinh = True

    return commit(db, snapshot=table)


@router.post(
    "/{table_id}/qr/regenerate",
    response_model=BanResponse,
    dependencies=manager,
)
def regenerate_qr(
    table_id: int,
    db: Session = Depends(get_db),
):
    table = get_table(
        db,
        table_id,
        lock=True,
    )

    if not table.da_cau_hinh:
        raise HTTPException(
            status_code=409,
            detail="Chưa thể sinh lại QR cho bàn chưa được cấu hình.",
        )

    table.qr_token = secrets.token_urlsafe(32)

    db.add(
        BanQRToken(
            token=table.qr_token,
            ban_id=table.id,
        )
    )

    return commit(
        db,
        snapshot=table,
    )


@router.get(
    "/{table_id}/qr.png",
    dependencies=manager,
)
def download_table_qr(
    table_id: int,
    db: Session = Depends(get_db),
):
    table = get_table(
        db,
        table_id,
    )

    if not table.da_cau_hinh:
        raise HTTPException(
            status_code=409,
            detail="Chưa thể tải QR cho bàn chưa được cấu hình.",
        )

    return Response(
        qr_png(table.qr_token),
        media_type="image/png",
        headers={
            "Content-Disposition": (
                f'attachment; filename="ban-{table_id}-qr.png"'
            ),
            "Cache-Control": "no-store",
        },
    )