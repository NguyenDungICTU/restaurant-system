import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Empty, Tag } from 'antd'
import { ReloadOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { closeServiceSession, getServiceOrders } from '../services/api'
import './OrderOperations.css'

export default function ServiceOrders() {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try { setOrders(await getServiceOrders()) } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 3000)
    return () => window.clearInterval(timer)
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map()
    orders.forEach((item) => {
      if (!map.has(item.ma_ban)) map.set(item.ma_ban, [])
      map.get(item.ma_ban).push(item)
    })
    return [...map.entries()]
  }, [orders])

  async function closeSession(sessionId) {
    setClosing(sessionId)
    try { await closeServiceSession(sessionId); await load() } finally { setClosing(null) }
  }

  return (
    <section className="order-ops-page">
      <div className="order-ops-heading">
        <div><p className="eyebrow"><ShoppingCartOutlined /> PHỤC VỤ</p><h1>Theo dõi món theo bàn</h1><p>Màn hình này cập nhật tự động để phục vụ biết bàn nào đang gọi món và món nào đã xong để mang ra.</p></div>
        <Button icon={<ReloadOutlined spin={loading} />} onClick={load}>Cập nhật</Button>
      </div>
      {!grouped.length ? <div className="order-ops-empty"><Empty description="Chưa có bàn nào đang gọi món." /></div> : (
        <div className="order-ops-grid">
          {grouped.map(([table, lines]) => (
            <article className="order-ticket" key={table}>
              <header><div><strong>Bàn {table}</strong><span>{lines.length} món đang theo dõi · Phiên #{lines[0].phien_ban_id}</span></div><div className="order-ticket-header-actions"><Tag color={lines.every((x) => ['DA_XONG', 'DA_PHUC_VU', 'DA_HUY'].includes(x.trang_thai)) ? 'green' : 'orange'}>{lines.every((x) => ['DA_XONG', 'DA_PHUC_VU', 'DA_HUY'].includes(x.trang_thai)) ? 'Có thể kết thúc' : 'Đang xử lý'}</Tag><Button size="small" disabled={!lines.every((x) => ['DA_XONG', 'DA_PHUC_VU', 'DA_HUY'].includes(x.trang_thai))} loading={closing === lines[0].phien_ban_id} onClick={() => closeSession(lines[0].phien_ban_id)}>Kết thúc phiên</Button></div></header>
              <div className="order-ticket-lines">
                {lines.map((line) => (
                  <div className="order-line" key={line.id}>
                    <div><strong>{line.ten_mon} × {line.so_luong}</strong>{line.ghi_chu && <small>Ghi chú: {line.ghi_chu}</small>}</div>
                    <div className="order-line-actions">
                      <Tag color={line.trang_thai === 'DA_XONG' ? 'green' : 'blue'}>{line.trang_thai === 'DA_XONG' ? 'Đã xong' : line.trang_thai === 'DANG_CHE_BIEN' ? 'Bếp đang làm' : 'Đã nhận'}</Tag>
                      <small>{line.trang_thai === 'DA_XONG' ? 'Mang ra bàn' : `Dự kiến ${new Date(line.du_kien_hoan_thanh_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'})}`}</small>
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
