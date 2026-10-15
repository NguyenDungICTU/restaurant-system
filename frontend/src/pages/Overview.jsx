import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRightOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  DollarOutlined,
  FileTextOutlined,
  ReloadOutlined,
  TableOutlined,
} from '@ant-design/icons'
import { Alert, Button, ConfigProvider, Empty, Pagination, Skeleton, Tooltip } from 'antd'
import {
  getOpenBillingSessions,
  getRestaurantTables,
  getRevenueReport,
  getTodayBookings,
} from '../services/api'
import { formatVnd } from '../utils/revenueReport'
import { statusColors } from '../utils/tableMapStatus'
import {
  VIETNAM_TIME_ZONE,
  normalizeOverviewRevenue,
  sortOverviewBookings,
  summarizeOverviewTables,
  summarizePendingPayments,
  vietnamDateKey,
} from '../utils/overview'
import './Overview.css'

const SOURCE_LABELS = {
  revenue: 'Doanh thu và hóa đơn',
  bookings: 'Đặt bàn hôm nay',
  tables: 'Tình trạng bàn',
  payments: 'Bàn chờ thanh toán',
}

const BOOKING_STATUSES = {
  CHO_XAC_NHAN: { label: 'Chờ xác nhận', tone: 'warning' },
  DA_XAC_NHAN: { label: 'Đã xác nhận', tone: 'success' },
  DA_HUY: { label: 'Đã hủy', tone: 'neutral' },
  KHACH_KHONG_TOI: { label: 'Khách không tới', tone: 'danger' },
}

const TABLE_STATES = [
  { key: 'serving', label: 'Đang phục vụ', status: 'DANG_SU_DUNG' },
  { key: 'empty', label: 'Còn trống', status: 'TRONG' },
  { key: 'reserved', label: 'Đã đặt', status: 'DA_DAT' },
  { key: 'cleaning', label: 'Đang dọn', status: 'DANG_DON' },
]

const PAGE_SIZE = 6
const number = value => value.toLocaleString('vi-VN')
const compactMoney = value => new Intl.NumberFormat('vi-VN', {
  notation: 'compact', maximumFractionDigits: 1,
}).format(value)

function requireRows(value, label, fields) {
  if (!Array.isArray(value) || value.some(row => (
    !row || fields.some(field => row[field] == null)
  ))) {
    throw new Error(`API chưa trả đủ dữ liệu ${label}. Cần bổ sung các trường: ${fields.join(', ')}.`)
  }
  return value
}

function errorMessage(error) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (typeof detail?.message === 'string') return detail.message
  if (Array.isArray(detail)) return detail.map(item => item.msg).filter(Boolean).join('; ')
  return error?.message || 'Không thể kết nối. Vui lòng thử lại.'
}

function MissingData({ onRetry, label = 'Chưa tải được dữ liệu' }) {
  return (
    <div className="resto-overview-unavailable">
      <span>{label}</span>
      <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>Thử lại</Button>
    </div>
  )
}

function Metric({ title, value, note, icon, accent, loading, onClick }) {
  return (
    <article className={`resto-overview-metric${accent ? ' resto-overview-metric--accent' : ''}`}>
      <div className="resto-overview-metric-top"><span>{title}</span><span className="resto-overview-metric-icon">{icon}</span></div>
      {loading ? <Skeleton.Input active size="small" /> : <strong className="resto-overview-metric-value">{value ?? '—'}</strong>}
      <p>{loading ? 'Đang tải số liệu…' : note}</p>
      <Button type="link" size="small" onClick={onClick}>Xem chi tiết <ArrowRightOutlined /></Button>
    </article>
  )
}

