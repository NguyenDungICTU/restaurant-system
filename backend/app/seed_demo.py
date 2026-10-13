"""Create the development demo manager account if it does not exist.

This script is intentionally idempotent: restarting the backend will not create
another account or overwrite an existing manager password.
"""

import os

from sqlalchemy import or_

from app.core.security import hash_password
from app.database.session import SessionLocal
from app.models.nhan_vien import NhanVien
from app.models.nhom_mon import NhomMon
from app.models.mon_an import MonAn
from app.seed_table_map_demo import seed_table_map_demo


DEFAULT_USERNAME = "manager"
DEFAULT_PHONE = "0963217400"
DEFAULT_PASSWORD = "demo12345"
DEFAULT_FULL_NAME = "Quản lý nhà hàng"


def env(name: str, default: str) -> str:
    value = os.getenv(name, default).strip()
    return value or default


def seed_demo_account() -> bool:
    username = env("DEMO_USERNAME", DEFAULT_USERNAME)
    phone = env("DEMO_PHONE", DEFAULT_PHONE)
    password = os.getenv("DEMO_PASSWORD", DEFAULT_PASSWORD)
    full_name = env("DEMO_FULL_NAME", DEFAULT_FULL_NAME)

    if len(password) < 8:
        raise ValueError("DEMO_PASSWORD must contain at least 8 characters.")

    db = SessionLocal()
    try:
        employee = db.query(NhanVien).filter(
            or_(
                NhanVien.ten_dang_nhap == username,
                NhanVien.so_dien_thoai == phone,
            )
        ).first()

        if employee is not None:
            print("Demo account already exists; keeping the existing password.")
            return False

        employee = NhanVien(
            ten_dang_nhap=username,
            so_dien_thoai=phone,
            mat_khau=hash_password(password),
            ho_ten=full_name,
            vai_tro="QUAN_LY",
            trang_thai="HOAT_DONG",
        )

        db.add(employee)
        db.commit()
        print(f"Demo account created: username={username}, phone={phone}")
        return True
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def seed_demo_menu() -> None:
    """Create a small demo menu and keep it idempotent."""
    db = SessionLocal()
    demo_menu = {
        "Khai vị": [
            ("Gỏi cuốn", "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=900&q=80"),
            ("Chả giò", "https://snapcalorie-webflow-website.s3.us-east-2.amazonaws.com/media/food_pics_v2/medium/fried_vietnamese_spring_roll.jpg"),
        ],
        "Món chính": [
            ("Cơm chiên", "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80"),
            ("Bò lúc lắc", "https://snapcalorie-webflow-website.s3.us-east-2.amazonaws.com/media/food_pics_v2/medium/bo_luc_lac.jpg"),
        ],
        "Đồ uống": [
            ("Trà đào", "https://bizweb.dktcdn.net/100/004/714/articles/tra-dao.jpg?v=1563186774693"),
            ("Nước suối", "https://cdn.hstatic.net/products/200001078872/z7164457794762_2eb24bc9b6d259462f521b188dcfd740_770c1030dd844f11bbbdd4d46476e167.jpg"),
        ],
    }
    try:
        for position, (category_name, dishes) in enumerate(demo_menu.items(), start=1):
            category = (
                db.query(NhomMon)
                .filter(NhomMon.ten_nhom == category_name)
                .first()
            )
            if category is None:
                category = NhomMon(
                    ten_nhom=category_name,
                    thu_tu=position,
                    dang_su_dung=True,
                    anh_url=DEMO_CATEGORY_PHOTOS[category_name],
                )
                db.add(category)
                db.flush()

            for dish_name, image_url in dishes:
                exists = (
                    db.query(MonAn)
                    .filter(
                        MonAn.ten_mon == dish_name,
                        MonAn.nhom_mon_id == category.id,
                    )
                    .first()
                )
                if exists is None:
                    db.add(
                        MonAn(
                            ten_mon=dish_name,
                            nhom_mon_id=category.id,
                            trang_thai="DANG_BAN",
                            anh_url=image_url,
                        )
                    )
                else:
                    exists.anh_url = image_url
        db.commit()
        print("Demo menu seeded: 3 categories with 6 dishes.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()



# Real food photography used by the seeded demo menu (not placeholder SVGs).
DEMO_CATEGORY_PHOTOS = {
    "Khai vị": "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=900&q=80",
    "Món chính": "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
    "Đồ uống": "https://bizweb.dktcdn.net/100/004/714/articles/tra-dao.jpg?v=1563186774693",
    "Lẩu": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Tráng miệng": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80",
}


SAMPLE_CATEGORIES = {
    "Khai vị": [
        "Gỏi cuốn", "Chả giò", "Salad rau củ", "Súp cua", "Khoai tây chiên",
        "Ngô chiên", "Đậu phụ chiên", "Nộm gà", "Gỏi ngó sen", "Nem chua rán",
        "Salad bò", "Súp bí đỏ",
    ],
    "Món chính": [
        "Cơm chiên", "Bò lúc lắc", "Phở bò", "Bún chả", "Cơm sườn",
        "Gà chiên nước mắm", "Cá kho tộ", "Bò sốt tiêu đen", "Mì xào hải sản",
        "Thịt rang cháy cạnh", "Sườn nướng", "Cá chiên giòn",
    ],
    "Đồ uống": [
        "Trà đào", "Nước suối", "Cà phê đen", "Cà phê sữa", "Trà chanh",
        "Nước cam", "Sinh tố xoài", "Sinh tố bơ", "Nước dừa", "Trà tắc",
        "Nước ép dưa hấu", "Soda chanh",
    ],
    "Lẩu": [
        "Lẩu thái", "Lẩu gà lá é", "Lẩu bò", "Lẩu riêu cua", "Lẩu hải sản",
        "Lẩu nấm", "Lẩu gà thuốc bắc", "Lẩu cá chua cay", "Lẩu ếch",
        "Lẩu kim chi", "Lẩu sườn sụn", "Lẩu thập cẩm",
    ],
    "Tráng miệng": [
        "Chè đậu đỏ", "Chè khúc bạch", "Rau câu dừa", "Sữa chua",
        "Kem vani", "Kem socola", "Bánh flan", "Hoa quả theo mùa",
        "Chè thập cẩm", "Bánh tiramisu", "Panna cotta", "Thạch trái cây",
    ],
}


def seed_restaurant_sample() -> tuple[int, int]:
    """Ensure a repeatable demo menu with five categories and at least 60 dishes."""
    categories_created = 0
    dishes_created = 0

    db = SessionLocal()
    try:
        for position, (category_name, dish_names) in enumerate(
            SAMPLE_CATEGORIES.items(), start=1
        ):
            category = (
                db.query(NhomMon)
                .filter(NhomMon.ten_nhom == category_name)
                .first()
            )
            if category is None:
                category = NhomMon(
                    ten_nhom=category_name,
                    thu_tu=position,
                    dang_su_dung=True,
                    anh_url=DEMO_CATEGORY_PHOTOS[category_name],
                )
                db.add(category)
                db.flush()
                categories_created += 1
            else:
                category.dang_su_dung = True
                if not category.anh_url or category.anh_url == "/media/default-category.svg":
                    category.anh_url = DEMO_CATEGORY_PHOTOS[category_name]

            for dish_index, dish_name in enumerate(dish_names, start=1):
                dish = (
                    db.query(MonAn)
                    .filter(
                        MonAn.ten_mon == dish_name,
                        MonAn.nhom_mon_id == category.id,
                    )
                    .first()
                )
                if dish is not None:
                    if not dish.anh_url or dish.anh_url == "/media/default-dish.svg":
                        dish.anh_url = DEMO_CATEGORY_PHOTOS[category_name]
                    continue

                db.add(
                    MonAn(
                        ten_mon=dish_name,
                        nhom_mon_id=category.id,
                        gia=(
                            15000 + ((position * 7 + dish_index * 11) % 36) * 5000
                        ),
                        don_vi_tinh="phần",
                        mo_ta_ngan=f"Món demo: {dish_name}",
                        thoi_gian_che_bien_phut=10 + (dish_index % 4) * 5,
                        trang_thai="DANG_BAN",
                        anh_url=DEMO_CATEGORY_PHOTOS[category_name],
                    )
                )
                dishes_created += 1

        db.commit()
        print(
            "Demo restaurant sample ready: "
            f"{len(SAMPLE_CATEGORIES)} categories, at least "
            f"{sum(len(items) for items in SAMPLE_CATEGORIES.values())} named dishes "
            f"({categories_created} categories and {dishes_created} dishes created)."
        )
        return categories_created, dishes_created
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_account()
    seed_demo_menu()
    seed_restaurant_sample()
    seed_table_map_demo()
