import { useState } from 'react'
import {
  ArrowLeftOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  PhoneOutlined,
  UserOutlined,
} from '@ant-design/icons'

import { login } from '../services/api'


export default function Login({
  onBack,
  onSuccess,
}) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')


  async function submit(event) {
    event.preventDefault()
    setError('')

    if (!identifier.trim() || !password) {
      setError(
        'Vui lòng nhập đầy đủ tên đăng nhập/số điện thoại và mật khẩu.'
      )
      return
    }

    try {
      setLoading(true)

      const result = await login(
        identifier.trim(),
        password,
      )

      // A fresh login starts at the first workspace allowed for that role.
      // A later manual/direct URL is still checked by the server.
      window.history.replaceState(
        {},
        '',
        '/',
      )

      onSuccess(result.user)
    } catch (err) {
      const detail = err.response?.data?.detail

      setError(
        typeof detail === 'string'
          ? detail
          : detail?.message ||
            'Không thể đăng nhập. Vui lòng kiểm tra thông tin và thử lại.'
      )
    } finally {
      setLoading(false)
    }
  }


  return (
    <div className="login-page">
      <div className="login-brand-panel">
        <div className="login-brand-top">
          <div className="brand-mark">
            R
          </div>

          <div>
            <strong>Resto</strong>
            <span>Management</span>
          </div>
        </div>

        <div className="login-art">
          <img
            src="https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1100&q=85"
            alt="Nhà hàng"
          />

          <div className="login-quote">
            <p>
              “Một ca làm việc tốt bắt đầu từ một quy trình rõ ràng.”
            </p>

            <span>
              RESTAURANT MANAGEMENT SYSTEM
            </span>
          </div>
        </div>
      </div>


      <div className="login-form-side">
        <button
          className="back-button"
          onClick={onBack}
        >
          <ArrowLeftOutlined />
          Trang chủ
        </button>

        <div className="login-form-wrap">
          <p className="eyebrow">
            WELCOME BACK
          </p>

          <h1>
            Đăng nhập hệ thống
          </h1>

          <p className="login-subtitle">
            Đăng nhập để truy cập khu vực làm việc đúng với vai trò của bạn.
          </p>

          <form
            onSubmit={submit}
            noValidate
          >
            <label>
              Tên đăng nhập hoặc số điện thoại
            </label>

            <div className="field">
              <UserOutlined />

              <input
                value={identifier}
                onChange={(event) =>
                  setIdentifier(event.target.value)
                }
                placeholder="Nhập tên đăng nhập hoặc số điện thoại"
                autoComplete="username"
              />
            </div>

            <label>
              Mật khẩu
            </label>

            <div className="field">
              <LockOutlined />

              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="Nhập mật khẩu"
                autoComplete="current-password"
              />

              <button
                type="button"
                className="field-action"
                onClick={() => setShow(!show)}
              >
                {show
                  ? <EyeOutlined />
                  : <EyeInvisibleOutlined />}
              </button>
            </div>

            {error && (
              <div className="login-error">
                {error}
              </div>
            )}

            <button
              className="login-submit"
              disabled={loading}
            >
              {loading
                ? 'Đang xác thực...'
                : 'Đăng nhập'}
            </button>
          </form>

          <div className="security-note">
            <LockOutlined />

            <span>
              Quyền truy cập được kiểm tra lại ở phía máy chủ cho từng màn hình làm việc.
            </span>
          </div>

          <p className="login-help">
            <PhoneOutlined />
            Cần hỗ trợ? Liên hệ quản trị hệ thống.
          </p>
        </div>
      </div>
    </div>
  )
}
