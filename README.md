# Restaurant Management System

Hệ thống quản lý nhà hàng được xây dựng phục vụ việc quản lý đặt bàn, khách hàng, món ăn, đơn hàng và các nghiệp vụ liên quan.

Project sử dụng Docker Compose để chuẩn hóa môi trường phát triển. Thành viên trong nhóm không cần tự cài Python, Node.js hoặc PostgreSQL để chạy project.

---

## 1. Công nghệ sử dụng

### Backend

- Python 3.12
- FastAPI
- Uvicorn
- SQLAlchemy
- Alembic
- PostgreSQL
- Pydantic
- JWT

### Frontend

- React
- Vite
- Ant Design
- Axios
- React Router

### Infrastructure

- Docker
- Docker Compose
- PostgreSQL 16
- Nginx

---

## 2. Cấu trúc project

```text
restaurant-system/
│
├── backend/
│   ├── app/
│   ├── alembic/
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── .env.example
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── package-lock.json
│   ├── .env.example
│   └── Dockerfile
│
├── .env.example
├── .gitignore
├── docker-compose.yml
└── README.md
```

---

# 3. Yêu cầu trước khi chạy

Thành viên chỉ cần cài:

- Git
- Docker Desktop

Không cần cài riêng:

- Python
- Node.js
- PostgreSQL

Docker sẽ cung cấp môi trường chạy cho project.

---

# 4. Kiểm tra Docker

Mở PowerShell và chạy:

```powershell
docker --version
```

Sau đó:

```powershell
docker compose version
```

Ví dụ:

```text
Docker version 29.x.x
Docker Compose version v5.x.x
```

Kiểm tra Docker hoạt động:

```powershell
docker run --rm hello-world
```

Nếu xuất hiện:

```text
Hello from Docker!
```

thì Docker đã hoạt động.

---

# 5. Clone project

Clone repository:

```powershell
git clone https://github.com/USERNAME/restaurant-system.git
```

Đi vào project:

```powershell
cd restaurant-system
```

> Thay `USERNAME` bằng username GitHub thực tế của repository.

---

# 6. Cấu hình môi trường

Tạo file `.env` từ `.env.example`:

```powershell
Copy-Item .\.env.example .\.env
```

File `.env` chỉ dùng cho máy local.

**Không commit `.env` lên GitHub.**

---

# 7. Chạy toàn bộ hệ thống bằng Docker

Từ thư mục:

```text
restaurant-system
```

chạy:

```powershell
docker compose up --build
```

Lần đầu Docker sẽ tải image và build:

```text
PostgreSQL
    ↓
FastAPI Backend
    ↓
React Frontend + Nginx
```

Lần đầu có thể mất vài phút.

---

# 8. Mở Demo

Sau khi Docker chạy thành công:

### Frontend

Mở trình duyệt:

```text
http://localhost:5173
```

### Backend

```text
http://localhost:8000
```

### Backend API Documentation

```text
http://localhost:8000/docs
```

### Backend Health Check

```text
http://localhost:8000/api/health
```

Kết quả mong muốn:

```json
{
  "status": "ok"
}
```

---

# 9. Kiểm tra container

Mở một PowerShell khác:

```powershell
cd C:\Workspaces\restaurant-system
```

Chạy:

```powershell
docker compose ps
```

Các service cần chạy:

```text
restaurant-db
restaurant-backend
restaurant-frontend
```

Database cần có trạng thái:

```text
healthy
```

---

# 10. Các service

Docker Compose tạo 3 service:

```text
┌─────────────────────────────┐
│          Frontend           │
│       React + Nginx         │
│       localhost:5173        │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│          Backend            │
│          FastAPI            │
│       localhost:8000        │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│         PostgreSQL          │
│       localhost:5432        │
└─────────────────────────────┘
```

---

# 11. Các lệnh Docker thường dùng

## Khởi động

```powershell
docker compose up
```

## Build lại và khởi động

Dùng khi thay đổi Dockerfile, `requirements.txt`, `package.json`, v.v.

