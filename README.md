# Restaurant Management System — Docker, S2-09 & QR gọi món

README này dành cho thành viên nhóm khi clone/pull project, tạo cấu hình local từ `.env.example`, chạy project bằng Docker và demo các tính năng S2-09:

* Đặt bàn và email xác nhận/hủy.
* Tra cứu/hủy đặt bàn.
* Quét QR tại bàn bằng điện thoại.
* Xem menu và gọi món.
* Theo dõi trạng thái món.
* Bếp nhận và xử lý món.
* Phục vụ theo dõi món theo bàn.

---

# 1. Yêu cầu môi trường

Cần cài:

* Git
* Docker Desktop
* Docker Compose v2

Không cần cài riêng:

* Python
* Node.js
* PostgreSQL

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

Lấy branch cần làm việc, ví dụ:

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

**Không commit file `.env` chứa mật khẩu hoặc secret lên GitHub.**

Project có file:

```text
.env.example
```

Sau khi clone project:

```bash
cd /c/Workspaces/restaurant-system
cp .env.example .env
```

Kiểm tra:

```bash
ls -la .env*
```

Kết quả cần có:

```text
.env
.env.example
```

Sau đó mở `.env`:

```bash
notepad .env
```

Hoặc:

```bash
code .env
```

## 3.1. Nguyên tắc quan trọng

* `.env.example`: file mẫu dùng chung → **được commit**.
* `.env`: cấu hình riêng từng máy → **không commit**.
* Không đưa Gmail password, Google App Password, JWT secret thật hoặc secret khác vào Git.
* Mỗi thành viên có thể có `.env` riêng.

---

# 4. Cấu hình `.env` cho local

Sau khi:

```bash
cp .env.example .env
```

mở:

```bash
notepad .env
```

Các biến quan trọng:

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

> Nếu `.env.example` đã có giá trị mặc định phù hợp thì giữ nguyên.

> **Lưu ý:** `localhost` ở đây phù hợp cho việc chạy/test trên chính laptop. Khi sử dụng QR bằng điện thoại, xem mục **15 — Quét QR bằng điện thoại qua mạng LAN**.

---

# 5. Cấu hình SMTP cho S2-09

S2-09 sử dụng Mailpit làm SMTP local.

Nếu chỉ cần demo email trong Mailpit, không cần gửi email ra Internet.

Sau khi Docker chạy, mở:

```text
http://localhost:8025
```

Nếu muốn Mailpit chuyển tiếp email tới email thật, cần cấu hình SMTP relay.

Trong `.env`:

```env
SMTP_RELAY_USERNAME=email_cua_ban
SMTP_RELAY_PASSWORD=<GOOGLE_APP_PASSWORD>
```

## Google App Password

`SMTP_RELAY_PASSWORD` phải là **Google App Password**.

Không sử dụng:

* Mật khẩu Gmail thông thường.
* OTP 6 số.
* Mã xác minh.
* Mã dự phòng đăng nhập.

Không gửi App Password cho người khác và không commit vào GitHub.

---

# 6. Pull code khi máy đã clone project

Nếu máy đã có project:

```bash
cd /c/Workspaces/restaurant-system
```

Kiểm tra:

```bash
git branch --show-current
git status
```

Ví dụ:

```bash
git checkout feature/s2-09
git pull origin feature/s2-09
```

Nếu muốn cập nhật `main`:

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

Hoặc stash:

```bash
git stash
git pull
git stash pop
```

---

# 7. Build và chạy Docker

Sau khi clone lần đầu hoặc pull code mới:

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

## Địa chỉ local

Frontend:

```text
http://localhost:5173
```

Backend:

```text
http://localhost:8000
```

Mailpit:

```text
http://localhost:8025
```

---

# 8. Nếu vừa sửa `.env`

Khi sửa `.env`, cần recreate container:

```bash
docker compose down
docker compose up -d --build
```

Nếu muốn build hoàn toàn sạch:

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

Kiểm tra SMTP password mà không in password:

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

Tạo một booking và nhập email người nhận.

Sau khi đặt bàn:

1. Kiểm tra booking đã được tạo.
2. Kiểm tra mã booking.
3. Mở:

```text
http://localhost:8025
```

4. Kiểm tra email xác nhận.
5. Mở email để kiểm tra nội dung.

