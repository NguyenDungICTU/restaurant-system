# Trợ lý Resto — cả 3 phần

Bản thay đổi dựa trên `feature/phan-nhom-menu`, commit `807a360`.
Nhánh triển khai: `feature/tro-ly-ai`. Không đổi schema, không cần migration mới.
File `tro-ly-ai.patch` đầy đủ hiện bao gồm bản nâng cấp **v4**. Nếu đã cài v3,
dùng bản vá nối tiếp `nang-cap-tro-ly-v4.patch` ở cuối hướng dẫn.

## Chức năng đã tích hợp

| Phần | Cách dùng | Phạm vi |
| --- | --- | --- |
| 1. Hỏi đáp | Nút **Trợ lý** → **Hỏi đáp** hoặc **Hướng dẫn** | 19 hướng dẫn tiếng Việt theo vai trò. Các mẫu câu tra cứu thông dụng được xử lý trực tiếp, không cần khóa AI. AI cấu hình riêng hỗ trợ diễn giải hướng dẫn và các câu nằm ngoài mẫu đã hỗ trợ nhưng vẫn trong phạm vi tài liệu. |
| 2. Tra cứu | Gõ câu hỏi hoặc **Tra cứu dữ liệu** → chọn nội dung | Dữ liệu thật, biểu đồ, so sánh, món bán giảm/hủy, thời gian xử lý, khung giờ gửi món; xuất CSV, sao chép và cập nhật. Không dùng mô hình để cộng tiền. |
| 3. Chỉ trên trang | **Hướng dẫn** → **Chỉ trên trang** | Tự mở trang đúng quyền, đánh dấu vị trí và chuyển từng bước. Không tự bấm nút nghiệp vụ hoặc điền biểu mẫu. |

Hướng dẫn chi tiết có điểm đánh dấu riêng cho Gọi món, Bếp, Theo dõi món,
Món trong ngày, Báo cáo món, Doanh thu, Thanh toán, Hóa đơn, Chốt ca.
Các trang còn lại có hướng dẫn menu + vùng nội dung + các bước dạng văn bản.
Nếu thành phần chưa tải được, hướng dẫn thông báo rõ; có thể đóng và thử lại.
Sidebar vẫn giữ nguyên 5 nhóm hiện tại.

| Vai trò | Tra cứu được phép |
| --- | --- |
| Quản lý | Bàn, tiến độ món, doanh thu, top món, phiên cần thu ngân; món bán giảm, món hủy, thời gian xử lý, khung giờ gửi món và kiểm tra AI |
| Phục vụ | Bàn, tiến độ món, thời gian xử lý/mang món; không có giá tiền hoặc doanh thu |
| Bếp | Tiến độ món, thời gian xử lý/mang món; không có giá tiền hoặc doanh thu |
| Thu ngân | Các phiên cần kiểm tra, ca đang mở của chính mình |

**Định nghĩa số liệu:**

- Bàn: chỉ bàn đã cấu hình; danh sách tối đa 20 bàn trống, cần kiểm tra thêm đặt bàn/sức chứa trước khi nhận khách.
- Món: tổng số lượng của phiên đang phục vụ/chờ thanh toán; không tính phiên đã đóng vào tiến độ hiện tại.
- Doanh thu: cộng `tong_thanh_toan` của hóa đơn `DA_CHOT`, loại hóa đơn hủy, đã phản ánh giảm giá.
- Top món: từ 1 đến 10 món theo số lượng (mặc định 10), chỉ món `DA_PHUC_VU` có tính tiền. Thời gian dùng `phuc_vu_at` hoặc `updated_at` như báo cáo món hiện có. Tiền món chưa trừ giảm giá hóa đơn.
- Ca: chỉ ca `DANG_MO` của tài khoản đang đăng nhập; cộng hóa đơn còn hiệu lực, không tự tạo ca nếu thiếu.
- Tra cứu doanh thu/top món nhận tối đa 92 ngày, theo múi giờ Việt Nam. Tra cứu còn lại là trạng thái hiện tại.

## Đưa bản thay đổi về Windows để kiểm thử

Tải `tro-ly-ai.patch` vào thư mục Downloads. Mở Git Bash tại dự án.
Chạy từng khối; nếu có lỗi thì dừng ở khối đó, không bỏ qua lỗi.

```bash
cd ~/OneDrive/Desktop/TTCS/restaurant-system
git status
```

