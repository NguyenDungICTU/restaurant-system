import { useEffect, useState } from 'react'
import { getAuditLogs } from '../services/api'

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
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load(event) {
    event?.preventDefault()
    setLoading(true)
    setError('')
    try {
      setItems(await getAuditLogs({
        start_date: startDate,
        end_date: endDate,
        ...(account.trim() ? { account: account.trim() } : {}),
      }))
    } catch (requestError) {
      setError(
        requestError.response?.data?.detail
          || 'Không tải được nhật ký thao tác.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <section className="audit-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">BẢO MẬT & TRUY VẾT</p>
          <h1>Nhật ký thao tác</h1>
          <p className="subheading">Nhật ký chỉ đọc, không thể sửa hoặc xóa.</p>
        </div>
      </header>
      <form className="audit-filters" onSubmit={load}>
        <label>Từ ngày<input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></label>
        <label>Đến ngày<input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
        <label>Tài khoản<input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Tên đăng nhập" /></label>
        <button className="employee-primary" disabled={loading}>Lọc</button>
      </form>
      {error && <div className="employee-error">{error}</div>}
      <div className="employee-table-wrap">
        <table className="employee-table audit-table">
          <thead>
            <tr><th>Thời điểm</th><th>Tài khoản</th><th>Vai trò</th><th>Hành động</th><th>IP</th><th>Chi tiết</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="table-empty">Đang tải...</td></tr>
            ) : items.length ? items.map((item) => (
              <tr key={item.id}>
                <td>{new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(item.timestamp))}</td>
                <td>{item.account || 'Không xác định'}</td>
                <td>{roleLabel(item.role)}</td>
                <td>{item.action}</td>
                <td>{item.ip_address || '—'}</td>
                <td><AuditDetails oldData={item.old_data} newData={item.new_data} /></td>
              </tr>
            )) : (
              <tr><td colSpan="6" className="table-empty">Không có bản ghi trong khoảng thời gian này.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
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
