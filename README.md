# Restaurant Management System — Docker & S2-09

README này dành cho thành viên nhóm khi clone/pull project, tạo cấu hình local từ `.env.example`, chạy project bằng Docker và demo tính năng S2-09.

---

# 1. Yêu cầu môi trường

Cần cài:

- Git
- Docker Desktop
- Docker Compose v2

Không cần cài riêng:

- Python
- Node.js
- PostgreSQL

Kiểm tra:

```bash
git --version
docker --version
docker compose version
```

Đảm bảo Docker Desktop đang chạy trước khi dùng `docker compose`.

---

# 2. Clone project lần đầu

Mở Git Bash:

```bash
cd /c/Workspaces
git clone https://github.com/NguyenDungICTU/restaurant-system.git
cd restaurant-system
```

Kiểm tra:

```bash
git status
git branch
```

Lấy branch cần làm việc, ví dụ S2-09:

```bash
git fetch origin
git checkout feature/s2-09
```

Nếu branch chưa tồn tại local:

```bash
git fetch origin
git checkout -b feature/s2-09 origin/feature/s2-09
```

---

# 3. Tạo `.env` local từ `.env.example`

**Không tạo `.env` bằng cách commit trực tiếp file chứa mật khẩu lên GitHub.**

Project có file:

```text
.env.example
```

Sau khi clone project, tạo `.env` local bằng:

```bash
cd /c/Workspaces/restaurant-system
cp .env.example .env
```

Kiểm tra:

```bash
ls -la .env*
```

Kết quả cần có cả:

```text
.env
.env.example
```

Sau đó mở `.env` để chỉnh cấu hình riêng cho máy local:

```bash
notepad .env
```

Hoặc nếu dùng VS Code:

```bash
code .env
```

## 3.1. Nguyên tắc quan trọng

- `.env.example`: file mẫu để cả nhóm dùng chung → **được commit lên GitHub**.
- `.env`: cấu hình riêng của từng máy → **không commit lên GitHub**.
- Không đưa Gmail password, Google App Password, JWT secret thật hoặc secret khác vào Git.
- Mỗi thành viên có thể có `.env` riêng.

---

# 4. Cấu hình `.env` cho local

Sau khi chạy:

```bash
cp .env.example .env
```

mở:

```bash
notepad .env
```

và kiểm tra/cấu hình các biến cần thiết cho môi trường local.

Các thông tin quan trọng của project:

```env
POSTGRES_DB=restaurant_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres

SECRET_KEY=change-this-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480

RESTAURANT_PHONE=0963217400
RESTAURANT_ADDRESS="Phường Thái Sơn 2, xã Quyết Thắng, thành phố Thái Nguyên"

VITE_API_BASE_URL=http://localhost:8000
VITE_WS_BASE_URL=ws://localhost:8000
QR_FRONTEND_URL=http://localhost:5173
FRONTEND_URLS=http://localhost:5173,http://127.0.0.1:5173
```

> Nếu `.env.example` đã có giá trị mặc định phù hợp thì giữ nguyên. Chỉ thay những giá trị cần thiết cho máy local.

---

# 5. Cấu hình SMTP cho S2-09

S2-09 sử dụng Mailpit làm SMTP local.

Nếu chỉ cần demo email trong Mailpit, không cần gửi email ra Internet. Sau khi Docker chạy, mở:

```text
http://localhost:8025
```

Nếu muốn email được Mailpit chuyển tiếp tới email thật, cần cấu hình SMTP relay.

Trong `.env`:

```env
SMTP_RELAY_USERNAME= email của bạn 
SMTP_RELAY_PASSWORD=<GOOGLE_APP_PASSWORD>
```

## Google App Password

`SMTP_RELAY_PASSWORD` phải là **Google App Password**.

Không sử dụng:

- Mật khẩu đăng nhập Gmail thông thường.
- Mã OTP 6 số / mã xác minh.
- Mã dự phòng đăng nhập.

Không gửi App Password cho người khác và không commit nó vào GitHub.

---

# 6. Pull code khi máy đã clone project

Nếu máy đã có project:

```bash
cd /c/Workspaces/restaurant-system
```

Kiểm tra branch:

```bash
git branch --show-current
git status
```

Ví dụ với S2-09:

```bash
git checkout feature/s2-09
git pull origin feature/s2-09
```

Nếu muốn cập nhật branch `main`:

```bash
git checkout main
git pull origin main
```

## Nếu đang có thay đổi local

Luôn kiểm tra:

```bash
git status
```

Nếu có file đang sửa, không nên pull tùy tiện.

Có thể commit trước:

```bash
git add .
git commit -m "wip: save local changes"
git pull
```