Chỉ tiếp tục khi working tree sạch. Nếu có thay đổi đang làm, giữ lại và xử lý riêng trước.
Các lệnh dưới đây chỉ fetch/chuyển nhánh ở máy bạn, không đẩy gì lên GitHub:

```bash
git fetch origin
git switch -c feature/tro-ly-ai origin/feature/phan-nhom-menu
git branch --unset-upstream
```

Nếu nhánh `feature/tro-ly-ai` đã tồn tại, dùng `git switch feature/tro-ly-ai`
và kiểm tra nhánh có đúng nền menu mới trước khi áp dụng; không tạo lại hoặc reset nhánh đó.

```bash
git apply --check ~/Downloads/tro-ly-ai.patch
git apply ~/Downloads/tro-ly-ai.patch
git status --short
docker compose up -d --build backend frontend
```

Mở `http://localhost:5173`, đăng nhập và bấm **Trợ lý** ở góc phải dưới.
Chưa cần khóa AI để thử hướng dẫn có sẵn, thẻ dữ liệu thật và hướng dẫn trực quan.

## Bật hỏi đáp AI

Sửa file `.env` **ở thư mục gốc dự án** khi chạy Docker Compose. Giữ các cấu hình cũ.
Thêm hoặc cập nhật các dòng sau bằng giá trị thật trên máy của bạn:

```dotenv
AI_ENABLED=true
OPENAI_API_KEY=
AI_MODEL=
AI_TIMEOUT_SECONDS=20
AI_REQUESTS_PER_MINUTE=12
```

Điền khóa vào `OPENAI_API_KEY`, mã model vào `AI_MODEL`. Chọn model trong tài khoản
có hỗ trợ **Responses API** và **Structured Outputs**; adapter không ép một model cụ thể.
Không đưa khóa vào frontend, biến `VITE_*`, commit hay tin nhắn.
Nếu chạy backend trực tiếp bằng uvicorn từ thư mục `backend`, dùng `backend/.env` thay cho `.env` gốc.

Sau khi sửa cấu hình:

```bash
docker compose up -d --build backend
```

Đóng và mở lại bảng Trợ lý để tải trạng thái cấu hình mới.
Nhãn **Đã cấu hình AI** chỉ xác nhận đủ cấu hình bật AI/model/key, không phải kiểm tra khóa còn hiệu lực.
Gửi câu hỏi hướng dẫn như “Làm thế nào xem món bán chạy?” để thử kết nối mô hình.
Các câu tra cứu đã hỗ trợ như “Doanh thu hôm nay là bao nhiêu?” chạy trực tiếp, kể cả khi tắt AI.
Nếu nhà cung cấp lỗi, hết hạn mức hoặc timeout, bảng trả về hướng dẫn có sẵn và thông báo rõ.
Không tự thử lại liên tục và không lộ nội dung lỗi/khóa từ nhà cung cấp.

Tài liệu API dùng để triển khai:

- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/your-data

## Kiểm thử trên máy bạn

1. **Quản lý:** hỏi cách xem báo cáo, thử doanh thu trong khoảng ngày, đối chiếu với Báo cáo doanh thu. Đổi ngày sang khoảng không có hóa đơn: kết quả phải là 0, không bịa số liệu.
2. **Phục vụ:** chỉ thấy tra cứu bàn/món; không có doanh thu. Thử hướng dẫn Gọi món và Theo dõi món.
3. **Bếp:** chỉ thấy tra cứu tiến độ món; thử hướng dẫn bếp khi có và khi không có phiếu.
4. **Thu ngân:** đối chiếu ca của chính tài khoản. Hỏi ca trước khi mở ca: trợ lý không tạo ca mới. Chỉ mở Chốt ca khi muốn vào quy trình nghiệp vụ hiện có của trang.
5. **Hướng dẫn trực quan:** bấm tiếp/quay lại/đóng, chuyển trang, thử khi dữ liệu chưa tải được và trên điện thoại.
6. **Phiên đăng nhập:** xóa hội thoại, đăng xuất, đăng nhập tài khoản khác: không được thấy hội thoại trước.
7. **AI:** thử câu hỏi thiếu khoảng ngày, câu hỏi ngoài tài liệu, yêu cầu sửa/hủy dữ liệu, khóa sai hoặc mất mạng. Không có thao tác nghiệp vụ tự động.