function RevenueChart({ report, loading, onRetry, onNavigate }) {
  const hourly = report?.hourly || []
  const max = Math.max(1, ...hourly.map(item => item.revenue))
  const hourlyTotal = hourly.reduce((sum, item) => sum + item.revenue, 0)
  const missingRevenue = report ? report.revenue - hourlyTotal : 0

  return (
    <section className="resto-overview-panel resto-overview-revenue" aria-labelledby="overview-revenue-title">
      <div className="resto-overview-panel-heading">
        <div><h2 id="overview-revenue-title">Doanh thu theo giờ</h2><p>Hóa đơn đã chốt trong ngày · VNĐ</p></div>
        <span className="resto-overview-chip"><i /> Hôm nay</span>
      </div>
      {loading ? <div className="resto-overview-panel-loading"><Skeleton active paragraph={{ rows: 5 }} /></div>
        : !report ? <MissingData onRetry={onRetry} />
          : hourly.length === 0 ? (
            <div className="resto-overview-empty">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={report.invoice_count ? 'Chưa có dữ liệu doanh thu theo giờ' : 'Chưa có hóa đơn đã chốt hôm nay'} />
              <p>Chưa có khung giờ mở cửa cho ngày này để vẽ biểu đồ.</p>
              <Button onClick={() => onNavigate('opening-hours')}>Xem giờ mở cửa</Button>
            </div>
          ) : report.no_data ? (
            <div className="resto-overview-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có hóa đơn đã chốt hôm nay" /><p>Doanh thu sẽ được cập nhật khi có hóa đơn hợp lệ.</p></div>
          ) : (
            <figure className="resto-overview-chart-figure">
              <div className="resto-overview-chart">
                <div className="resto-overview-axis" aria-hidden="true">
                  {[1, 2 / 3, 1 / 3, 0].map(ratio => <span key={ratio}>{compactMoney(Math.round(max * ratio))}</span>)}
                </div>
                <div className="resto-overview-chart-plot">
                  <div className="resto-overview-gridlines" aria-hidden="true"><i /><i /><i /><i /></div>
                  <div className="resto-overview-bars" role="list" aria-label="Doanh thu từng giờ, theo giờ Việt Nam">
                    {hourly.map((item, index) => (
                      <Tooltip key={item.hour} title={`${item.label}: ${formatVnd(item.revenue)}`}>
                        <div className="resto-overview-bar-column" role="listitem" tabIndex={0} aria-label={`${item.label}: ${formatVnd(item.revenue)}`}>
                          <div className="resto-overview-bar-track"><div className={`resto-overview-bar${item.revenue === 0 ? ' resto-overview-bar--zero' : ''}`} style={{ height: `${item.revenue / max * 100}%` }} /></div>
                          <span className="resto-overview-bar-label">{hourly.length <= 12 || index % 2 === 0 ? `${String(item.hour).padStart(2, '0')}h` : ''}</span>
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              </div>
              <figcaption><i /> Doanh thu trong khung giờ mở cửa</figcaption>
            </figure>
          )}
      {!loading && report && missingRevenue !== 0 && (
        <Alert type="warning" showIcon title="Biểu đồ chưa khớp tổng doanh thu" description={missingRevenue > 0
          ? `Còn ${formatVnd(missingRevenue)} chưa được phân bổ theo giờ. API hiện chỉ trả các giờ mở cửa; cần bổ sung giờ có hóa đơn phát sinh ngoài khung này.`
          : 'Tổng theo giờ vượt doanh thu hợp lệ. Cần kiểm tra dữ liệu báo cáo từ API.'} />
      )}
    </section>
  )
}

export default function Overview({ onNavigate }) {
  const requestRef = useRef(0)
  const [bookingPage, setBookingPage] = useState(1)
  const [snapshot, setSnapshot] = useState({
    date: vietnamDateKey(), loading: true, errors: {}, updatedAt: null,
    revenue: null, bookings: null, tables: null, payments: null,
  })

  const load = useCallback(async function loadOverview() {
    const request = ++requestRef.current
    const date = vietnamDateKey()
    setSnapshot({ date, loading: true, errors: {}, updatedAt: null, revenue: null, bookings: null, tables: null, payments: null })
    setBookingPage(1)
    const sources = [
      ['revenue', async () => normalizeOverviewRevenue(await getRevenueReport(date, date), date)],
      ['bookings', async () => sortOverviewBookings(requireRows(await getTodayBookings('ALL'), 'đặt bàn', ['id', 'khung_gio', 'ho_ten_khach', 'so_luong_khach', 'trang_thai']))],
      ['tables', async () => requireRows(await getRestaurantTables(), 'bàn', ['id', 'trang_thai', 'da_cau_hinh'])],
      ['payments', async () => requireRows(await getOpenBillingSessions(), 'thanh toán', ['phien_ban_id', 'ban_id', 'trang_thai_phien'])],
    ]
    const results = await Promise.allSettled(sources.map(([, fetch]) => fetch()))
    if (request !== requestRef.current) return
    // A refresh crossing midnight must never mix yesterday's revenue with today's bookings.
    if (date !== vietnamDateKey()) return loadOverview()
    const next = { date, loading: false, errors: {}, updatedAt: new Date(), revenue: null, bookings: null, tables: null, payments: null }
    results.forEach((result, index) => {
      const key = sources[index][0]
      if (result.status === 'fulfilled') next[key] = result.value
      else next.errors[key] = errorMessage(result.reason)
    })
    setSnapshot(next)
  }, [])

  useEffect(() => {
    const initial = window.setTimeout(() => void load(), 0)
    const interval = window.setInterval(() => void load(), 60_000)
    return () => {
      window.clearTimeout(initial)
      window.clearInterval(interval)
      requestRef.current += 1
    }
  }, [load])

  const { loading, revenue, bookings, tables, payments, errors } = snapshot
  const tableCounts = tables && summarizeOverviewTables(tables, snapshot.updatedAt)
  const pendingPayments = payments && summarizePendingPayments(payments)
  const pendingBookings = bookings?.filter(row => row.trang_thai === 'CHO_XAC_NHAN').length
  const errorEntries = Object.entries(errors)
  const dateLabel = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VIETNAM_TIME_ZONE, weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric',
  }).format(new Date(`${snapshot.date}T00:00:00+07:00`))
  const tasks = [
    { key: 'bookings', title: 'Đặt bàn chờ xác nhận', count: pendingBookings, detail: 'Kiểm tra yêu cầu và xếp bàn cho khách.', target: 'bookings', icon: <CalendarOutlined /> },
    { key: 'payments', title: 'Bàn chờ thanh toán', count: pendingPayments?.tableCount, detail: 'Phiên đã yêu cầu thanh toán; bàn ghép tính theo nhóm.', target: 'checkout', icon: <DollarOutlined /> },
    { key: 'tables', title: 'Bàn đang dọn', count: tableCounts?.cleaning, detail: 'Theo dõi dọn bàn để sẵn sàng đón khách.', target: 'tables', icon: <TableOutlined /> },
  ]
  const taskTotal = tasks.every(task => task.count != null) ? tasks.reduce((sum, task) => sum + task.count, 0) : null
  const extraTableStatuses = tableCounts && [
    tableCounts.unconfigured > 0 && `${number(tableCounts.unconfigured)} bàn chưa cấu hình`,
    tableCounts.inactive > 0 && `${number(tableCounts.inactive)} bàn ngừng sử dụng`,
    tableCounts.other > 0 && `${number(tableCounts.other)} bàn có trạng thái khác`,
  ].filter(Boolean)

  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#9f2f27', colorLink: '#9f2f27', colorLinkHover: '#7d211b', colorLinkActive: '#7d211b', colorText: '#27231f', colorTextSecondary: '#7d766e', colorBorder: '#ebe7e1', borderRadius: 8, fontFamily: 'inherit' } }}>
      <section className="resto-overview" aria-busy={loading}>
        <div className="resto-overview-heading">
          <div><h1>Tổng quan</h1><p>Theo dõi hoạt động và những việc cần xử lý của nhà hàng hôm nay.</p></div>
          <div className="resto-overview-heading-actions">
            <span className="resto-overview-date"><CalendarOutlined /><time dateTime={snapshot.date}>{dateLabel}</time></span>
            <Button type="primary" icon={<ReloadOutlined />} loading={loading} onClick={load}>Làm mới</Button>
          </div>
        </div>

        {errorEntries.length > 0 && <Alert className="resto-overview-alert" type="error" showIcon
          title={errorEntries.length === 4 ? 'Không thể tải dữ liệu Tổng quan' : 'Một số dữ liệu chưa tải được'}
          description={<ul>{errorEntries.map(([key, message]) => <li key={key}><strong>{SOURCE_LABELS[key]}:</strong> {message}</li>)}</ul>}
          action={<Button onClick={load} icon={<ReloadOutlined />}>Thử lại</Button>} />}

        <div className="resto-overview-metrics">
          <Metric title="Doanh thu hôm nay" value={revenue && formatVnd(revenue.revenue)} note={revenue ? 'Từ hóa đơn hợp lệ đã chốt' : 'Chưa tải được doanh thu'} icon={<DollarOutlined />} accent loading={loading} onClick={() => onNavigate('invoices')} />
          <Metric title="Đặt bàn hôm nay" value={bookings && number(bookings.length)} note={bookings ? `${number(pendingBookings)} yêu cầu chờ xác nhận` : 'Chưa tải được danh sách đặt bàn'} icon={<CalendarOutlined />} loading={loading} onClick={() => onNavigate('bookings')} />
          <Metric title="Bàn đang phục vụ" value={tableCounts && <>{number(tableCounts.serving)}<small> / {number(tableCounts.total)} bàn</small></>} note={tableCounts ? `${number(tableCounts.empty)} bàn trống · Số đang phục vụ gồm bàn chờ thanh toán` : 'Chưa tải được tình trạng bàn'} icon={<TableOutlined />} loading={loading} onClick={() => onNavigate('tables')} />
          <Metric title="Hóa đơn đã chốt hôm nay" value={revenue && number(revenue.invoice_count)} note={revenue ? 'Hóa đơn đã chốt còn hiệu lực' : 'Chưa tải được số hóa đơn'} icon={<FileTextOutlined />} loading={loading} onClick={() => onNavigate('invoices')} />
        </div>

        <div className="resto-overview-content-grid">
          <RevenueChart report={revenue} loading={loading} onRetry={load} onNavigate={onNavigate} />
          <section className="resto-overview-panel" aria-labelledby="overview-tables-title">
            <div className="resto-overview-panel-heading"><div><h2 id="overview-tables-title">Tình trạng bàn</h2><p>Trạng thái hiện tại của bàn vật lý</p></div><Button type="text" size="small" icon={<ArrowRightOutlined />} aria-label="Xem quản lý bàn" onClick={() => onNavigate('tables')} /></div>
            {loading ? <div className="resto-overview-panel-loading"><Skeleton active paragraph={{ rows: 5 }} /></div>
              : !tableCounts ? <MissingData onRetry={load} />
                : tableCounts.total === 0 ? <div className="resto-overview-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có bàn trong nhà hàng" /><Button onClick={() => onNavigate('tables')}>Quản lý bàn</Button></div>
                  : <>
                    <div className="resto-overview-table-summary"><strong>{number(tableCounts.total)}</strong><span>Tổng số bàn</span></div>
                    <div className="resto-overview-status-track" aria-hidden="true">
                      {TABLE_STATES.map(item => <span key={item.key} style={{ flexGrow: tableCounts[item.key], background: statusColors[item.status].border }} />)}
                      <span style={{ flexGrow: tableCounts.unconfigured + tableCounts.inactive + tableCounts.other, background: '#b5ada5' }} />
                    </div>
                    <ul className="resto-overview-table-states">
                      {TABLE_STATES.map(item => <li key={item.key}><span><i style={{ background: statusColors[item.status].border }} />{item.label}</span><strong>{number(tableCounts[item.key])}<small> bàn</small></strong></li>)}
                    </ul>
                    {extraTableStatuses.length > 0 && <p className="resto-overview-table-note">{extraTableStatuses.join(' · ')}. Các bàn này vẫn thuộc tổng số bàn.</p>}
                    <p className="resto-overview-table-note">Đặt bàn chưa đến giờ vẫn hiển thị trống, theo sơ đồ bàn.</p>
                  </>}
          </section>

          <section className="resto-overview-panel resto-overview-bookings" aria-labelledby="overview-bookings-title">
            <div className="resto-overview-panel-heading"><div><h2 id="overview-bookings-title">Đặt bàn hôm nay {!loading && bookings && <span className="resto-overview-count">{number(bookings.length)}</span>}</h2><p>Danh sách theo giờ đến, gồm tất cả trạng thái</p></div><Button type="link" size="small" onClick={() => onNavigate('bookings')}>Xem tất cả <ArrowRightOutlined /></Button></div>
            {loading ? <div className="resto-overview-panel-loading"><Skeleton active paragraph={{ rows: 5 }} /></div>
              : !bookings ? <MissingData onRetry={load} />
                : bookings.length === 0 ? <div className="resto-overview-empty"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có đặt bàn hôm nay" /></div>
                  : <>
                    <table className="resto-overview-booking-table">
                      <caption className="resto-overview-sr-only">Đặt bàn ngày {dateLabel}</caption>
                      <colgroup><col style={{ width: '13%' }} /><col style={{ width: '30%' }} /><col style={{ width: '12%' }} /><col style={{ width: '17%' }} /><col style={{ width: '28%' }} /></colgroup>
                      <thead><tr><th scope="col">Giờ đến</th><th scope="col">Khách hàng</th><th scope="col">Số khách</th><th scope="col">Bàn</th><th scope="col">Trạng thái</th></tr></thead>
                      <tbody>{bookings.slice((bookingPage - 1) * PAGE_SIZE, bookingPage * PAGE_SIZE).map(row => {
                        const status = BOOKING_STATUSES[row.trang_thai] || { label: row.trang_thai, tone: 'neutral' }
                        return <tr key={row.id}>
                          <td data-label="Giờ đến"><span className="resto-overview-arrival">{row.khung_gio.split(' - ')[0]}</span></td>
                          <td data-label="Khách hàng"><div className="resto-overview-customer"><strong>{row.ho_ten_khach}</strong>{row.so_dien_thoai_da_che && <small>{row.so_dien_thoai_da_che}</small>}</div></td>
                          <td data-label="Số khách">{number(row.so_luong_khach)}</td>
                          <td data-label="Bàn">{row.ten_ban || <span className="resto-overview-muted">Chưa xếp</span>}</td>
                          <td data-label="Trạng thái"><span className={`resto-overview-booking-status resto-overview-booking-status--${status.tone}`}><i />{status.label}</span></td>
                        </tr>
                      })}</tbody>
                    </table>
                    {bookings.length > PAGE_SIZE && <Pagination className="resto-overview-pagination" current={bookingPage} total={bookings.length} pageSize={PAGE_SIZE} showSizeChanger={false} size="small" onChange={setBookingPage} />}
                  </>}
          </section>

          <section className="resto-overview-panel resto-overview-tasks" aria-labelledby="overview-tasks-title">
            <div className="resto-overview-panel-heading"><div><h2 id="overview-tasks-title">Cần xử lý</h2><p>Ưu tiên công việc trong ca phục vụ</p></div><span className="resto-overview-task-clock"><ClockCircleOutlined /></span></div>
            <div className="resto-overview-task-list">{tasks.map(task => <div className="resto-overview-task" key={task.key}>
              <div className="resto-overview-task-top"><span className="resto-overview-task-icon">{task.icon}</span><h3>{task.title}</h3><strong>{loading ? '…' : task.count == null ? '—' : number(task.count)}</strong></div>
              <p>{loading ? 'Đang tải dữ liệu…' : task.count == null ? 'Chưa tải được dữ liệu. Vui lòng thử lại.' : task.detail}</p>
              <Button type="link" size="small" onClick={task.count == null && !loading ? load : () => onNavigate(task.target)}>{task.count == null && !loading ? 'Thử lại' : 'Xem chi tiết'} <ArrowRightOutlined /></Button>
            </div>)}</div>
            {!loading && taskTotal === 0 && <p className="resto-overview-all-done"><CheckCircleOutlined /> Hiện không có việc cần xử lý.</p>}
          </section>
        </div>
        <p className="resto-overview-updated" aria-live="polite">{loading ? 'Đang cập nhật dữ liệu…' : snapshot.updatedAt && `Cập nhật lúc ${new Intl.DateTimeFormat('vi-VN', { timeZone: VIETNAM_TIME_ZONE, timeStyle: 'medium' }).format(snapshot.updatedAt)} · Tự cập nhật mỗi phút · Giờ Việt Nam (UTC+7)`}</p>
      </section>
    </ConfigProvider>
  )
}
