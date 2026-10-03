Restaurant Management System — Docker & S2-09

1. Mục đích

README này hướng dẫn thành viên nhóm:

Clone project từ GitHub.

Pull code mới khi đã clone.

Build/chạy project bằng Docker Compose.

Build Docker không dùng cache.

Demo S2-09 — Email xác nhận / hủy đặt bàn.

Push branch đang làm việc lên GitHub.

2. Yêu cầu

Cần:

Git

Docker Desktop

Docker Compose v2

Không cần cài riêng Python, Node.js hoặc PostgreSQL.

Kiểm tra:

git --version
docker --version
docker compose version

3. Clone project lần đầu

cd /c/Workspaces
git clone https://github.com/NguyenDungICTU/restaurant-system.git
cd restaurant-system

Kiểm tra:

git status
git branch

Lấy branch S2-09:

git fetch origin
git checkout feature/s2-09

Nếu branch chưa tồn tại local:

git fetch origin
git checkout -b feature/s2-09 origin/feature/s2-09

4. Cấu hình .env

.env chứa cấu hình local và không được commit password/App Password lên GitHub.

Các cấu hình chính:

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

SMTP cho S2-09

Nếu chỉ demo email local, Mailpit chạy tại:

http://localhost:8025

Nếu muốn Mailpit chuyển tiếp email ra Gmail thật:

SMTP_RELAY_USERNAME=vandungx2211@gmail.com
SMTP_RELAY_PASSWORD=<GOOGLE_APP_PASSWORD>

SMTP_RELAY_PASSWORD phải là Google App Password, không phải mật khẩu Gmail thông thường và không phải mã OTP.

Không commit App Password.

5. Pull code nếu máy đã clone

cd /c/Workspaces/restaurant-system
git branch --show-current
git status

Với S2-09:

git checkout feature/s2-09
git pull origin feature/s2-09

Nếu đang có thay đổi local, kiểm tra và commit/stash trước khi pull:

git status

6. Build và chạy Docker không cache

Cách an toàn:

cd /c/Workspaces/restaurant-system

docker compose down
docker compose build --no-cache
docker compose up -d

Kiểm tra:

docker compose ps

Các service cần hoạt động:

restaurant-db — Healthy

restaurant-backend — Healthy

restaurant-frontend — Running

restaurant-mailpit — Running

Mở:

Frontend: http://localhost:5173

Backend: http://localhost:8000

Mailpit: http://localhost:8025

7. Nếu chỉ sửa .env

Không cần build source lại, nhưng cần recreate container để nhận biến môi trường:

docker compose down
docker compose up -d --build

Kiểm tra password SMTP có được truyền vào Mailpit mà không in password:

docker exec restaurant-mailpit sh -c 'if [ -n "$MP_SMTP_RELAY_PASSWORD" ]; then echo "PASSWORD_SET"; else echo "PASSWORD_EMPTY"; fi'

Kết quả mong muốn:

PASSWORD_SET

8. S2-09 — Email xác nhận / hủy đặt bàn

Luồng chính:

Khách tạo booking.

Booking được ghi nhận và vẫn hiển thị mã booking.

Hệ thống tạo email xác nhận.

Worker gửi email.

Nếu gửi thất bại, hệ thống retry theo cấu hình.

Nhân viên xem được trạng thái email trong chi tiết booking.

Khi booking bị hủy/từ chối, hệ thống tạo email hủy kèm lý do.

Cấu hình worker:

NOTIFICATION_WORKER_INTERVAL_SECONDS=10
NOTIFICATION_RETRY_MINUTES=5

9. Demo S2-09 bằng Mailpit

Tạo booking với email test, ví dụ:

dtc245200174@ictu.edu.vn

Sau đó mở:

http://localhost:8025

Mailpit nhận email từ backend qua SMTP nội bộ:

backend → mailpit:1025

Nếu Mailpit có email thì có thể mở email để kiểm tra nội dung.

10. Demo gửi email ra Gmail thật

Trong .env:

SMTP_RELAY_USERNAME=vandungx2211@gmail.com
SMTP_RELAY_PASSWORD=<GOOGLE_APP_PASSWORD>

Sau khi sửa .env:

docker compose down
docker compose up -d --build

