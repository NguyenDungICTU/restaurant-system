import { useCallback, useEffect, useState } from 'react'
import { Button, Tabs } from 'antd'
import { getAuditLogs, getAuditSessions } from '../services/api'

function localDateString(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export default function AuditLogs() {
  const today = new Date()
  const initialStart = new Date(today)
  initialStart.setDate(initialStart.getDate() - 6)
  const [startDate, setStartDate] = useState(localDateString(initialStart))
  const [endDate, setEndDate] = useState(localDateString(today))
  const [account, setAccount] = useState('')
  const [activeTab, setActiveTab] = useState('actions')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async (event) => {
    event?.preventDefault()
    setLoading(true)
    setError('')
    try {
      const filters = {
        start_date: startDate,
        end_date: endDate,
        ...(account.trim() ? { account: account.trim() } : {}),
      }
      setItems(activeTab === 'sessions'
        ? await getAuditSessions(filters)
        : await getAuditLogs(filters))
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail
          || 'Không tải được nhật ký thao tác.',
      )
    } finally {
      setLoading(false)
    }
  }, [account, activeTab, endDate, startDate])

  useEffect(() => {
    load()
  }, [load])

  return (
    <section className="audit-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">BẢO MẬT & TRUY VẾT</p>
          <h1>Nhật ký hệ thống</h1>
          <p className="subheading">Tra cứu phiên đăng nhập và các thay đổi đã ghi nhận.</p>
        </div>
        <Button onClick={() => load()}>Làm mới</Button>
      </header>
      <form className="audit-filters" onSubmit={load}>
        <label>Từ ngày<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label>Đến ngày<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
        <label>Tài khoản<input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Tên đăng nhập" /></label>
        <button className="employee-primary" disabled={loading}>Lọc</button>
      </form>
      {error && <div className="employee-error">{error}</div>}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          { key: 'actions', label: 'Thay đổi & thao tác' },
          { key: 'sessions', label: 'Phiên đăng nhập' },
        ]}
      />
      <div className="employee-table-wrap">
        <table className="employee-table audit-table">
          {activeTab === 'sessions' ? (
            <thead>
              <tr><th>Đăng nhập lúc</th><th>Tài khoản</th><th>Vai trò</th><th>Hoạt động gần nhất</th><th>Hết hạn</th><th>IP</th><th>Trạng thái</th></tr>
            </thead>
          ) : (
            <thead>
              <tr><th>Thời điểm</th><th>Tài khoản</th><th>Vai trò</th><th>Hành động</th><th>IP</th><th>Chi tiết</th></tr>
            </thead>
          )}
          <tbody>
            {loading ? (
              <tr><td colSpan={activeTab === 'sessions' ? 7 : 6} className="table-empty">Đang tải...</td></tr>
            ) : items.length ? items.map((item) => activeTab === 'sessions' ? (
              <tr key={item.id}>
                <td>{formatTimestamp(item.created_at)}</td>
                <td>{item.account}</td>
                <td>{roleLabel(item.role)}</td>
                <td>{formatTimestamp(item.last_activity_at)}</td>
                <td>{formatTimestamp(item.expires_at)}</td>
                <td>{item.ip_address || '—'}</td>
                <td>{sessionStatus(item)}</td>
              </tr>
            ) : (
              <tr key={item.id}>
                <td>{formatTimestamp(item.timestamp)}</td>
                <td>{item.account || 'Không xác định'}</td>
                <td>{roleLabel(item.role)}</td>
                <td>{item.action}</td>
                <td>{item.ip_address || '—'}</td>
                <td><AuditDetails oldData={item.old_data} newData={item.new_data} /></td>
              </tr>
            )) : (
              <tr><td colSpan={activeTab === 'sessions' ? 7 : 6} className="table-empty">Không có bản ghi trong khoảng thời gian này.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function formatTimestamp(value) {
  return value
    ? new Intl.DateTimeFormat('vi-VN', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date(value))
    : '—'
}

function sessionStatus(session) {
  if (session.revoked_at) return 'Đã đăng xuất'
  return new Date(session.expires_at) > new Date() ? 'Còn hiệu lực' : 'Đã hết hạn'
}

function roleLabel(role) {
  return ({
    QUAN_LY: 'Quản lý',
    PHUC_VU: 'Phục vụ',
    BEP: 'Bếp',
    THU_NGAN: 'Thu ngân',
  })[role] || '—'
}

function AuditDetails({ oldData, newData }) {
  if (!oldData && !newData) return '—'
  return (
    <details>
      <summary>Xem</summary>
      <pre>{JSON.stringify({ old: oldData, new: newData }, null, 2)}</pre>
    </details>
  )
}
