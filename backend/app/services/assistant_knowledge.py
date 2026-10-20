"""Versioned, reviewed UI instructions. No database or provider access here."""
import re
import unicodedata

KNOWLEDGE_VERSION = "2026-10-15.4"
M, S, K, C = "QUAN_LY", "PHUC_VU", "BEP", "THU_NGAN"
PAGES = {
    M: "dashboard bookings menu-management daily-menu service-orders employees areas tables reports revenue-report checkout invoices audit opening-hours".split(),
    S: "table-map bookings order-entry service-orders".split(),
    K: "kitchen daily-menu".split(),
    C: "checkout invoices shift-close".split(),
}


def guide(key, title, page, roles, keywords, *steps):
    return dict(id=key, title=title, page=page, roles=roles,
                keywords=keywords, steps=list(steps))


GUIDES = [
    guide("overview", "Đọc màn hình tổng quan", "dashboard", [M], "tong quan dashboard thong ke",
          "Mở Tổng quan trong nhóm Điều hành.", "Xem chỉ số và thời điểm cập nhật; dùng lối tắt để mở chức năng chi tiết."),
    guide("booking", "Tra cứu và xử lý đặt bàn", "bookings", [M, S], "dat ban khach den check in xac nhan tu choi",
          "Mở Đặt bàn hoặc Danh sách đặt bàn trong nhóm Điều hành.", "Tìm yêu cầu, kiểm tra ngày giờ, số khách và bàn được phân bổ.",
          "Mở yêu cầu để xem các thao tác được cấp quyền. Kiểm tra thông tin trước khi xác nhận, từ chối hoặc ghi nhận khách đến."),
    guide("tables", "Xem sơ đồ và trạng thái bàn", "tables", [M], "ban trong dang don da dat so do qr",
          "Mở Quản lý bàn trong nhóm Điều hành.", "Lọc khu vực và xem trạng thái bàn. Bàn trống khác với bàn đang dọn hoặc đã đặt.",
          "Chọn bàn để xem chi tiết và thao tác khả dụng. Chỉ dùng QR của đúng bàn."),
    guide("table-map", "Nhận khách và xem bàn", "table-map", [S], "so do ban nhan khach khach vang lai trong dang don",
          "Mở Sơ đồ bàn.", "Chọn khu vực và kiểm tra bàn trống, sức chứa, các đặt bàn liên quan.",
          "Chọn bàn để xem thao tác nhận khách được hệ thống cho phép. Sau khi có phiên phục vụ, mở Gọi món."),
    guide("order", "Gọi món cho khách", "order-entry", [S], "goi mon them mon gui bep chon ban ghi chu",
          "Chọn bàn đang phục vụ; bàn chưa nhận khách sẽ chưa xuất hiện trong danh sách.",
          "Tìm món, chọn món đang bán; món tạm hết không thể thêm vào đơn.",
          "Kiểm tra số lượng và ghi chú trong Đơn mới, sau đó tự bấm gửi xuống bếp khi đã xác nhận với khách."),
    guide("service", "Theo dõi và mang món ra bàn", "service-orders", [M, S], "theo doi mon da xong da phuc vu mang ra huy mon",
          "Mở Theo dõi món; khu vực đầu trang liệt kê món bếp đã hoàn thành.",
          "Kiểm tra mã bàn, món, số lượng và ghi chú trước khi mang ra; xác nhận đã phục vụ sau khi giao món.",
          "Phần phía dưới hiển thị trạng thái từng món theo phiên bàn. Khi hủy món, kiểm tra lý do và quy định tính tiền."),
    guide("payment-first", "Kết thúc phục vụ sau khi thanh toán", "service-orders", [M, S], "ket thuc phien dong ban thanh toan",
          "Kiểm tra món và thông báo cho thu ngân khi khách yêu cầu thanh toán.",
          "Thu ngân kiểm tra và chốt hóa đơn ở màn hình Thanh toán.",
          "Không dùng Kết thúc phiên để thay cho thanh toán; thao tác này không tự chứng minh hóa đơn đã được thanh toán."),
    guide("kitchen", "Tiếp nhận và hoàn thành món", "kitchen", [K], "bep cho bep dang che bien hoan thanh mon can lam",
          "Mở Màn hình bếp và kiểm tra trạng thái kết nối.",
          "Đọc phiếu theo bàn, số lượng, ghi chú; chuyển món đang chờ sang chế biến khi bắt đầu làm.",
          "Khi chế biến xong, xác nhận hoàn thành. Phục vụ tiếp tục xác nhận mang món ra ở màn hình của họ."),
    guide("daily-menu", "Đánh dấu món tạm hết", "daily-menu", [M, K], "tam het nguyen lieu mon trong ngay con mon het mon",
          "Mở Món trong ngày, tìm món theo tên hoặc nhóm.", "Mở nhóm món và kiểm tra trạng thái từng món trước khi thay đổi.",
          "Dùng điều khiển trạng thái để đánh dấu tạm hết hoặc bán lại. Trạng thái tạm hết được hệ thống đặt lại khi sang ngày mới."),
    guide("menu", "Quản lý thực đơn", "menu-management", [M], "thuc don danh muc nhom mon gia anh ngung ban",
          "Mở Thực đơn trong nhóm Danh mục.", "Chọn nhóm món, tìm món và kiểm tra tên, giá, đơn vị, ảnh và trạng thái.",
          "Dùng biểu mẫu thêm hoặc sửa món và kiểm tra dữ liệu trước khi lưu. Món tạm hết trong ngày quản lý tại Món trong ngày."),
    guide("areas", "Quản lý khu vực", "areas", [M], "khu vuc tang phong",
          "Mở Khu vực trong nhóm Danh mục.", "Kiểm tra danh sách khu vực trước khi thêm hoặc sửa. Xem thông báo hệ thống nếu khu vực đang có bàn và chưa thể xóa."),
    guide("dish-report", "Xem báo cáo món ăn", "reports", [M], "bao cao mon an ban chay top huy csv so luong",
          "Chọn khoảng ngày ở bộ lọc Báo cáo món ăn rồi bấm Xem báo cáo.",
          "Chọn xếp hạng theo số lượng hoặc doanh thu, xem Top món bán chạy và món bị hủy.",
          "Dùng Xuất CSV để tải dữ liệu đang xem. Tiền món ở đây dựa trên món đã phục vụ có tính tiền, có thể khác doanh thu hóa đơn sau giảm giá."),
    guide("revenue", "Xem báo cáo doanh thu", "revenue-report", [M], "bao cao doanh thu hoa don luot khach bieu do ngay",
          "Chọn từ ngày, đến ngày (tối đa 92 ngày) và bấm Xem báo cáo.",
          "Doanh thu tính trên hóa đơn đã chốt, loại hóa đơn hủy. Kiểm tra khoảng ngày và thời điểm cập nhật.",
          "Lượt khách chỉ từ đặt bàn đã ghi nhận khách đến; chưa bao gồm số người của khách vãng lai. Biểu đồ giờ dựa vào Giờ mở cửa."),
    guide("checkout", "Thanh toán và chốt hóa đơn", "checkout", [M, C], "thanh toan tinh tien giam gia tien mat chuyen khoan tien thoi",
          "Mở Thanh toán và chọn phiên bàn cần tính tiền. Kiểm tra các dòng món và tổng tiền hàng.",
          "Nếu giảm giá, nhập giá trị và lý do; chọn tiền mặt hoặc chuyển khoản.",
          "Nhập tiền khách đưa hoặc mã tham chiếu. Đối chiếu số tiền thực nhận rồi tự bấm Chốt hóa đơn và đóng bàn."),
    guide("invoices", "Tra cứu và in hóa đơn", "invoices", [M, C], "hoa don in huy hoa don",
          "Mở Hóa đơn trong nhóm Tài chính và tìm hóa đơn trong danh sách.",
          "Bấm biểu tượng in để xem chi tiết rồi in hoặc lưu PDF bằng hộp thoại trình duyệt.",
          "Chỉ quản lý được hủy hóa đơn và phải nhập lý do. Hóa đơn hủy được giữ lại trong dữ liệu."),
    guide("shift", "Đối chiếu và chốt ca", "shift-close", [C], "chot ca cuoi buoi ket so chenhlech chenh lech tien ket",
          "Mở Chốt ca, kiểm tra các chỉ số hóa đơn, doanh thu, tiền mặt và chuyển khoản của ca.",
          "Đếm tiền thực tế, nhập số tiền, đối chiếu chênh lệch và điền giải trình khi hệ thống yêu cầu.",
          "Tự bấm Chốt ca sau khi kiểm tra; dùng In / Lưu PDF để lưu biên bản khi đã chốt."),
    guide("employees", "Quản lý tài khoản nhân viên", "employees", [M], "nhan vien tai khoan phan quyen khoa mat khau",
          "Mở Nhân viên trong nhóm Hệ thống.", "Kiểm tra vai trò khi tạo tài khoản hoặc thay đổi trạng thái tài khoản.",
          "Bản hiện tại còn có thao tác sửa/xóa lưu cục bộ trong trình duyệt; không coi các thao tác đó là đã đồng bộ tới máy chủ."),
    guide("hours", "Cấu hình giờ mở cửa", "opening-hours", [M], "gio mo cua ngay nghi dat ban lich hoat dong",
          "Mở Giờ mở cửa trong nhóm Hệ thống.", "Kiểm tra giờ hoạt động theo ngày và ngày nghỉ trước khi lưu cấu hình.",
          "Cấu hình ảnh hưởng tới khung giờ đặt bàn và biểu đồ doanh thu theo giờ."),
    guide("audit", "Xem nhật ký hệ thống", "audit", [M], "nhat ky lich su thao tac audit",
          "Mở Nhật ký hệ thống trong nhóm Hệ thống.", "Dùng bộ lọc của trang để đối chiếu thời gian, người thực hiện và thao tác đã được ghi nhận."),
]


