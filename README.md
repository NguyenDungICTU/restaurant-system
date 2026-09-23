# Restaurant Management System

Hệ thống quản lý nhà hàng gồm **Frontend (React/Vite)**, **Backend (FastAPI)** và **PostgreSQL**, được đóng gói bằng **Docker Compose** để các thành viên trong nhóm có thể clone repository và chạy trên máy mới mà không phải tự cài Python, Node.js hoặc PostgreSQL.

## 1. Công nghệ

- **Frontend:** React + Vite + Axios + React Router + Ant Design
- **Backend:** Python 3.12 + FastAPI + SQLAlchemy + Alembic
- **Database:** PostgreSQL 16
- **Web server frontend:** Nginx
- **Container:** Docker Compose
- **Authentication:** Session cookie HttpOnly + bcrypt password hash

## 2. Yêu cầu trước khi chạy

Chỉ cần cài:

1. **Git**
2. **Docker Desktop** trên Windows/macOS hoặc **Docker Engine + Compose plugin** trên Linux

Không cần cài riêng:

- Python
- Node.js/npm
- PostgreSQL

Kiểm tra Docker:

```bash
docker --version
docker compose version
```

Nếu hai lệnh trên chạy được thì có thể tiếp tục.

## 3. Clone project

```bash
git clone <URL-GITHUB-CUA-NHOM>
cd <TEN-THU-MUC-PROJECT>
```

Nếu project đã được clone trước đó:

```bash
git pull
```

## 4. Chạy project lần đầu

Từ **thư mục gốc**, nơi có file `docker-compose.yml`, chạy:

```bash
docker compose up -d --build
```

Lần đầu có thể mất vài phút vì Docker phải tải image và build Frontend/Backend.

Kiểm tra trạng thái:

```bash
docker compose ps
```

Mong muốn thấy 3 service:

- `restaurant-db` — healthy
- `restaurant-backend` — healthy
- `restaurant-frontend` — running

Kiểm tra Backend:

```bash
curl http://localhost:8000/api/health
```

Kết quả mong muốn:

```json
{"status":"ok"}
```

Trên Windows PowerShell có thể mở trực tiếp trình duyệt:

```powershell
start http://localhost:5173
```

Hoặc truy cập thủ công:

**Frontend:** http://localhost:5173

**Backend:** http://localhost:8000

## 5. Tài khoản demo

Project đã được cấu hình để **tự động chạy migration và tạo tài khoản demo khi Backend khởi động**.

Thông tin đăng nhập mặc định:

| Trường | Giá trị |
|---|---|
| Tên đăng nhập | `manager` |
| Số điện thoại | `0963217400` |
| Mật khẩu | `demo12345` |
| Vai trò | `QUAN_LY` |

Có thể đăng nhập bằng **`manager` hoặc `0963217400`**.

### Tại sao không cần tự tạo tài khoản?

Khi Backend container khởi động, quy trình là:

```text
PostgreSQL healthy
        ↓
alembic upgrade head
        ↓
Tạo/cập nhật cấu trúc database
        ↓
Seed demo account nếu chưa tồn tại
        ↓
FastAPI khởi động
```

Script seed có tính **idempotent**: nếu tài khoản demo đã tồn tại thì không tạo bản ghi thứ hai và không ghi đè mật khẩu hiện tại.

## 6. Vì sao trước đây máy người khác không đăng nhập được?

Docker volume của PostgreSQL không được lưu trong GitHub.

Máy của bạn có thể đã có database:

```text
postgres_data
    └── nhan_vien
          └── 0963217400 / manager
```

Trong khi máy thành viên mới clone repository sẽ có volume PostgreSQL mới và ban đầu không có dữ liệu nhân viên.

Code đăng nhập khi không tìm thấy tài khoản cũng trả về:

```text
Tên đăng nhập/số điện thoại hoặc mật khẩu không đúng.
```

Do đó thông báo này **không nhất thiết có nghĩa là mật khẩu sai**; tài khoản có thể chưa tồn tại trong database.

Project hiện đã khắc phục bằng migration + automatic seed khi Backend container khởi động.

## 7. Cấu trúc Docker

```text
Browser
   │
   ├── http://localhost:5173
   ▼
Frontend container
React/Vite build → Nginx
   │
   │ API: http://localhost:8000
   ▼
Backend container
FastAPI
   │
   │ PostgreSQL: db:5432
   ▼
PostgreSQL container
restaurant-db
   │
   ▼
Docker volume: postgres_data
```

Lưu ý:

- **Frontend → Backend** dùng `localhost:8000` vì request được gửi từ trình duyệt của người dùng.
- **Backend → PostgreSQL** dùng `db:5432` vì Backend và PostgreSQL nằm trong cùng Docker Compose network.
- Không đổi Backend database host thành `localhost` khi chạy trong Docker.

## 8. CORS

Backend mặc định cho phép cả:

```text
http://localhost:5173
http://127.0.0.1:5173
```

Vì vậy nếu mở frontend bằng một trong hai địa chỉ trên thì không cần sửa code.

Nếu nhóm thay đổi port/domain frontend, có thể cấu hình:

```env
FRONTEND_URLS=http://localhost:5173,http://127.0.0.1:5173
```

Sau đó rebuild Backend:

```bash
docker compose up -d --build
```

## 9. Các lệnh Docker thường dùng

### Xem trạng thái

```bash
docker compose ps
```

### Xem log toàn bộ hệ thống

```bash
docker compose logs -f
```

### Xem log Backend

```bash
docker compose logs -f backend
```

### Xem log Database

```bash
docker compose logs -f db
```

### Xem log Frontend

```bash
docker compose logs -f frontend
```

### Dừng project nhưng giữ database

