import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Empty, Tag } from 'antd'
import { FireOutlined, ReloadOutlined } from '@ant-design/icons'
import { getKitchenOrders, updateOrderLineStatus } from '../services/api'
import './OrderOperations.css'

export default function Kitchen() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setOrders(await getKitchenOrders()) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 3000)
    return () => window.clearInterval(timer)
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map()
    orders.forEach((item) => {
      const key = `${item.ma_ban}-${item.dot_id}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    })
    return [...map.entries()]
  }, [orders])

  async function update(lineId, status) {
    setUpdating(lineId)
    try { await updateOrderLineStatus(lineId, status); await load() } finally { setUpdating(null) }
  }

  return (
    <section className="order-ops-page">
      <div className="order-ops-heading">
        <div><p className="eyebrow"><FireOutlined /> BẾP</p><h1>Màn hình bếp</h1><p>Theo dõi món khách gọi theo từng bàn và cập nhật trạng thái để phục vụ biết khi nào có thể mang món ra.</p></div>
        <Button icon={<ReloadOutlined spin={loading} />} onClick={load}>Cập nhật</Button>
      </div>
      {!grouped.length ? <div className="order-ops-empty"><Empty description="Chưa có món đang chờ xử lý." /></div> : (
        <div className="order-ops-grid">
          {grouped.map(([key, lines]) => (
            <article className="order-ticket" key={key}>
              <header><div><strong>Bàn {lines[0].ma_ban}</strong><span>Đợt gọi #{lines[0].dot_id}</span></div><Tag color="blue">{lines.length} dòng món</Tag></header>
              <div className="order-ticket-lines">
                {lines.map((line) => (
                  <div className="order-line" key={line.id}>
                    <div><strong>{line.ten_mon} × {line.so_luong}</strong>{line.ghi_chu && <small>Ghi chú: {line.ghi_chu}</small>}<small>Dự kiến xong: {new Date(line.du_kien_hoan_thanh_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}</small></div>
                    <div className="order-line-actions">
                      <Tag>{line.trang_thai}</Tag>
                      {line.trang_thai === 'CHO_BEP' && <Button size="small" type="primary" loading={updating === line.id} onClick={() => update(line.id, 'DANG_CHE_BIEN')}>Bắt đầu</Button>}
                      {line.trang_thai === 'DANG_CHE_BIEN' && <Button size="small" type="primary" loading={updating === line.id} onClick={() => update(line.id, 'DA_XONG')}>Đã xong</Button>}
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
