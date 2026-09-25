import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Input, InputNumber, Tag } from 'antd'
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { cancelBooking, createBooking, getBookings, getOpeningSettings, getRestaurantTables, createRestaurantTable, getAvailableTables, confirmBooking } from '../services/api'
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

export default function BookingDemo() {
  const [settings, setSettings] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [date, setDate] = useState(() => vietnamDateTime().date)
  const [time, setTime] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [guests, setGuests] = useState(2)
  const [note, setNote] = useState('')
  const [result, setResult] = useState(null)
  const [tables, setTables] = useState([])
  const [tableName, setTableName] = useState("")
  const [tableSeats, setTableSeats] = useState(2)
  const [assigningId, setAssigningId] = useState(null)
  const [availableTables, setAvailableTables] = useState([])
  const [selectedTableId, setSelectedTableId] = useState("")

  async function reload() {
    setLoading(true)
    setError('')
    try {
      const [configuration, rows, restaurantTables] = await Promise.all([getOpeningSettings(), getBookings(), getRestaurantTables()])
      setSettings(fromServer(configuration))
      setBookings(rows)
      setTables(restaurantTables)
    } catch (cause) {
      setError(apiError(cause))
      setSettings(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Read shared backend state on initial mount, never treat localStorage as the source of truth.
    let mounted = true
    Promise.all([getOpeningSettings(), getBookings(), getRestaurantTables()])
      .then(([configuration, rows, restaurantTables]) => {
        if (mounted) {
          setSettings(fromServer(configuration))
          setBookings(rows)
      setTables(restaurantTables)
        }
      })
      .catch((cause) => { if (mounted) setError(apiError(cause)) })
      .finally(() => { if (mounted) setLoading(false) })
    return () => { mounted = false }
  }, [])

  const weekdayIndex = getWeekdayIndex(date)
  const schedule = weekdayIndex === null ? null : settings?.week[weekdayIndex]
  const holiday = settings?.holidays.find((item) => item.date === date)
  const slots = useMemo(() => {
    const now = vietnamDateTime()
    return !settings?.configured || holiday || !date || date < now.date
      ? []
      : slotsFor(schedule, settings.duration).filter((slot) => date !== now.date || slot > now.time)
  }, [date, holiday, schedule, settings])

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
    } else if (!slots.includes(time)) {
      setResult({ ok: false, message: 'Chọn khung giờ còn hiệu lực, đúng mốc 30 phút và đủ thời lượng trước giờ đóng.' })
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

  async function addTable() {
    if (!tableName.trim() || !Number.isInteger(tableSeats) || tableSeats < 1 || tableSeats > 30) {
      setResult({ ok: false, message: 'Nhập tên bàn và số chỗ từ 1 đến 30.' })
      return
    }

    setBusy(true)
    setResult(null)
    try {
      const added = await createRestaurantTable({
        ten_ban: tableName.trim(),
        so_cho: tableSeats,
      })
      setTables(await getRestaurantTables())
      setTableName('')
      setResult({ ok: true, message: `Đã thêm bàn ${added.ten_ban} (${added.so_cho} chỗ).` })
    } catch (cause) {
      setResult({ ok: false, message: `Không thêm được bàn: ${apiError(cause)}` })
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
        message: `Đã phân ${response.ten_ban} và xác nhận đơn #${bookingId}.`,
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
        <div>
          <p className="booking-demo-eyebrow">QUẢN LÝ YÊU CẦU ĐẶT BÀN</p>
          <h1>Đặt bàn và danh sách yêu cầu</h1>
          <p>Lịch và đơn đặt bàn được đọc, lưu trực tiếp trong PostgreSQL.</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={reload} loading={loading}>Tải lại từ máy chủ</Button>
      </div>

      {error && <Alert showIcon type="error" className="booking-demo-alert" message="Không tải được dữ liệu" description={error} />}
      {loading && <Alert showIcon type="info" className="booking-demo-alert" message="Đang tải lịch và danh sách đặt bàn..." />}
      {settings && !settings.configured && <Alert showIcon type="warning" className="booking-demo-alert" message="Chưa có lịch mở cửa đủ 7 ngày trong PostgreSQL. Quản lý cần lưu cấu hình trước." />}
      {settings && <Alert showIcon type="info" className="booking-demo-alert"
        message={`Múi giờ: ${TIME_ZONE} · Giữ bàn: ${settings.duration} phút · Mốc 30 phút`}
        description="Đơn mới chờ xác nhận. Kiểm tra bàn trống, chọn bàn và xác nhận để giữ chỗ cho khách." />}

      <div className="booking-demo-grid">
        <Card className="booking-demo-card" title={<><CalendarOutlined /> Tạo yêu cầu đặt bàn</>}>
          <form onSubmit={submitBooking} className="booking-demo-form">
            <label>Ngày đặt bàn <span>*</span>
              <input type="date" min={vietnamDateTime().date} value={date} onChange={(event) => { setDate(event.target.value); setTime(''); setResult(null) }} />
            </label>
            <label>Giờ bắt đầu <span>*</span>
              <input type="time" step="60" value={time} onChange={(event) => { setTime(event.target.value); setResult(null) }} />
              <small>Chọn mốc giờ ở bên phải để tự điền.</small>
            </label>
            <label>Họ tên khách <span>*</span>
              <Input value={customerName} maxLength={100} placeholder="Nhập tên khách hàng" onChange={(event) => setCustomerName(event.target.value)} />
            </label>
            <label>Số điện thoại <span>*</span>
              <Input value={phone} maxLength={10} placeholder="Ví dụ: 0912345678" onChange={(event) => setPhone(event.target.value)} />
            </label>
            <label>Số khách <span>*</span>
              <InputNumber min={1} max={30} value={guests} onChange={setGuests} style={{ width: '100%' }} />
            </label>
            <label>Ghi chú
              <Input.TextArea value={note} maxLength={1000} rows={2} placeholder="Yêu cầu của khách (không bắt buộc)" onChange={(event) => setNote(event.target.value)} />
            </label>
            <Button type="primary" htmlType="submit" block loading={busy} disabled={loading || !settings?.configured}>Lưu yêu cầu đặt bàn</Button>
            {result && <Alert showIcon type={result.ok ? 'success' : 'error'} icon={result.ok ? <CheckCircleOutlined /> : <CloseCircleOutlined />} message={result.message} />}
          </form>
        </Card>

        <Card className="booking-demo-card" title={<><ClockCircleOutlined /> Khung giờ theo lịch đã lưu</>}>
          <div className="booking-demo-status">
            <strong>{schedule?.label || 'Chưa chọn ngày'}</strong>
            {holiday ? <Tag color="red">Nghỉ đặc biệt</Tag> : schedule?.closed ? <Tag color="red">Ngày nghỉ</Tag> : schedule ? <Tag color="green">Mở cửa</Tag> : <Tag>Chưa có lịch</Tag>}
          </div>
          {holiday && <Alert type="error" showIcon message={`Nghỉ đặc biệt: ${holiday.name}`} />}
          {!holiday && schedule?.closed && <Alert type="warning" showIcon message="Không nhận đặt bàn theo lịch tuần." />}
          {!holiday && schedule && !schedule.closed && <p className="booking-demo-hours">Giờ mở cửa: <b>{schedule.open} – {schedule.close}</b></p>}
          {slots.length ? (
            <>
              <p className="booking-demo-help">Chọn giờ bên dưới. Các mốc bảo đảm đủ thời lượng giữ bàn trước giờ đóng.</p>
              <div className="booking-demo-slots">
                {slots.map((slot) => (
                  <button key={slot} type="button" className={time === slot ? 'selected' : ''} onClick={() => { setTime(slot); setResult(null) }}>{slot}</button>
                ))}
              </div>
            </>
          ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có khung giờ nhận đặt bàn cho ngày này." />}
          <div className="booking-demo-note">Ngày nghỉ đặc biệt được ưu tiên hơn lịch tuần. Backend kiểm tra lại trước khi lưu.</div>
        </Card>
      </div>

      <Card className="booking-demo-card booking-demo-list" title={`Bàn vật lý (${tables.length})`}>
        <div className="booking-demo-table-controls">
          <Input placeholder="Tên bàn (ví dụ: B01)" value={tableName} maxLength={50} onChange={(event) => setTableName(event.target.value)} />
          <InputNumber min={1} max={30} value={tableSeats} onChange={setTableSeats} style={{ width: 110 }} addonAfter="chỗ" />
          <Button type="primary" loading={busy} onClick={addTable}>Thêm bàn</Button>
          <Button disabled={busy} onClick={async () => {
            try { setTables(await getRestaurantTables()) }
            catch (cause) { setResult({ ok: false, message: apiError(cause) }) }
          }}>Tải bàn</Button>
        </div>
        <p className="booking-demo-help">Chỉ Quản lý được thêm bàn; Quản lý và Phục vụ được phân bàn. Bàn phải được khai báo trước khi xác nhận đơn.</p>
        <div className="booking-demo-table-chips">
          {tables.map((table) => <Tag key={table.id} color={table.hoat_dong ? 'green' : 'default'}>{table.ten_ban} · {table.so_cho} chỗ{table.hoat_dong ? '' : ' (ngừng dùng)'}</Tag>)}
          {!tables.length && <span>Chưa có bàn nào. Quản lý hãy thêm bàn.</span>}
        </div>
      </Card>

      <Card className="booking-demo-card booking-demo-list" title={`Yêu cầu đã lưu (${bookings.length})`}>
        {bookings.length ? bookings.map((booking) => (
          <div key={booking.id} className="booking-demo-list-item">
            <div>
              <strong>#{booking.id} · {booking.ho_ten_khach}</strong>
              <p>{booking.ngay_dat} · {booking.gio_bat_dau?.slice(0, 5)} · {booking.so_luong_khach} khách · {booking.thoi_luong_giu_ban} phút</p>
              <p>Điện thoại: {booking.so_dien_thoai}{booking.ghi_chu ? ` · ${booking.ghi_chu}` : ''}</p>
              {booking.ban_id && <p>Đã phân: <b>{booking.ten_ban || `Bàn #${booking.ban_id}`}</b></p>}
            </div>
            <div className="booking-demo-list-actions">
              <Tag color={booking.trang_thai === 'DA_HUY' ? 'default' : booking.trang_thai === 'DA_XAC_NHAN' ? 'green' : 'orange'}>
                {booking.trang_thai === 'DA_HUY' ? 'Đã hủy' : booking.trang_thai === 'DA_XAC_NHAN' ? 'Đã xác nhận' : 'Chờ xác nhận'}
              </Tag>
              {booking.trang_thai === 'CHO_XAC_NHAN' && <Button size="small" disabled={busy} onClick={() => checkAvailable(booking.id)}>Kiểm tra bàn trống</Button>}
              {booking.trang_thai === 'CHO_XAC_NHAN' && <Button danger size="small" disabled={busy} onClick={() => cancel(booking.id)}>Hủy</Button>}
              {booking.trang_thai === 'CHO_XAC_NHAN' && assigningId === booking.id && (
                <div className="booking-demo-assign">
                  <select value={selectedTableId} onChange={(event) => setSelectedTableId(event.target.value)} disabled={busy || !availableTables.length}>
                    <option value="">{availableTables.length ? 'Chọn bàn còn trống' : 'Không có bàn phù hợp'}</option>
                    {availableTables.map((table) => <option key={table.id} value={table.id}>{table.ten_ban} · {table.so_cho} chỗ</option>)}
                  </select>
                  <Button type="primary" size="small" disabled={busy || !selectedTableId} loading={busy} onClick={() => assignTable(booking.id)}>Phân bàn & xác nhận</Button>
                </div>
              )}
            </div>
          </div>
        )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có yêu cầu đặt bàn nào." />}
      </Card>
    </section>
  )
}
