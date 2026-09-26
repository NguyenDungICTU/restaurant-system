# Restaurant Management System

Hệ thống quản lý nhà hàng. Giữ nguyên tên dự án và cấu trúc hiện có:

- `backend/`: FastAPI, xử lý nghiệp vụ, xác thực, phân quyền và dữ liệu.
- `frontend/`: React/Vite, giao diện người dùng.

Danh sách bên dưới đối chiếu 10 yêu cầu S1-01 đến S1-10 trong tài liệu yêu cầu.

## S1-01 (EP-01) - Đăng nhập tài khoản quản lý

**Backend**

- Đăng nhập bằng tên đăng nhập hoặc số điện thoại và mật khẩu; mật khẩu lưu dạng bcrypt.
- Chuẩn hóa username không phân biệt hoa thường và số điện thoại trước khi tra cứu.
- Sai mật khẩu 5 lần trong 15 phút thì khóa tài khoản 15 phút; phản hồi có thời gian khóa còn lại.
- Sai tên đăng nhập/số điện thoại và sai mật khẩu dùng cùng thông báo. Tài khoản không tồn tại vẫn được kiểm tra bcrypt giả nhằm giảm khác biệt thời gian phản hồi.
- Session dùng token ngẫu nhiên, cookie HttpOnly; mặc định hết hạn sau 30 phút không hoạt động.

**Frontend**

- Có trường tên đăng nhập/số điện thoại, mật khẩu và nút đăng nhập.
- Hiển thị thông báo đăng nhập thành công; lỗi đăng nhập không tiết lộ tài khoản có tồn tại.
- Khi session hết hạn, hiển thị thông báo và đưa người dùng về đăng nhập.

**Chưa xác nhận:** Chưa có test tự động cho login bằng username/phone, thông báo lỗi chung, bcrypt, khóa tài khoản và session timeout.

## S1-02 (EP-01) - Quản lý tạo tài khoản nhân viên

**Backend**

- Quản lý tạo tài khoản với họ tên, số điện thoại, username, vai trò và trạng thái.
- Username và số điện thoại được kiểm tra trùng; sinh mật khẩu tạm 8 ký tự, lưu dạng bcrypt và trả về một lần khi tạo.
- Mỗi tài khoản có một vai trò; tài khoản nghỉ việc không đăng nhập được nhưng dữ liệu và nhật ký cũ được giữ lại.

**Frontend**

- Có màn hình danh sách và tạo tài khoản nhân viên.
- Có API kiểm tra trùng username/số điện thoại và hiển thị mật khẩu tạm sau khi tạo.
- Có thao tác đổi trạng thái làm việc/nghỉ việc.

## S1-03 (EP-01) - Đổi mật khẩu tạm

**Backend**

- Tài khoản mới bị yêu cầu đổi mật khẩu trước khi truy cập các chức năng khác.
- Đổi mật khẩu yêu cầu mật khẩu hiện tại; sai mật khẩu hiện tại không gọi luồng đếm lần đăng nhập sai.
- Mật khẩu mới cần tối thiểu 8 ký tự, có chữ cái và chữ số, không trùng mật khẩu tạm.
- Đổi thành công sẽ thu hồi các session cũ của tài khoản.

**Frontend**

- Có màn hình đổi mật khẩu bắt buộc khi đăng nhập lần đầu bằng mật khẩu tạm.

## S1-04 (EP-01) - Phân quyền màn hình và API

**Backend**

- API xác thực người dùng và kiểm tra vai trò; không chỉ dựa vào việc ẩn menu frontend.
- Tài khoản không có quyền truy cập API bị từ chối.

**Frontend**

- Menu được lọc theo vai trò: phục vụ thấy sơ đồ bàn, đặt bàn, gọi món; bếp thấy màn hình bếp và món trong ngày; thu ngân thấy thanh toán, hóa đơn và chốt ca.
- Phục vụ không thấy thực đơn, tài khoản và báo cáo.
- Có trang 403 khi truy cập chức năng không thuộc quyền.

**Chưa xác nhận:** Chưa kiểm thử trực tiếp toàn bộ đường dẫn và mọi API bằng từng vai trò. Một số mục điều hướng (món trong ngày, hóa đơn, chốt ca) chưa được nối với màn hình nghiệp vụ riêng.

## S1-05 (EP-01) - Nhật ký đăng nhập và sửa giá

**Backend**

- Ghi nhật ký đăng nhập thành công/thất bại và thao tác sửa giá, bao gồm thời điểm, tài khoản, vai trò, hành động và IP.
- API chỉ đọc, chỉ dành cho quản lý; hỗ trợ lọc ngày và tài khoản, mặc định 7 ngày gần nhất.

