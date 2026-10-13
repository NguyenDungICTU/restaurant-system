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



# Individual photo URLs for the sample dishes. Each dish has its own photograph;
# category cover photos remain separate from dish photos.
DISH_PHOTOS = {
    "Gỏi cuốn": "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=900&q=80",
    "Chả giò": "https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=900&q=80",
    "Salad rau củ": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80",
    "Súp cua": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Khoai tây chiên": "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=900&q=80",
    "Ngô chiên": "https://images.unsplash.com/photo-1551754655-cd27e38d2076?auto=format&fit=crop&w=900&q=80",
    "Đậu phụ chiên": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
    "Nộm gà": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Gỏi ngó sen": "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=80",
    "Nem chua rán": "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=900&q=80",
    "Salad bò": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=80",
    "Súp bí đỏ": "https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&w=900&q=80",
    "Cơm chiên": "https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=900&q=80",
    "Bò lúc lắc": "https://snapcalorie-webflow-website.s3.us-east-2.amazonaws.com/media/food_pics_v2/medium/bo_luc_lac.jpg",
    "Phở bò": "https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=900&q=80",
    "Bún chả": "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80",
    "Cơm sườn": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Gà chiên nước mắm": "https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&w=900&q=80",
    "Cá kho tộ": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=80",
    "Bò sốt tiêu đen": "https://images.unsplash.com/photo-1546833999-b9f581a1996d?auto=format&fit=crop&w=900&q=80",
    "Mì xào hải sản": "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=80",
    "Thịt rang cháy cạnh": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
    "Sườn nướng": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
    "Cá chiên giòn": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=80",
    "Trà đào": "https://bizweb.dktcdn.net/100/004/714/articles/tra-dao.jpg?v=1563186774693",
    "Nước suối": "https://cdn.hstatic.net/products/200001078872/z7164457794762_2eb24bc9b6d259462f521b188dcfd740_770c1030dd844f11bbbdd4d46476e167.jpg",
    "Cà phê đen": "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80",
    "Cà phê sữa": "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80",
    "Trà chanh": "https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=80",
    "Nước cam": "https://images.unsplash.com/photo-1600271886742-f049cd451bba?auto=format&fit=crop&w=900&q=80",
    "Sinh tố xoài": "https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?auto=format&fit=crop&w=900&q=80",
    "Sinh tố bơ": "https://images.unsplash.com/photo-1553530666-ba11a7da3888?auto=format&fit=crop&w=900&q=80",
    "Nước dừa": "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=80",
    "Trà tắc": "https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=80",
    "Nước ép dưa hấu": "https://images.unsplash.com/photo-1587049352851-8d4e89133924?auto=format&fit=crop&w=900&q=80",
    "Soda chanh": "https://images.unsplash.com/photo-1513558161293-cdae765edfd7?auto=format&fit=crop&w=900&q=80",
    "Lẩu thái": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Lẩu gà lá é": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Lẩu bò": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Lẩu riêu cua": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Lẩu hải sản": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Lẩu nấm": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Lẩu gà thuốc bắc": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Lẩu cá chua cay": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Lẩu ếch": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Lẩu kim chi": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Lẩu sườn sụn": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Lẩu thập cẩm": "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=80",
    "Chè đậu đỏ": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80",
    "Chè khúc bạch": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80",
    "Rau câu dừa": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80",
    "Sữa chua": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80",
    "Kem vani": "https://images.unsplash.com/photo-1560008581-09826d1de69e?auto=format&fit=crop&w=900&q=80",
    "Kem socola": "https://images.unsplash.com/photo-1563805042-7684c019e1cb?auto=format&fit=crop&w=900&q=80",
    "Bánh flan": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80",
    "Hoa quả theo mùa": "https://images.unsplash.com/photo-1490818387583-1baba5e638af?auto=format&fit=crop&w=900&q=80",
    "Bánh tiramisu": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=80",
    "Panna cotta": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80",
    "Thạch trái cây": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80",
}


# Keep the sample dishes from reusing the same image URL for different dishes.
# These are distinct food-photo assets hosted by Unsplash.
DISH_PHOTO_UNIQUE_OVERRIDES = {
    "Gỏi ngó sen": "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=900&q=80",
    "Nộm gà": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=80",
    "Cơm sườn": "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=900&q=80",
    "Lẩu thái": "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80",
    "Lẩu gà lá é": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80",
    "Lẩu bò": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80",
    "Lẩu riêu cua": "https://images.unsplash.com/photo-1565299507177-b0ac66763828?auto=format&fit=crop&w=900&q=80",
    "Lẩu hải sản": "https://images.unsplash.com/photo-1601050690117-94f5f6fa8bd7?auto=format&fit=crop&w=900&q=80",
    "Lẩu nấm": "https://images.unsplash.com/photo-1576402187878-974f70c890a5?auto=format&fit=crop&w=900&q=80",
    "Lẩu gà thuốc bắc": "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=900&q=80",
    "Lẩu cá chua cay": "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80",
    "Lẩu ếch": "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=900&q=80",
    "Lẩu kim chi": "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=900&q=80",
    "Lẩu sườn sụn": "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80",
    "Lẩu thập cẩm": "https://images.unsplash.com/photo-1576402187878-974f70c890a5?auto=format&fit=crop&w=900&q=80",
    "Salad bò": "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=900&q=81",
    "Cá chiên giòn": "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=900&q=80",
    "Sườn nướng": "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=900&q=80",
    "Chè khúc bạch": "https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=900&q=80",
    "Rau câu dừa": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=81",
    "Sữa chua": "https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=80",
    "Bánh flan": "https://images.unsplash.com/photo-1560008581-09826d1de69e?auto=format&fit=crop&w=900&q=80",
    "Panna cotta": "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=900&q=80",
    "Thạch trái cây": "https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=900&q=80",
    "Chè thập cẩm": "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80",
}
DISH_PHOTOS.update(DISH_PHOTO_UNIQUE_OVERRIDES)


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
                # Always repair demo category covers to their real food-photo URL,
                # including databases seeded by an older demo version.
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
                    if dish_name in DISH_PHOTOS:
                        dish.anh_url = DISH_PHOTOS[dish_name]
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
                        anh_url=DISH_PHOTOS.get(dish_name, DEMO_CATEGORY_PHOTOS[category_name]),
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