Chạy kiểm thử tự động từ gốc dự án (Docker backend đã build):

```bash
docker compose run --rm --no-deps -e DATABASE_URL=sqlite:// -v "$(pwd)/backend/tests:/app/tests:ro" backend sh -c 'pip install pytest httpx httpx2 && python -m pytest tests/test_assistant.py tests/test_assistant_intents.py tests/test_assistant_analytics.py tests/test_revenue_report.py app/tests/test_billing_logic.py app/tests/test_provisional_bill_logic.py tests/test_shift_close_logic.py -q'
```

Lệnh này dùng SQLite trong RAM, không dùng DB nhà hàng. `httpx2` hỗ trợ bản Starlette mới;
không cần thêm thư viện AI vào backend vì adapter dùng thư viện chuẩn Python.
Nếu Git Bash tự đổi đường dẫn mount Docker trên Windows, chạy cùng lệnh với
`MSYS_NO_PATHCONV=1` trước `docker compose run`.

Kiểm thử frontend (cần Node/npm trên máy):

```bash
cd frontend
npm ci
npm test
npm run build
npx eslint src/components/AssistantWidget.jsx src/components/AssistantDataCard.jsx src/utils/assistantTours.js src/utils/assistantReports.js src/services/assistantApi.js
```

## Thiết kế và giới hạn

- `GET /api/assistant/catalog` và `POST /api/assistant/chat` dùng phiên đăng nhập hiện có. Vai trò lấy từ máy chủ, không nhận vai trò do client truyền lên.
- Tri thức nằm trong `backend/app/services/assistant_knowledge.py`, có phiên bản và quyền cho từng hướng dẫn. Cần cập nhật khi quy trình hoặc menu thay đổi.
- Mô hình nhận câu hỏi, tối đa 8 tin nhắn ngắn, trang hiện tại, tài liệu và danh sách loại tra cứu được cấp quyền. Không gửi token đăng nhập, khóa DB, số điện thoại khách hay bản ghi nghiệp vụ vào context.
- Người dùng có thể tự nhập thông tin riêng tư vào câu hỏi; không làm vậy vì câu hỏi/lịch sử được gửi đến nhà cung cấp khi bật AI.
- Kết quả chọn tra cứu được kiểm tra lại trên server; không có tool viết SQL, sửa dữ liệu hay gọi URL do AI tạo. Truy vấn riêng dùng SELECT; PostgreSQL còn đặt transaction chỉ đọc và giới hạn statement 5 giây.
- Auth hiện có vẫn cập nhật thời hạn phiên đăng nhập như các API khác. Khi tự mở một trang nghiệp vụ, hành vi vốn có của trang đó vẫn chạy; ví dụ trang Chốt ca có thể tạo ca theo cơ chế cũ. Đây là khác biệt với hỏi “ca của tôi” trong trợ lý.
- Kết quả số liệu và nhận xét được tính trực tiếp từ truy vấn, không gửi ngược sang mô hình để diễn giải, không cache dùng chung giữa nhân viên. Header API đặt `Cache-Control: no-store`. Các mẫu tra cứu có thể xử lý được chạy trước nhà cung cấp AI.
- Hội thoại chỉ ở bộ nhớ tab, tối đa 20 tin nhắn; xóa khi đổi người/vai trò hoặc hết phiên. Không lưu bảng chat mới, không ghi câu hỏi thô vào log.
- Request nhà cung cấp có `store=false`; điều này không đồng nghĩa mọi chính sách lưu dữ liệu của nhà cung cấp đều bị tắt. Xem tài liệu Your data trước khi triển khai thực tế.
- Giới hạn mặc định 12 yêu cầu/phút/người và 4 lần gọi mô hình đồng thời, áp dụng **mỗi process**. Khi chạy nhiều worker/replica cần limiter dùng chung, ví dụ Redis.
- AI có thể diễn giải sai dù có nguồn. Các bước và nút điều hướng lấy từ danh sách đã biên soạn; người dùng tự kiểm tra và xác nhận thao tác.

## Kết quả kiểm tra của bản bàn giao