hoặc stash:

```bash
git stash
git pull
git stash pop
```

---

# 7. Build và chạy Docker không dùng cache

Sau khi clone lần đầu hoặc pull code mới, có thể build sạch:

```bash
cd /c/Workspaces/restaurant-system

docker compose down
docker compose build --no-cache
docker compose up -d
```

Kiểm tra:

```bash
docker compose ps
```

Các container cần hoạt động:

```text
restaurant-db
restaurant-backend
restaurant-frontend
restaurant-mailpit
```

Backend và database cần ở trạng thái healthy khi hệ thống khởi động hoàn tất.

Các địa chỉ local:

```text
Frontend:
http://localhost:5173

Backend:
http://localhost:8000

Mailpit:
http://localhost:8025
```

---

# 8. Nếu vừa sửa `.env`

Khi sửa `.env`, cần recreate container để Docker nhận biến môi trường mới:

```bash
docker compose down
docker compose up -d --build
```

Nếu muốn build source hoàn toàn sạch:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

Kiểm tra SMTP password đã được truyền vào Mailpit mà không in password:

```bash
docker exec restaurant-mailpit sh -c 'if [ -n "$MP_SMTP_RELAY_PASSWORD" ]; then echo "PASSWORD_SET"; else echo "PASSWORD_EMPTY"; fi'
```

Kết quả mong muốn:

```text
PASSWORD_SET
```

---

# 9. S2-09 — Email xác nhận / hủy đặt bàn

## 9.1. Luồng chức năng

Sau khi khách đặt bàn:

1. Booking được ghi nhận.
2. Hệ thống tạo email xác nhận.
3. Email chứa thông tin đặt bàn.
4. Worker xử lý việc gửi email.
5. Nếu gửi thất bại, hệ thống retry theo cấu hình.
6. Mã booking vẫn hiển thị trên giao diện ngay cả khi email đang chờ/gửi thất bại.
7. Nhân viên xem được trạng thái email trong chi tiết booking.
8. Khi booking bị hủy/từ chối, hệ thống tạo email thông báo hủy kèm lý do.

Cấu hình worker:

```env
NOTIFICATION_WORKER_INTERVAL_SECONDS=10
NOTIFICATION_RETRY_MINUTES=5
```

---

# 10. Demo S2-09 bằng Mailpit

Sau khi Docker chạy:

```bash
docker compose ps
```

Mở:

```text
http://localhost:5173
```

Tạo một booking và nhập email người nhận, ví dụ:

```text
dtc245200174@ictu.edu.vn
```

Sau khi đặt bàn:

1. Kiểm tra booking đã được tạo.
2. Kiểm tra mã booking trên giao diện.
3. Mở:

```text
http://localhost:8025
```

4. Kiểm tra email xác nhận trong Mailpit.
5. Mở email để kiểm tra nội dung.

Mailpit nhận email từ backend qua:

```text
backend → mailpit:1025
```

---

# 11. Demo S2-09 gửi email ra Gmail thật

Nếu `.env` đã cấu hình:

```env
SMTP_RELAY_USERNAME=vandungx2211@gmail.com
SMTP_RELAY_PASSWORD=<GOOGLE_APP_PASSWORD>
```

sau khi sửa `.env`:

```bash
docker compose down
docker compose up -d --build
```

Kiểm tra:

```bash
docker exec restaurant-mailpit sh -c 'if [ -n "$MP_SMTP_RELAY_PASSWORD" ]; then echo "PASSWORD_SET"; else echo "PASSWORD_EMPTY"; fi'
```

Tạo một booking mới với email người nhận thật.

Sau đó kiểm tra:

```bash
docker logs restaurant-mailpit --tail 100
```

Nếu thành công, email sẽ được relay từ Mailpit qua Gmail SMTP tới địa chỉ người nhận.

---

# 12. Kiểm tra trạng thái email trong database

Có thể xem các notification gần nhất:

```bash
docker exec restaurant-db psql -U postgres -d restaurant_db -c "SELECT id, dat_ban_id, loai, email, trang_thai, so_lan_thu, lan_tiep_theo_at, da_gui_at, loi_cuoi FROM thong_bao ORDER BY id DESC LIMIT 10;"
```

Các trạng thái:

```text
CHO_GUI   = đang chờ gửi
DA_GUI    = gửi thành công
THAT_BAI  = gửi thất bại
```

Nếu `THAT_BAI`, kiểm tra:

```text
loi_cuoi
```

để biết lỗi SMTP/relay.

---

# 13. Xem log

Backend:

```bash
docker logs restaurant-backend --tail 200
```

Theo dõi realtime:

```bash
docker logs -f restaurant-backend
```

