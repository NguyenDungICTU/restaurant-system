import { useEffect, useState } from 'react'
import { App as AntdApp, Button, Input, InputNumber } from 'antd'
import {
  addSpecialClosure,
  getBusinessHours,
  getSpecialClosures,
  removeSpecialClosure,
  saveBusinessHours,
} from '../services/api'

const WEEKDAYS = ['Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy', 'Chủ nhật']
const DEFAULT_DAYS = WEEKDAYS.map((_, weekday) => ({
  weekday,
  is_closed: true,
  open_time: null,
  close_time: null,
}))

export default function BusinessHours() {
  const { message, modal } = AntdApp.useApp()
  const [days, setDays] = useState(DEFAULT_DAYS)
  const [duration, setDuration] = useState(90)
  const [closures, setClosures] = useState([])
  const [closureDate, setClosureDate] = useState('')
  const [closureNote, setClosureNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [schedule, holidays] = await Promise.all([
        getBusinessHours(),
        getSpecialClosures(),
      ])
      setDays(schedule.days)
      setDuration(schedule.reservation_duration_minutes)
      setClosures(holidays)
    } catch (requestError) {
      message.error(requestError.response?.data?.detail || 'Không tải được giờ hoạt động.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function updateDay(weekday, changes) {
    setDays((current) => current.map((day) => (
      day.weekday === weekday ? { ...day, ...changes } : day
    )))
  }

  async function save() {
    setSaving(true)
    try {
      const saved = await saveBusinessHours({
        days,
        reservation_duration_minutes: duration,
      })
      setDays(saved.days)
      setDuration(saved.reservation_duration_minutes)
      message.success('Đã lưu giờ mở cửa và khung nhận đặt bàn.')
    } catch (requestError) {
      message.error(requestError.response?.data?.detail || 'Không thể lưu giờ hoạt động.')
    } finally {
      setSaving(false)
    }
  }

  async function addClosure(event) {
    event.preventDefault()
    if (!closureDate) return
    try {
      const created = await addSpecialClosure({ date: closureDate, note: closureNote || null })
      setClosures((current) => [...current, created].sort((a, b) => a.date.localeCompare(b.date)))
      setClosureDate('')
      setClosureNote('')
      message.success('Đã thêm ngày nghỉ đặc biệt.')
    } catch (requestError) {
      message.error(requestError.response?.data?.detail || 'Không thể thêm ngày nghỉ.')
    }
  }

  function deleteClosure(closure) {
    modal.confirm({
      title: 'Xóa ngày nghỉ đặc biệt?',
      content: `Ngày ${closure.date} sẽ nhận đặt bàn theo lịch tuần.`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await removeSpecialClosure(closure.id)
          setClosures((current) => current.filter((item) => item.id !== closure.id))
          message.success('Đã xóa ngày nghỉ.')
        } catch (requestError) {
          message.error(requestError.response?.data?.detail || 'Không thể xóa ngày nghỉ.')
          throw requestError
        }
      },
    })
  }

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">CẤU HÌNH ĐẶT BÀN</p>
          <h1>Giờ mở cửa & khung nhận bàn</h1>
          <p className="subheading">Múi giờ áp dụng: Asia/Ho_Chi_Minh · khung giờ cách nhau 30 phút.</p>
        </div>
        <Button type="primary" onClick={save} loading={saving} disabled={loading}>Lưu lịch tuần</Button>
      </header>

      <section className="panel hours-panel">
        <div className="hours-grid hours-header"><strong>Ngày</strong><strong>Nghỉ</strong><strong>Mở cửa</strong><strong>Đóng cửa</strong></div>
        {days.map((day) => (
          <div className="hours-grid" key={day.weekday}>
            <strong>{WEEKDAYS[day.weekday]}</strong>
            <input
              type="checkbox"
              checked={day.is_closed}
              onChange={(event) => updateDay(day.weekday, {
                is_closed: event.target.checked,
                open_time: event.target.checked ? null : day.open_time || '09:00',
                close_time: event.target.checked ? null : day.close_time || '22:00',
              })}
              aria-label={`${WEEKDAYS[day.weekday]} nghỉ`}
            />
            <input
              type="time"
              value={day.open_time || ''}
              disabled={day.is_closed}
              onChange={(event) => updateDay(day.weekday, { open_time: event.target.value })}
            />
            <input
              type="time"
              value={day.close_time || ''}
              disabled={day.is_closed}
              onChange={(event) => updateDay(day.weekday, { close_time: event.target.value })}
            />
          </div>
        ))}
        <div className="duration-setting">
          <label>Thời lượng mỗi lượt đặt (phút)</label>
          <InputNumber min={30} max={720} value={duration} onChange={setDuration} />
          <span>Mặc định 90 phút</span>
        </div>
      </section>

      <section className="panel closure-panel">
        <h2>Ngày nghỉ đặc biệt</h2>
        <p>Ngày này không nhận đặt bàn dù lịch tuần đang mở.</p>
        <form className="audit-filters" onSubmit={addClosure}>
          <label>Ngày<input type="date" value={closureDate} onChange={(event) => setClosureDate(event.target.value)} required /></label>
          <label>Ghi chú<Input value={closureNote} onChange={(event) => setClosureNote(event.target.value)} maxLength={255} placeholder="Ví dụ: Nghỉ Tết" /></label>
          <Button htmlType="submit">Thêm ngày nghỉ</Button>
        </form>
        <div className="closure-list">
          {closures.map((closure) => (
            <div className="closure-item" key={closure.id}>
              <strong>{closure.date}</strong><span>{closure.note || 'Ngày nghỉ'}</span>
              <Button danger type="link" onClick={() => deleteClosure(closure)}>Xóa</Button>
            </div>
          ))}
          {!closures.length && <p>Chưa khai báo ngày nghỉ đặc biệt.</p>}
        </div>
      </section>
    </section>
  )
}