Mailpit nhận email từ backend qua:

```text
backend → mailpit:1025
```

---

# 11. Demo S2-09 gửi email ra Gmail thật

Nếu `.env` đã cấu hình:

```env
SMTP_RELAY_USERNAME=email_cua_ban
SMTP_RELAY_PASSWORD=<GOOGLE_APP_PASSWORD>
```

Sau khi sửa `.env`:

```bash
docker compose down
docker compose up -d --build
```

Kiểm tra:

```bash
docker exec restaurant-mailpit sh -c 'if [ -n "$MP_SMTP_RELAY_PASSWORD" ]; then echo "PASSWORD_SET"; else echo "PASSWORD_EMPTY"; fi'
```

Tạo booking mới với email người nhận thật.

Kiểm tra:

```bash
docker logs restaurant-mailpit --tail 100
```

Nếu thành công, email sẽ được relay từ Mailpit tới địa chỉ người nhận.

---

# 12. Kiểm tra trạng thái email trong database

Có thể xem notification gần nhất:

```bash
docker exec restaurant-db psql -U postgres -d restaurant_db -c "SELECT id, dat_ban_id, loai, email, trang_thai, so_lan_thu, lan_tiep_theo_at, da_gui_at, loi_cuoi FROM thong_bao ORDER BY id DESC LIMIT 10;"
```

Các trạng thái:

```text
CHO_GUI  = đang chờ gửi
DA_GUI   = gửi thành công
THAT_BAI = gửi thất bại
```

Nếu `THAT_BAI`, kiểm tra:

```text
loi_cuoi
```

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

# 14. S2-09 — Quét QR và gọi món

Tính năng QR cho phép khách:

```text
Quét QR tại bàn
      ↓
Xác định bàn
      ↓
Kiểm tra trạng thái bàn
      ↓
Kiểm tra booking
      ↓
Hiển thị menu
      ↓
Chọn món
      ↓
Xác nhận gọi món
      ↓
Đơn được lưu vào phiên phục vụ
      ↓
Bếp nhận món
      ↓
Bếp cập nhật trạng thái
      ↓
Khách theo dõi trạng thái / ETA
      ↓
Phục vụ theo dõi món theo bàn
```

Khách hàng **không cần đăng nhập** để quét QR.

---

# 15. Quét QR bằng điện thoại qua mạng LAN

## 15.1. Điều kiện

Điện thoại và laptop chạy Docker phải kết nối **cùng một mạng Wi-Fi/LAN**.

Ví dụ laptop có:

```text
IPv4: 192.168.1.171
```

thì điện thoại có thể truy cập:

```text
http://192.168.1.171:5173
```

---

## 15.2. Lấy IP LAN của laptop

Trên Windows:

```bash
ipconfig
```

Tìm adapter Wi-Fi đang sử dụng.

Ví dụ:

```text
Wireless LAN adapter Wi-Fi:

IPv4 Address. . . . . . . . . . . : 192.168.1.171
```

Lấy giá trị IPv4 đó.

**Không hardcode IP này vào source code.**

IP của mỗi thành viên có thể khác nhau.

---

# 16. Kiểm tra điện thoại truy cập được frontend

Trên laptop:

```bash
docker compose ps
```

Frontend phải publish:

```text
0.0.0.0:5173->80/tcp
```

Trên điện thoại mở Chrome:

```text
http://<LAN_IP_CUA_LAPTOP>:5173
```

Ví dụ:

```text
http://192.168.1.171:5173
```

Nếu trang web mở được thì kết nối LAN đã hoạt động.

---

## Nếu điện thoại không mở được

Kiểm tra:

1. Laptop và điện thoại cùng Wi-Fi.
2. Docker Desktop đang chạy.
3. `restaurant-frontend` đang running.
4. Port `5173` đã publish.
5. Windows Firewall không chặn TCP port `5173`.

Không cần mở backend `8000` cho điện thoại khi sử dụng frontend Nginx.

Luồng mạng là:

```text
Điện thoại
    ↓
Laptop:5173
    ↓
Frontend Nginx
    ↓
/api → restaurant-backend:8000
/ws  → restaurant-backend:8000
```

---

# 17. QUAN TRỌNG — Không sinh QR từ localhost

