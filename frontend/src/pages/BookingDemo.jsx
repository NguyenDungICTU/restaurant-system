import { Fragment, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Input, InputNumber } from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  PhoneOutlined,
  SearchOutlined,
  TableOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { cancelBooking, createBooking, getAreas, getBookings, getOpeningSettings, getRestaurantTables, getAvailableTables, confirmBooking } from '../services/api'
import { formatAreaName, formatTableName } from '../utils/areaNames'
import './BookingDemo.css'

const TIME_ZONE = 'Asia/Ho_Chi_Minh'
const DEFAULT_WEEK = [
  { key: 'monday', label: 'Thứ Hai', closed: false, open: '08:00', close: '22:00' },
  { key: 'tuesday', label: 'Thứ Ba', closed: false, open: '08:00', close: '22:00' },
  { key: 'wednesday', label: 'Thứ Tư', closed: false, open: '08:00', close: '22:00' },
  { key: 'thursday', label: 'Thứ Năm', closed: false, open: '08:00', close: '22:00' },
  { key: 'friday', label: 'Thứ Sáu', closed: false, open: '08:00', close: '23:00' },
  { key: 'saturday', label: 'Thứ Bảy', closed: false, open: '08:00', close: '23:00' },
  { key: 'sunday', label: 'Chủ Nhật', closed: true, open: '08:00', close: '22:00' },
]

// Trạng thái bàn hiển thị trong trang đặt bàn (chỉ đổi nhãn hiển thị, giữ nguyên giá trị backend).
const TABLE_STATUS_META = {
  TRONG: { label: 'Trống', tone: 'success' },
  DA_DAT: { label: 'Đang giữ', tone: 'warning' },
  DANG_SU_DUNG: { label: 'Đã đặt', tone: 'danger' },
  DANG_DON: { label: 'Đang dọn', tone: 'info' },
  NGUNG_SU_DUNG: { label: 'Ngừng sử dụng', tone: 'neutral' },
}

const BOOKING_STATUS_META = {
  DA_XAC_NHAN: { label: 'Đã xác nhận', tone: 'success' },
  CHO_XAC_NHAN: { label: 'Chờ xác nhận', tone: 'warning' },
  DA_HUY: { label: 'Đã hủy', tone: 'danger' },
  KHACH_KHONG_TOI: { label: 'Khách không tới', tone: 'neutral' },
}

function tableStatusMeta(table) {
  if (!table.da_cau_hinh) return { label: 'Chưa cấu hình', tone: 'neutral' }
  return TABLE_STATUS_META[table.trang_thai] || { label: table.trang_thai || 'Chưa có trạng thái', tone: 'neutral' }
}

function bookingStatusMeta(status) {
  return BOOKING_STATUS_META[status] || { label: status || 'Chưa rõ', tone: 'neutral' }
}

function formatDateVN(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return value || ''
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function vietnamDateTime() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date())
  const part = (type) => parts.find((item) => item.type === type)?.value
  return { date: `${part('year')}-${part('month')}-${part('day')}`, time: `${part('hour')}:${part('minute')}` }
}

function getWeekdayIndex(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return null
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (parsed.toISOString().slice(0, 10) !== value) return null
  return (parsed.getUTCDay() + 6) % 7
}

function toMinutes(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null
  const [hours, minutes] = value.split(':').map(Number)
  return hours * 60 + minutes
}

