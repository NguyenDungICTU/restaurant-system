import { useCallback, useEffect, useMemo, useState } from 'react'
import { App as AntdApp, Button, Empty, Popconfirm, Tag } from 'antd'
import { ReloadOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { cancelOrderLine, closeServiceSession, getServiceOrders } from '../services/api'
import './OrderOperations.css'

export default function ServiceOrders() {
  const { message } = AntdApp.useApp()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(null)
  const [canceling, setCanceling] = useState(null)

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

  async function cancelLine(line) {
    setCanceling(line.id)
    try {
      await cancelOrderLine(line.id)
      message.success(`Đã huỷ món "${line.ten_mon}".`)
      await load()
    } catch (error) {
      message.error(
        error?.response?.data?.detail || 'Không thể huỷ món.',
      )
    } finally {
      setCanceling(null)
    }
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
                      <Tag color={line.trang_thai === 'DA_XONG' ? 'green' : line.trang_thai === 'DA_HUY' ? 'red' : 'blue'}>
                        {line.trang_thai === 'DA_XONG'
                          ? 'Đã xong'
                          : line.trang_thai === 'DA_HUY'
                            ? 'Đã huỷ'
                            : line.trang_thai === 'DANG_CHE_BIEN'
                              ? 'Bếp đang làm'
                              : 'Đã nhận'}
                      </Tag>
                      {line.trang_thai === 'CHO_BEP' && (
                        <Popconfirm
                          title="Huỷ dòng món này?"
                          description={`Món "${line.ten_mon}" chưa được bếp bắt đầu chế biến.`}
                          okText="Huỷ món"
                          cancelText="Không"
                          okButtonProps={{ danger: true }}
                          onConfirm={() => cancelLine(line)}
                        >
                          <Button
                            size="small"
                            danger
                            loading={canceling === line.id}
                          >
                            Huỷ món
                          </Button>
                        </Popconfirm>
                      )}
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