Nếu QR dùng cho điện thoại thì **không nên sinh QR khi trang quản trị đang mở bằng**:

```text
http://localhost:5173
```

Vì khi điện thoại quét QR:

```text
localhost
```

có nghĩa là **chính điện thoại**, không phải laptop.

Kết quả có thể là:

```text
localhost refused to connect
```

---

# 18. Quy trình chuẩn để sinh QR dùng cho điện thoại

## Bước 1 — Lấy IP LAN

```bash
ipconfig
```

Ví dụ:

```text
192.168.1.171
```

## Bước 2 — Mở frontend bằng IP LAN

Trên laptop mở:

```text
http://192.168.1.171:5173
```

**Không dùng:**

```text
http://localhost:5173
```

cho bước sinh QR dùng với điện thoại.

## Bước 3 — Vào Quản lý bàn

Đăng nhập tài khoản quản lý.

Chọn:

```text
Quản lý bàn
```

## Bước 4 — Sinh lại QR

Chọn bàn cần sử dụng.

Bấm:

```text
Sinh lại QR
```

Hệ thống sẽ:

1. Tạo QR token mới.
2. Vô hiệu hóa QR token cũ.
3. Sinh QR mới.
4. QR sử dụng frontend origin hiện tại.

Nếu đang mở:

```text
http://192.168.1.171:5173
```

QR mới sẽ có dạng:

```text
http://192.168.1.171:5173/?qr=<QR_TOKEN>
```

**Không cần sửa IP trong code.**

---

# 19. Thành viên khác có cần sửa code không?

**Không.**

Ví dụ:

Thành viên A:

```text
192.168.1.171
```

Thành viên B:

```text
192.168.1.105
```

Thành viên C:

```text
192.168.1.120
```

Mỗi người chỉ cần:

```text
ipconfig
   ↓
lấy IPv4 Wi-Fi
   ↓
mở http://<IPv4>:5173
   ↓
Quản lý bàn
   ↓
Sinh lại QR
```

Không được sửa source thành:

```text
192.168.1.171
```

và commit lên Git.

---

# 20. Test QR bằng điện thoại

Sau khi sinh QR:

1. Mở Camera hoặc Google Lens.
2. Quét QR.
3. Mở đường dẫn.
4. Hệ thống xác định bàn.
5. Backend kiểm tra trạng thái bàn.
6. Nếu bàn hợp lệ, menu được hiển thị.

---

# 21. Quy tắc booking khi khách quét QR

Hệ thống kiểm tra booking của bàn.

### Bàn đang được sử dụng

Khách không được tự gọi món vào bàn đó.

Hiển thị thông báo yêu cầu liên hệ nhân viên phục vụ.

### Bàn có booking sắp tới

Nếu booking tiếp theo nằm trong khoảng **90 phút**, hệ thống không cho khách sử dụng bàn.

Ví dụ:

```text
Booking: 18:00
Hiện tại: 17:20
Khoảng cách: 40 phút
```

→ Không cho khách sử dụng.

### Booking còn cách trên 90 phút

Nếu booking tiếp theo còn cách trên 90 phút, bàn có thể được sử dụng.

### Bàn không có booking phù hợp

Khách có thể xem menu và gọi món.

---

# 22. Luồng gọi món

Khách:

```text
Menu
 ↓
Chọn món
 ↓
Chọn số lượng
 ↓
Nhập ghi chú nếu cần
 ↓
Xem tổng tiền
 ↓
Xác nhận
```

Sau khi xác nhận:

```text
Customer
   ↓
Backend
   ↓
Phiên phục vụ
   ↓
Đơn gọi món
   ↓
Màn hình Bếp
```

Backend kiểm tra lại dữ liệu trước khi tạo đơn.

Không tin tưởng hoàn toàn dữ liệu từ frontend.

---

# 23. Màn hình Bếp

Nhân viên Bếp đăng nhập.

Mở:

```text
Màn hình bếp
```

Món được hiển thị theo bàn/đợt gọi món.

Trạng thái món:

```text
CHO_BEP
    ↓
DANG_CHE_BIEN
    ↓
DA_XONG
```

Bếp cập nhật trạng thái món.

---

# 24. Màn hình Phục vụ

Nhân viên Phục vụ đăng nhập.

