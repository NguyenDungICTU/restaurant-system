# 🍽️ Restaurant Management System

Hệ thống quản lý nhà hàng full-stack, hỗ trợ quản lý nhân viên, phân quyền, khu vực, bàn, QR bàn, thực đơn, đặt bàn, giờ hoạt động và nhật ký hệ thống.

Project được đóng gói bằng **Docker Compose**, vì vậy người dùng có thể clone repository và chạy toàn bộ hệ thống mà không cần cài Python, Node.js/npm hoặc PostgreSQL trên máy.

---

## 🚀 Quick Start

### 1. Yêu cầu

Chỉ cần cài:

* Git
* Docker Desktop

Docker Desktop đã bao gồm Docker Compose.

Không cần cài riêng:

* Python
* Node.js
* npm
* PostgreSQL

---

### 2. Clone repository

```powershell
git clone https://github.com/NguyenDungICTU/restaurant-system.git
cd restaurant-system
```

---

### 3. Build và chạy

Lần đầu chạy:

```powershell
docker compose up -d --build
```

Kiểm tra trạng thái:

```powershell
docker compose ps
```

Kết quả mong muốn:

```text
restaurant-db          Up (healthy)
restaurant-backend     Up (healthy)
restaurant-frontend    Up
```

Backend sẽ tự động:

1. Chờ PostgreSQL healthy.
2. Chạy Alembic migration.
3. Tạo tài khoản demo nếu chưa tồn tại.
4. Tạo dữ liệu menu demo nếu chưa tồn tại.
5. Khởi động FastAPI.

Frontend sẽ được build bằng Vite và phục vụ bằng Nginx.

---

## 🌐 Truy cập hệ thống

### Frontend

```text
http://localhost:5173
```

### Backend

```text
http://localhost:8000
```

### API documentation

```text
http://localhost:8000/docs
```

### Health check

```text
http://localhost:8000/api/health
```

Kết quả:

```json
{
  "status": "ok"
}
```

---

## 🔐 Tài khoản demo

```text
Username: manager
Password: demo12345
```

Hoặc:

```text
Phone: 0963217400
Password: demo12345
```

Tài khoản demo được seed tự động khi backend khởi động lần đầu.

Seed có tính idempotent nên restart container không tạo thêm tài khoản demo trùng.

---

# 🏗️ Kiến trúc hệ thống

```text
                         Browser
                            |
                            |
                    http://localhost:5173
                            |
                            v
                  +-------------------+
                  | React + Vite      |
                  | Nginx             |
                  +-------------------+
                            |
                            | HTTP / WebSocket
                            |
                    localhost:8000
                            |
                            v
                  +-------------------+
                  | FastAPI Backend   |
                  | Python 3.12       |
                  +-------------------+
                            |
                            | Docker Network
                            |
                            v
                  +-------------------+
                  | PostgreSQL 16     |
                  +-------------------+
```

### Docker services

| Service    | Công nghệ             | Host port |
| ---------- | --------------------- | --------: |
| `db`       | PostgreSQL 16 Alpine  |    `5433` |
| `backend`  | FastAPI / Python 3.12 |    `8000` |
| `frontend` | React / Vite / Nginx  |    `5173` |

PostgreSQL chỉ được expose ra host ở port `5433`. Backend kết nối PostgreSQL thông qua Docker network bằng hostname `db`.

---

# 🛠️ Công nghệ sử dụng

## Frontend

* React 19
* Vite 8
* React Router
* Ant Design
* Axios
* JavaScript/JSX
* CSS

## Backend

* Python 3.12
* FastAPI
* Uvicorn
* SQLAlchemy
* Alembic
* Pydantic / Pydantic Settings
* PostgreSQL driver: psycopg2
* bcrypt
* WebSocket
* python-multipart
* qrcode
* ReportLab

## Database

* PostgreSQL 16

## DevOps

* Docker
* Docker Compose
* Docker multi-stage build
* Nginx

---

# ⭐ Chức năng hệ thống

## 1. Xác thực và phân quyền

Hệ thống hỗ trợ các vai trò:

```text
QUAN_LY
PHUC_VU
BEP
THU_NGAN
```

Chức năng xác thực:

* Đăng nhập bằng username hoặc số điện thoại.
* Hash mật khẩu bằng bcrypt.
* Session-based authentication.
* Đăng xuất.
* Đổi mật khẩu.
* Kiểm tra phiên đăng nhập.
* Tự hết phiên sau thời gian không hoạt động.
* Giới hạn số lần đăng nhập sai.
* Khóa đăng nhập tạm thời khi vượt quá số lần thất bại.
* Kiểm tra quyền truy cập theo role.

---

## 2. Quản lý nhân viên

Quản lý có thể:

* Xem danh sách nhân viên.
* Tạo tài khoản nhân viên.
* Gán vai trò:

  * Phục vụ
  * Bếp
  * Thu ngân
