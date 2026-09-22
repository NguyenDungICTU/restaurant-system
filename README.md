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

## 3. Yêu cầu trước khi chạy

Thành viên chỉ cần cài:
- Git
- Docker Desktop

Không cần cài riêng:
- Python
- Node.js
- PostgreSQL

Docker sẽ cung cấp môi trường chạy cho project.

---

## 4. Kiểm tra Docker

Mở PowerShell và chạy:

```powershell
docker --version
```

Sau đó:

```powershell
docker compose version
```

Kiểm tra Docker hoạt động:

```powershell
docker run --rm hello-world
```

Nếu xuất hiện `Hello from Docker!` thì Docker đã hoạt động bình thường.

---

## 5. Clone project

Clone repository:

```powershell
git clone [https://github.com/NguyenDungICTU/restaurant-system.git](https://github.com/NguyenDungICTU/restaurant-system.git)
```

Đi vào project:

```powershell
cd restaurant-system
```

---

## 6. Cấu hình môi trường

Tạo file `.env` từ `.env.example`:

```powershell
Copy-Item .\.env.example .\.env
```

File `.env` chỉ dùng cho máy local. **Không commit `.env` lên GitHub.**

---

## 7. Chạy toàn bộ hệ thống bằng Docker

Từ thư mục gốc `restaurant-system`, chạy:

```powershell
docker compose up --build
```

Lần đầu Docker sẽ tải image và build các service theo thứ tự:

```text
PostgreSQL ──> FastAPI Backend ──> React Frontend + Nginx
```

Lần đầu khởi chạy có thể mất vài phút.

---

## 8. Mở Demo

Sau khi Docker chạy thành công:

- **Frontend:** [http://localhost:5173](http://localhost:5173) (hoặc [http://localhost](http://localhost) tùy cấu hình Nginx)
- **Backend Base API:** [http://localhost:8000](http://localhost:8000)
- **Backend API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Backend Health Check:** [http://localhost:8000/api/health](http://localhost:8000/api/health)

Kết quả Health Check mong muốn:

```json
{
  "status": "ok"
}
```

---

## 9. Kiểm tra container

Mở một cửa sổ PowerShell khác và chạy:

```powershell
docker compose ps
```

Các service cần chạy:
- `restaurant-db` (Trạng thái: `healthy`)
- `restaurant-backend`
- `restaurant-frontend`

---

## 10. Kiến trúc các service

Docker Compose quản lý 3 service kết nối với nhau:

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
│          PostgreSQL         │
│       localhost:5432        │
└─────────────────────────────┘
```

---

## 11. Các lệnh Docker thường dùng

- **Khởi động hệ thống:**
  ```powershell
  docker compose up
  ```

- **Chạy ngầm dưới nền:**
  ```powershell
  docker compose up -d
  ```

- **Build lại và khởi động (Dùng khi sửa Dockerfile, requirements.txt, package.json):**
  ```powershell
  docker compose up --build -d
  ```

- **Dừng toàn bộ hệ thống:**
  ```powershell
  docker compose down
  ```

- **Xem trạng thái các container:**
  ```powershell
  docker compose ps
  ```

- **Xem log tổng hợp hoặc xem log riêng từng service:**
  ```powershell
  docker compose logs -f
  docker compose logs -f backend
  docker compose logs -f frontend
  docker compose logs -f db
  ```

---

## 12. Quản lý Database

PostgreSQL chạy trong Docker với cấu hình mặc định (development):

```text
Database: restaurant_db
User:     postgres
Password: postgres
Host:     db
Port:     5432
```

> **Lưu ý:** Backend kết nối với PostgreSQL thông qua Docker network bằng host `db:5432` (không dùng `localhost:5432` bên trong container Backend).

---

## 13. Database volume

Database sử dụng Docker volume tên là `postgres_data`.

Khi chạy lệnh `docker compose down`, dữ liệu trong database vẫn được giữ lại nguyên vẹn.

**Lưu ý:** Không nên dùng lệnh `docker compose down -v` trừ khi bạn thật sự muốn xóa toàn bộ dữ liệu phát triển.

---

## 14. Quy trình làm việc với Git

1. Cập nhật code mới nhất từ `main`:
   ```powershell
   git checkout main
   git pull origin main
   ```

2. Tạo branch mới cho chức năng:
   ```powershell
   git checkout -b feature/ten-chuc-nang
   ```
   *Ví dụ:* `git checkout -b feature/table-management`

3. Sau khi hoàn thành và test thành công:
   ```powershell
   git add .
   git commit -m "feat: add table management"
   git push -u origin feature/table-management
   ```

4. Truy cập GitHub và tạo **Pull Request**.

---

## 15. Quy ước Commit Message

Sử dụng các tiền tố chuẩn sau:

- `feat:` Thêm chức năng mới
- `fix:` Sửa lỗi
- `refactor:` Chỉnh sửa cấu trúc code
- `docs:` Cập nhật tài liệu
- `style:` Chỉnh sửa format, UI layout
- `test:` Thêm hoặc sửa bài test
- `chore:` Cấu hình, dependency, Docker...

*Ví dụ:* `feat: add reservation management`, `fix: prevent duplicate reservation`

---

## 16. Quy trình phát triển của thành viên

```text
Clone repository
       ↓
docker compose up --build -d
       ↓
Mở localhost:5173 kiểm tra
       ↓
Tạo branch (git checkout -b feature/...)
       ↓
Lập trình & Test
       ↓
Commit & Push
       ↓
Tạo Pull Request trên GitHub ──> Review ──> Merge main
```

---

## 17. Danh sách file bỏ qua (GitIgnore)

Tuyệt đối không commit các file/thư mục sau lên GitHub:
- `.env`
- `backend/.env`
- `frontend/.env`
- `backend/venv/`
- `frontend/node_modules/`
- `frontend/dist/`
- `__pycache__/`

---

## 18. Xử lý sự cố thường gặp (Troubleshooting)

Nếu hệ thống báo lỗi không chạy được:

1. Kiểm tra trạng thái các container:
   ```powershell
   docker compose ps
   ```
2. Xem log chi tiết dịch vụ bị lỗi:
   ```powershell
   docker compose logs backend
   docker compose logs db
   ```
3. Rebuild lại toàn bộ container:
   ```powershell
   docker compose down
   docker compose up --build -d
   ```

---

## 19. Quick Start (Dành cho thành viên mới)

```powershell
# 1. Clone project
git clone [https://github.com/NguyenDungICTU/restaurant-system.git](https://github.com/NguyenDungICTU/restaurant-system.git)

# 2. Truy cập thư mục
cd restaurant-system

# 3. Tạo file cấu hình môi trường
Copy-Item .\.env.example .\.env

# 4. Khởi chạy dự án
docker compose up --build -d
```

Sau đó truy cập:
- Frontend: [http://localhost:5173](http://localhost:5173)
- Backend Swagger: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 20. Danh sách thành viên nhóm

| Thành viên | Vai trò |
|---|---|
| Thành viên 1 | Backend Developer |
| Thành viên 2 | Frontend Developer |
| Thành viên 3 | Database Administrator |
| Thành viên 4 | Tester / Scrum Master |

---

## Repository

- **GitHub:** (https://github.com/NguyenDungICTU/restaurant-system)