```bash
docker compose down
```

### Chạy lại

```bash
docker compose up -d
```

### Rebuild sau khi sửa code/Dockerfile

```bash
docker compose up -d --build
```

## 10. Nếu đăng nhập vẫn báo sai mật khẩu

Đầu tiên kiểm tra Backend:

```bash
docker compose logs backend
```

Tìm các dòng gần:

```text
Database migrations completed.
Demo account created: ...
```

Hoặc:

```text
Demo account already exists; keeping the existing password.
```

Kiểm tra trực tiếp database:

```bash
docker compose exec db psql -U postgres -d restaurant_db
```

Sau đó chạy:

```sql
SELECT id, ten_dang_nhap, so_dien_thoai, ho_ten, vai_tro, trang_thai
FROM nhan_vien;
```

Phải có tài khoản `manager` hoặc số điện thoại `0963217400`.

Thoát PostgreSQL:

```text
\q
```

### Trường hợp database đã có tài khoản cũ

Seed mặc định **không ghi đè mật khẩu của tài khoản đã tồn tại**.

Nếu bạn đang dùng database cũ và quên mật khẩu, có thể reset bằng:

```bash
docker compose exec backend python reset_manager_password.py
```

Nhập mật khẩu mới ít nhất 8 ký tự và xác nhận lại.

## 11. Nếu muốn làm lại database từ đầu

⚠️ Lệnh dưới đây **xóa toàn bộ dữ liệu PostgreSQL trong Docker volume**.

Chỉ dùng trong môi trường phát triển/test khi không cần giữ dữ liệu.

```bash
docker compose down -v
```

Sau đó:

```bash
docker compose up -d --build
```

Docker sẽ tạo database mới, chạy migration và tạo lại tài khoản demo.

## 12. Nếu clone project nhưng Docker báo container cũ/conflict

Kiểm tra:

```bash
docker compose ps -a
```

Nếu đây là project dev và không cần giữ container cũ, có thể chạy:

```bash
docker compose down
```

rồi:

```bash
docker compose up -d --build
```

Không dùng `down -v` nếu muốn giữ database.

## 13. Nếu port đã bị sử dụng

Project sử dụng:

| Thành phần | Host port | Container port |
|---|---:|---:|
| PostgreSQL | `5433` | `5432` |
| Backend | `8000` | `8000` |
| Frontend | `5173` | `80` |

Nếu một ứng dụng khác đang dùng `5173`, `8000` hoặc `5433`, Docker có thể không start được.

Có thể kiểm tra container:

```bash
docker compose ps
```

Trên Windows PowerShell có thể kiểm tra port:

```powershell
netstat -ano | findstr :5173
netstat -ano | findstr :8000
netstat -ano | findstr :5433
```

## 14. Nếu thay đổi biến môi trường

Docker Compose đọc biến từ file `.env` ở **thư mục gốc của project**.

Có thể tạo `.env` từ `.env.example`:

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

### Linux/macOS

```bash
cp .env.example .env
```

Sau khi thay đổi các biến build/runtime, chạy:

```bash
docker compose up -d --build
```

## 15. Lưu ý về tài khoản demo

Tài khoản `manager / demo12345` chỉ dành cho **môi trường development/demo**.

Không sử dụng mật khẩu này cho môi trường production.

Mật khẩu được lưu trong database dưới dạng **bcrypt hash**, không lưu plaintext.

## 16. Quy trình dành cho thành viên nhóm

Nếu chỉ muốn chạy project, hãy làm đúng 5 bước này:

```bash
# 1. Clone
git clone <URL-GITHUB-CUA-NHOM>
cd <TEN-THU-MUC-PROJECT>

# 2. Build + start
docker compose up -d --build

# 3. Kiểm tra
docker compose ps

# 4. Mở web
# http://localhost:5173

# 5. Đăng nhập
# manager / demo12345
# hoặc 0963217400 / demo12345
```

Nếu bước 3 cho thấy `restaurant-db` healthy và `restaurant-backend` healthy nhưng đăng nhập vẫn thất bại, xem phần **10. Nếu đăng nhập vẫn báo sai mật khẩu**.

## 17. Quy trình dành cho người phát triển code

Sau khi sửa Backend:

```bash
docker compose up -d --build backend
```

Sau khi sửa Frontend:

```bash
docker compose up -d --build frontend
```

Sau khi sửa `docker-compose.yml` hoặc Dockerfile:

```bash
docker compose down
docker compose up -d --build
```

Không commit các file/thư mục local như:

```text
.env
backend/venv/
backend/__pycache__/
frontend/node_modules/
frontend/dist/
```

## 18. Những file quan trọng liên quan đến khởi tạo

```text
.
├── docker-compose.yml
├── .env.example
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.py
│   ├── alembic/
│   │   └── versions/
│   │       └── 001_add_authentication.py
│   └── app/
│       ├── seed_demo.py
│       ├── core/
│       ├── database/
│       ├── models/
│       ├── routers/
│       └── services/
│
└── frontend/
    ├── Dockerfile
    └── src/
        └── services/
            └── api.js
```

### Vai trò của các file mới/sửa

- `backend/entrypoint.py`: tự chạy migration, seed demo account rồi mới start FastAPI.
- `backend/app/seed_demo.py`: tạo tài khoản demo nếu tài khoản chưa tồn tại.
- `backend/Dockerfile`: gọi `entrypoint.py` thay vì chạy Uvicorn trực tiếp.
- `backend/app/core/config.py`: hỗ trợ nhiều CORS origin thông qua `FRONTEND_URLS`.
- `backend/app/main.py`: sử dụng danh sách CORS origin đã cấu hình.
- `docker-compose.yml`: truyền các biến seed/CORS vào Backend.

