import { useMemo, useState } from 'react'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  PlusOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  message,
  Switch,
  Tag,
} from 'antd'

import './OpeningHoursSettings.css'

const STORAGE_KEY = 'resto-opening-hours-settings'

const DEFAULT_WEEK = [
  { key: 'monday', label: 'Thứ Hai', closed: false, open: '08:00', close: '22:00' },
  { key: 'tuesday', label: 'Thứ Ba', closed: false, open: '08:00', close: '22:00' },
  { key: 'wednesday', label: 'Thứ Tư', closed: false, open: '08:00', close: '22:00' },
  { key: 'thursday', label: 'Thứ Năm', closed: false, open: '08:00', close: '22:00' },
  { key: 'friday', label: 'Thứ Sáu', closed: false, open: '08:00', close: '23:00' },
  { key: 'saturday', label: 'Thứ Bảy', closed: false, open: '08:00', close: '23:00' },
  { key: 'sunday', label: 'Chủ Nhật', closed: true, open: '08:00', close: '22:00' },
]

function toMinutes(value) {
  if (!value || !value.includes(':')) return null
  const [hour, minute] = value.split(':').map(Number)
  if (!Number.isInteger(hour) || !Number.isInteger(minute)) return null
  return hour * 60 + minute
}

function toTime(minutes) {
  const hour = Math.floor(minutes / 60)
  const minute = minutes % 60
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function createSlots(open, close, duration) {
  const start = toMinutes(open)
  const end = toMinutes(close)
  if (start === null || end === null || end <= start) return []

  const slots = []
  for (let current = start; current < end; current += 30) {
    if (current + duration <= end) {
      slots.push(toTime(current))
    }
  }
  return slots
}

function loadInitialData() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
    if (saved?.week?.length === 7) {
      return {
        week: saved.week,
        duration: saved.duration || 90,
        holidays: saved.holidays || [],
      }
    }
  } catch {
    // Dùng cấu hình mặc định khi dữ liệu lưu cục bộ không hợp lệ.
  }

  return {
    week: DEFAULT_WEEK,
    duration: 90,
    holidays: [],
  }
}

