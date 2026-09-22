\# 🍽️ Restaurant Management System



Hệ thống quản lý nhà hàng được phát triển theo mô hình \*\*Frontend + Backend API\*\*, phục vụ việc quản lý nhà hàng, đặt bàn, khách hàng, bàn ăn và các chức năng liên quan.



Project được tổ chức để các thành viên trong nhóm có thể \*\*clone repository, cài đặt môi trường và bắt đầu phát triển ngay\*\*.



\---



\## 📌 1. Tech Stack



\### Backend



\- Python

\- FastAPI

\- Uvicorn

\- SQLAlchemy

\- PostgreSQL

\- Alembic

\- Pydantic

\- JWT

\- WebSocket



\### Frontend



\- React

\- Vite

\- Ant Design

\- Axios

\- React Router



\### Development Tools



\- Git

\- GitHub

\- Visual Studio Code

\- PostgreSQL



\---



\# 📁 2. Cấu trúc project



```text

restaurant-system/

│

├── backend/

│   ├── app/

│   │   ├── models/

│   │   ├── schemas/

│   │   ├── routers/

│   │   ├── services/

│   │   ├── core/

│   │   │   ├── config.py

│   │   │   └── security.py

│   │   ├── database/

│   │   │   └── session.py

│   │   ├── \_\_init\_\_.py

│   │   └── main.py

│   │

│   ├── alembic/

│   ├── alembic.ini

│   ├── requirements.txt

│   └── .env.example

│

├── frontend/

│   ├── src/

│   │   ├── pages/

│   │   ├── components/

│   │   ├── layouts/

│   │   ├── services/

│   │   ├── hooks/

│   │   └── routes/

│   │

│   ├── public/

│   ├── package.json

│   ├── package-lock.json

│   └── .env.example

│

├── .gitignore

└── README.md

```



\---



\# 💻 3. Yêu cầu môi trường



Trước khi clone project, cần cài các phần mềm:



| Công cụ | Phiên bản đề nghị |

|---|---|

| Python | 3.10+ |

| Node.js | 18+ |

| npm | Đi kèm Node.js |

| Git | Phiên bản mới |

| PostgreSQL | 14+ |

| VS Code | Khuyến nghị |



Kiểm tra sau khi cài:



```powershell

python --version

```



```powershell

node --version

```



```powershell

npm --version

```



```powershell

git --version

```



```powershell

psql --version

```



\---



\# 🚀 4. Clone project



Clone repository:



```powershell

git clone <GITHUB\_REPOSITORY\_URL>

```



Ví dụ:



```powershell

git clone https://github.com/USERNAME/restaurant-system.git

```



Di chuyển vào project:



```powershell

cd restaurant-system

```



Kiểm tra:



```powershell

git status

```



\---



\# ⚙️ 5. Cài đặt Backend



Di chuyển vào Backend:



```powershell

cd backend

```



\## 5.1. Tạo Python Virtual Environment



```powershell

python -m venv venv

```



Kích hoạt môi trường ảo:



```powershell

.\\venv\\Scripts\\Activate.ps1

```



Nếu thành công, terminal sẽ hiển thị:



```text

(venv)

```



ở đầu dòng.



\### Nếu PowerShell không cho phép chạy script



Chạy:



```powershell

Set-ExecutionPolicy -Scope CurrentUser RemoteSigned

```



Sau đó kích hoạt lại:



```powershell

.\\venv\\Scripts\\Activate.ps1

```



\---



\# 📦 6. Cài thư viện Backend



Sau khi kích hoạt `venv`:



```powershell

pip install -r requirements.txt

```



Kiểm tra:



```powershell

pip list

```



Các thư viện chính:



```text

FastAPI

Uvicorn

SQLAlchemy

Alembic

PostgreSQL Driver

Pydantic

JWT

WebSocket

```



\---



\# 🔐 7. Cấu hình Backend



Project không lưu `.env` thật trên GitHub để tránh lộ thông tin nhạy cảm.



Repository chỉ chứa:



```text

.env.example

```



Tạo `.env` từ file mẫu:



```powershell

Copy-Item .env.example .env

```



Mở file:



```powershell

notepad .env

```



Cấu hình:



```env

PROJECT\_NAME="Restaurant Management System"



DATABASE\_URL="postgresql://user:password@localhost:5432/restaurant\_db"



SECRET\_KEY="change-this-secret-key"



ALGORITHM="HS256"



ACCESS\_TOKEN\_EXPIRE\_MINUTES=480

```



