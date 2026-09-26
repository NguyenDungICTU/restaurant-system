import { useState } from 'react'
import { changePassword } from '../services/api'

export default function ChangePassword({ onComplete, onLogout }) {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    if (newPassword !== confirmation) {
      setError('Mật khẩu xác nhận không khớp.')
      return
    }
    if (newPassword === currentPassword) {
      setError('Mật khẩu mới không được trùng mật khẩu tạm.')
      return
    }
    setSaving(true)
    try {
      await changePassword(currentPassword, newPassword)
      onComplete()
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail
          || 'Không thể đổi mật khẩu. Vui lòng thử lại.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <main className="login-page password-change-page">
      <section className="login-form-side">
        <div className="login-form-wrap">
          <p className="eyebrow">BẢO MẬT TÀI KHOẢN</p>
          <h1>Đổi mật khẩu tạm</h1>
          <p className="login-subtitle">
            Bạn cần tạo mật khẩu cá nhân trước khi tiếp tục sử dụng hệ thống.
          </p>
          <form onSubmit={submit} noValidate>
            <label>Mật khẩu hiện tại</label>
            <div className="field">
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
              />
            </div>
            <label>Mật khẩu mới</label>
            <div className="field">
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
              />
            </div>
            <label>Nhập lại mật khẩu mới</label>
            <div className="field">
              <input
                type="password"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                required
              />
            </div>
            <p className="login-subtitle">
              Tối thiểu 8 ký tự, gồm ít nhất một chữ cái và một chữ số.
            </p>
            {error && <div className="login-error">{error}</div>}
            <button className="login-submit" disabled={saving}>
              {saving ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
            </button>
          </form>
          <button className="back-button" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </section>
    </main>
  )
}
