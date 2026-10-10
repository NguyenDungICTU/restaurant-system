import { Fragment, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Input, InputNumber, Select } from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  PhoneOutlined,
  RightOutlined,
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

const BOOKING_STATUS_FILTERS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'CHO_XAC_NHAN', label: 'Chờ xác nhận' },
  { value: 'DA_XAC_NHAN', label: 'Đã xác nhận' },
  { value: 'DA_HUY', label: 'Đã hủy' },
]

const BOOKINGS_PER_PAGE = 10

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

function timeValidationMessage(start, end, close) {
  if (start && toMinutes(start) === null) return 'Giờ bắt đầu không hợp lệ. Vui lòng nhập đúng định dạng HH:mm.'
  if (end && toMinutes(end) === null) return 'Giờ kết thúc không hợp lệ. Vui lòng nhập đúng định dạng HH:mm.'
  if (start && end && toMinutes(end) <= toMinutes(start)) return 'Giờ kết thúc phải lớn hơn giờ bắt đầu.'
  if (end && close && toMinutes(end) > toMinutes(close)) return 'Giờ kết thúc không được sau giờ đóng cửa.'
  return ''
}

function slotsFor(day, duration) {
  if (!day || day.closed) return []
  const open = toMinutes(day.open)
  const close = toMinutes(day.close)
  if (open === null || close === null || close <= open || !Number.isInteger(duration) || duration <= 0) return []
  const slots = []
  for (let current = open; current + duration <= close; current += 1) slots.push(toTime(current))
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
  const [bookingSearch, setBookingSearch] = useState('')
  const [bookingStatusFilter, setBookingStatusFilter] = useState('ALL')
  const [bookingPage, setBookingPage] = useState(1)
  const [tableSearch, setTableSearch] = useState('')
  const [tableAreaFilter, setTableAreaFilter] = useState('all')
  const [tablesPerPage, setTablesPerPage] = useState(10)
  const [tablePage, setTablePage] = useState(1)
  const [assigningId, setAssigningId] = useState(null)
  const [availableTables, setAvailableTables] = useState([])
  const [selectedTableId, setSelectedTableId] = useState("")
  const [availableAreaFilter, setAvailableAreaFilter] = useState('all')

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
  const filteredBookings = useMemo(() => {
    const query = bookingSearch.trim().toLocaleLowerCase('vi')

    return bookings.filter((booking) => {
      const matchesStatus = bookingStatusFilter === 'ALL'
        || booking.trang_thai === bookingStatusFilter
      if (!matchesStatus) return false
      if (!query) return true

      const assignedTable = tables.find((table) => table.id === booking.ban_id)
      const assignedAreaName = areasById.get(assignedTable?.khu_vuc_id)?.ten_khu_vuc
      const requestedAreaId = booking.khu_vuc_yeu_cau_id ?? booking.khu_vuc_id
      const requestedAreaName = areasById.get(requestedAreaId)?.ten_khu_vuc
      const searchableText = [
        booking.ho_ten_khach,
        booking.ma_dat_ban,
        booking.so_dien_thoai,
        booking.ten_ban,
        assignedTable?.ma_ban,
        assignedAreaName,
        requestedAreaName,
      ].filter(Boolean).join(' ').toLocaleLowerCase('vi')

      return searchableText.includes(query)
    })
  }, [areasById, bookingSearch, bookingStatusFilter, bookings, tables])
  const totalBookingPages = Math.max(1, Math.ceil(filteredBookings.length / BOOKINGS_PER_PAGE))
  const safeBookingPage = Math.min(bookingPage, totalBookingPages)
  const bookingPageStartIndex = (safeBookingPage - 1) * BOOKINGS_PER_PAGE
  const currentBookings = filteredBookings.slice(
    bookingPageStartIndex,
    bookingPageStartIndex + BOOKINGS_PER_PAGE,
  )

  useEffect(() => {
    if (bookingPage !== safeBookingPage) setBookingPage(safeBookingPage)
  }, [bookingPage, safeBookingPage])

  const tableDisplayName = (table) => table.ma_ban
    ? formatTableName(
      areasById.get(table.khu_vuc_id)?.ten_khu_vuc || '',
      table.ma_ban,
    )
    : ''
  const filteredTables = useMemo(() => {
    const normalizedSearch = tableSearch.trim().toLocaleLowerCase('vi')
    return tables.filter((table) => {
      const searchableName = `${table.ma_ban || ''} ${tableDisplayName(table)}`
        .toLocaleLowerCase('vi')
      const matchesSearch = !normalizedSearch || searchableName.includes(normalizedSearch)
      const matchesArea = tableAreaFilter === 'all'
        || String(table.khu_vuc_id) === tableAreaFilter
      return matchesSearch && matchesArea
    })
  }, [tables, tableSearch, tableAreaFilter])
  const totalTablePages = Math.max(1, Math.ceil(filteredTables.length / tablesPerPage))
  const currentTables = filteredTables.slice(
    (tablePage - 1) * tablesPerPage,
    tablePage * tablesPerPage,
  )
  const filteredAvailableTables = availableAreaFilter === 'all'
    ? availableTables
    : availableTables.filter((table) => String(table.khu_vuc_id) === availableAreaFilter)

  const weekdayIndex = getWeekdayIndex(date)
  const schedule = weekdayIndex === null ? null : settings?.week[weekdayIndex]
  const holiday = settings?.holidays.find((item) => item.date === date)
  const slots = useMemo(() => {
    const now = vietnamDateTime()
    return !settings?.configured || holiday || !date || date < now.date
      ? []
      : slotsFor(schedule, settings.duration).filter((slot) => date !== now.date || slot > now.time)
  }, [date, holiday, schedule, settings])

  const timeError = timeValidationMessage(time, endTime, schedule?.close)

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
    } else if (toMinutes(endTime) > toMinutes(schedule.close)) {
      setResult({ ok: false, message: 'Giờ kết thúc không được sau giờ đóng cửa.' })
    } else if (!slots.includes(time)) {
      setResult({ ok: false, message: 'Giờ bắt đầu phải nằm trong giờ mở cửa và đủ thời lượng trước giờ đóng.' })
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
    setAvailableAreaFilter('all')
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
                  <input type="time" step="60" value={time} onChange={(event) => {
                    const nextTime = event.target.value
                    const duration = settings?.duration
                    setTime(nextTime)
                    setEndTime(nextTime && duration ? toTime(toMinutes(nextTime) + duration) : '')
                    setResult(null)
                  }} />
                </div>
                <span className="booking-demo-time-sep">–</span>
                <div className="booking-demo-control booking-demo-control--time">
                  <ClockCircleOutlined className="booking-demo-control-icon" />
                  <input type="time" step="60" value={endTime} onChange={(event) => { setEndTime(event.target.value); setResult(null) }} />
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
          title={<span className="booking-demo-card-title"><TableOutlined /> Danh sách bàn <span className="booking-demo-card-count">{filteredTables.length}{filteredTables.length !== tables.length ? `/${tables.length}` : ''}</span></span>}
          extra={
            <div className="booking-demo-legend">
              <span className="booking-demo-legend-item"><i className="booking-demo-legend-dot booking-demo-legend-dot--success" />Trống</span>
              <span className="booking-demo-legend-item"><i className="booking-demo-legend-dot booking-demo-legend-dot--warning" />Đang giữ</span>
              <span className="booking-demo-legend-item"><i className="booking-demo-legend-dot booking-demo-legend-dot--danger" />Đã đặt</span>
            </div>
          }
        >
          <div className="booking-demo-table-toolbar">
            <Input
              allowClear
              aria-label="Tìm bàn theo mã hoặc tên"
              placeholder="Tìm mã/tên bàn"
              value={tableSearch}
              onChange={(event) => { setTableSearch(event.target.value); setTablePage(1) }}
            />
            <Select
              aria-label="Lọc bàn theo khu vực"
              value={tableAreaFilter}
              onChange={(value) => { setTableAreaFilter(value); setTablePage(1) }}
              options={[
                { value: 'all', label: 'Tất cả khu vực' },
                ...areas.map((area) => ({ value: String(area.id), label: area.ten_khu_vuc })),
              ]}
            />
          </div>
          <div className="booking-demo-table-grid">
            {currentTables.map((table) => {
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
            {!filteredTables.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={tables.length ? 'Không tìm thấy bàn phù hợp' : 'Chưa có bàn nào. Quản lý hãy khai báo bàn trước.'} />}
          </div>
          {filteredTables.length > 0 && (
            <div className="booking-demo-table-pagination" aria-label="Phân trang danh sách bàn">
              <label className="booking-demo-page-size">
                <span>Bàn mỗi trang</span>
                <Select
                  size="small"
                  value={tablesPerPage}
                  onChange={(value) => { setTablesPerPage(value); setTablePage(1) }}
                  options={[10, 15, 20].map((value) => ({ value, label: String(value) }))}
                />
              </label>
              <span className="booking-demo-page-indicator">Trang {tablePage} / {totalTablePages}</span>
              <div className="booking-demo-page-controls">
                <Button
                  size="small"
                  aria-label="Trang trước"
                  icon={<LeftOutlined />}
                  disabled={tablePage <= 1}
                  onClick={() => setTablePage((page) => Math.max(1, page - 1))}
                />
                <Button
                  size="small"
                  aria-label="Trang sau"
                  icon={<RightOutlined />}
                  disabled={tablePage >= totalTablePages}
                  onClick={() => setTablePage((page) => Math.min(totalTablePages, page + 1))}
                />
              </div>
            </div>
          )}
          <div className="booking-demo-tables-note">
            <InfoCircleOutlined />
            <span>Chọn bàn phù hợp với số lượng khách và thời gian đặt.</span>
          </div>
        </Card>
      </div>

      <Card
        className="booking-demo-card booking-demo-requests-card"
        title={<span className="booking-demo-requests-title"><CalendarOutlined /> Danh sách yêu cầu đặt bàn <span className="booking-demo-card-count">{filteredBookings.length}</span></span>}
      >
        <div className="booking-demo-table-toolbar">
          <Input
            allowClear
            aria-label="Tìm yêu cầu đặt bàn"
            placeholder="Tìm khách, mã đặt bàn, số điện thoại, bàn hoặc khu vực"
            prefix={<SearchOutlined />}
            value={bookingSearch}
            onChange={(event) => {
              setBookingSearch(event.target.value)
              setBookingPage(1)
            }}
          />
          <Select
            aria-label="Lọc trạng thái yêu cầu đặt bàn"
            value={bookingStatusFilter}
            onChange={(value) => {
              setBookingStatusFilter(value)
              setBookingPage(1)
            }}
            options={BOOKING_STATUS_FILTERS}
          />
        </div>
        {filteredBookings.length ? (
          <>
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
                  <th>Thao tác</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
                <tbody>
                {currentBookings.map((booking, index) => {
                  const meta = bookingStatusMeta(booking.trang_thai)
                  const assignedTable = tables.find((table) => table.id === booking.ban_id)
                  const assignedName = assignedTable ? tableDisplayName(assignedTable) : ''
                  return (
                    <Fragment key={booking.id}>
                      <tr
                        id={`booking-${booking.id}`}
                        className={String(booking.id) === String(focusedBookingId) ? 'booking-demo-row--focused' : ''}
                      >
                        <td className="booking-demo-cell-id">{bookingPageStartIndex + index + 1}</td>
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
                        <td className="booking-demo-cell-actions">
                          {booking.trang_thai === 'CHO_XAC_NHAN' && (
                            <div className="booking-demo-row-actions">
                              <span className="booking-demo-check-wrap">
                                <Button size="small" icon={<SearchOutlined />} disabled={busy} aria-label="Kiểm tra bàn trống" className="booking-demo-check-button" onClick={() => checkAvailable(booking.id)} />
                                <span className="booking-demo-check-tooltip" role="tooltip">Kiểm tra bàn trống</span>
                              </span>
                              <Button danger size="small" disabled={busy} onClick={() => cancel(booking.id)}>Hủy</Button>
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`booking-demo-status booking-demo-status--${meta.tone}`}>
                            <i className="booking-demo-status-dot" />
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                      {booking.trang_thai === 'CHO_XAC_NHAN' && assigningId === booking.id && (
                        <tr className="booking-demo-assign-row">
                          <td colSpan={8}>
                            <section className="booking-demo-assign-panel" aria-label={`Chọn bàn cho yêu cầu ${booking.id}`}>
                              <div className="booking-demo-assign-heading">
                                <div className="booking-demo-assign-title">
                                  <span className="booking-demo-assign-eyebrow">PHÂN BÀN</span>
                                  <h3>Chọn bàn phù hợp</h3>
                                  <p>Yêu cầu #{booking.id} · {booking.ho_ten_khach}</p>
                                </div>
                                <div className="booking-demo-assign-meta">
                                  <span><TeamOutlined /> {booking.so_luong_khach} khách</span>
                                  <span><CalendarOutlined /> {formatDateVN(booking.ngay_dat)} · {booking.gio_bat_dau?.slice(0, 5)}</span>
                                </div>
                              </div>
                              <div className="booking-demo-assign-toolbar">
                                <span>Bàn trống phù hợp <b>{filteredAvailableTables.length}</b></span>
                                <Select
                                  aria-label="Lọc bàn theo khu vực"
                                  value={availableAreaFilter}
                                  onChange={(value) => {
                                    setAvailableAreaFilter(value)
                                    setSelectedTableId('')
                                  }}
                                  options={[
                                    { value: 'all', label: 'Tất cả khu vực' },
                                    ...areas
                                      .filter((area) => availableTables.some((table) => String(table.khu_vuc_id) === String(area.id)))
                                      .map((area) => ({ value: String(area.id), label: formatAreaName(area.ten_khu_vuc) })),
                                  ]}
                                />
                              </div>
                              {availableTables.length ? (
                                filteredAvailableTables.length ? (
                                  <div className="booking-demo-assign-grid">
                                    {filteredAvailableTables.map((table) => {
                                        const areaName = formatAreaName(areasById.get(table.khu_vuc_id)?.ten_khu_vuc || 'Chưa xác định')
                                        const isSelected = String(selectedTableId) === String(table.id)
                                        return (
                                          <button
                                            type="button"
                                            key={table.id}
                                            className={`booking-demo-assign-table${isSelected ? ' is-selected' : ''}`}
                                            aria-pressed={isSelected}
                                            disabled={busy}
                                            onClick={() => setSelectedTableId(String(table.id))}
                                          >
                                            <span className="booking-demo-assign-table-name"><TableOutlined /> {table.ma_ban || tableDisplayName(table)}</span>
                                            <span className="booking-demo-assign-table-area">{areaName}</span>
                                            <span className="booking-demo-assign-table-capacity">{table.da_cau_hinh ? `${table.suc_chua_toi_thieu}–${table.suc_chua_toi_da} khách` : `Tối đa ${table.suc_chua_toi_da} khách`}</span>
                                            <span className="booking-demo-assign-available"><i /> Còn trống phù hợp</span>
                                          </button>
                                        )
                                      })}
                                  </div>
                                ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có bàn phù hợp trong khu vực này." />
                              ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có bàn trống phù hợp với yêu cầu này." />}
                              <div className="booking-demo-assign-footer">
                                <Button
                                  disabled={busy}
                                  onClick={() => {
                                    setAssigningId(null)
                                    setAvailableTables([])
                                    setSelectedTableId('')
                                    setAvailableAreaFilter('all')
                                  }}
                                >Đóng</Button>
                                <Button type="primary" disabled={busy || !selectedTableId} loading={busy} onClick={() => assignTable(booking.id)}>
                                  Phân bàn &amp; xác nhận
                                </Button>
                              </div>
                            </section>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                </tbody>
              </table>
            </div>
            {filteredBookings.length > BOOKINGS_PER_PAGE && (
              <div className="booking-demo-table-pagination" aria-label="Phân trang yêu cầu đặt bàn">
                <span className="booking-demo-page-size">
                  Hiển thị {bookingPageStartIndex + 1}–{Math.min(bookingPageStartIndex + BOOKINGS_PER_PAGE, filteredBookings.length)} trên tổng số {filteredBookings.length} yêu cầu
                </span>
                <div className="booking-demo-page-controls">
                  <Button
                    size="small"
                    aria-label="Trang trước"
                    icon={<LeftOutlined />}
                    disabled={safeBookingPage <= 1}
                    onClick={() => setBookingPage((page) => Math.max(1, page - 1))}
                  />
                  {Array.from({ length: totalBookingPages }, (_, index) => index + 1).map((page) => (
                    <Button
                      key={page}
                      size="small"
                      type={safeBookingPage === page ? 'primary' : 'default'}
                      aria-label={`Trang ${page}`}
                      aria-current={safeBookingPage === page ? 'page' : undefined}
                      onClick={() => setBookingPage(page)}
                    >
                      {page}
                    </Button>
                  ))}
                  <Button
                    size="small"
                    aria-label="Trang sau"
                    icon={<RightOutlined />}
                    disabled={safeBookingPage >= totalBookingPages}
                    onClick={() => setBookingPage((page) => Math.min(totalBookingPages, page + 1))}
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={bookings.length ? 'Không tìm thấy yêu cầu đặt bàn phù hợp.' : 'Chưa có yêu cầu đặt bàn nào.'}
          />
        )}
      </Card>
    </section>
  )
}