- Backend: **124 kiểm thử đạt** cho assistant, xử lý câu hỏi/ngày tháng và logic hóa đơn/báo cáo/chốt ca dùng SQLite mẫu và mock Responses API; không tốn phí API.
- Frontend: **37 kiểm thử đạt**, build production và ESLint mã trợ lý mới đạt.
- Chromium: đã thử chat gợi ý + nhập câu hỏi + Enter, dữ liệu qua API trợ lý thật với SQLite mẫu, đi hết tour báo cáo, xóa lịch sử và sự kiện kết thúc phiên. Đã thử màn hình 390px cho phục vụ/bếp/thu ngân, giới hạn công cụ theo quyền, doanh thu ca riêng; không có lỗi JavaScript hoặc request ghi nghiệp vụ trong các luồng này. Các API trang nghiệp vụ bên ngoài trợ lý được mô phỏng để cô lập kiểm tra UI.
- Các trang cũ còn lỗi lint có sẵn; bản thay đổi chỉ thêm điểm đánh dấu và không tăng lỗi so với nền `807a360`.
- Build vẫn cảnh báo bundle chính trên 500 kB; trợ lý được tách thành chunk riêng.
- Chưa kiểm thử gọi OpenAI thật do chưa có khóa/model của bạn; cần hoàn tất bước Bật hỏi đáp AI trên máy.
- Chưa kiểm thử trên PostgreSQL/Docker thực tế của bạn. Nên đối chiếu các thẻ với báo cáo gốc trước khi dùng chính thức.

Bản thay đổi chưa commit và chưa push. Chỉ thực hiện các bước đó sau khi bạn đã kiểm thử và yêu cầu.

## Sửa phạm vi câu hỏi — phiên bản tri thức 2026-10-15.2

Bản đầu đã ghép nhầm câu hỏi thời tiết và lô đề với hướng dẫn trang. Bộ tìm kiếm
mới yêu cầu cụm từ chức năng có nghĩa; trang hiện tại chỉ giúp xếp hạng sau khi
câu hỏi đã liên quan. Các từ chung như “xem”, “hôm nay” không đủ để chọn hướng dẫn.
Câu hỏi chưa nhận diện được chức năng/quyền hoặc thuộc các chủ đề ngoài phạm vi
được trả nhãn **Phạm vi hỗ trợ**, không kèm nguồn, nút điều hướng hay dữ liệu.
Kiểm tra này chạy trước nhà cung cấp AI và truy vấn dữ liệu, kể cả khi chưa bật AI.
Với câu hỏi mơ hồ, người dùng cần nói rõ chức năng hoặc chọn tab Hướng dẫn.
Các câu nối ngắn như “Còn hôm qua?” chỉ dùng lại chủ đề người dùng vừa hỏi nếu
chủ đề đó còn thuộc quyền của tài khoản; câu hỏi ngoài phạm vi không kế thừa quyền từ lịch sử.

Nếu đang dùng v1, tải `fix-pham-vi-tro-ly.patch` vào Downloads và chạy các lệnh
dưới đây trên nhánh `feature/tro-ly-ai` để cập nhật lên v2 trước khi áp dụng v3.
Không áp dụng lại bản sửa v2 lên code v3:

```bash
git apply --check ~/Downloads/fix-pham-vi-tro-ly.patch && git apply ~/Downloads/fix-pham-vi-tro-ly.patch
docker compose up -d --build backend frontend
```

Nhấn Ctrl + F5, xóa hội thoại cũ và gửi lại từng câu:

| Câu hỏi | Kết quả |
| --- | --- |
| cho tôi xem thời tiết hôm nay | Phạm vi hỗ trợ; không có hướng dẫn/số liệu |
| nay đề về bao nhiêu | Phạm vi hỗ trợ; không có hướng dẫn/số liệu |
| Thủ đô của Pháp là gì? | Phạm vi hỗ trợ; không có hướng dẫn/số liệu |
| Cách xem báo cáo món ăn? (quản lý) | Hướng dẫn báo cáo món ăn |
| Cách gọi món? (phục vụ) | Hướng dẫn gọi món |
| Hướng dẫn sử dụng trang này | Hướng dẫn trang hiện tại nếu có tài liệu và đúng quyền |

Bộ lọc dựa trên cụm từ được biên soạn, không phải bộ phân loại ngữ nghĩa hoàn hảo.
Khi người dùng dùng cách diễn đạt mới, có thể cần bổ sung cụm từ và kiểm thử hồi quy.

## Nâng cấp v3 — hỏi số liệu, so sánh và xuất báo cáo

Không cần khóa AI để dùng các câu thông dụng sau (có dấu hoặc không dấu):

