# Restaurant Management System — Docker Demo (bản đã sửa)

Bản này tập trung xử lý 3 vấn đề:

1. **Màn hình Login bị mất/bể CSS** khi chạy frontend bằng Docker.
2. **Có nhóm món nhưng chưa có chức năng quản lý món ăn thuộc nhóm**.
3. **Clone từ GitHub phải có thể dựng demo bằng Docker Compose**, không phụ thuộc máy của người tạo project.

## 1. Những gì đã sửa

### 1.1 Login CSS

`frontend/src/pages/Login.jsx` sử dụng các class như `login-page`, `login-form-side`, `field`, `login-submit` nhưng source trước đó chưa có bộ CSS tương ứng trong `frontend/src/App.css`.

Bản này đã bổ sung đầy đủ:

- layout 2 cột trên màn hình lớn;
- layout 1 cột trên màn hình nhỏ;
- form input;
- trạng thái focus;
- nút đăng nhập;
- thông báo lỗi;
- security note;
- nút quay lại trang chủ.

Docker build sẽ lấy chính source CSS này để tạo `frontend/dist`.

### 1.2 Món ăn thuộc nhóm món

Backend đã có bảng `mon_an` với khóa ngoại:

```text
mon_an.nhom_mon_id -> nhom_mon.id
```

Bản này bổ sung API CRUD món ăn:

```text
GET    /api/menu/dishes
GET    /api/menu/dishes/public
POST   /api/menu/dishes
PATCH  /api/menu/dishes/{dish_id}
DELETE /api/menu/dishes/{dish_id}
```

Frontend trang **Thực đơn** có 2 chế độ:

```text
Nhóm món
Món ăn
```

Khi thêm món ăn, bắt buộc chọn một nhóm món.

### 1.3 Demo data

Khi backend khởi động trong Docker:

- Alembic tự chạy migration.
- Tài khoản demo tự tạo nếu chưa tồn tại.
- Menu demo tự tạo nếu chưa tồn tại.

Tài khoản demo:

```text
Username: manager
Password: demo12345
```

Hoặc đăng nhập bằng:

```text
Phone: 0963217400
Password: demo12345
```

Menu demo gồm 3 nhóm và 6 món mẫu.

Seed có tính idempotent: restart container không tạo bản sao mới.

---

# 2. Kiến trúc Docker

```text
Browser
   |
   | http://localhost:5173
   v
frontend (Nginx)
   |
   | browser gọi API http://localhost:8000
   v
backend (FastAPI)
   |
   | Docker network
   v
db (PostgreSQL 16)
```

Port:

| Thành phần | Port máy host |
|---|---:|
| Frontend | `5173` |
| Backend | `8000` |
| PostgreSQL | `5433` |

Quan trọng: frontend chạy trong Nginx nhưng API được gọi **từ browser**, vì vậy `VITE_API_BASE_URL` mặc định là:

```text
http://localhost:8000
```

Không đổi thành `http://backend:8000` trong frontend.

---

# 3. Cách chạy sau khi clone GitHub

## Yêu cầu

Chỉ cần:

- Git
- Docker Desktop
- Docker Compose

Không cần cài:

- Python
- Node.js
- npm
- PostgreSQL

## Clone

```powershell
git clone <URL_GITHUB_CUA_BAN>
cd <TEN_PROJECT>
```

## Build và chạy

Lần đầu nên dùng:

```powershell
docker compose up -d --build
```

Kiểm tra:

```powershell
docker compose ps
```

Mục tiêu:

```text
restaurant-db         Up (healthy)
restaurant-backend    Up (healthy)
restaurant-frontend   Up
```

Nếu frontend hoặc backend chưa ready ngay lập tức, chờ khoảng 10–30 giây rồi kiểm tra lại:

```powershell
docker compose ps
```

## Mở demo

Frontend:

```text
http://localhost:5173
```

Backend health:

```text
http://localhost:8000/api/health
```

Backend API docs:

```text
http://localhost:8000/docs
```

Đăng nhập:

```text
Username: manager
Password: demo12345
```

---

# 4. Nếu Docker đã từng chạy project cũ

Để build lại toàn bộ image:

```powershell
docker compose down
docker compose build --no-cache
docker compose up -d
```

Hoặc nhanh hơn:

```powershell
docker compose up -d --build
```

### Nếu muốn giữ database hiện tại

Không dùng `docker compose down -v`.

Chỉ:

```powershell
docker compose down
docker compose up -d --build
```

### Nếu muốn reset database demo hoàn toàn