* Kiểm tra username có tồn tại hay chưa.
* Kiểm tra số điện thoại có tồn tại hay chưa.
* Kích hoạt/ngừng hoạt động tài khoản.

---

## 3. Quản lý khu vực

Hỗ trợ:

* Tạo khu vực.
* Sửa khu vực.
* Xem danh sách khu vực.
* Xem khu vực đang hoạt động.
* Kích hoạt khu vực.
* Ngừng sử dụng khu vực.
* Xóa khu vực.

---

## 4. Quản lý bàn

Hỗ trợ:

* Tạo bàn.
* Sửa bàn.
* Xóa bàn.
* Kiểm tra mã bàn.
* Gán bàn vào khu vực.
* Quản lý trạng thái bàn.
* Tạo QR riêng cho từng bàn.
* Kiểm tra QR khi khách quét.
* Xuất PDF QR cho toàn bộ bàn trong khu vực.

---

## 5. QR bàn

Mỗi bàn có QR token riêng.

Luồng cơ bản:

```text
Quản lý tạo bàn
      ↓
Hệ thống tạo QR token
      ↓
Khách quét QR
      ↓
Backend kiểm tra token
      ↓
Xác định bàn + khu vực
      ↓
Mở giao diện phù hợp
```

QR có thể được xuất thành PDF theo khu vực.

---

## 6. Quản lý thực đơn

Thực đơn được tổ chức theo:

```text
Nhóm món
   |
   +-- Món ăn
```

### Nhóm món

* Tạo nhóm.
* Sửa nhóm.
* Bật/tắt nhóm.
* Sắp xếp thứ tự.
* Xóa nhóm.
* Upload ảnh nhóm.
* Kiểm tra trùng tên.

### Món ăn

* Tạo món.
* Sửa món.
* Xóa món.
* Chọn nhóm món.
* Quản lý trạng thái bán.
* Upload ảnh món.
* Hiển thị ảnh mặc định nếu chưa có ảnh.

Mỗi món bắt buộc thuộc một nhóm món.

---

## 7. Đặt bàn

Hỗ trợ:

* Xem danh sách đặt bàn.
* Tạo đặt bàn.
* Xác nhận đặt bàn.
* Hủy đặt bàn.
* Kiểm tra bàn trống.
* Cấu hình thời gian giữ bàn.

---

## 8. Giờ hoạt động

Hỗ trợ:

* Cấu hình giờ mở cửa.
* Cấu hình giờ đóng cửa.
* Cấu hình lịch hoạt động theo tuần.
* Quản lý ngày nghỉ đặc biệt.
* Cấu hình thời gian giữ bàn.

---

## 9. Phân quyền workspace

Giao diện được tổ chức theo role.

### Quản lý

Có các khu vực:

* Tổng quan
* Đặt bàn
* Khách hàng
* Thực đơn
* Đơn hàng
* Nhân viên
* Khu vực
* Quản lý bàn
* Báo cáo
* Nhật ký hệ thống
* Giờ mở cửa

### Phục vụ

* Sơ đồ bàn
* Danh sách đặt bàn
* Gọi món

### Bếp

* Màn hình bếp
* Món trong ngày

### Thu ngân

* Thanh toán
* Hóa đơn
* Chốt ca

Backend kiểm tra quyền truy cập workspace trước khi cho phép sử dụng chức năng.

---

## 10. Audit log

Hệ thống có nhật ký hoạt động để ghi nhận các thao tác quan trọng của nhân viên.

Có thể theo dõi:

* hành động;
* nhân viên thực hiện;
* đối tượng tác động;
* session đăng nhập;
* thông tin request liên quan.

---

## 11. WebSocket

Backend cung cấp WebSocket:

```text
/ws/orders
```

Frontend có client để kết nối WebSocket và nhận cập nhật đơn hàng theo thời gian thực.

---

# 🗄️ Database migration

Database sử dụng Alembic.

Các migration được thực hiện tự động khi backend Docker khởi động:

```text
alembic upgrade head
```

Không cần chạy migration thủ công khi clone project mới.

Backend có cơ chế retry khi PostgreSQL chưa sẵn sàng ngay lập tức.

---

# ⚙️ Environment variables

Project có giá trị mặc định trong `docker-compose.yml`, vì vậy **không cần tạo `.env` để chạy demo cơ bản**.

Các biến quan trọng có thể override:

```env
POSTGRES_DB=restaurant_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000

QR_FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:5173,http://127.0.0.1:5173
```

Nếu cần chạy frontend từ IP LAN để điện thoại quét QR, cần cấu hình URL frontend phù hợp với mạng LAN.

---

# 🔄 Các lệnh Docker thường dùng

## Khởi động

```powershell
docker compose up -d
```

## Build lại khi source thay đổi

```powershell
docker compose up -d --build
```

## Xem trạng thái

```powershell
docker compose ps
```

## Xem log backend

```powershell
docker compose logs backend --tail=200
```

## Xem log frontend

```powershell
docker compose logs frontend --tail=100
```