> Mỗi thành viên sử dụng `.env` riêng trên máy của mình.



\*\*Không commit `.env` lên GitHub.\*\*



\---



\# 🗄️ 8. Cấu hình PostgreSQL



Tạo database:



```text

restaurant\_db

```



Ví dụ thông tin kết nối:



```text

Host: localhost

Port: 5432

Database: restaurant\_db

Username: postgres

Password: <your-password>

```



Sau đó cập nhật:



```env

DATABASE\_URL="postgresql://postgres:<your-password>@localhost:5432/restaurant\_db"

```



Ví dụ:



```env

DATABASE\_URL="postgresql://postgres:123456@localhost:5432/restaurant\_db"

```



> Không sử dụng mật khẩu ví dụ này cho môi trường thật.



\---



\# 🧱 9. Database Migration với Alembic



Nếu project đã có:



```text

backend/alembic/

backend/alembic.ini

```



thì không cần chạy lại:



```powershell

alembic init alembic

```



Khi project có migration mới, chạy:



```powershell

alembic upgrade head

```



Để tạo migration mới:



```powershell

alembic revision --autogenerate -m "description"

```



Sau đó:



```powershell

alembic upgrade head

```



\---



\# ▶️ 10. Chạy Backend



Đảm bảo đang ở:



```text

restaurant-system/backend

```



và `venv` đã được kích hoạt.



Chạy:



```powershell

uvicorn app.main:app --reload

```



Backend mặc định:



```text

http://localhost:8000

```



\---



\## 🔎 10.1. Kiểm tra Backend



Mở trình duyệt:



```text

http://localhost:8000

```



API Docs:



```text

http://localhost:8000/docs

```



Health check:



```text

http://localhost:8000/api/health

```



Nếu API hoạt động bình thường:



```json

{

&#x20;   "status": "ok"

}

```



\---



\# 🎨 11. Cài đặt Frontend



Mở \*\*PowerShell mới\*\*.



Di chuyển đến Frontend:



```powershell

cd restaurant-system\\frontend

```



Cài dependencies:



```powershell

npm install

```



Nếu cần cài lại các thư viện chính:



```powershell

npm install antd @ant-design/icons axios react-router-dom

```



\---



\# 🔐 12. Cấu hình Frontend



Tạo `.env`:



```powershell

Copy-Item .env.example .env

```



File `.env`:



```env

VITE\_API\_BASE\_URL=http://localhost:8000

VITE\_WS\_BASE\_URL=ws://localhost:8000

```



Không commit `.env`.



\---



\# ▶️ 13. Chạy Frontend



Trong thư mục:



```text

restaurant-system/frontend

```



chạy:



```powershell

npm run dev

```



Frontend mặc định:



```text

http://localhost:5173

```



Mở trình duyệt:



```text

http://localhost:5173

```



\---



\# 🔄 14. Chạy toàn bộ hệ thống



Cần mở \*\*2 terminal\*\*.



\## Terminal 1 — Backend



```powershell

cd restaurant-system\\backend



.\\venv\\Scripts\\Activate.ps1



uvicorn app.main:app --reload

```



Backend:



```text

http://localhost:8000

```



Swagger:



```text

http://localhost:8000/docs

```



\---



\## Terminal 2 — Frontend



```powershell

cd restaurant-system\\frontend



npm run dev

```



Frontend:



```text

http://localhost:5173

```



\---



\# 🌿 15. Quy trình Git của nhóm



Không nên phát triển trực tiếp trên branch `main`.



Mỗi thành viên tạo branch riêng cho chức năng mình phụ trách.



\---



\## 15.1. Cập nhật code mới nhất



Trước khi bắt đầu:



```powershell

git checkout main

```



```powershell

git pull origin main

```



\---



\## 15.2. Tạo branch mới



Ví dụ làm chức năng quản lý bàn:



```powershell

git checkout -b feature/table-management

```



Ví dụ làm chức năng đặt bàn:



```powershell

git checkout -b feature/booking

```



Ví dụ sửa lỗi:



```powershell

git checkout -b fix/booking-validation

```



\---



\# 💾 16. Commit code



Kiểm tra file thay đổi:



```powershell

git status

```



Thêm file:



```powershell

git add .

```



Commit:



```powershell

git commit -m "feat

