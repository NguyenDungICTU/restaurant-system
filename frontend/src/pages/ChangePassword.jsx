import { useMemo, useState } from 'react'
import {
  CheckCircleFilled,
  CloseCircleFilled,
  EyeInvisibleOutlined,
  EyeOutlined,
  KeyOutlined,
  LockOutlined,
  LogoutOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { changePassword } from '../services/api'
import './ChangePassword.css'

function getApiMessage(error) {
  const detail = error?.response?.data?.detail

  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.message)
      .filter(Boolean)
      .join(' · ')
  }
  if (detail && typeof detail === 'object') {
    return detail.message || detail.msg || 'Dữ liệu không hợp lệ.'
  }
  return 'Không thể đổi mật khẩu. Vui lòng thử lại.'
}

function PasswordField({
  label,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  placeholder,
  error,
}) {
  return (
    <div className="cp-field-group">
      <label>{label}</label>
      <div className={`cp-input ${error ? 'has-error' : ''}`}>
        <LockOutlined />
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
        />
        <button
          type="button"
          className="cp-eye"
          onClick={onToggle}
          aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        >
          {show ? <EyeOutlined /> : <EyeInvisibleOutlined />}
        </button>
      </div>
      {error && (
        <div className="cp-field-error">
          <CloseCircleFilled />
          {error}
        </div>
      )}
    </div>
  )
}