| Vai trò | Ví dụ |
| --- | --- |
| Quản lý | Doanh thu hôm nay bao nhiêu? · So sánh doanh thu hôm nay với hôm qua · Món bán chạy 7 ngày qua · Top 5 món hôm nay · Bàn nào còn trống? |
| Phục vụ | Bàn nào còn trống? · Có bao nhiêu món chờ mang ra? · Tiến độ món hiện tại |
| Bếp | Có bao nhiêu món chờ bếp? · Có bao nhiêu món đang chế biến? · Món nào đã xong? |
| Thu ngân | Bàn nào đang chờ thanh toán? · Doanh thu ca của tôi · Ca đang mở của tôi |

Sau câu hỏi doanh thu, có thể hỏi tiếp “Còn hôm qua?”. Chủ đề lấy từ câu hỏi
người dùng gần nhất, không lấy quyền từ nội dung mô hình hoặc lịch sử. Server vẫn
kiểm tra vai trò cho mỗi lần tra cứu. Câu hỏi thời tiết/lô đề tiếp tục bị từ chối.

Khoảng ngày hỗ trợ:

- Hôm nay, hôm qua, tuần này, tuần trước, tháng này, tháng trước.
- “7 ngày qua” gồm hôm nay và 6 ngày trước; có thể chọn 1–92 ngày.
- Tuần này tính từ thứ Hai đến hôm nay; tháng này từ ngày 1 đến hôm nay.
- Tháng trước là tháng lịch đầy đủ; “tháng 02/2024” tính đúng ngày nhuận.
- Ngày rõ ràng như `15/10/2026`, `2026-10-15`, hoặc “từ 01/10/2026 đến 15/10/2026”.
- Thiếu ngày/năm, ngày sai, khoảng không được hỗ trợ: hỏi lại, không ngầm đổi thành hôm nay.

So sánh chỉ áp dụng doanh thu, ví dụ “So sánh doanh thu hôm nay với hôm qua”.
Hoặc chọn khoảng ngày và tick **So sánh doanh thu với kỳ liền trước, cùng số ngày**.
“Kỳ liền trước” là đoạn thời gian liên tục kết thúc ngay trước ngày bắt đầu, cùng
số ngày với khoảng đang xem. Hai khoảng chỉ định riêng có số ngày khác nhau sẽ
được ghi chú rõ. Nếu kỳ so sánh bằng 0, không tạo tỷ lệ phần trăm giả.
Ngày hôm nay chưa kết thúc được ghi chú rõ; so sánh tổng tiền chưa chuẩn hóa theo giờ/ngày.

Kết quả có tóm tắt, chỉ số, chênh lệch, biểu đồ từng ngày (bù ngày không giao dịch
bằng 0), bảng chi tiết và thời điểm lấy dữ liệu. Nhận xét chỉ nêu dữ kiện tính được,
không suy đoán nguyên nhân tăng/giảm hoặc dự báo. Bấm **Cập nhật** để lấy lại đúng
phạm vi báo cáo đang xem; kết quả cũ vẫn là ảnh chụp tại thời điểm trước đó.
Tiến độ món kèm danh sách tối đa 20 dòng món chưa phục vụ, có mã bàn, tên món,
số lượng và trạng thái; ưu tiên món chờ mang ra. Không trả giá tiền cho bếp/phục vụ.

**Xuất CSV** tải đúng kết quả đang xem, có BOM để đọc tiếng Việt trên Excel,
kèm khoảng ngày, chỉ số, bảng, kỳ so sánh và ghi chú. Các ô văn bản có thể bị
diễn giải thành công thức được vô hiệu hóa. Danh sách bàn/phiên vẫn giới hạn 20
dòng như API và Top món tối đa 10; CSV không phải bản xuất toàn bộ CSDL.
**Sao chép** lấy bản tóm tắt bằng văn bản.

Áp dụng trên máy đã có bản v2 (bản sửa phạm vi câu hỏi): tải
`nang-cap-tro-ly-v3.patch` vào Downloads, chạy tại dự án trên nhánh `feature/tro-ly-ai`:

```bash
git apply --check ~/Downloads/nang-cap-tro-ly-v3.patch && git apply ~/Downloads/nang-cap-tro-ly-v3.patch
docker compose up -d --build backend frontend
```