Chỉ làm khi chấp nhận mất dữ liệu PostgreSQL của project:

```powershell
docker compose down -v
docker compose up -d --build
```

Sau đó database được tạo lại và seed demo lại.

---

# 5. Kiểm tra backend

```powershell
curl http://localhost:8000/api/health
```

Kết quả mong muốn:

```json
{"status":"ok"}
```

Xem log:

```powershell
docker compose logs backend --tail=200
```

Phải thấy các bước tương tự:

```text
Running database migrations ...
Database migrations completed.
Seeding development demo account...
Seeding demo menu...
```

Nếu muốn kiểm tra nhanh:

```powershell
docker compose logs backend | Select-String "migration|Demo account|Demo menu|error"
```

---

# 6. Kiểm tra frontend

Xem log:

```powershell
docker compose logs frontend --tail=100
```

Nếu trang Login vẫn hiển thị CSS cũ sau khi build lại, hãy:

1. Đóng tab `http://localhost:5173`.
2. Mở lại.
3. Nhấn `Ctrl + Shift + R`.

Nếu vẫn bị cache:

- Chrome DevTools → Network → tick `Disable cache`
- reload trang.

Không nên chỉ reload bình thường sau khi thay đổi file CSS trong Docker vì browser có thể đang giữ asset cũ.

---

# 7. Kiểm tra chức năng nhóm món và món ăn

Sau khi đăng nhập:

```text
Thực đơn
  |
  +-- Nhóm món
  |     +-- Tạo nhóm
  |     +-- Sửa
  |     +-- Bật/tắt
  |     +-- Sắp xếp
  |     +-- Xóa
  |
  +-- Món ăn
        +-- Tạo món
        +-- Chọn nhóm món
        +-- Chọn trạng thái
        +-- Sửa
        +-- Xóa
```

Ví dụ:

```text
Khai vị
  ├── Gỏi cuốn
  └── Chả giò

Món chính
  ├── Cơm chiên
  └── Bò lúc lắc

Đồ uống
  ├── Trà đào
  └── Nước suối
```

Mỗi món có `nhom_mon_id`, nên món luôn thuộc một nhóm.

---

# 8. Tạo backup trước khi ghi đè source cũ

## Windows PowerShell

Đứng tại thư mục project hiện tại:

```powershell
cd C:\Users\FPT\Documents\GitHub\<TEN_PROJECT>
```

Tạo thư mục backup:

```powershell
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
New-Item -ItemType Directory -Path ".\backup\$stamp" -Force
```

Backup các phần quan trọng:

```powershell
Copy-Item ".\backend" ".\backup\$stamp\backend" -Recurse
Copy-Item ".\frontend" ".\backup\$stamp\frontend" -Recurse
Copy-Item ".\docker-compose.yml" ".\backup\$stamp\docker-compose.yml"
Copy-Item ".\README.md" ".\backup\$stamp\README.md" -ErrorAction SilentlyContinue
```

Kiểm tra:

```powershell
Get-ChildItem ".\backup\$stamp"
```

**Không backup database bằng cách copy thư mục `postgres_data` trong source.**

Nếu database đang chứa dữ liệu quan trọng, backup database riêng bằng `pg_dump`.

---

# 9. Ghi đè source cũ bằng bản đã sửa

Giả sử bạn đã giải nén file bản sửa vào:

```text
C:\Users\FPT\Downloads\restaurant-management-fixed
```

Đứng tại root project cũ.

### Bước 1 — dừng container

```powershell
docker compose down
```

### Bước 2 — ghi đè backend

```powershell
Remove-Item ".\backend" -Recurse -Force
Copy-Item "C:\Users\FPT\Downloads\restaurant-management-fixed\backend" ".\backend" -Recurse
```

### Bước 3 — ghi đè frontend

```powershell
Remove-Item ".\frontend" -Recurse -Force
Copy-Item "C:\Users\FPT\Downloads\restaurant-management-fixed\frontend" ".\frontend" -Recurse
```

### Bước 4 — ghi đè docker-compose

```powershell
Copy-Item "C:\Users\FPT\Downloads\restaurant-management-fixed\docker-compose.yml" ".\docker-compose.yml" -Force
```

### Bước 5 — copy README

```powershell
Copy-Item "C:\Users\FPT\Downloads\restaurant-management-fixed\README.md" ".\README.md" -Force
```

Sau đó kiểm tra Git:

```powershell
git status
```

---

# 10. Build Docker sạch sau khi ghi đè

Chạy:

```powershell
docker compose down
docker compose build --no-cache
docker compose up -d
```

Kiểm tra:

```powershell
docker compose ps
```

Sau đó:

```powershell
docker compose logs backend --tail=200
```

và:

```powershell
docker compose logs frontend --tail=100
```

Mở:

```text
http://localhost:5173
```

---

# 11. Nếu muốn kiểm tra toàn bộ từ đầu như một người bạn clone GitHub

Đây là quy trình nên dùng để test trước khi push:

```powershell
git clone <URL_GITHUB_CUA_BAN> restaurant-demo-test
cd restaurant-demo-test
docker compose up -d --build
docker compose ps
```

Chờ backend healthy.

Sau đó mở:

```text
http://localhost:5173
```

Đăng nhập:

```text
manager
demo12345
```

Kiểm tra:

```text
Dashboard
→ Thực đơn
→ Nhóm món
→ Món ăn
→ Thêm món ăn
→ Chọn nhóm món
```

Nếu quy trình này chạy trên một thư mục clone mới thì project không phụ thuộc vào database cũ trên máy của bạn.

---

# 12. GitHub: những gì KHÔNG nên push

Không push:

```text
backend/.env
backend/venv/
frontend/node_modules/
frontend/dist/
__pycache__/
*.pyc
```

Các file cần có trong GitHub:

```text
docker-compose.yml
README.md
.env.example

backend/
  Dockerfile
  entrypoint.py
  requirements.txt
  alembic/
  app/

frontend/
  Dockerfile
  package.json
  package-lock.json
  vite.config.js
  index.html
  src/
```

---

# 13. Quy trình làm việc chuẩn sau này

Hoang gay
Hung gay

Mỗi khi sửa code:

```powershell
docker compose up -d --build
```

Nếu nghi ngờ cache frontend:

```powershell
docker compose build --no-cache frontend
docker compose up -d
```

Nếu sửa backend:

```powershell
docker compose build --no-cache backend
docker compose up -d
```

Nếu thay đổi migration:

```powershell
docker compose up -d --build
docker compose logs backend --tail=200
```

Nếu muốn test như người clone mới:

```powershell
git clone <URL_GITHUB_CUA_BAN> test-clone
cd test-clone
docker compose up -d --build
```

---

# 14. Kết quả mong muốn của bản này

```text
[OK] Login có CSS đầy đủ khi build Docker
[OK] Backend tự migrate PostgreSQL
[OK] Backend tự tạo tài khoản demo
[OK] Backend tự tạo menu demo
[OK] Có nhóm món
[OK] Có món ăn thuộc nhóm
[OK] Không thể tạo món không có nhóm
[OK] Clone GitHub -> docker compose up -d --build -> chạy demo
[OK] Không cần Python/Node/PostgreSQL cài trên máy bạn bè
```

## Menu category & dish rules

The menu management feature follows this user story:

> Là Quản lý quán, tôi muốn sắp xếp thực đơn thành các nhóm món như khai vị, món chính, lẩu, tráng miệng và đồ uống, để khách và phục vụ tìm món nhanh thay vì cuộn qua toàn bộ danh sách.

Acceptance criteria implemented:

- Thêm, sửa, đổi thứ tự hiển thị và ngừng sử dụng nhóm món.
- Tên nhóm món bắt buộc 1–50 ký tự và không phân biệt hoa/thường khi kiểm tra trùng.
- Nhóm món đang chứa món không thể xoá; phải chuyển món sang nhóm khác trước.
- API public và API món ăn public đều sắp xếp theo `nhom_mon.thu_tu`, bảo đảm cùng một nguồn thứ tự cho thực đơn công khai và màn hình gọi món.
- Bấm vào một nhóm món trong màn hình quản lý sẽ mở rộng danh sách các món thuộc nhóm đó.
- Nhóm món và món ăn đều có ảnh mô tả tùy chọn. Nếu không tải ảnh, hệ thống dùng ảnh mặc định.
- Có thể tải ảnh JPG/PNG/WEBP/GIF tối đa 5 MB.
- Dữ liệu demo có sẵn 6 món và ảnh tham khảo từ Internet cho các món mẫu.

### Demo menu

`manager / demo12345`

Các món mẫu gồm Gỏi cuốn, Chả giò, Cơm chiên, Bò lúc lắc, Trà đào và Nước suối.

> Ảnh Internet trong dữ liệu demo chỉ dùng để minh họa giao diện. Khi dùng cho sản phẩm thật, nên thay bằng ảnh mà nhà hàng có quyền sử dụng.