export default function ChangePassword({
  user,
  forced = false,
  onSuccess,
  onLogout,
}) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  const rules = useMemo(() => ({
    minLength: newPassword.length >= 8,
    hasLetter: /\p{L}/u.test(newPassword),
    hasNumber: /\d/.test(newPassword),
    different:
      Boolean(newPassword) &&
      Boolean(currentPassword) &&
      newPassword !== currentPassword,
    confirm:
      Boolean(confirmPassword) &&
      newPassword === confirmPassword,
  }), [currentPassword, newPassword, confirmPassword])

  function validate() {
    const next = {}

    if (!currentPassword) {
      next.current_password = 'Vui lòng nhập mật khẩu hiện tại.'
    }

    if (!newPassword) {
      next.new_password = 'Vui lòng nhập mật khẩu mới.'
    } else if (newPassword.length < 8) {
      next.new_password = 'Mật khẩu mới phải có ít nhất 8 ký tự.'
    } else if (!/\p{L}/u.test(newPassword)) {
      next.new_password = 'Mật khẩu mới phải có ít nhất một chữ cái.'
    } else if (!/\d/.test(newPassword)) {
      next.new_password = 'Mật khẩu mới phải có ít nhất một chữ số.'
    } else if (newPassword === currentPassword) {
      next.new_password = 'Mật khẩu mới không được trùng mật khẩu tạm hiện tại.'
    }

    if (!confirmPassword) {
      next.confirm_password = 'Vui lòng xác nhận mật khẩu mới.'
    } else if (confirmPassword !== newPassword) {
      next.confirm_password = 'Xác nhận mật khẩu không khớp.'
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function submit(event) {
    event.preventDefault()
    setServerError('')
    setSuccess('')

    if (!validate()) return

    try {
      setLoading(true)
      const result = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })

      setSuccess(result?.message || 'Đổi mật khẩu thành công.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      window.setTimeout(() => {
        onSuccess?.(result)
      }, 700)
    } catch (error) {
      const message = getApiMessage(error)
      setServerError(message)

      const normalized = message.toLowerCase()
      if (
        normalized.includes('mật khẩu hiện tại') ||
        normalized.includes('current password')
      ) {
        setErrors((current) => ({
          ...current,
          current_password: message,
        }))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="cp-page">
      <div className="cp-shell">
        <section className="cp-brand-panel">
          <div className="cp-brand">
            <div className="cp-brand-mark">R</div>
            <div>
              <strong>Resto</strong>
              <span>Management</span>
            </div>
          </div>

          <div className="cp-security-copy">
            <div className="cp-security-icon">
              <SafetyCertificateOutlined />
            </div>

            <p className="cp-kicker">
              {forced ? 'BẮT BUỘC BẢO MẬT' : 'BẢO MẬT TÀI KHOẢN'}
            </p>

            <h1>
              {forced
                ? 'Đổi mật khẩu trước khi bắt đầu ca làm việc'
                : 'Đổi mật khẩu của bạn'}
            </h1>

            <p>
              Mật khẩu tạm chỉ dùng để đăng nhập lần đầu. Hãy tạo mật khẩu riêng để bảo vệ tài khoản và lịch sử thao tác của bạn.
            </p>

            <div className="cp-account-card">
              <UserOutlined />
              <div>
                <span>Tài khoản đang đăng nhập</span>
                <strong>{user?.full_name || user?.username || 'Nhân viên'}</strong>
                <small>@{user?.username || 'employee'}</small>
              </div>
            </div>
          </div>

          <div className="cp-brand-footer">
            <LockOutlined />
            Phiên hiện tại được xác thực bằng cookie HttpOnly.
          </div>
        </section>

        <main className="cp-form-panel">
          <div className="cp-form-wrap">
            <div className="cp-form-heading">
              <div className="cp-key-icon"><KeyOutlined /></div>
              <div>
                <p className="cp-kicker">ĐỔI MẬT KHẨU</p>
                <h2>Tạo mật khẩu riêng</h2>
                <p>Nhập mật khẩu tạm hiện tại và đặt mật khẩu mới đáp ứng các yêu cầu bên dưới.</p>
              </div>
            </div>

            {forced && (
              <div className="cp-forced-note">
                <SafetyCertificateOutlined />
                <div>
                  <strong>Bạn đang sử dụng mật khẩu tạm.</strong>
                  <span>Bạn chỉ có thể đổi mật khẩu hoặc đăng xuất trước khi sử dụng các chức năng khác.</span>
                </div>
              </div>
            )}

            <form onSubmit={submit} noValidate>
              <PasswordField
                label="Mật khẩu hiện tại"
                value={currentPassword}
                onChange={(value) => {
                  setCurrentPassword(value)
                  setErrors((current) => ({ ...current, current_password: '' }))
                }}
                show={showCurrent}
                onToggle={() => setShowCurrent((value) => !value)}
                autoComplete="current-password"
                placeholder="Nhập mật khẩu tạm / mật khẩu hiện tại"
                error={errors.current_password}
              />

              <PasswordField
                label="Mật khẩu mới"
                value={newPassword}
                onChange={(value) => {
                  setNewPassword(value)
                  setErrors((current) => ({ ...current, new_password: '' }))
                }}
                show={showNew}
                onToggle={() => setShowNew((value) => !value)}
                autoComplete="new-password"
                placeholder="Tối thiểu 8 ký tự"
                error={errors.new_password}
              />

              <div className="cp-rules">
                <Rule ok={rules.minLength}>Ít nhất 8 ký tự</Rule>
                <Rule ok={rules.hasLetter}>Có ít nhất một chữ cái</Rule>
                <Rule ok={rules.hasNumber}>Có ít nhất một chữ số</Rule>
                <Rule ok={rules.different}>Không trùng mật khẩu hiện tại</Rule>
              </div>

              <PasswordField
                label="Xác nhận mật khẩu mới"
                value={confirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value)
                  setErrors((current) => ({ ...current, confirm_password: '' }))
                }}
                show={showConfirm}
                onToggle={() => setShowConfirm((value) => !value)}
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu mới"
                error={errors.confirm_password}
              />

              {confirmPassword && (
                <div className={`cp-confirm-state ${rules.confirm ? 'ok' : 'bad'}`}>
                  {rules.confirm ? <CheckCircleFilled /> : <CloseCircleFilled />}
                  {rules.confirm ? 'Mật khẩu xác nhận đã khớp.' : 'Mật khẩu xác nhận chưa khớp.'}
                </div>
              )}

              {serverError && (
                <div className="cp-server-message error">
                  <CloseCircleFilled />
                  <span>{serverError}</span>
                </div>
              )}

              {success && (
                <div className="cp-server-message success">
                  <CheckCircleFilled />
                  <span>{success}</span>
                </div>
              )}

              <button type="submit" className="cp-submit" disabled={loading}>
                <KeyOutlined />
                {loading ? 'Đang đổi mật khẩu...' : 'Đổi mật khẩu'}
              </button>

              <button type="button" className="cp-logout" onClick={onLogout} disabled={loading}>
                <LogoutOutlined />
                Đăng xuất
              </button>
            </form>

            <div className="cp-help">
              Nhập sai mật khẩu hiện tại tại màn hình này chỉ hiển thị lỗi đổi mật khẩu; backend không nên cộng vào bộ đếm đăng nhập sai.
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

function Rule({ ok, children }) {
  return (
    <div className={`cp-rule ${ok ? 'ok' : ''}`}>
      {ok ? <CheckCircleFilled /> : <span className="cp-rule-dot" />}
      <span>{children}</span>
    </div>
  )
}
