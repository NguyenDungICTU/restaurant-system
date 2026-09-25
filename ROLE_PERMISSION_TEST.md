# Test phân quyền vai trò

## Permission matrix đã code

### QUAN_LY
- dashboard
- bookings
- customers
- menu-management
- orders
- employees
- areas
- reports
- settings
- và có quyền kiểm tra toàn bộ workspace nhân viên

### PHUC_VU
- table-map
- bookings
- order-entry

### BEP
- kitchen
- daily-menu

### THU_NGAN
- checkout
- invoices
- shift-close

## Test Lát 1 - server trả 403

1. Đăng nhập tài khoản PHUC_VU.
2. Mở Swagger hoặc gọi trực tiếp:
   GET /api/workspace/reports
   => phải nhận 403.
3. Gọi:
   GET /api/workspace/menu-management
   => phải nhận 403.
4. Gọi:
   GET /api/workspace/table-map
   => phải nhận 200.

## Test direct URL trên frontend

Đăng nhập PHUC_VU rồi gõ:
http://localhost:5173/reports

Frontend phải gọi server, nhận 403 và hiển thị trang "Không có quyền truy cập".

## Test Lát 2

Đăng nhập PHUC_VU:
- Chỉ thấy Sơ đồ bàn
- Danh sách đặt bàn
- Gọi món

Không thấy:
- Thực đơn
- Nhân viên/Tài khoản
- Báo cáo

## Test Lát 3

BEP:
- Màn hình bếp
- Danh sách món trong ngày

THU_NGAN:
- Thanh toán
- Hóa đơn
- Chốt ca