Mở:

```text
Theo dõi món
```

Có thể theo dõi:

```text
Bàn
Món
Số lượng
Ghi chú
Trạng thái
Thời gian dự kiến hoàn thành
```

---

# 25. Khách theo dõi trạng thái món

Sau khi gọi món, khách có thể theo dõi:

```text
Đã gửi bếp
      ↓
Đang chế biến
      ↓
Đã hoàn thành
```

và thời gian dự kiến hoàn thành nếu backend cung cấp.

---

# 26. Sinh lại QR và QR cũ

Khi bấm:

```text
Sinh lại QR
```

QR token mới được tạo.

QR token cũ không còn được sử dụng.

Vì vậy nếu đã in QR cũ và sinh lại QR:

```text
QR cũ → không sử dụng được
QR mới → sử dụng được
```

Sau khi sinh lại QR, phải in/thay QR mới tại bàn.

---

# 27. QR PDF theo khu vực

Có thể tải QR theo khu vực.

Ví dụ:

```text
Khu vực A
├── Bàn A01
├── Bàn A02
└── Bàn A03
```

Khi tải PDF QR để in:

**Phải mở frontend bằng IP LAN trước:**

```text
http://<LAN_IP>:5173
```

sau đó mới tải/sinh PDF QR.

---

# 28. Nếu QR vẫn chứa localhost

Kiểm tra URL trên laptop.

Nếu đang là:

```text
http://localhost:5173
```

hãy mở lại bằng:

```text
http://<LAN_IP>:5173
```

Ví dụ:

```text
http://192.168.1.171:5173
```

Sau đó:

```text
Quản lý bàn
    ↓
Sinh lại QR
```

QR cũ chứa `localhost` sẽ không tự thay đổi.

Phải **sinh lại QR** sau khi chuyển sang LAN URL.

---

# 29. Quy trình đầy đủ cho thành viên mới

```text
Clone repository
       ↓
cp .env.example .env
       ↓
docker compose up -d --build
       ↓
docker compose ps
       ↓
ipconfig
       ↓
Lấy IPv4 Wi-Fi
       ↓
Mở http://<LAN_IP>:5173 trên laptop
       ↓
Mở cùng URL trên điện thoại
       ↓
Kiểm tra frontend hoạt động
       ↓
Đăng nhập quản lý
       ↓
Quản lý bàn
       ↓
Sinh lại QR
       ↓
Quét QR bằng điện thoại
       ↓
Xem menu
       ↓
Gọi món
       ↓
Kiểm tra Bếp
       ↓
Kiểm tra Phục vụ
```

---

# 30. Quy tắc quan trọng về LAN

**Không commit IP LAN cá nhân vào source code.**

Không làm:

```text
192.168.1.171
```

trong:

* React source.
* FastAPI source.
* QR service.
* Dockerfile.
* Docker Compose.
* `.env.example`.

Mỗi máy có IP LAN khác nhau.

Frontend sử dụng origin hiện tại để QR có thể hoạt động trên từng máy.

---

# 31. Nếu IP LAN thay đổi

IP có thể thay đổi khi:

* đổi Wi-Fi;
* router cấp DHCP IP mới;
* đổi mạng;
* đổi máy.

Ví dụ:

```text
Hôm nay:
192.168.1.171

Sau này:
192.168.1.120
```

Không cần sửa source code.

Chỉ cần:

```bash
ipconfig
```

sau đó:

```text
Mở http://<IP_MOI>:5173
        ↓
Quản lý bàn
        ↓
Sinh lại QR
```

QR mới sẽ sử dụng địa chỉ mới.

---

# 32. Quy trình demo QR nhanh

```bash
cd /c/Workspaces/restaurant-system

docker compose ps
```

Lấy IP:

```bash
ipconfig
```

Ví dụ:

```text
192.168.1.171
```

Mở trên laptop:

```text
http://192.168.1.171:5173
```

Mở cùng địa chỉ trên điện thoại:

```text
http://192.168.1.171:5173
```

Nếu điện thoại truy cập được:

```text
Quản lý bàn
    ↓
Sinh lại QR
    ↓
Quét QR
    ↓
Xem menu
    ↓
Gọi món
```

---

# 33. Xử lý lỗi QR

## QR mở `localhost`