export default function OpeningHoursSettings() {
  const initial = useMemo(loadInitialData, [])
  const [week, setWeek] = useState(initial.week)
  const [duration, setDuration] = useState(initial.duration)
  const [holidays, setHolidays] = useState(initial.holidays)
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayName, setHolidayName] = useState('')
  const [errors, setErrors] = useState({})
  const [savedAt, setSavedAt] = useState('')

  const totalSlots = useMemo(
    () => week.reduce((sum, day) => {
      if (day.closed) return sum
      return sum + createSlots(day.open, day.close, duration).length
    }, 0),
    [week, duration],
  )

  function updateDay(key, patch) {
    setWeek((current) => current.map((day) => (
      day.key === key ? { ...day, ...patch } : day
    )))

    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  function validateWeek() {
    const nextErrors = {}

    week.forEach((day) => {
      if (day.closed) return

      const open = toMinutes(day.open)
      const close = toMinutes(day.close)

      if (open === null || close === null) {
        nextErrors[day.key] = 'Vui lòng nhập đầy đủ giờ mở cửa và giờ đóng cửa.'
        return
      }

      if (close <= open) {
        nextErrors[day.key] = 'Giờ đóng cửa phải sau giờ mở cửa.'
      }
    })

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  function saveSettings() {
    if (!validateWeek()) {
      message.error('Không thể lưu vì lịch tuần còn dữ liệu chưa hợp lệ.')
      return
    }

    if (!Number.isInteger(duration) || duration <= 0) {
      message.error('Thời lượng giữ bàn phải lớn hơn 0 phút.')
      return
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      week,
      duration,
      holidays,
      timezone: 'Asia/Ho_Chi_Minh',
    }))

    const now = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date())

    setSavedAt(now)
    message.success('Đã lưu cấu hình giờ hoạt động.')
  }

  function addHoliday() {
    if (!holidayDate) {
      message.warning('Vui lòng chọn ngày nghỉ đặc biệt.')
      return
    }

    if (holidays.some((item) => item.date === holidayDate)) {
      message.warning('Ngày này đã có trong danh sách nghỉ đặc biệt.')
      return
    }

    setHolidays((current) => [
      ...current,
      {
        id: `${holidayDate}-${Date.now()}`,
        date: holidayDate,
        name: holidayName.trim() || 'Ngày nghỉ đặc biệt',
      },
    ].sort((a, b) => a.date.localeCompare(b.date)))

    setHolidayDate('')
    setHolidayName('')
  }

  function removeHoliday(id) {
    setHolidays((current) => current.filter((item) => item.id !== id))
  }

  return (
    <section className="opening-hours-page">
      <div className="opening-hours-header">
        <div>
          <p className="opening-hours-eyebrow">CÀI ĐẶT VẬN HÀNH</p>
          <h1>Giờ mở cửa & nhận đặt bàn</h1>
          <p className="opening-hours-description">
            Thiết lập lịch hoạt động theo tuần, thời lượng giữ bàn và các ngày nghỉ đặc biệt.
          </p>
        </div>

        <div className="opening-hours-actions">
          {savedAt && <span className="saved-at">Đã lưu lúc {savedAt}</span>}
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={saveSettings}
          >
            Lưu cấu hình
          </Button>
        </div>
      </div>

      <Alert
        className="timezone-alert"
        type="info"
        showIcon
        message="Múi giờ áp dụng: Asia/Ho_Chi_Minh"
        description="Tất cả giờ mở cửa, khung giờ nhận đặt bàn và ngày nghỉ đặc biệt đều được hiểu theo múi giờ Việt Nam."
      />

      <div className="opening-hours-summary">
        <Card size="small">
          <span className="summary-label">Ngày đang mở</span>
          <strong>{week.filter((day) => !day.closed).length}/7</strong>
        </Card>
        <Card size="small">
          <span className="summary-label">Bước khung giờ</span>
          <strong>30 phút</strong>
        </Card>
        <Card size="small">
          <span className="summary-label">Thời lượng giữ bàn</span>
          <strong>{duration} phút</strong>
        </Card>
        <Card size="small">
          <span className="summary-label">Khung giờ khả dụng/tuần</span>
          <strong>{totalSlots}</strong>
        </Card>
      </div>

      <Card className="settings-card" title={(
        <div className="card-title-with-icon">
          <ClockCircleOutlined />
          <span>Lịch mở cửa theo tuần</span>
        </div>
      )}>
        <div className="weekly-schedule">
          {week.map((day) => {
            const slots = day.closed
              ? []
              : createSlots(day.open, day.close, duration)

            return (
              <div
                className={`schedule-row ${day.closed ? 'is-closed' : ''}`}
                key={day.key}
              >
                <div className="schedule-day">
                  <strong>{day.label}</strong>
                  <span>{day.closed ? 'Không nhận đặt bàn' : `${slots.length} khung giờ có thể nhận`}</span>
                </div>

                <div className="schedule-status">
                  <Switch
                    checked={!day.closed}
                    onChange={(checked) => updateDay(day.key, { closed: !checked })}
                  />
                  <span>{day.closed ? 'Nghỉ' : 'Mở cửa'}</span>
                </div>

                <div className="time-field">
                  <label>Giờ mở</label>
                  <input
                    type="time"
                    value={day.open}
                    disabled={day.closed}
                    onChange={(event) => updateDay(day.key, { open: event.target.value })}
                  />
                </div>

                <div className="time-divider">→</div>

                <div className="time-field">
                  <label>Giờ đóng</label>
                  <input
                    type="time"
                    value={day.close}
                    disabled={day.closed}
                    onChange={(event) => updateDay(day.key, { close: event.target.value })}
                  />
                </div>

                <div className="slot-preview">
                  {day.closed ? (
                    <Tag>Ngày nghỉ</Tag>
                  ) : slots.length ? (
                    <>
                      {slots.slice(0, 4).map((slot) => (
                        <Tag key={slot}>{slot}</Tag>
                      ))}
                      {slots.length > 4 && <Tag>+{slots.length - 4}</Tag>}
                    </>
                  ) : (
                    <Tag color="error">Không có khung giờ hợp lệ</Tag>
                  )}
                </div>

                {errors[day.key] && (
                  <div className="schedule-error">{errors[day.key]}</div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <div className="settings-grid">
        <Card className="settings-card" title="Quy tắc nhận đặt bàn">
          <div className="booking-rule">
            <div>
              <strong>Thời lượng giữ bàn mặc định</strong>
              <p>Mỗi lượt đặt sẽ giữ bàn trong khoảng thời gian này.</p>
            </div>

            <div className="duration-control">
              <InputNumber
                min={30}
                step={30}
                value={duration}
                onChange={(value) => setDuration(Number(value || 0))}
              />
              <span>phút</span>
            </div>
          </div>

          <div className="rule-note">
            Khung giờ bắt đầu được chia cố định theo bước <strong>30 phút</strong>.
            Hệ thống chỉ hiển thị các khung giờ mà lượt giữ bàn có thể hoàn tất trước giờ đóng cửa.
          </div>
        </Card>

        <Card
          className="settings-card"
          title={(
            <div className="card-title-with-icon">
              <CalendarOutlined />
              <span>Ngày nghỉ đặc biệt</span>
            </div>
          )}
        >
          <div className="holiday-form">
            <div className="holiday-field">
              <label>Ngày nghỉ</label>
              <input
                type="date"
                value={holidayDate}
                onChange={(event) => setHolidayDate(event.target.value)}
              />
            </div>

            <div className="holiday-field holiday-name-field">
              <label>Tên / ghi chú</label>
              <Input
                value={holidayName}
                placeholder="Ví dụ: Tết Dương lịch"
                onChange={(event) => setHolidayName(event.target.value)}
                onPressEnter={addHoliday}
              />
            </div>

            <Button
              icon={<PlusOutlined />}
              onClick={addHoliday}
            >
              Thêm ngày nghỉ
            </Button>
          </div>

          <div className="holiday-list">
            {holidays.length === 0 ? (
              <div className="holiday-empty">
                Chưa khai báo ngày nghỉ đặc biệt.
              </div>
            ) : holidays.map((holiday) => (
              <div className="holiday-item" key={holiday.id}>
                <div>
                  <strong>{holiday.name}</strong>
                  <span>{holiday.date}</span>
                </div>
                <Tag color="red">Không nhận đặt bàn</Tag>
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => removeHoliday(holiday.id)}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  )
}