Kiểm tra:

docker exec restaurant-mailpit sh -c 'if [ -n "$MP_SMTP_RELAY_PASSWORD" ]; then echo "PASSWORD_SET"; else echo "PASSWORD_EMPTY"; fi'

Tạo booking mới rồi xem:

docker logs restaurant-mailpit --tail 100

Nếu Gmail từ chối xác thực, xem lỗi SMTP trong log. Không chia sẻ App Password.

11. Kiểm tra trạng thái email trong database

docker exec restaurant-db psql -U postgres -d restaurant_db -c "SELECT id, dat_ban_id, loai, email, trang_thai, so_lan_thu, lan_tiep_theo_at, da_gui_at, loi_cuoi FROM thong_bao ORDER BY id DESC LIMIT 10;"

Các trạng thái:

CHO_GUI: đang chờ gửi

DA_GUI: gửi thành công

THAT_BAI: gửi thất bại

Nếu THAT_BAI, xem loi_cuoi.

12. Xem log

Backend:

docker logs restaurant-backend --tail 200

Realtime:

docker logs -f restaurant-backend

Mailpit:

docker logs restaurant-mailpit --tail 200

Username relay:

docker exec restaurant-mailpit env | grep MP_SMTP_RELAY_USERNAME

Không dùng lệnh in toàn bộ environment để chia sẻ log nếu có secret.

13. Lỗi S2-09 thường gặp

535 5.7.8 Username and Password not accepted

Kiểm tra App Password đã được truyền vào container:

docker exec restaurant-mailpit sh -c 'if [ -n "$MP_SMTP_RELAY_PASSWORD" ]; then echo "PASSWORD_SET"; else echo "PASSWORD_EMPTY"; fi'

Nếu PASSWORD_EMPTY:

Kiểm tra .env.

Kiểm tra tên biến SMTP_RELAY_PASSWORD.

Chạy lại:

docker compose down
docker compose up -d --build

Nếu PASSWORD_SET nhưng vẫn lỗi 535, kiểm tra App Password của Google.

451 4.3.5 Unable to process mail

Thường là Mailpit không relay được tới SMTP thật. Kiểm tra:

docker logs restaurant-mailpit --tail 100

và:

docker exec restaurant-db psql -U postgres -d restaurant_db -c "SELECT id, dat_ban_id, loai, email, trang_thai, so_lan_thu, lan_tiep_theo_at, da_gui_at, loi_cuoi FROM thong_bao ORDER BY id DESC LIMIT 10;"

14. Quy trình demo nhanh sau khi pull

cd /c/Workspaces/restaurant-system

git checkout feature/s2-09
git pull origin feature/s2-09

docker compose down
docker compose build --no-cache
docker compose up -d

docker compose ps

Sau đó:

Mở http://localhost:5173.

Tạo booking.

Kiểm tra mã booking.

Mở http://localhost:8025 để xem email.

Nếu đã cấu hình Gmail App Password, kiểm tra hộp thư người nhận.

Vào chi tiết booking để xem trạng thái email.

Thử hủy/từ chối booking và kiểm tra email hủy.

15. Push branch đang làm việc lên GitHub

Kiểm tra branch:

git branch --show-current
git status

Ví dụ branch:

feature/s2-09

Chỉ push README

git add README_S2-09_DOCKER.md
git commit -m "docs: add Docker and S2-09 setup guide"
git push -u origin feature/s2-09

Push toàn bộ thay đổi đã kiểm tra

git status
git add .
git status
git commit -m "feat: complete S2-09 booking email"
git push -u origin feature/s2-09

Các lần sau nếu upstream đã có:

git add .
git commit -m "mô tả thay đổi"
git push

16. Kiểm tra .env trước khi push

git status --short
git check-ignore -v .env

.env không được nằm trong danh sách file commit.

Tuyệt đối không commit:

SMTP_RELAY_PASSWORD=<Google App Password>

17. Cổng local

Thành phần

URL / Port

Frontend

http://localhost:5173

Backend

http://localhost:8000

Mailpit Web UI

http://localhost:8025

Mailpit SMTP

localhost:1025

PostgreSQL host

localhost:5433

PostgreSQL trong Docker

db:5432