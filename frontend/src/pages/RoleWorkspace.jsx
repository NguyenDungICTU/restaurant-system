import {
  CheckCircleFilled,
  ClockCircleOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'

import './RoleAccess.css'


const CONTENT = {
  'table-map': {
    kicker: 'PHỤC VỤ',
    title: 'Sơ đồ bàn',
    description: 'Theo dõi nhanh trạng thái bàn để sắp xếp và phục vụ khách.',
    chips: ['Bàn trống', 'Đang phục vụ', 'Đã đặt'],
  },

  bookings: {
    kicker: 'PHỤC VỤ',
    title: 'Danh sách đặt bàn',
    description: 'Xem danh sách khách đã đặt bàn và thời gian dự kiến đến.',
    chips: ['Hôm nay', 'Sắp đến giờ', 'Đã nhận bàn'],
  },

  'order-entry': {
    kicker: 'PHỤC VỤ',
    title: 'Màn hình gọi món',
    description: 'Tạo và cập nhật món gọi cho bàn đang phục vụ.',
    chips: ['Chọn bàn', 'Chọn món', 'Gửi bếp'],
  },

  kitchen: {
    kicker: 'BẾP',
    title: 'Màn hình bếp',
    description: 'Theo dõi món mới, món đang làm và món đã hoàn thành.',
    chips: ['Món mới', 'Đang chế biến', 'Hoàn thành'],
  },

  'daily-menu': {
    kicker: 'BẾP',
    title: 'Danh sách món trong ngày',
    description: 'Xem danh sách món phục vụ trong ca làm việc hiện tại.',
    chips: ['Đang bán', 'Tạm hết', 'Ưu tiên'],
  },

  checkout: {
    kicker: 'THU NGÂN',
    title: 'Thanh toán',
    description: 'Tiếp nhận các bàn cần thanh toán và hoàn tất giao dịch.',
    chips: ['Chờ thanh toán', 'Tiền mặt', 'Chuyển khoản'],
  },

  invoices: {
    kicker: 'THU NGÂN',
    title: 'Hóa đơn',
    description: 'Tra cứu hóa đơn đã phát hành trong ca làm việc.',
    chips: ['Hôm nay', 'Đã thanh toán', 'Tra cứu'],
  },

  'shift-close': {
    kicker: 'THU NGÂN',
    title: 'Chốt ca',
    description: 'Tổng hợp doanh thu và hoàn tất bàn giao cuối ca.',
    chips: ['Doanh thu ca', 'Đối soát', 'Bàn giao'],
  },

  reports: {
    kicker: 'QUẢN LÝ',
    title: 'Báo cáo',
    description: 'Tổng hợp hoạt động và dữ liệu vận hành của nhà hàng.',
    chips: ['Doanh thu', 'Đơn hàng', 'Hiệu suất'],
  },
}


export default function RoleWorkspace({
  page,
}) {
  const data = CONTENT[page]

  if (!data) {
    return null
  }

  return (
    <section className="role-workspace">
      <div className="role-workspace-heading">
        <div>
          <p className="role-eyebrow">
            <SafetyCertificateOutlined />
            {data.kicker}
          </p>

          <h1>{data.title}</h1>

          <p>{data.description}</p>
        </div>

        <div className="server-guard-pill">
          <CheckCircleFilled />
          Đã kiểm tra quyền từ server
        </div>
      </div>

      <div className="role-workspace-grid">
        {data.chips.map((chip, index) => (
          <article
            className="role-workspace-card"
            key={chip}
          >
            <div className="role-workspace-card-number">
              {String(index + 1).padStart(2, '0')}
            </div>

            <strong>{chip}</strong>

            <span>
              <ClockCircleOutlined />
              Sẵn sàng cho nghiệp vụ
            </span>
          </article>
        ))}
      </div>

      <div className="role-access-info">
        <SafetyCertificateOutlined />

        <div>
          <strong>Phân quyền hai lớp</strong>
          <p>
            Menu được ẩn/hiện theo vai trò ở frontend,
            đồng thời API <code>/api/workspace/{page}</code>
            kiểm tra lại quyền ở backend.
          </p>
        </div>
      </div>
    </section>
  )
}