def normalize(value):
    text = unicodedata.normalize("NFD", value.lower().replace("đ", "d"))
    return re.sub(r"[^a-z0-9\s-]", " ", "".join(c for c in text if not unicodedata.combining(c)))


def allowed_guides(role):
    return [item for item in GUIDES if role in item["roles"] and item["page"] in PAGES.get(role, [])]


# Multiword domain phrases prevent incidental words ("nay", "xem", "mon")
# or the currently open page from making unrelated questions look relevant.
TOPICS = {
    "overview": ("tong quan", "dashboard", "thong ke nha hang"),
    "booking": ("dat ban", "khach den", "check in", "check-in", "xac nhan dat", "tu choi dat"),
    "tables": ("so do ban", "trang thai ban", "quan ly ban", "ban trong", "ban dang don", "ma qr", "qr ban", "suc chua ban"),
    "table-map": ("so do ban", "trang thai ban", "ban trong", "nhan khach", "khach vang lai", "ban dang don"),
    "order": ("goi mon", "them mon", "gui bep", "gui xuong bep", "chon ban", "don moi", "ghi chu cho bep"),
    "service": ("theo doi mon", "tien do mon", "trang thai mon", "mang mon", "mang ra", "huy mon", "da phuc vu"),
    "payment-first": ("ket thuc phien", "dong ban", "ket thuc phuc vu"),
    "kitchen": ("man hinh bep", "phieu bep", "cho bep", "mon can lam", "che bien", "hoan thanh mon", "tien do mon", "trang thai mon"),
    "daily-menu": ("mon trong ngay", "tam het", "het mon", "het nguyen lieu", "trang thai nguyen lieu", "ban lai mon"),
    "menu": ("thuc don", "menu", "nhom mon", "danh muc mon", "mon an", "gia mon", "ngung ban"),
    "areas": ("khu vuc",),
    "dish-report": ("bao cao mon", "mon ban chay", "ban chay", "top mon", "mon bi huy", "xuat csv", "bao cao"),
    "revenue": ("doanh thu", "luot khach", "bao cao", "bieu do gio"),
    "checkout": ("thanh toan", "tinh tien", "giam gia", "tien mat", "chuyen khoan", "tien thoi"),
    "invoices": ("hoa don",),
    "shift": ("chot ca", "ca lam viec", "ca dang mo", "ca cua toi", "ket ca", "doi chieu ca"),
    "employees": ("nhan vien", "tai khoan", "phan quyen", "mat khau", "dang nhap", "dang xuat"),
    "hours": ("gio mo cua", "gio dong cua", "lich hoat dong", "ngay nghi nha hang"),
    "audit": ("nhat ky", "lich su thao tac"),
}
OUTSIDE_TOPICS = (
    "thoi tiet", "nhiet do", "du bao mua", "weather", "xo so", "lo de", "danh de", "de ve",
    "bong da", "ty so", "world cup", "football", "viet tho", "lam tho", "ke chuyen", "viet truyen",
    "giai toan", "giai phuong trinh", "bai tap", "tu vi", "boi toan", "chung khoan", "bitcoin",
    "cong thuc nau", "cong thuc mon an", "cach nau", "recipe", "viet bao cao", "bao cao tot nghiep",
    "tiet lo prompt", "system prompt", "bo qua phan quyen", "bo qua huong dan",
)