function toTime(value) {
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`
}

function timeValidationMessage(start, end) {
  if (start && toMinutes(start) === null) return 'Giờ bắt đầu không hợp lệ. Vui lòng nhập đúng định dạng HH:mm.'
  if (end && toMinutes(end) === null) return 'Giờ kết thúc không hợp lệ. Vui lòng nhập đúng định dạng HH:mm.'
  if (start && end && toMinutes(end) <= toMinutes(start)) return 'Giờ kết thúc phải lớn hơn giờ bắt đầu.'
  return ''
}

function slotsFor(day, duration) {
  if (!day || day.closed) return []
  const open = toMinutes(day.open)
  const close = toMinutes(day.close)
  if (open === null || close === null || close <= open || !Number.isInteger(duration) || duration <= 0) return []
  const slots = []
  for (let current = open; current + duration <= close; current += 30) slots.push(toTime(current))
  return slots
}

function fromServer(data) {
  const byDay = new Map((data.ngay || []).map((item) => [item.thu, item]))
  return {
    week: DEFAULT_WEEK.map((day, thu) => {
      const row = byDay.get(thu)
      return row ? {
        ...day,
        closed: row.la_ngay_nghi,
        open: row.gio_mo_cua?.slice(0, 5) || day.open,
        close: row.gio_dong_cua?.slice(0, 5) || day.close,
      } : day
    }),
    duration: data.thoi_luong_giu_ban ?? 90,
    holidays: (data.ngay_nghi || []).map((item) => ({ date: item.ngay, name: item.ten_ngay_nghi })),
    configured: (data.ngay || []).length === 7,
  }
}

function apiError(error) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (typeof detail?.message === 'string') return detail.message
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join('; ')
  return error?.message || 'Không kết nối được máy chủ.'
}

export default function BookingDemo({ focusedBookingId = null }) {
  const [settings, setSettings] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [date, setDate] = useState(() => vietnamDateTime().date)
  const [time, setTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [guests, setGuests] = useState(2)
  const [note, setNote] = useState('')
  const [result, setResult] = useState(null)
  const [tables, setTables] = useState([])
  const [areas, setAreas] = useState([])
  const [assigningId, setAssigningId] = useState(null)
  const [availableTables, setAvailableTables] = useState([])
  const [selectedTableId, setSelectedTableId] = useState("")

  useEffect(() => {
    // Read shared backend state on initial mount, never treat localStorage as the source of truth.
    let mounted = true
    Promise.all([getOpeningSettings(), getBookings(), getRestaurantTables(), getAreas()])
      .then(([configuration, rows, restaurantTables, regions]) => {
        if (mounted) {
          setSettings(fromServer(configuration))
          setBookings(rows)
          setTables(restaurantTables)
          setAreas(regions)
        }
      })
      .catch((cause) => { if (mounted) setError(apiError(cause)) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    if (!focusedBookingId || loading) return

    document
      .getElementById(`booking-${focusedBookingId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [bookings, focusedBookingId, loading])

  const areasById = useMemo(
    () => new Map(areas.map((area) => [area.id, area])),
    [areas],
  )
  const tableDisplayName = (table) => table.ma_ban
    ? formatTableName(
      areasById.get(table.khu_vuc_id)?.ten_khu_vuc || '',
      table.ma_ban,
    )
    : ''

  const weekdayIndex = getWeekdayIndex(date)
  const schedule = weekdayIndex === null ? null : settings?.week[weekdayIndex]
  const holiday = settings?.holidays.find((item) => item.date === date)
  const slots = useMemo(() => {
    const now = vietnamDateTime()
    return !settings?.configured || holiday || !date || date < now.date
      ? []
      : slotsFor(schedule, settings.duration).filter((slot) => date !== now.date || slot > now.time)
  }, [date, holiday, schedule, settings])

  const timeError = timeValidationMessage(time, endTime)

  async function submitBooking(event) {
    event.preventDefault()
    setResult(null)
    const now = vietnamDateTime()
    if (!settings?.configured || error) {
      setResult({ ok: false, message: 'Chưa tải được lịch từ PostgreSQL. Vui lòng thử tải lại.' })
    } else if (!date || weekdayIndex === null || date < now.date) {
      setResult({ ok: false, message: 'Vui lòng chọn ngày hợp lệ, không ở quá khứ.' })
    } else if (holiday) {
      setResult({ ok: false, message: `Nhà hàng nghỉ đặc biệt: ${holiday.name}.` })
    } else if (!schedule || schedule.closed) {
      setResult({ ok: false, message: 'Nhà hàng nghỉ theo lịch tuần vào ngày này.' })
    } else if (toMinutes(time) === null) {
      setResult({ ok: false, message: 'Giờ bắt đầu không hợp lệ. Vui lòng nhập đúng định dạng HH:mm.' })
    } else if (toMinutes(endTime) === null) {
      setResult({ ok: false, message: 'Giờ kết thúc không hợp lệ. Vui lòng nhập đúng định dạng HH:mm.' })
    } else if (toMinutes(endTime) <= toMinutes(time)) {
      setResult({ ok: false, message: 'Giờ kết thúc phải lớn hơn giờ bắt đầu.' })
    } else if (!slots.includes(time)) {
      setResult({ ok: false, message: 'Giờ bắt đầu phải nằm trong giờ mở cửa, đúng mốc 30 phút và đủ thời lượng trước giờ đóng.' })
    } else if (!customerName.trim()) {
      setResult({ ok: false, message: 'Vui lòng nhập tên khách hàng.' })
    } else if (!/^0\d{9}$/.test(phone.trim())) {
      setResult({ ok: false, message: 'Số điện thoại gồm 10 chữ số và bắt đầu bằng 0.' })
    } else if (!Number.isInteger(guests) || guests < 1 || guests > 30) {
      setResult({ ok: false, message: 'Số khách phải từ 1 đến 30.' })
    } else {
      setBusy(true)
      try {
        const created = await createBooking({
          ho_ten_khach: customerName.trim(), so_dien_thoai: phone.trim(),
          so_luong_khach: guests, ngay_dat: date, gio_bat_dau: time,
          ghi_chu: note.trim() || null,
        })
        setResult({ ok: true, message: `Đã lưu yêu cầu #${created.id} vào PostgreSQL. Trạng thái: Chờ xác nhận.` })
        setCustomerName('')
        setPhone('')
        setNote('')
        try {
          setBookings(await getBookings())
        } catch (refreshError) {
          setError(`Đơn đã lưu nhưng chưa tải lại được danh sách: ${apiError(refreshError)}`)
        }
      } catch (cause) {
        setResult({ ok: false, message: `Không lưu được đơn: ${apiError(cause)}` })
      } finally {
        setBusy(false)
      }
    }
  }

  async function cancel(id) {
    if (!window.confirm(`Hủy yêu cầu đặt bàn #${id}?`)) return
    setBusy(true)
    setResult(null)
    try {
      await cancelBooking(id)
      setBookings((current) => current.map((row) => row.id === id ? { ...row, trang_thai: 'DA_HUY' } : row))
      setResult({ ok: true, message: `Đã hủy yêu cầu #${id}.` })
    } catch (cause) {
      setResult({ ok: false, message: `Không hủy được đơn: ${apiError(cause)}` })
    } finally {
      setBusy(false)
    }
  }

  async function checkAvailable(bookingId) {
    setBusy(true)
    setResult(null)
    setAssigningId(null)
    setSelectedTableId('')
    setAvailableTables([])

    try {
      const response = await getAvailableTables(bookingId)
      setAvailableTables(response.ban_trong || [])
      setAssigningId(bookingId)

      setResult({
        ok: response.so_ban_trong > 0,
        message: response.so_ban_trong > 0
          ? `Đơn #${bookingId}: có ${response.so_ban_trong} bàn phù hợp. Chọn bàn để xác nhận.`
          : `Đơn #${bookingId}: chưa có bàn trống đủ chỗ ở khung giờ này.`,
      })
    } catch (cause) {
      setResult({ ok: false, message: `Không kiểm tra được bàn trống: ${apiError(cause)}` })
    } finally {
      setBusy(false)
    }
  }

  async function assignTable(bookingId) {
    if (!selectedTableId) {
      setResult({ ok: false, message: 'Vui lòng chọn một bàn trước khi xác nhận.' })
      return
    }

    setBusy(true)
    setResult(null)

    try {
      const response = await confirmBooking(bookingId, Number(selectedTableId))
      setBookings(await getBookings())
      setAssigningId(null)
      setAvailableTables([])
      setSelectedTableId('')

      setResult({
        ok: true,
        message: `Đã phân ${
          tableDisplayName(
            availableTables.find(
              (table) => table.id === response.ban_id,
            ) || {
              khu_vuc_id: null,
              ma_ban: response.ma_ban,
            },
          )
        } và xác nhận đơn #${bookingId}.`,
      })
    } catch (cause) {
      setResult({
        ok: false,
        message: `Không xác nhận được đơn: ${apiError(cause)}. Hãy kiểm tra lại bàn trống.`,
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="booking-demo-page">
      <div className="booking-demo-heading">
        <div className="booking-demo-heading-copy">
          <nav className="booking-demo-breadcrumb" aria-label="Breadcrumb">
            <span>Trang chủ</span>
            <b>/</b>
            <span className="booking-demo-breadcrumb-current">Đặt bàn</span>
          </nav>
          <h1>Đặt bàn</h1>
          <p>Chọn thời gian, số lượng khách và thông tin khách hàng để đặt bàn.</p>
        </div>
      </div>

      {error && <Alert showIcon type="error" className="booking-demo-alert" message="Không tải được dữ liệu" description={error} />}
      {loading && <Alert showIcon type="info" className="booking-demo-alert" message="Đang tải lịch và danh sách đặt bàn..." />}
      {focusedBookingId && !loading && !bookings.some((booking) => String(booking.id) === String(focusedBookingId)) && (
        <Alert showIcon type="warning" className="booking-demo-alert" message={`Không tìm thấy đặt bàn #${focusedBookingId} trong danh sách đã tải.`} />
      )}
      {settings && !settings.configured && <Alert showIcon type="warning" className="booking-demo-alert" message="Chưa có lịch mở cửa đủ 7 ngày trong PostgreSQL. Quản lý cần lưu cấu hình trước." />}

      <div className="booking-demo-grid">
        <Card
          className="booking-demo-card booking-demo-info-card"
          title={<span className="booking-demo-card-title"><CalendarOutlined /> Thông tin đặt bàn</span>}
        >
          <form onSubmit={submitBooking} noValidate className="booking-demo-form">
            <div className="booking-demo-field">
              <label className="booking-demo-label">Ngày đặt bàn <span className="booking-demo-required">*</span></label>
              <div className="booking-demo-control">
                <CalendarOutlined className="booking-demo-control-icon" />
                <input type="date" min={vietnamDateTime().date} value={date} onChange={(event) => { setDate(event.target.value); setTime(''); setEndTime(''); setResult(null) }} />
              </div>
            </div>

            <div className="booking-demo-field">
              <label className="booking-demo-label">Chọn khung giờ <span className="booking-demo-required">*</span></label>
              <div className="booking-demo-time-row">
                <div className="booking-demo-control booking-demo-control--time">
                  <ClockCircleOutlined className="booking-demo-control-icon" />
                  <input type="time" step="1800" value={time} onChange={(event) => {
                    const value = event.target.value
                    const duration = settings?.duration
                    setTime(value)
                    setEndTime(value && toMinutes(value) !== null && duration ? toTime(toMinutes(value) + duration) : '')
                    setResult(null)
                  }} />
                </div>
                <span className="booking-demo-time-sep">–</span>
                <div className="booking-demo-control booking-demo-control--time">
                  <ClockCircleOutlined className="booking-demo-control-icon" />
                  <input type="time" step="1800" value={endTime} onChange={(event) => { setEndTime(event.target.value); setResult(null) }} />
                </div>
              </div>
              {timeError
                ? <div className="booking-demo-field-error">{timeError}</div>
                : <div className="booking-demo-schedule-hint">
                    {holiday ? `Nghỉ đặc biệt: ${holiday.name}` : schedule?.closed ? 'Nhà hàng nghỉ theo lịch tuần.' : schedule ? `Mở cửa: ${schedule.open} – ${schedule.close}` : 'Chưa có lịch hoạt động.'}
                  </div>}
            </div>

            <div className="booking-demo-row">
              <div className="booking-demo-field">
                <label className="booking-demo-label">Họ tên khách <span className="booking-demo-required">*</span></label>
                <Input prefix={<UserOutlined />} value={customerName} maxLength={100} placeholder="Nhập tên khách hàng" onChange={(event) => setCustomerName(event.target.value)} />
              </div>
              <div className="booking-demo-field">
                <label className="booking-demo-label">Số điện thoại <span className="booking-demo-required">*</span></label>
                <Input prefix={<PhoneOutlined />} value={phone} maxLength={10} placeholder="Ví dụ: 0912345678" onChange={(event) => setPhone(event.target.value)} />
              </div>
            </div>

            <div className="booking-demo-row">
              <div className="booking-demo-field">
                <label className="booking-demo-label">Số khách <span className="booking-demo-required">*</span></label>
                <InputNumber prefix={<TeamOutlined />} min={1} max={30} value={guests} onChange={setGuests} style={{ width: '100%' }} />
              </div>
              <div className="booking-demo-field">
                <label className="booking-demo-label">Ghi chú <em>(không bắt buộc)</em></label>
                <Input.TextArea value={note} maxLength={1000} rows={2} placeholder="Ví dụ: Gần cửa sổ, yêu cầu ghế cao..." onChange={(event) => setNote(event.target.value)} />
              </div>
            </div>

            <Button type="primary" htmlType="submit" block size="large" loading={busy} disabled={loading || !settings?.configured} className="booking-demo-submit">
              Lưu yêu cầu đặt bàn
            </Button>

            {result && <Alert showIcon type={result.ok ? 'success' : 'error'} icon={result.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />} message={result.message} />}

            <div className="booking-demo-guide">
              <InfoCircleOutlined />
              <span>Quy trình: Lưu yêu cầu → Kiểm tra bàn trống → Phân bàn &amp; xác nhận</span>
            </div>
          </form>
        </Card>

        <Card
          className="booking-demo-card booking-demo-tables-card"
          title={<span className="booking-demo-card-title"><TableOutlined /> Danh sách bàn <span className="booking-demo-card-count">{tables.length}</span></span>}
          extra={
            <div className="booking-demo-legend">
              <span className="booking-demo-legend-item"><i className="booking-demo-legend-dot booking-demo-legend-dot--success" />Trống</span>
              <span className="booking-demo-legend-item"><i className="booking-demo-legend-dot booking-demo-legend-dot--warning" />Đang giữ</span>
              <span className="booking-demo-legend-item"><i className="booking-demo-legend-dot booking-demo-legend-dot--danger" />Đã đặt</span>
            </div>
          }
        >
          <div className="booking-demo-table-grid">
            {tables.map((table) => {
              const meta = tableStatusMeta(table)
              const areaName = formatAreaName(areasById.get(table.khu_vuc_id)?.ten_khu_vuc || 'Chưa xác định')
              return (
                <div className="booking-demo-table-card" key={table.id}>
                  <div className="booking-demo-table-name">
                    <TableOutlined className="booking-demo-table-icon" />
                    <strong>{table.ma_ban || 'Bàn chưa đặt mã'}</strong>
                  </div>
                  <div className="booking-demo-table-capacity">
                    <TeamOutlined />
                    <span>{table.da_cau_hinh ? `${table.suc_chua_toi_thieu} - ${table.suc_chua_toi_da} người` : 'Chưa cấu hình sức chứa'}</span>
                  </div>
                  <div className="booking-demo-table-area">Khu vực: {areaName}</div>
                  <span className={`booking-demo-status booking-demo-status--${meta.tone}`}>
                    <i className="booking-demo-status-dot" />
                    {meta.label}
                  </span>
                </div>
              )
            })}
            {!tables.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có bàn nào. Quản lý hãy khai báo bàn trước." />}
          </div>
          <div className="booking-demo-tables-note">
            <InfoCircleOutlined />
            <span>Chọn bàn phù hợp với số lượng khách và thời gian đặt.</span>
          </div>
        </Card>
      </div>

      <Card
        className="booking-demo-card booking-demo-requests-card"
        title={<span className="booking-demo-requests-title"><CalendarOutlined /> Danh sách yêu cầu đặt bàn <span className="booking-demo-card-count">{bookings.length}</span></span>}
      >
        {bookings.length ? (
          <div className="booking-demo-table-wrap">
            <table className="booking-demo-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Khách hàng</th>
                  <th>Ngày đặt</th>
                  <th>Giờ</th>
                  <th>Số khách</th>
                  <th>Bàn</th>
                  <th>Trạng thái</th>
                  <th>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const meta = bookingStatusMeta(booking.trang_thai)
                  const assignedTable = tables.find((table) => table.id === booking.ban_id)
                  const assignedName = assignedTable ? tableDisplayName(assignedTable) : ''
                  return (
                    <Fragment key={booking.id}>
                      <tr
                        id={`booking-${booking.id}`}
                        className={String(booking.id) === String(focusedBookingId) ? 'booking-demo-row--focused' : ''}
                      >
                        <td className="booking-demo-cell-id">#{booking.id}</td>
                        <td>
                          <div className="booking-demo-cell-customer">
                            <strong>{booking.ho_ten_khach}</strong>
                            <span>{booking.so_dien_thoai}</span>
                          </div>
                        </td>
                        <td>{formatDateVN(booking.ngay_dat)}</td>
                        <td>{booking.gio_bat_dau?.slice(0, 5)}</td>
                        <td>{booking.so_luong_khach}</td>
                        <td>
                          {booking.ban_id ? (assignedName || 'Chưa tải được thông tin bàn') : <span className="booking-demo-muted">Chưa xếp bàn</span>}
                        </td>
                        <td>
                          <span className={`booking-demo-status booking-demo-status--${meta.tone}`}>
                            <i className="booking-demo-status-dot" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="booking-demo-cell-actions">
                          {booking.trang_thai === 'CHO_XAC_NHAN' && (
                            <Button size="small" icon={<SearchOutlined />} disabled={busy} onClick={() => checkAvailable(booking.id)}>
                              Kiểm tra bàn trống
                            </Button>
                          )}
                          {booking.trang_thai === 'CHO_XAC_NHAN' && (
                            <Button danger size="small" disabled={busy} onClick={() => cancel(booking.id)}>
                              Hủy
                            </Button>
                          )}
                        </td>
                      </tr>
                      {booking.trang_thai === 'CHO_XAC_NHAN' && assigningId === booking.id && (
                        <tr className="booking-demo-assign-row">
                          <td colSpan={8}>
                            <div className="booking-demo-assign">
                              <span className="booking-demo-assign-label">Phân bàn cho đơn #{booking.id}:</span>
                              <select value={selectedTableId} onChange={(event) => setSelectedTableId(event.target.value)} disabled={busy || !availableTables.length}>
                                <option value="">{availableTables.length ? 'Chọn bàn còn trống' : 'Không có bàn phù hợp'}</option>
                                {availableTables.map((table) => (
                                  <option key={table.id} value={table.id}>{tableDisplayName(table)} · {table.suc_chua_toi_thieu}–{table.suc_chua_toi_da} khách</option>
                                ))}
                              </select>
                              <Button type="primary" size="small" disabled={busy || !selectedTableId} loading={busy} onClick={() => assignTable(booking.id)}>
                                Phân bàn & xác nhận
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có yêu cầu đặt bàn nào." />
        )}
      </Card>
    </section>
  )
}
