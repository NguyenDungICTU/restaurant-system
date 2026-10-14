# Kiểm thử giao diện gộp bàn

1. Đăng nhập vai trò `PHUC_VU` hoặc `QUAN_LY`, mở **Quản lý bàn**.
2. Đảm bảo có hai bàn cùng khu vực, đều `DANG_SU_DUNG` và có phiên `DANG_PHUC_VU`.
3. Chọn đúng hai bàn, nhấn **Gộp hai bàn**; UI báo thành công và hiển thị ID phiên chính.
4. Thử bàn khác khu vực hoặc bàn `CHO_THANH_TOAN`: backend phải trả 409 và không đổi dữ liệu.
5. Nhập ID phiên chính rồi nhấn **Huỷ gộp** trước khi thanh toán.
6. Kiểm tra đợt gọi món đã trở lại phiên gốc và sơ đồ sau khi tải lại.

**Giới hạn cần biết:** dữ liệu bàn hiện không có tọa độ/vị trí vật lý, nên chưa thể xác minh hai bàn có thực sự liền kề; hiện kiểm tra cùng khu vực. Bảng sơ đồ cũng chưa có nhãn nhóm bàn cố định, API trả `nhan_nhom` để bổ sung hiển thị.