Dừng bằng:

```text
Ctrl + C
```

Mailpit:

```bash
docker logs restaurant-mailpit --tail 200
```

Kiểm tra username relay:

```bash
docker exec restaurant-mailpit env | grep MP_SMTP_RELAY_USERNAME
```

Không chia sẻ toàn bộ environment nếu trong đó có secret.

---

# 14. Lỗi S2-09 thường gặp

## `535 5.7.8 Username and Password not accepted`

Kiểm tra password đã được truyền vào container:

```bash
docker exec restaurant-mailpit sh -c 'if [ -n "$MP_SMTP_RELAY_PASSWORD" ]; then echo "PASSWORD_SET"; else echo "PASSWORD_EMPTY"; fi'
```

Nếu:

```text
PASSWORD_EMPTY
```

kiểm tra `.env`, sau đó:

```bash
docker compose down
docker compose up -d --build
```

Nếu:

```text
PASSWORD_SET
```

nhưng Gmail vẫn báo `535`, kiểm tra lại Google App Password.

## `451 4.3.5 Unable to process mail`

Kiểm tra Mailpit:

```bash
docker logs restaurant-mailpit --tail 100
```

và notification:

```bash
docker exec restaurant-db psql -U postgres -d restaurant_db -c "SELECT id, dat_ban_id, loai, email, trang_thai, so_lan_thu, lan_tiep_theo_at, da_gui_at, loi_cuoi FROM thong_bao ORDER BY id DESC LIMIT 10;"
```

---

# 15. Quy trình demo nhanh sau khi pull

```bash
cd /c/Workspaces/restaurant-system

git checkout feature/s2-09
git pull origin feature/s2-09

docker compose down
docker compose build --no-cache
docker compose up -d

docker compose ps
```

Nếu là máy mới và chưa có `.env`:

```bash
cp .env.example .env
```

Sau đó cấu hình `.env` rồi chạy Docker.

Demo:

1. Mở `http://localhost:5173`.
2. Tạo booking.
3. Nhập email khách.
4. Kiểm tra mã booking.
5. Mở `http://localhost:8025`.
6. Kiểm tra email xác nhận.
7. Nếu đã cấu hình Gmail App Password, kiểm tra hộp thư người nhận.
8. Vào chi tiết booking để xem trạng thái email.
9. Thử hủy/từ chối booking và kiểm tra email hủy.

---

# 16. Đẩy branch đang làm việc lên GitHub

Kiểm tra:

```bash
git branch --show-current
git status
```

Ví dụ:

```text
feature/s2-09
```

## Chỉ push README

```bash
git add README_S2-09_DOCKER.md
git commit -m "docs: add Docker and S2-09 setup guide"
git push -u origin feature/s2-09
```

## Push toàn bộ thay đổi đã kiểm tra

```bash
git status
git add .
git status
git commit -m "feat: complete S2-09 booking email"
git push -u origin feature/s2-09
```

Những lần sau:

```bash
git add .
git commit -m "mô tả thay đổi"
git push
```

---

# 17. Kiểm tra `.env` trước khi push

Chạy:

```bash
git status --short
git check-ignore -v .env
```

`.env` phải được Git ignore.

Nếu `.env` xuất hiện trong danh sách file chuẩn bị commit:

**Dừng lại và không push.**

Tuyệt đối không commit:

```text
SMTP_RELAY_PASSWORD=<GOOGLE_APP_PASSWORD>
```

hoặc các secret/token thật.

File `.env.example` mới là file mẫu được commit để các thành viên khác có thể tạo `.env` local.

---

# 18. Quy trình chuẩn cho thành viên mới

```text
Clone repository
       ↓
git checkout branch cần làm
       ↓
cp .env.example .env
       ↓
Sửa .env local
       ↓
docker compose down
       ↓
docker compose build --no-cache
       ↓
docker compose up -d
       ↓
docker compose ps
       ↓
Mở http://localhost:5173
```

---

# 19. Quy trình chuẩn khi đã có project

```text
git checkout branch
       ↓
git pull
       ↓
docker compose down
       ↓
docker compose build --no-cache
       ↓
docker compose up -d
       ↓
docker compose ps
```

Nếu chỉ sửa `.env`:

```text
Sửa .env
   ↓
docker compose down
   ↓
docker compose up -d --build
```

---

# 20. Cổng local

| Thành phần | URL / Port |
|---|---|
| Frontend | http://localhost:5173 |
| Backend | http://localhost:8000 |
| Mailpit Web UI | http://localhost:8025 |
| Mailpit SMTP | localhost:1025 |
| PostgreSQL host | localhost:5433 |
| PostgreSQL trong Docker | db:5432 |