Nhấn Ctrl + F5, xóa hội thoại cũ, thử các câu mẫu theo vai trò, so sánh với trang
báo cáo gốc và tải CSV. Bản vá không có migration hoặc thư viện production mới.
Chưa commit/push, chưa gọi mô hình AI thật hoặc kiểm thử PostgreSQL/Docker trên máy bạn.

## Nâng cấp v4 — hội thoại có ngữ cảnh và phân tích vận hành

Bản này nâng phần hiểu câu hỏi và phân tích, chưa bổ sung PDF/Excel mới.

### Hội thoại nhiều lượt

Thử liên tiếp với tài khoản quản lý:

1. “Doanh thu tuần này”.
2. “So với tuần trước?”.
3. “Còn món nào giảm mạnh?”.
4. “Món bị hủy nhiều?”.
5. “Thời gian xử lý món?”.

Thanh **Đang xem** hiển thị loại phân tích và khoảng ngày đang áp dụng. Mỗi câu
đổi chỉ số mà không đổi ngày sẽ dùng lại khoảng đang xem; phân tích món giảm
cũng giữ kỳ so sánh doanh thu nếu phù hợp. Câu ghi ngày mới sẽ đổi khoảng ngày.
Mỗi kết quả vẫn ghi rõ phạm vi thực tế, kỳ so sánh và thời điểm lấy dữ liệu.
Nếu chỉ hỏi “Thời gian xử lý món?” khi chưa có ngày, trợ lý nhớ loại phân tích
đang chờ và hỏi lại; trả lời ngắn “Hôm nay” sẽ hoàn tất yêu cầu đó.

**Xóa ngữ cảnh** bỏ bộ lọc và ngừng khôi phục ngày từ lịch sử cũ. Sau đó hỏi
“Doanh thu bao nhiêu?” phải được hỏi lại ngày. Xóa hội thoại, đăng xuất, đổi tài
khoản/vai trò hoặc tải lại trang cũng xóa ngữ cảnh. Không có bảng chat/migration mới.
Client gửi bộ lọc có cấu trúc, không gửi quyền; server luôn kiểm tra quyền và khoảng ngày lại.

### Các phân tích bổ sung

| Phân tích | Cách tính và giới hạn |
| --- | --- |
| Món giảm số lượng bán | So số lượng món đã phục vụ có tính tiền giữa hai kỳ. Bao gồm món kỳ trước có bán nhưng kỳ này bằng 0; xếp giảm tuyệt đối lớn nhất trước, tối đa 10 món. Không coi thiếu doanh số kỳ trước là bằng chứng suy giảm. |
| Món bị hủy | Cộng số lượng và số dòng theo thời điểm hủy, dùng updated_at nếu thiếu mốc hủy. Không bịa tỷ lệ hủy hoặc số tiền thiệt hại khi chưa có mẫu số/chi phí phù hợp. |
| Thời gian xử lý/mang món | Tiếp nhận → hoàn thành gồm cả chờ bếp và chế biến; hoàn thành → phục vụ phản ánh đoạn chờ mang ra. Trung bình theo dòng, không nhân số lượng; mỗi đoạn lọc theo ngày kết thúc riêng. Mốc thiếu/sai/âm bị loại và thống kê riêng, giá trị trung bình thiếu trả null. |
| Khung giờ tiếp nhận món | Đếm phiên có món gửi theo từng giờ Việt Nam, mỗi phiên chỉ một lần trong cùng giờ, gồm cả dòng sau đó bị hủy. Đây là hoạt động gọi món, không phải đếm số khách vào quán. |

Quản lý được xem cả bốn phân tích. Phục vụ/bếp chỉ thêm phân tích thời gian
không có giá tiền; thu ngân giữ tra cứu phiên bàn và ca riêng. Truy vấn phân tích
chỉ dùng SELECT trong transaction chỉ đọc trên PostgreSQL. Khoảng ngày tối đa 92,
danh sách xếp hạng tối đa 10; ngày hôm nay chưa kết thúc được ghi chú rõ.
CSV và sao chép giữ cả kỳ so sánh số lượng và trạng thái **Chưa đủ dữ liệu**,
không đổi thiếu thời gian thành 0 phút.

Nhận xét chỉ nêu số liệu có thể kiểm chứng. Hỏi “Vì sao giảm?” không được kết
luận do thời tiết, nhân sự hay thị trường khi DB chưa có bằng chứng. Cần đối
chiếu nhật ký nghiệp vụ/thông tin thực tế; bản này không dự báo doanh thu hay tính lợi nhuận.