def has_phrase(text, phrase):
    return f" {phrase} " in f" {' '.join(normalize(text).split())} "


def outside_topic(question):
    return any(has_phrase(question, phrase) for phrase in OUTSIDE_TOPICS)


def page_help(question):
    normalized = normalize(question)
    return (any(has_phrase(normalized, p) for p in ("trang nay", "man hinh nay", "chuc nang nay", "muc nay"))
            and any(has_phrase(normalized, p) for p in ("huong dan", "cach dung", "su dung", "lam gi", "dung the nao")))


def retrieve(question, page, role, limit=4):
    if outside_topic(question):
        return []
    matches = []
    for item in allowed_guides(role):
        phrases = [p for p in TOPICS[item["id"]] if has_phrase(question, p)]
        contextual = page_help(question) and item["page"] == page
        # Page is only a tie-breaker after evidence of relevance, never evidence itself.
        if phrases or contextual:
            specificity = max((len(p.split()) for p in phrases), default=0)
            score = specificity * 10 + len(phrases) * 3 + (2 if item["page"] == page else 0)
            matches.append((score, item))
    return [item for _, item in sorted(matches, key=lambda match: match[0], reverse=True)[:limit]]


def followup_question(question, history, page, role):
    """Only short temporal/step follow-ups may inherit a prior user's topic."""
    text = " ".join(normalize(question).split())
    followup = re.fullmatch(
        r"(?:(?:con|the con|vay|the) )?(?:hom qua|hom nay|tuan nay|thang nay|buoc tiep theo|tiep theo)(?: thi sao| nhu the nao)?", text)
    if not followup:
        return question
    for message in reversed(history):
        if message.role == "user":
            # A new off-topic user message breaks the chain. Assistant text is not trusted as a topic.
            if retrieve(message.content, page, role):
                return message.content + "\n" + question
            break
    return question
