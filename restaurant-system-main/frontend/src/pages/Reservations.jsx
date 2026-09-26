import { useEffect, useState } from 'react'
import { getReservations } from '../services/api'

export default function Reservations() {
  const [date, setDate] = useState(() => {
    const current = new Date()
    return `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
  })
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    getReservations(date)
      .then(setItems)
      .catch((requestError) => setError(requestError.response?.data?.detail || 'Không tải được danh sách đặt bàn.'))
      .finally(() => setLoading(false))
  }, [date])

  return (
    <section>
      <header className="page-heading">
        <div><p className="eyebrow">TIẾP NHẬN KHÁCH</p><h1>Danh sách đặt bàn</h1></div>
        <label>Ngày<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      </header>
      {error && <div className="employee-error">{error}</div>}
      <div className="employee-table-wrap">
        <table className="employee-table">
          <thead><tr><th>Giờ đến</th><th>Tên khách</th><th>Điện thoại</th><th>Số khách</th><th>Thời lượng</th><th>Ghi chú</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {loading ? <tr><td colSpan="7" className="table-empty">Đang tải...</td></tr>
              : items.length ? items.map((item) => (
                <tr key={item.id}>
                  <td>{new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(item.starts_at))}</td>
                  <td>{item.guest_name}</td><td>{item.phone}</td><td>{item.guests}</td><td>{item.duration_minutes} phút</td><td>{item.note || '—'}</td><td>{item.status}</td>
                </tr>
              )) : <tr><td colSpan="7" className="table-empty">Chưa có yêu cầu đặt bàn trong ngày này.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  )
}