### Hiểu câu hỏi bằng mô hình AI

- Các mẫu trên và ngữ cảnh thông dụng hoạt động không cần khóa AI.
- Khi bật AI, các câu diễn đạt khác được gửi tới Responses API để phân loại thành hướng dẫn, kế hoạch tra cứu, câu hỏi làm rõ hoặc ngoài phạm vi.
- Mô hình chỉ chọn loại truy vấn, ngày, kỳ so sánh và giới hạn trong danh sách server cho phép. Không thực thi SQL, URL hoặc thao tác ghi do mô hình sinh.
- Server tự tính số liệu/nhận xét và trình bày; không dùng câu trả lời số học của mô hình làm kết quả. Không gửi bảng số liệu, token đăng nhập, khóa API hoặc thông tin khách hàng vào context mô hình.
- AI có thể hiểu sai câu/ngày hoặc từ chối nhầm. Người dùng cần kiểm tra thanh ngữ cảnh, kỳ so sánh và số liệu; không cam kết hiểu chính xác mọi cách nói.

Bật AI trong `.env` gốc khi chạy Docker như phần cấu hình ở trên, với
`AI_ENABLED=true`, `OPENAI_API_KEY` và `AI_MODEL` hỗ trợ Responses + Structured Outputs.
Giữ khóa trên backend và khởi động lại backend. Mở lại bảng trợ lý sau khi đổi cấu hình.

Quản lý có nút **Kiểm tra AI**. Khi chưa cấu hình đủ, nút chỉ trả thông báo và
không gọi nhà cung cấp. Khi đã cấu hình, mỗi lần bấm gửi một request kiểm tra nhỏ
không có dữ liệu nghiệp vụ; request này có thể được tính phí theo tài khoản API.
Kết quả thành công xác nhận đã nhận/kiểm tra được phản hồi có cấu trúc, không đảm bảo
độ chính xác mọi câu hỏi. Lỗi khóa/model/hạn mức/mạng chỉ trả thông báo an toàn,
không lộ nội dung lỗi gốc hoặc khóa.

Để thử khả năng diễn đạt linh hoạt sau khi kết nối thành công:

1. Hỏi “Doanh thu tuần này” để đặt ngữ cảnh.
2. Hỏi “Mặt hàng nào đang hụt sức tiêu thụ?”; kỳ vọng AI chọn phân tích món giảm và giữ đúng ngày.
3. Hỏi câu ngoài hệ thống; kỳ vọng thông báo phạm vi, không trả kiến thức ngoài chủ đề.
4. Thử tài khoản bếp yêu cầu doanh thu; server phải từ chối dù mô hình chọn nhầm loại dữ liệu.

### Áp dụng bản vá v4 và kiểm thử

Nếu đã cài v3, tải `nang-cap-tro-ly-v4.patch` vào Downloads. Chạy tại dự án
trên nhánh `feature/tro-ly-ai`; nếu báo lỗi thì dừng, không áp dụng cưỡng ép:

```bash
git apply --check ~/Downloads/nang-cap-tro-ly-v4.patch && git apply ~/Downloads/nang-cap-tro-ly-v4.patch
docker compose up -d --build backend frontend
```

Nhấn Ctrl + F5, xóa hội thoại cũ, kiểm tra chuỗi hội thoại và nút xóa ngữ cảnh;
đối chiếu món giảm/hủy với dữ liệu món gốc. Với thời gian thiếu, UI và CSV phải
ghi **Chưa đủ dữ liệu**, không hiển thị 0 phút. Thử lần lượt bếp/phục vụ/thu ngân,
đảm bảo không thấy số liệu tài chính ngoài quyền và không lưu hội thoại của người trước.

Kiểm thử đã thực hiện: 124 kiểm thử backend (SQLite, mô phỏng provider), 37
frontend, ESLint mã mới, build và Chromium desktop/mobile 390px. Trình duyệt đã
thử chuỗi nhiều lượt, xóa ngữ cảnh, CSV/sao chép/cập nhật, phân quyền và kiểm tra
kết nối khi chưa có khóa. Các API trang ngoài trợ lý được mô phỏng để cô lập UI.
Chưa có khóa/model của bạn để gọi AI thật; PostgreSQL/Docker thực tế và chất lượng
hiểu câu hỏi của model bạn chọn cần kiểm thử trên máy trước khi dùng chính thức.