```powershell
docker compose up --build
```

## Chạy dưới nền

```powershell
docker compose up -d
```

## Dừng hệ thống

```powershell
docker compose down
```

## Xem trạng thái

```powershell
docker compose ps
```

## Xem toàn bộ log

```powershell
docker compose logs
```

## Xem log Backend

```powershell
docker compose logs -f backend
```

## Xem log Frontend

```powershell
docker compose logs -f frontend
```

## Xem log Database

```powershell
docker compose logs -f db
```

---

# 12. Database

PostgreSQL được chạy trong Docker.

Thông tin mặc định trong môi trường development:

```text
Database: restaurant_db
User: postgres
Password: postgres
Host: db
Port: 5432
```

Backend kết nối PostgreSQL thông qua Docker network:

```text
db:5432
```

Không sử dụng:

```text
localhost:5432
```

bên trong Backend container.

---

# 13. Database volume

Database sử dụng Docker volume:

```text
postgres_data
```

Vì vậy khi chạy:

```powershell
docker compose down
```

database vẫn được giữ lại.

Không nên chạy:

```powershell
docker compose down -v
```

trừ khi muốn xóa database development.

---

# 14. Làm việc với Git

Trước khi bắt đầu làm việc:

```powershell
git checkout main
git pull origin main
```

Tạo branch mới:

```powershell
git checkout -b feature/ten-chuc-nang
```

Ví dụ:

```powershell
git checkout -b feature/table-management
```

Sau khi hoàn thành:

```powershell
git add .
git commit -m "feat: add table management"
git push -u origin feature/table-management
```

Sau đó tạo Pull Request trên GitHub.

---

# 15. Quy ước commit

Một số prefix thường sử dụng:

```text
feat:      thêm chức năng mới
fix:       sửa lỗi
refactor:  chỉnh sửa cấu trúc code
docs:      cập nhật tài liệu
style:     chỉnh format/code style
test:      thêm hoặc sửa test
chore:     cấu hình, dependency, Docker...
```

Ví dụ:

```text
feat: add reservation management
fix: prevent duplicate reservation
docs: update docker setup
chore: configure postgres container
```

---

# 16. Quy trình làm việc của thành viên

Mỗi thành viên thực hiện:

```text
Clone repository
       ↓
docker compose up --build
       ↓
Mở localhost:5173
       ↓
git checkout -b feature/...
       ↓
Lập trình
       ↓
git add .
       ↓
git commit
       ↓
git push
       ↓
Pull Request
       ↓
Review
       ↓
Merge
```

---

# 17. Không commit các file sau

Không push:

```text
.env
backend/.env
frontend/.env
backend/venv/
frontend/node_modules/
frontend/dist/
__pycache__/
```

Các file này đã được thêm vào `.gitignore`.

---

# 18. Nếu Docker báo lỗi

Kiểm tra container:

```powershell
docker compose ps
```

Xem log:

```powershell
docker compose logs
```

Nếu Backend lỗi:

```powershell
docker compose logs backend
```

Nếu Database lỗi:

```powershell
docker compose logs db
```

Nếu Frontend lỗi:

```powershell
docker compose logs frontend
```

Có thể thử build lại:

```powershell
docker compose down
docker compose up --build
```

---

# 19. Quick Start

Thành viên mới chỉ cần:

```powershell
git clone https://github.com/USERNAME/restaurant-system.git

cd restaurant-system

Copy-Item .\.env.example .\.env

docker compose up --build
```

Sau đó mở:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:8000
```

Swagger:

```text
http://localhost:8000/docs
```

---

# 20. Team

| Thành viên | Vai trò |
|---|---|
| Thành viên 1 | Backend |
| Thành viên 2 | Frontend |
| Thành viên 3 | Database |
| Thành viên 4 | Testing / Scrum |

Cập nhật danh sách thành viên theo nhóm thực tế.

---

## Repository

GitHub:

```text
https://github.com/NguyenDungICTU/restaurant-system
```

Thay URL trên bằng URL repository thực tế của nhóm.