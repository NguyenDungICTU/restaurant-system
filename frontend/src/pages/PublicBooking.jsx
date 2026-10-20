import { useEffect, useState } from 'react'
import {
  AlertOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  EnvironmentOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LoadingOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Alert, Button, Input, InputNumber, Modal, Tag } from 'antd'
import {
  cancelPublicBooking,
  createPublicBooking,
  getPublicBookingAreas,
  getPublicTimeSlots,
  lookupPublicBooking,
  requestPublicBookingEmailOtp,
  verifyPublicBookingEmailOtp,
} from '../services/api'
import './PublicBooking.css'

const TIME_ZONE = 'Asia/Ho_Chi_Minh'
const HISTORY_KEY = 'restaurant_public_booking_history'

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

function formatDateTime(booking) {
  return `${formatDate(booking.ngay_dat)} · ${booking.gio_bat_dau?.slice(0, 5)}`
}

function apiError(error) {
  const detail = error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object') return detail.message || 'Yêu cầu không thể thực hiện.'
  if (Array.isArray(detail)) return detail.map((item) => item.msg).join('; ')
  return error?.message || 'Không kết nối được máy chủ. Vui lòng thử lại.'
}

function readHistory() {
  try {
    const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}

function saveHistory(booking) {
  const item = {
    ma_dat_ban: booking.ma_dat_ban,
    so_dien_thoai: booking.so_dien_thoai,
    email: booking.email || '',
    ho_ten_khach: booking.ho_ten_khach,
    ngay_dat: booking.ngay_dat,
    gio_bat_dau: booking.gio_bat_dau,
    created_at: new Date().toISOString(),
  }
  const next = [
    item,
    ...readHistory().filter((entry) => entry.ma_dat_ban !== item.ma_dat_ban),
  ].slice(0, 20)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}

function statusLabel(status) {
  return {
    CHO_XAC_NHAN: 'Chờ xác nhận',
    DA_XAC_NHAN: 'Đã xác nhận',
    DA_HUY: 'Đã huỷ',
    KHONG_DEN: 'Không đến',
    DA_HOAN_TAT: 'Hoàn tất',
  }[status] || status
}

function statusColor(status) {
  if (status === 'DA_HUY') return 'default'
  if (status === 'DA_XAC_NHAN') return 'green'
  if (status === 'CHO_XAC_NHAN') return 'gold'
  return 'blue'
}

function BookingInfo({ booking, onCancel }) {
  return (
    <div className="public-lookup-result">
      <div className="lookup-result-header">
        <div>
          <p className="booking-success-eyebrow">THÔNG TIN ĐẶT BÀN</p>
          <h2>{booking.ma_dat_ban}</h2>
        </div>
        <Tag color={statusColor(booking.trang_thai)}>{statusLabel(booking.trang_thai)}</Tag>
      </div>

      <div className="booking-success-card">
        <div className="booking-success-row"><span>Thời gian</span><strong>{formatDateTime(booking)}</strong></div>
        <div className="booking-success-row"><span>Số khách</span><strong>{booking.so_luong_khach} khách</strong></div>
        <div className="booking-success-row"><span>Khu vực</span><strong>{booking.ten_khu_vuc || 'Bất kỳ'}</strong></div>
        <div className="booking-success-row"><span>Bàn đã xếp</span><strong>{booking.ten_ban || 'Chưa xếp bàn'}</strong></div>
        <div className="booking-success-row"><span>Số điện thoại</span><strong>{booking.so_dien_thoai}</strong></div>
        <div className="booking-success-row"><span>Email</span><strong>{booking.email || 'Chưa có'}</strong></div>
      </div>

      {booking.thong_bao_huy && (
        <div className={`lookup-cancel-note ${booking.co_the_huy ? '' : 'warning'}`}>
          <AlertOutlined /> {booking.thong_bao_huy}
        </div>
      )}

      {booking.co_the_huy ? (
        <Button danger icon={<DeleteOutlined />} onClick={onCancel} block>
          Huỷ đặt bàn
        </Button>
      ) : booking.phut_con_lai < 60 && booking.trang_thai !== 'DA_HUY' ? (
        <div className="lookup-phone-box">
          <PhoneOutlined />
          <span>
            Đã dưới 60 phút trước giờ hẹn. Vui lòng gọi trực tiếp cho nhà hàng:
            <strong>{booking.so_dien_thoai_quan || ' Nhà hàng chưa cấu hình số điện thoại.'}</strong>
          </span>
        </div>
      ) : null}
    </div>
  )
}

export default function PublicBooking({
  onBack,
  initialMode = 'create',
  initialLookupCode = '',
}) {
  const [mode, setMode] = useState(initialMode)
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
  const [email, setEmail] = useState('')
  const [emailOtp, setEmailOtp] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailVerificationToken, setEmailVerificationToken] = useState('')
  const [otpError, setOtpError] = useState('')
  const [otpMessage, setOtpMessage] = useState('')
  const [resendSeconds, setResendSeconds] = useState(0)
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [summary, setSummary] = useState(null)

  const [history, setHistory] = useState(() => readHistory())
  const [lookupCode, setLookupCode] = useState(
    () => initialLookupCode.trim().toUpperCase()
  )
  const [lookupPhone, setLookupPhone] = useState('')
  const [lookupResult, setLookupResult] = useState(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState('')

  useEffect(() => {
    let cancelled = false
    getPublicBookingAreas()
      .then((data) => { if (!cancelled) setAreas(Array.isArray(data) ? data : []) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setAreasLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (resendSeconds <= 0) return undefined
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [resendSeconds])

  useEffect(() => {
    if (mode !== 'create') return undefined
    let cancelled = false
    setSlotsLoading(true)
    getPublicTimeSlots({ ngay: date, so_luong_khach: guests, ...(areaId ? { khu_vuc_id: Number(areaId) } : {}) })
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
  }, [date, guests, areaId, mode])

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

  function handleEmailChange(value) {
    setEmail(value)
    setEmailOtp('')
    setOtpRequested(false)
    setEmailVerified(false)
    setEmailVerificationToken('')
    setOtpError('')
    setOtpMessage('')
    setResendSeconds(0)
  }

  async function handleSendEmailOtp() {
    const normalizedEmail = email.trim().toLowerCase()
    setOtpError('')
    setOtpMessage('')
    if (!/^[a-z0-9._%+-]+@gmail\.com$/i.test(normalizedEmail)) {
      setOtpError('Chỉ chấp nhận địa chỉ Gmail hợp lệ có đuôi @gmail.com.')
      return
    }
    setOtpSending(true)
    try {
      const result = await requestPublicBookingEmailOtp(normalizedEmail)
      setOtpRequested(true)
      setEmailOtp('')
      setEmailVerified(false)
      setEmailVerificationToken('')
      setResendSeconds(Number(result?.resend_after_seconds || 60))
      setOtpMessage(result?.message || 'Mã OTP 6 số đã được gửi tới Gmail. Mã có hiệu lực trong 10 phút.')
    } catch (cause) {
      setOtpError(apiError(cause))
    } finally {
      setOtpSending(false)
    }
  }

  async function handleVerifyEmailOtp() {
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedOtp = emailOtp.trim()
    setOtpError('')
    setOtpMessage('')
    if (!/^\d{6}$/.test(normalizedOtp)) {
      setOtpError('Mã xác minh phải gồm đúng 6 chữ số.')
      return
    }
    setOtpVerifying(true)
    try {
      const result = await verifyPublicBookingEmailOtp(normalizedEmail, normalizedOtp)
      if (!result?.verification_token) throw new Error('Máy chủ chưa trả về token xác minh email.')
      setEmailVerified(true)
      setEmailVerificationToken(result.verification_token)
      setOtpMessage('Gmail đã được xác minh. Bạn có thể gửi yêu cầu đặt bàn.')
    } catch (cause) {
      setEmailVerified(false)
      setEmailVerificationToken('')
      setOtpError(apiError(cause))
    } finally {
      setOtpVerifying(false)
    }
  }

  function validate() {
    if (!name.trim()) return 'Vui lòng nhập họ tên khách.'
    if (!/^0\d{9}$/.test(phone.trim())) return 'Số điện thoại gồm 10 chữ số và bắt đầu bằng 0.'
    if (!/^[a-z0-9._%+-]+@gmail\.com$/i.test(email.trim())) return 'Chỉ chấp nhận địa chỉ Gmail hợp lệ có đuôi @gmail.com.'
    if (!emailVerified || !emailVerificationToken) return 'Vui lòng xác minh Gmail bằng mã OTP trước khi đặt bàn.'
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
        email: email.trim().toLowerCase(),
        email_verification_token: emailVerificationToken,
        so_luong_khach: guests,
        ngay_dat: date,
        gio_bat_dau: selectedSlot,
        khu_vuc_id: areaId || null,
        ghi_chu: note.trim() || null,
      })
      saveHistory({ ...created, email: email.trim() })
      setHistory(readHistory())
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
    setEmail('')
    setEmailOtp('')
    setOtpRequested(false)
    setOtpSending(false)
    setOtpVerifying(false)
    setEmailVerified(false)
    setEmailVerificationToken('')
    setOtpError('')
    setOtpMessage('')
    setResendSeconds(0)
    setNote('')
    setAreaId('')
    setSelectedSlot('')
    setFormError('')
  }

  function openHistoryItem(item) {
    setLookupCode(item.ma_dat_ban)
    setLookupPhone(item.so_dien_thoai)
    setMode('lookup')
    setLookupResult(null)
    setLookupError('')
  }

  async function handleLookup(event) {
    event?.preventDefault()
    setLookupError('')
    setLookupResult(null)
    if (!/^[A-Za-z0-9]{6}$/.test(lookupCode.trim())) {
      setLookupError('Mã đặt bàn phải gồm 6 ký tự.')
      return
    }
    if (!/^0\d{9}$/.test(lookupPhone.trim())) {
      setLookupError('Số điện thoại gồm 10 chữ số và bắt đầu bằng 0.')
      return
    }

    setLookupLoading(true)
    try {
      const result = await lookupPublicBooking(lookupCode.trim().toUpperCase(), lookupPhone.trim())
      setLookupResult(result)
      saveHistory(result)
      setHistory(readHistory())
    } catch (cause) {
      setLookupError(apiError(cause))
    } finally {
      setLookupLoading(false)
    }
  }

  async function handleCancel() {
    if (!lookupResult) return
    Modal.confirm({
      title: 'Xác nhận huỷ đặt bàn?',
      content: `Bạn muốn huỷ đặt bàn ${lookupResult.ma_dat_ban} vào ${formatDateTime(lookupResult)}?`,
      okText: 'Huỷ đặt bàn',
      cancelText: 'Không',
      okButtonProps: { danger: true },
      async onOk() {
        try {
          const result = await cancelPublicBooking(lookupResult.ma_dat_ban, lookupResult.so_dien_thoai)
          setLookupResult(result)
          saveHistory(result)
          setHistory(readHistory())
        } catch (cause) {
          const detail = cause?.response?.data?.detail
          if (detail?.so_dien_thoai_quan) {
            setLookupError(`${detail.message} Số điện thoại nhà hàng: ${detail.so_dien_thoai_quan}`)
          } else {
            setLookupError(apiError(cause))
          }
          throw cause
        }
      },
    })
  }

  function clearHistoryItem(code) {
    const next = history.filter((item) => item.ma_dat_ban !== code)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    setHistory(next)
    if (lookupCode === code) {
      setLookupCode('')
      setLookupPhone('')
      setLookupResult(null)
    }
  }

  if (summary) {
    return (
      <div className="public-booking-page">
        <header className="public-booking-header">
          <div className="public-booking-brand">
            <button className="public-booking-back" onClick={onBack} aria-label="Quay lại"><ArrowLeftOutlined /></button>
            <div className="brand-mark">R</div>
            <div><strong>Resto</strong><span>Đặt bàn</span></div>
          </div>
        </header>
        <main className="public-booking-main">
          <section className="booking-success">
            <div className="booking-success-icon"><CheckCircleOutlined /></div>
            <p className="booking-success-eyebrow">ĐẶT BÀN THÀNH CÔNG</p>
            <h1>Mã đặt bàn của bạn</h1>
            <div className="booking-code">{summary.ma_dat_ban}</div>
            <p className="booking-success-status"><span className="status-dot" /> Trạng thái: Chờ xác nhận</p>
            {summary.canh_bao_khong_toi && (
              <Alert
                type="warning" showIcon icon={<AlertOutlined />}
                message="Cảnh báo lịch sử không tới"
                description={`Số điện thoại này đã có ${summary.so_lan_khong_toi_90_ngay} lần khách không tới trong 90 ngày gần đây. Nhà hàng có thể liên hệ để xác nhận lại lượt đặt.`}
                style={{ marginBottom: 18, textAlign: 'left' }}
              />
            )}
            <div className="booking-success-note">
              {summary.email_xac_nhan_trang_thai === 'DA_GUI'
                ? 'Email xác nhận đã được gửi đến địa chỉ bạn cung cấp.'
                : 'Email xác nhận đã được ghi nhận vào hàng đợi gửi. Nếu email gặp lỗi, hệ thống sẽ tự thử lại tối đa 3 lần.'}
            </div>
            <div className="booking-success-card">
              <div className="booking-success-row"><span>Khách hàng</span><strong>{summary.ho_ten_khach}</strong></div>
              <div className="booking-success-row"><span>Số điện thoại</span><strong>{summary.so_dien_thoai}</strong></div>
              <div className="booking-success-row"><span>Email</span><strong>{summary.email}</strong></div>
              <div className="booking-success-row"><span>Thời gian</span><strong>{formatDate(summary.ngay_dat)} · {summary.gio_bat_dau?.slice(0, 5)}</strong></div>
              <div className="booking-success-row"><span>Số khách</span><strong>{summary.so_luong_khach} khách</strong></div>
              <div className="booking-success-row"><span>Khu vực</span><strong>{summary.ten_khu_vuc || 'Bất kỳ'}</strong></div>
            </div>
            <p className="booking-success-note">
              Lịch sử đặt bàn đã được lưu trên trình duyệt này. Bạn có thể vào mục “Tra cứu & huỷ đặt bàn” để xem trạng thái hoặc huỷ khi còn ít nhất 60 phút.
            </p>
            <div className="booking-success-actions">
              <Button type="primary" onClick={resetForm}>Đặt thêm lượt mới</Button>
              <Button icon={<HistoryOutlined />} onClick={() => { setSummary(null); setMode('lookup'); setLookupCode(summary.ma_dat_ban); setLookupPhone(summary.so_dien_thoai) }}>
                Tra cứu đặt bàn
              </Button>
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
          <button className="public-booking-back" onClick={onBack} aria-label="Quay lại"><ArrowLeftOutlined /></button>
          <div className="brand-mark">R</div>
          <div><strong>Resto</strong><span>Khách hàng</span></div>
        </div>
      </header>

      <main className="public-booking-main">
        <section className="public-booking-intro">
          <p className="eyebrow">DỊCH VỤ KHÁCH HÀNG</p>
          <h1>{mode === 'create' ? 'Đặt bàn trước, khỏi chờ lâu.' : 'Tra cứu & huỷ đặt bàn.'}</h1>
          <p>
            {mode === 'create'
              ? 'Chọn ngày, giờ và khu vực bạn mong muốn. Sau khi đặt, lịch sử sẽ được lưu trên trình duyệt để bạn dễ tra cứu lại.'
              : 'Dùng đúng mã đặt bàn và số điện thoại đã dùng khi đặt. Thông tin hiển thị gồm trạng thái, thời gian, số khách, khu vực và bàn đã xếp.'}
          </p>
        </section>

        <div className="public-booking-tabs">
          <button className={mode === 'create' ? 'active' : ''} onClick={() => { setMode('create'); setLookupError('') }}>
            <CalendarOutlined /> Đặt bàn trực tuyến
          </button>
          <button className={mode === 'lookup' ? 'active' : ''} onClick={() => { setMode('lookup'); setLookupError('') }}>
            <HistoryOutlined /> Tra cứu & huỷ đặt bàn
          </button>
        </div>

        {mode === 'lookup' ? (
          <>
            <section className="booking-step">
              <div className="booking-step-heading">
                <span className="booking-step-num"><SearchOutlined /></span>
                <div><h2>Tra cứu bằng mã đặt bàn + số điện thoại</h2><p>Sai quá 5 lần trong 10 phút từ cùng một địa chỉ IP sẽ bị tạm chặn.</p></div>
              </div>
              <form className="lookup-form" onSubmit={handleLookup}>
                <label className="booking-field">
                  <span className="booking-field-label"><FileTextOutlined /> Mã đặt bàn</span>
                  <Input value={lookupCode} maxLength={6} placeholder="Ví dụ: A7K2PQ" onChange={(event) => setLookupCode(event.target.value.toUpperCase())} />
                </label>
                <label className="booking-field">
                  <span className="booking-field-label"><PhoneOutlined /> Số điện thoại</span>
                  <Input value={lookupPhone} maxLength={10} placeholder="Ví dụ: 0912345678" onChange={(event) => setLookupPhone(event.target.value)} />
                </label>
                <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={lookupLoading}>Tra cứu</Button>
              </form>
              {lookupError && <div className="booking-form-error">{lookupError}</div>}
            </section>

            {lookupResult && <BookingInfo booking={lookupResult} onCancel={handleCancel} />}

            <section className="booking-step">
              <div className="booking-step-heading">
                <span className="booking-step-num"><HistoryOutlined /></span>
                <div><h2>Lịch sử đặt bàn trên trình duyệt này</h2><p>Đây là lịch sử cục bộ; hệ thống vẫn xác thực lại với mã + số điện thoại khi bạn tra cứu.</p></div>
              </div>
              {history.length === 0 ? (
                <div className="booking-slots-empty">Chưa có lịch sử. Sau khi đặt bàn trực tuyến, mã đặt bàn sẽ được lưu tại đây.</div>
              ) : (
                <div className="booking-history-list">
                  {history.map((item) => (
                    <div className="booking-history-item" key={item.ma_dat_ban}>
                      <div>
                        <strong>{item.ma_dat_ban}</strong>
                        <span>{item.ho_ten_khach || 'Khách'} · {item.ngay_dat} · {item.gio_bat_dau?.slice(0, 5)}</span>
                      </div>
                      <div className="booking-history-actions">
                        <Button size="small" onClick={() => openHistoryItem(item)}>Tra cứu</Button>
                        <Button size="small" danger type="text" icon={<DeleteOutlined />} onClick={() => clearHistoryItem(item.ma_dat_ban)} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          <form className="public-booking-form" onSubmit={handleSubmit}>
            <section className="booking-step">
              <div className="booking-step-heading"><span className="booking-step-num">1</span><div><h2>Chọn ngày & số khách</h2><p>Chọn ngày bạn muốn đến và số lượng khách.</p></div></div>
              <div className="booking-step-grid">
                <label className="booking-field"><span className="booking-field-label"><CalendarOutlined /> Ngày đặt bàn</span><input type="date" min={today} value={date} onChange={(event) => handleDateChange(event.target.value)} /></label>
                <label className="booking-field"><span className="booking-field-label"><TeamOutlined /> Số khách</span><InputNumber min={1} max={20} value={guests} onChange={handleGuestsChange} style={{ width: '100%' }} /></label>
              </div>
            </section>

            <section className="booking-step">
              <div className="booking-step-heading"><span className="booking-step-num">2</span><div><h2>Chọn khung giờ</h2><p>Chỉ hiện giờ mở cửa còn bàn phù hợp. Giữ bàn {slots?.thoi_luong_giu_ban || 90} phút.</p></div></div>
              {slotsLoading ? <div className="booking-slots-loading"><LoadingOutlined spin /> Đang tải khung giờ...</div> : slots?.ly_do ? <div className="booking-slots-empty">{slots.ly_do}</div> : (
                <div className="booking-slots">
                  {(slots?.khung_gio || []).filter((slot) => slot.kha_dung).map((slot) => (
                    <button key={slot.gio} type="button" disabled={!slot.kha_dung} className={`booking-slot ${selectedSlot === slot.gio ? 'selected' : ''} ${slot.kha_dung ? '' : 'disabled'}`} onClick={() => setSelectedSlot(slot.gio)} title={slot.ly_do || ''}>
                      <span className="booking-slot-time">{slot.gio}</span>
                      {!slot.kha_dung && slot.ly_do && <span className="booking-slot-reason">{slot.ly_do}</span>}
                    </button>
                  ))}
                  {slots && !slots.khung_gio.some((slot) => slot.kha_dung) && <div className="booking-slots-empty">Không còn khung giờ phù hợp với số khách và khu vực đã chọn. Vui lòng đổi ngày, số khách hoặc khu vực.</div>}
                </div>
              )}
            </section>

            <section className="booking-step">
              <div className="booking-step-heading"><span className="booking-step-num">3</span><div><h2>Khu vực mong muốn</h2><p>Không bắt buộc. Nhà hàng sẽ cố gắng sắp xếp theo mong muốn của bạn.</p></div></div>
              {areasLoading ? <div className="booking-slots-loading"><LoadingOutlined spin /> Đang tải khu vực...</div> : (
                <div className="booking-areas">
                  <button type="button" className={`booking-area ${areaId === '' ? 'selected' : ''}`} onClick={() => setAreaId('')}><EnvironmentOutlined /> Bất kỳ</button>
                  {areas.map((area) => <button key={area.id} type="button" className={`booking-area ${areaId === String(area.id) ? 'selected' : ''}`} onClick={() => setAreaId(String(area.id))}><EnvironmentOutlined /> {area.ten_khu_vuc}</button>)}
                </div>
              )}
            </section>

            <section className="booking-step">
              <div className="booking-step-heading"><span className="booking-step-num">4</span><div><h2>Thông tin khách</h2><p>Gmail phải được xác minh bằng OTP trước khi gửi yêu cầu. Gmail đã xác minh sẽ nhận xác nhận và email nhắc lịch S4-08.</p></div></div>
              <div className="booking-step-grid booking-step-grid-stack">
                <label className="booking-field"><span className="booking-field-label"><UserOutlined /> Họ tên khách</span><Input value={name} maxLength={100} placeholder="Nhập họ tên" onChange={(event) => setName(event.target.value)} /></label>
                <label className="booking-field"><span className="booking-field-label"><PhoneOutlined /> Số điện thoại</span><Input value={phone} maxLength={10} placeholder="Ví dụ: 0912345678" onChange={(event) => setPhone(event.target.value)} /></label>
                <div className="booking-field booking-email-verification">
                  <span className="booking-field-label"><MailOutlined /> Gmail nhận thông báo</span>
                  <div className="booking-email-action-row">
                    <Input type="email" value={email} maxLength={254} placeholder="tenban@gmail.com" disabled={emailVerified} onChange={(event) => handleEmailChange(event.target.value)} />
                    <Button type={emailVerified ? 'default' : 'primary'} disabled={emailVerified || resendSeconds > 0 || !email.trim()} loading={otpSending} onClick={handleSendEmailOtp}>
                      {emailVerified ? 'Đã xác minh' : resendSeconds > 0 ? `Gửi lại (${resendSeconds}s)` : otpRequested ? 'Gửi lại mã' : 'Gửi mã'}
                    </Button>
                  </div>
                  <div className="booking-email-rule">Chỉ chấp nhận <strong>@gmail.com</strong>. Gmail phải nhận được OTP thật mới có thể hoàn tất đặt bàn.</div>

                  {(otpRequested || emailVerified) && (
                    <div className={`booking-otp-panel ${emailVerified ? 'verified' : ''}`}>
                      <div className="booking-otp-title">
                        <SafetyCertificateOutlined />
                        <div>
                          <strong>{emailVerified ? 'Gmail đã xác minh' : 'Nhập mã OTP 6 số'}</strong>
                          <span>{emailVerified ? email.trim().toLowerCase() : 'Kiểm tra hộp thư Gmail (kể cả Spam) rồi nhập mã trong 10 phút.'}</span>
                        </div>
                      </div>
                      {!emailVerified && (
                        <div className="booking-otp-row">
                          <Input value={emailOtp} inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, ''))} />
                          <Button type="primary" disabled={emailOtp.length !== 6} loading={otpVerifying} onClick={handleVerifyEmailOtp}>Xác minh</Button>
                        </div>
                      )}
                      {emailVerified && (
                        <div className="booking-email-verified-badge"><CheckCircleOutlined /> Email này đã được xác minh và sẽ nhận email nhắc lịch.</div>
                      )}
                    </div>
                  )}
                  {otpMessage && <div className="booking-otp-message success">{otpMessage}</div>}
                  {otpError && <div className="booking-otp-message error">{otpError}</div>}
                </div>
                <label className="booking-field"><span className="booking-field-label"><FileTextOutlined /> Ghi chú</span><Input.TextArea value={note} maxLength={1000} rows={3} placeholder="Yêu cầu thêm (không bắt buộc)" onChange={(event) => setNote(event.target.value)} /></label>
              </div>
            </section>

            {formError && <div className="booking-form-error">{formError}</div>}
            <div className="booking-submit-bar">
              <div className="booking-submit-summary">{selectedSlot ? <span>{formatDate(date)} · {selectedSlot} · {guests} khách{areaId ? ' · có chọn khu vực' : ''}</span> : <span>Chọn khung giờ để hoàn tất.</span>}</div>
              <Button type="primary" htmlType="submit" size="large" loading={submitting} disabled={!emailVerified} title={!emailVerified ? 'Hãy xác minh Gmail trước khi đặt bàn.' : ''}>
                {emailVerified ? 'Gửi yêu cầu đặt bàn' : 'Xác minh Gmail để tiếp tục'}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}