Nguyên nhân:

```text
QR được sinh khi frontend đang mở bằng localhost.
```

Cách xử lý:

```text
Mở frontend bằng LAN IP
        ↓
Sinh lại QR
```

---

## Điện thoại không truy cập được `192.168.x.x:5173`

Kiểm tra:

```bash
docker compose ps
```

Kiểm tra laptop:

```bash
ipconfig
```

Kiểm tra:

* cùng Wi-Fi;
* đúng IPv4;
* frontend đang chạy;
* port 5173 đang publish;
* Windows Firewall.

---

## QR báo token không hợp lệ

Có thể QR đã bị regenerate.

Hãy:

```text
Quản lý bàn
    ↓
Sinh lại QR
    ↓
Dùng QR mới
```

---

## QR mở được nhưng không gọi món

Kiểm tra backend:

```bash
docker logs restaurant-backend --tail 200
```

Kiểm tra frontend:

```bash
docker logs restaurant-frontend --tail 200
```

Kiểm tra:

* bàn có tồn tại;
* QR token còn hiệu lực;
* bàn có đang bị booking;
* booking có nằm trong khoảng 90 phút;
* món còn bán;
* phiên phục vụ đã được tạo.

---

# 34. Quy trình demo nhanh S2-09 sau khi pull

```bash
cd /c/Workspaces/restaurant-system

git checkout feature/s2-09
git pull origin feature/s2-09

docker compose down
docker compose build --no-cache
docker compose up -d

docker compose ps
```

Nếu là máy mới:

```bash
cp .env.example .env
```

Sau đó cấu hình `.env`.

Demo email:

```text
http://localhost:5173
        ↓
Tạo booking
        ↓
Kiểm tra booking
        ↓
http://localhost:8025
        ↓
Kiểm tra email
```

Demo QR:

```text
ipconfig
        ↓
Lấy IPv4 Wi-Fi
        ↓
http://<IPv4>:5173
        ↓
Quản lý bàn
        ↓
Sinh lại QR
        ↓
Điện thoại quét QR
        ↓
Gọi món
```

---

# 35. Đẩy branch lên GitHub

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
git commit -m "docs: add Docker S2-09 and QR guide"
git push -u origin feature/s2-09
```

## Push toàn bộ thay đổi đã kiểm tra

```bash
git status
git add .
git status
git commit -m "feat: complete S2-09 QR ordering"
git push -u origin feature/s2-09
```

Những lần sau:

```bash
git add .
git commit -m "mô tả thay đổi"
git push
```

---

# 36. Kiểm tra `.env` trước khi push

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

Chỉ commit:

```text
.env.example
```

---

# 37. Quy trình chuẩn cho thành viên mới

```text
Clone repository
       ↓
git checkout branch cần làm
       ↓
cp .env.example .env
       ↓
Cấu hình .env local
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

Nếu cần test QR bằng điện thoại:

```text
ipconfig
       ↓
Lấy IPv4 Wi-Fi
       ↓
Mở http://<IPv4>:5173
       ↓
Sinh lại QR
       ↓
Điện thoại quét QR
```

---

# 38. Quy trình chuẩn khi đã có project

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

# 39. Cổng local

| Thành phần              | URL / Port             |
| ----------------------- | ---------------------- |
| Frontend                | http://localhost:5173  |
| Frontend LAN            | http://`<LAN_IP>`:5173 |
| Backend                 | http://localhost:8000  |
| Mailpit Web UI          | http://localhost:8025  |
| Mailpit SMTP            | localhost:1025         |
| PostgreSQL host         | localhost:5433         |
| PostgreSQL trong Docker | db:5432                |

---

# 40. Tóm tắt quy tắc QR

> **Muốn QR dùng được trên điện thoại:**

```text
1. Laptop + điện thoại cùng Wi-Fi
2. Lấy IPv4 laptop bằng ipconfig
3. Mở frontend bằng http://<IPv4>:5173
4. Vào Quản lý bàn
5. Sinh lại QR
6. Dùng QR mới
7. Điện thoại quét QR
```

**Không hardcode IP vào source code.**

**Không sinh QR từ `localhost` nếu QR dùng cho điện thoại.**

**Mỗi máy tự sử dụng IP LAN của chính máy đó.**