## Xem log PostgreSQL

```powershell
docker compose logs db --tail=100
```

## Dừng hệ thống

```powershell
docker compose down
```

---

# 🧹 Build sạch khi Docker sử dụng cache cũ

Nếu nghi ngờ Docker đang sử dụng layer/image cũ:

```powershell
docker compose down
docker compose build --no-cache --pull
docker compose up -d
```

Sau đó kiểm tra:

```powershell
docker compose ps
```

và:

```powershell
docker compose logs backend --tail=200
```

---

# 🎨 Nếu frontend vẫn hiển thị giao diện cũ

Sau khi build lại:

```powershell
docker compose build --no-cache frontend
docker compose up -d
```

Mở:

```text
http://localhost:5173
```

Sau đó hard refresh:

```text
Ctrl + Shift + R
```

Nếu vẫn còn cache:

1. Mở Chrome DevTools.
2. Chọn `Network`.
3. Tick `Disable cache`.
4. Reload trang.

---

# 🔧 Nếu chỉ muốn build lại backend

```powershell
docker compose build --no-cache backend
docker compose up -d
```

---

# 🔧 Nếu chỉ muốn build lại frontend

```powershell
docker compose build --no-cache frontend
docker compose up -d
```

---

# 💥 Reset toàn bộ database demo

**Cảnh báo: thao tác này xóa PostgreSQL volume của project.**

Chỉ sử dụng khi muốn tạo database mới hoàn toàn:

```powershell
docker compose down -v
docker compose build --no-cache --pull
docker compose up -d
```

Sau đó:

```powershell
docker compose ps
```

Backend sẽ chạy lại:

```text
Alembic migration
        ↓
Demo account seed
        ↓
Demo menu seed
        ↓
FastAPI
```

---

# 🧪 Kiểm tra hệ thống sau khi clone

Quy trình kiểm tra giống một người dùng mới:

```powershell
git clone https://github.com/NguyenDungICTU/restaurant-system.git restaurant-demo-test
cd restaurant-demo-test

docker compose up -d --build
docker compose ps
```

Chờ:

```text
restaurant-db          Up (healthy)
restaurant-backend     Up (healthy)
restaurant-frontend    Up
```

Sau đó mở:

```text
http://localhost:5173
```

Đăng nhập:

```text
Username: manager
Password: demo12345
```

Kiểm tra lần lượt:

```text
Dashboard
→ Nhân viên
→ Khu vực
→ Quản lý bàn
→ Thực đơn
→ Nhóm món
→ Món ăn
→ Đặt bàn
→ Giờ mở cửa
→ Nhật ký hệ thống
```

---

# 📁 Cấu trúc project

```text
restaurant-system/
│
├── backend/
│   ├── app/
│   │   ├── core/
│   │   ├── database/
│   │   ├── dependencies/
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   └── services/
│   │
│   ├── alembic/
│   │   └── versions/
│   │
│   ├── tests/
│   ├── Dockerfile
│   ├── entrypoint.py
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   │
│   ├── public/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   └── package-lock.json
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

# 🔒 Không commit các file/thư mục local

Không đưa lên GitHub:

```text
.env
backend/venv/
backend/__pycache__/
frontend/node_modules/
frontend/dist/
*.pyc
```

Các file cần có trong repository để Docker build thành công:

```text
docker-compose.yml
.env.example
README.md

backend/
    Dockerfile
    entrypoint.py
    requirements.txt
    app/
    alembic/

frontend/
    Dockerfile
    nginx.conf
    package.json
    package-lock.json
    src/
```

---

# 📝 Lưu ý

* Frontend gọi API từ browser nên `VITE_API_BASE_URL` phải trỏ tới URL mà browser truy cập được, mặc định là `http://localhost:8000`.
* Không sử dụng `http://backend:8000` làm API URL của frontend khi truy cập từ máy host.
* `docker compose down` không xóa database volume.
* `docker compose down -v` sẽ xóa database volume.
* Ảnh demo trong menu chỉ phục vụ mục đích minh họa. Khi triển khai thực tế nên sử dụng ảnh mà nhà hàng có quyền sử dụng.

---

# ✅ Demo checklist

```text
[✓] Docker Compose
[✓] PostgreSQL 16
[✓] FastAPI backend
[✓] React frontend
[✓] Automatic database migration
[✓] Automatic demo seed
[✓] Authentication
[✓] Role-based access
[✓] Employee management
[✓] Area management
[✓] Table management
[✓] QR table
[✓] Menu category management
[✓] Dish management
[✓] Booking management
[✓] Opening hours
[✓] Audit logs
[✓] WebSocket infrastructure
[✓] Frontend production build with Nginx
```

## 🚀 One-command demo

Sau khi clone:

```powershell
git clone https://github.com/NguyenDungICTU/restaurant-system.git
cd restaurant-system
docker compose up -d --build
```

Mở:

```text
http://localhost:5173
```

Login:

```text
manager
demo12345
```
