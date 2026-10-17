// Selectors are maintained in code. Model output cannot provide selectors/actions.
const DETAILS = {
  'order-entry': [
    ['order-table', 'Chọn bàn đang phục vụ', 'Chỉ bàn đã nhận khách mới xuất hiện. Nếu chưa có bàn, kiểm tra Sơ đồ bàn trước.'],
    ['order-menu', 'Chọn món', 'Tìm món đang bán, chọn số lượng và thêm vào đơn.'],
    ['order-cart', 'Kiểm tra đơn mới', 'Đối chiếu số lượng, ghi chú với khách trước khi tự gửi xuống bếp.'],
  ],
  kitchen: [
    ['kitchen-heading', 'Kiểm tra kết nối', 'Đọc trạng thái kết nối trước khi xử lý phiếu món.'],
    ['kitchen-work', 'Phiếu món cần làm', 'Kiểm tra bàn và ghi chú; bắt đầu chế biến, rồi xác nhận hoàn thành khi món đã xong. Nếu chưa có phiếu, màn hình hiển thị trạng thái trống.'],
    ['kitchen-ready', 'Món đã hoàn thành', 'Khu vực này dành cho món chờ phục vụ mang ra.'],
  ],
  'service-orders': [
    ['service-ready', 'Món chờ mang ra', 'Kiểm tra đúng bàn, món và số lượng; chỉ xác nhận đã phục vụ sau khi giao món.'],
    ['service-history', 'Theo dõi phiên bàn', 'Đối chiếu trạng thái món theo bàn. Thu ngân chốt hóa đơn trước khi kết thúc phục vụ.'],
  ],
  'daily-menu': [
    ['daily-summary', 'Tình trạng nguyên liệu', 'Xem tổng số món và số món đang tạm hết.'],
    ['daily-search', 'Tìm món cần cập nhật', 'Tìm tên món, mở nhóm rồi tự kiểm tra trạng thái trước khi thay đổi.'],
  ],
  reports: [
    ['dish-filters', 'Chọn khoảng báo cáo', 'Chọn ngày, cách xếp hạng rồi bấm Xem báo cáo.'],
    ['dish-export', 'Xuất CSV', 'Tải kết quả đang xem để mở bằng Excel. Nút chỉ sẵn sàng sau khi có dữ liệu.'],
  ],
  'revenue-report': [
    ['revenue-filters', 'Chọn khoảng ngày', 'Chọn tối đa 92 ngày rồi bấm Xem báo cáo.'],
    ['revenue-results', 'Đọc số liệu', 'Doanh thu dựa trên hóa đơn đã chốt. Lượt khách chỉ tính đặt bàn đã check-in; nếu chưa tải được dữ liệu hãy đóng hướng dẫn và thử tải lại.'],
  ],
  checkout: [
    ['billing-modes', 'Chọn danh sách thanh toán', 'Chọn Bàn chờ thanh toán, rồi chọn phiên bàn cần kiểm tra.'],
    ['billing-content', 'Đối chiếu hóa đơn', 'Kiểm tra món, giảm giá và phương thức. Bạn tự xác nhận sau khi đã thực nhận tiền; trợ lý không bấm chốt thay bạn.'],
  ],
  invoices: [
    ['billing-modes', 'Tra cứu hóa đơn', 'Mở danh sách hóa đơn đã phát hành.'],
    ['billing-content', 'Xem và in', 'Chọn biểu tượng in của hóa đơn; kiểm tra bản chi tiết trước khi in hoặc lưu PDF.'],
  ],
  'shift-close': [
    ['shift-heading', 'Đối chiếu ca', 'Làm mới để kiểm tra số liệu ca trước khi nhập số tiền thực đếm.'],
    ['shift-content', 'Kiểm tra và xác nhận', 'Đếm tiền, đối chiếu chênh lệch, nhập giải trình khi cần. Bạn tự bấm Chốt ca sau khi kiểm tra.'],
  ],
}

export function buildTour(guide) {
  if (!guide?.page || !/^[a-z-]+$/.test(guide.page)) return []
  return [
    { selector: `[data-assistant-nav="${guide.page}"]`, title: guide.title,
      description: 'Đây là mục tương ứng trong menu của bạn. Có thể đóng hướng dẫn bất cứ lúc nào.' },
    ...(DETAILS[guide.page] || []).map(([id, title, description]) => ({ selector: `[data-tour="${id}"]`, title, description })),
    { selector: `[data-assistant-page="${guide.page}"][data-assistant-ready="true"]`,
      title: 'Các bước cần thực hiện', description: guide.steps.join('\n') },
  ]
}

export function chatHistory(messages) {
  return messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-8)
    .map(m => ({ role: m.role, content: String(m.content || '').slice(0, 1500) }))
}

export function vietnamToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now)
  const get = type => parts.find(p => p.type === type).value
  return `${get('year')}-${get('month')}-${get('day')}`
}
