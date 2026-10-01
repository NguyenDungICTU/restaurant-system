import { useEffect, useState } from 'react'
import {
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  LoadingOutlined,
  PhoneOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Button, Input, InputNumber } from 'antd'
import { createPublicBooking, getPublicBookingAreas, getPublicTimeSlots } from '../services/api'
import './PublicBooking.css'

const TIME_ZONE = 'Asia/Ho_Chi_Minh'

function vietnamToday() {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function formatDate(value) {
  if (!value) return ''
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'UTC',
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function apiError(error) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join('; ')
  return error?.message || 'Không kết nối được máy chủ. Vui lòng thử lại.'
}

export default function PublicBooking({ onBack }) {
  const [today] = useState(() => vietnamToday())
  const [areas, setAreas] = useState([])
  const [areasLoading, setAreasLoading] = useState(true)
  const [date, setDate] = useState(today)
  const [guests, setGuests] = useState(2)
  const [areaId, setAreaId] = useState('')
  const [slots, setSlots] = useState(null)
  const [slotsLoading, setSlotsLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [summary, setSummary] = useState(null)

  useEffect(() => {
    let cancelled = false
    getPublicBookingAreas()
      .then((data) => { if (!cancelled) setAreas(Array.isArray(data) ? data : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAreasLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    getPublicTimeSlots({ ngay: date, so_luong_khach: guests })
      .then((data) => {
        if (!cancelled) {
          setSlots(data)
          setSelectedSlot('')
          setFormError('')
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setSlots(null)
          setFormError(apiError(cause))
        }
      })
      .finally(() => { if (!cancelled) setSlotsLoading(false) })
    return () => { cancelled = true }
  }, [date, guests])

  function handleDateChange(next) {
    setDate(next)
    setSelectedSlot('')
    setSlots(null)
    setSlotsLoading(true)
  }

  function handleGuestsChange(next) {
    setGuests(next || 1)
    setSelectedSlot('')
    setSlots(null)
    setSlotsLoading(true)
  }

  function validate() {
    if (!name.trim()) return 'Vui lòng nhập họ tên khách.'
    if (!/^0\d{9}$/.test(phone.trim())) return 'Số điện thoại gồm 10 chữ số và bắt đầu bằng 0.'
    if (!Number.isInteger(guests) || guests < 1 || guests > 20) return 'Số khách phải từ 1 đến 20.'
    if (!selectedSlot) return 'Vui lòng chọn khung giờ.'
    return ''
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setFormError('')
    const message = validate()
    if (message) {
      setFormError(message)
      return
    }
    setSubmitting(true)
    try {
      const created = await createPublicBooking({
        ho_ten_khach: name.trim(),
        so_dien_thoai: phone.trim(),
        so_luong_khach: guests,
        ngay_dat: date,
        gio_bat_dau: selectedSlot,
        khu_vuc_id: areaId || null,
        ghi_chu: note.trim() || null,
      })
      setSummary(created)
    } catch (cause) {
      setFormError(apiError(cause))
    } finally {
      setSubmitting(false)
    }
  }

  function resetForm() {
    setSummary(null)
    setName('')
    setPhone('')
    setNote('')
    setAreaId('')
    setSelectedSlot('')
    setFormError('')
  }

  if (summary) {
    return (
      <div className="public-booking-page">
        <header className="public-booking-header">
          <div className="public-booking-brand">
            <button className="public-booking-back" onClick={onBack} aria-label="Quay lại">
              <ArrowLeftOutlined />
            </button>
            <div className="brand-mark">R</div>
            <div>
              <strong>Resto</strong>
              <span>Đặt bàn</span>
            </div>
          </div>
        </header>

        <main className="public-booking-main">
          <section className="booking-success">
            <div className="booking-success-icon"><CheckCircleOutlined /></div>
            <p className="booking-success-eyebrow">ĐẶT BÀN THÀNH CÔNG</p>
            <h1>Mã đặt bàn của bạn</h1>
            <div className="booking-code">{summary.ma_dat_ban}</div>
            <p className="booking-success-status"><span className="status-dot" /> Trạng thái: Chờ xác nhận</p>
            <div className="booking-success-card">
              <div className="booking-success-row">
                <span>Khách hàng</span>
                <strong>{summary.ho_ten_khach}</strong>
              </div>
              <div className="booking-success-row">
                <span>Số điện thoại</span>
                <strong>{summary.so_dien_thoai}</strong>
              </div>
              <div className="booking-success-row">
                <span>Thời gian</span>
                <strong>{formatDate(summary.ngay_dat)} · {summary.gio_bat_dau?.slice(0, 5)}</strong>
              </div>
              <div className="booking-success-row">
                <span>Số khách</span>
                <strong>{summary.so_luong_khach} khách</strong>
              </div>
              <div className="booking-success-row">
                <span>Khu vực</span>
                <strong>{summary.ten_khu_vuc || 'Bất kỳ'}</strong>
              </div>
              {summary.ghi_chu && (
                <div className="booking-success-row">
                  <span>Ghi chú</span>
                  <strong>{summary.ghi_chu}</strong>
                </div>
              )}
            </div>
            <p className="booking-success-note">
              Nhà hàng sẽ liên hệ qua số điện thoại để xác nhận. Vui lòng giữ mã đặt bàn khi đến quán.
            </p>
            <div className="booking-success-actions">
              <Button type="primary" onClick={resetForm}>Đặt thêm lượt mới</Button>
              <Button onClick={onBack}>Về trang chủ</Button>
            </div>
          </section>
        </main>
      </div>
    )
  }

  return (
    <div className="public-booking-page">
      <header className="public-booking-header">
        <div className="public-booking-brand">
          <button className="public-booking-back" onClick={onBack} aria-label="Quay lại">
            <ArrowLeftOutlined />
          </button>
          <div className="brand-mark">R</div>
          <div>
            <strong>Resto</strong>
            <span>Đặt bàn</span>
          </div>
        </div>
      </header>

      <main className="public-booking-main">
        <section className="public-booking-intro">
          <p className="eyebrow">ĐẶT BÀN TRỰC TUYẾN</p>
          <h1>Đặt bàn trước, khỏi chờ lâu.</h1>
          <p>Chọn ngày, giờ và khu vực bạn mong muốn. Nhà hàng sẽ liên hệ xác nhận trong thời gian sớm nhất.</p>
        </section>

        <form className="public-booking-form" onSubmit={handleSubmit}>
          <section className="booking-step">
            <div className="booking-step-heading">
              <span className="booking-step-num">1</span>
              <div>
                <h2>Chọn ngày & số khách</h2>
                <p>Chọn ngày bạn muốn đến và số lượng khách.</p>
              </div>
            </div>
            <div className="booking-step-grid">
              <label className="booking-field">
                <span className="booking-field-label"><CalendarOutlined /> Ngày đặt bàn</span>
                <input type="date" min={today} value={date} onChange={(event) => handleDateChange(event.target.value)} />
              </label>
              <label className="booking-field">
                <span className="booking-field-label"><TeamOutlined /> Số khách</span>
                <InputNumber min={1} max={20} value={guests} onChange={handleGuestsChange} style={{ width: '100%' }} />
              </label>
            </div>
          </section>

          <section className="booking-step">
            <div className="booking-step-heading">
              <span className="booking-step-num">2</span>
              <div>
                <h2>Chọn khung giờ</h2>
                <p>Chỉ hiện giờ mở cửa còn bàn phù hợp. Giữ bàn {slots?.thoi_luong_giu_ban || 90} phút.</p>
              </div>
            </div>
            {slotsLoading ? (
              <div className="booking-slots-loading"><LoadingOutlined spin /> Đang tải khung giờ...</div>
            ) : slots?.ly_do ? (
              <div className="booking-slots-empty">{slots.ly_do}</div>
            ) : (
              <div className="booking-slots">
                {(slots?.khung_gio || []).map((slot) => (
                  <button
                    key={slot.gio}
                    type="button"
                    disabled={!slot.kha_dung}
                    className={`booking-slot ${selectedSlot === slot.gio ? 'selected' : ''} ${slot.kha_dung ? '' : 'disabled'}`}
                    onClick={() => setSelectedSlot(slot.gio)}
                    title={slot.ly_do || ''}
                  >
                    <span className="booking-slot-time">{slot.gio}</span>
                    {!slot.kha_dung && slot.ly_do && <span className="booking-slot-reason">{slot.ly_do}</span>}
                  </button>
                ))}
                {slots && !slots.khung_gio.length && <div className="booking-slots-empty">Chưa có khung giờ nhận đặt bàn cho ngày này.</div>}
              </div>
            )}
          </section>

          <section className="booking-step">
            <div className="booking-step-heading">
              <span className="booking-step-num">3</span>
              <div>
                <h2>Khu vực mong muốn</h2>
                <p>Không bắt buộc. Nhà hàng sẽ cố gắng sắp xếp theo mong muốn của bạn.</p>
              </div>
            </div>
            {areasLoading ? (
              <div className="booking-slots-loading"><LoadingOutlined spin /> Đang tải khu vực...</div>
            ) : (
              <div className="booking-areas">
                <button type="button" className={`booking-area ${areaId === '' ? 'selected' : ''}`} onClick={() => setAreaId('')}>
                  <EnvironmentOutlined /> Bất kỳ
                </button>
                {areas.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    className={`booking-area ${areaId === String(area.id) ? 'selected' : ''}`}
                    onClick={() => setAreaId(String(area.id))}
                  >
                    <EnvironmentOutlined /> {area.ten_khu_vuc}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="booking-step">
            <div className="booking-step-heading">
              <span className="booking-step-num">4</span>
              <div>
                <h2>Thông tin khách</h2>
                <p>Nhập thông tin để nhà hàng liên hệ xác nhận.</p>
              </div>
            </div>
            <div className="booking-step-grid booking-step-grid-stack">
              <label className="booking-field">
                <span className="booking-field-label"><UserOutlined /> Họ tên khách</span>
                <Input value={name} maxLength={100} placeholder="Nhập họ tên" onChange={(event) => setName(event.target.value)} />
              </label>
              <label className="booking-field">
                <span className="booking-field-label"><PhoneOutlined /> Số điện thoại</span>
                <Input value={phone} maxLength={10} placeholder="Ví dụ: 0912345678" onChange={(event) => setPhone(event.target.value)} />
              </label>
              <label className="booking-field">
                <span className="booking-field-label"><FileTextOutlined /> Ghi chú</span>
                <Input.TextArea value={note} maxLength={1000} rows={3} placeholder="Yêu cầu thêm (không bắt buộc)" onChange={(event) => setNote(event.target.value)} />
              </label>
            </div>
          </section>

          {formError && <div className="booking-form-error">{formError}</div>}

          <div className="booking-submit-bar">
            <div className="booking-submit-summary">
              {selectedSlot ? (
                <span>{formatDate(date)} · {selectedSlot} · {guests} khách{areaId ? ' · có chọn khu vực' : ''}</span>
              ) : (
                <span>Chọn khung giờ để hoàn tất.</span>
              )}
            </div>
            <Button type="primary" htmlType="submit" size="large" loading={submitting}>
              Gửi yêu cầu đặt bàn
            </Button>
          </div>
        </form>
      </main>
    </div>
  )
}