**Frontend**

- Có màn hình nhật ký chỉ đọc với bộ lọc ngày/tài khoản; không có thao tác sửa hoặc xóa.

## S1-06 (EP-02) - Quản lý khu vực

**Backend**

- Có tạo, sửa và ngừng sử dụng khu vực, gồm tên, thứ tự hiển thị và ghi chú.
- Kiểm tra tên sau khi bỏ khoảng trắng thừa, không phân biệt hoa thường.
- Không xóa khu vực đang có bàn; khu vực ngừng sử dụng không được chọn khi tạo đặt bàn mới nhưng dữ liệu cũ vẫn hiển thị tên khu vực.

**Frontend**

- Có giao diện quản lý khu vực.

## S1-07 (EP-02) - Quản lý bàn và mã QR

**Backend**

- Bàn có mã, khu vực, sức chứa, loại bàn và trạng thái; mã bàn duy nhất trong quán.
- QR token ngẫu nhiên tối thiểu 16 ký tự, không suy ra từ mã bàn; hỗ trợ sinh lại, tải PNG và PDF QR theo khu vực.
- Sinh lại QR làm token cũ mất hiệu lực; QR cũ báo mã đã thay đổi và hướng dẫn gọi phục vụ.

**Frontend**

- Có giao diện quản lý bàn, sinh/tải QR và xem menu công khai theo QR bàn.

**Cấu hình:** Khi dùng QR trên thiết bị khách, `BACKEND_PUBLIC_URL` phải là địa chỉ backend mà thiết bị đó truy cập được.

## S1-08 (EP-02) - Quản lý nhóm món

**Backend**

- Hỗ trợ thêm, sửa, đổi thứ tự hiển thị và ngừng sử dụng nhóm món.
- Tên nhóm không trùng và tối đa 50 ký tự.
- Nhóm có món không được xóa khi chưa chuyển món sang nhóm khác.

**Frontend**

- Có giao diện quản lý nhóm món cùng thực đơn.

**Chưa xác nhận:** Chưa có kiểm thử xác nhận thứ tự nhóm món giống hệt giữa thực đơn công khai và màn hình gọi món.

## S1-09 (EP-02) - Quản lý món và giá

**Backend**

- Món có tên, nhóm, giá VND, đơn vị, mô tả ngắn, thời gian chế biến ước tính theo phút và trạng thái bán.
- Giá là số nguyên dương, tối đa 50.000.000 VND; giao diện hiển thị dấu phân cách hàng nghìn.
- Món ngừng bán không xuất hiện trong thực đơn công khai và không được thêm vào order.
- Sửa giá được ghi nhật ký kèm giá cũ, giá mới và người sửa; chi tiết order lưu giá tại thời điểm gọi để giá mới không ảnh hưởng order đã tạo.

**Frontend**

- Có giao diện quản lý món với các trường thông tin và trạng thái bán.
- Gọi món, bếp và thanh toán sử dụng giao diện order hiện có.

## S1-10 (EP-02) - Giờ hoạt động và đặt bàn

**Backend**

- Cấu hình giờ mở/đóng và ngày nghỉ theo từng ngày trong tuần; giờ đóng phải sau giờ mở.
- Hỗ trợ ngày nghỉ đặc biệt theo ngày cụ thể.
- Khung giờ đặt bàn cách nhau 30 phút; thời lượng giữ bàn mặc định 90 phút và có thể cấu hình.
- Kiểm tra khung giờ theo `Asia/Ho_Chi_Minh`, ngày nghỉ và giờ đóng cửa.

**Frontend**

- Có giao diện cấu hình giờ hoạt động, ngày nghỉ, thời lượng giữ bàn và danh sách đặt bàn.

## Database migrations

Chạy từ thư mục `backend/`; các migration cần được áp dụng tuần tự:

```text
004_add_khu_vuc
005_auth_password_audit
006_tables_qr
007_menu_details
008_hours_reservations
009_order_price_snapshots
```

```powershell
alembic upgrade head
```

## Cài đặt và chạy

Tạo `backend/.env` dựa trên `backend/.env.example`. Các dependency backend phục vụ QR là `qrcode[pil]` (ảnh QR) và `reportlab` (PDF QR).

### Backend

```powershell
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

### Docker Compose

Chạy từ thư mục dự án:

```powershell
docker compose up --build
```

## Trạng thái kiểm thử

README này đối chiếu mã nguồn với 10 yêu cầu, không thay thế kết quả kiểm thử. Chưa xác nhận chạy migration trên PostgreSQL test, khởi động backend, frontend lint/build hoặc kiểm thử end-to-end. Cần thực hiện các bước đó trước khi kết luận các yêu cầu đã được nghiệm thu.
