import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Input, InputNumber, Spin, Tag } from 'antd'
import {
  ClockCircleOutlined,
  MinusOutlined,
  PlusOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import {
  createCustomerOrder,
  getCustomerOrders,
  getCustomerTable,
  getMediaUrl,
  getPublicMenu,
} from '../services/api'
import './QuetQR.css'

const SESSION_KEY_PREFIX = 'restaurant_customer_session_'
const REFRESH_MS = 5000

function formatVnd(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} ₫`
}

function sessionKey(token) {
  return `${SESSION_KEY_PREFIX}${token}`
}

export default function QuetQR({ token }) {
  const [table, setTable] = useState(null)
  const [categories, setCategories] = useState([])
  const [cart, setCart] = useState({})
  const [notes, setNotes] = useState({})
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [menuLoading, setMenuLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [sessionId, setSessionId] = useState(
    () => Number(localStorage.getItem(sessionKey(token))) || null,
  )

  const load = useCallback(async () => {
    try {
      const state = await getCustomerTable(token, sessionId)
      setTable(state)
      setError('')
      if (state.phien_ban_id && state.phien_ban_id !== sessionId) {
        // The QR belongs to the table, not to one phone. Always accept the
        // server's active session so a second phone joins the same session.
        setSessionId(state.phien_ban_id)
        localStorage.setItem(sessionKey(token), String(state.phien_ban_id))
      } else if (!state.phien_ban_id && sessionId) {
        setSessionId(null)
        localStorage.removeItem(sessionKey(token))
      }
      if (state.can_order) {
        setMenuLoading(true)
        const menu = await getPublicMenu()
        setCategories(menu?.categories || [])
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Không thể kiểm tra mã QR. Vui lòng thử lại.')
    } finally {
      setLoading(false)
      setMenuLoading(false)
    }
  }, [token, sessionId])

  useEffect(() => {
    load()
  }, [load])

  const loadOrders = useCallback(async () => {
    if (!sessionId) return
    try {
      setOrders(await getCustomerOrders(sessionId, token))
    } catch {
      // The table may have been closed; the next QR scan will restore the state.
    }
  }, [sessionId, token])

  useEffect(() => {
    if (!sessionId) return undefined
    loadOrders()
    const timer = window.setInterval(loadOrders, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [loadOrders, sessionId])

  const dishes = useMemo(
    () => categories.flatMap((category) => category.mon_an || []),
    [categories],
  )

  const selected = useMemo(
    () => dishes
      .filter((dish) => cart[dish.id])
      .map((dish) => ({
        ...dish,
        so_luong: cart[dish.id],
        ghi_chu: notes[dish.id] || '',
      })),
    [cart, dishes, notes],
  )

  const total = selected.reduce(
    (sum, item) => sum + Number(item.gia || 0) * item.so_luong,
    0,
  )

  function setQuantity(dish, value) {
    const quantity = Math.max(0, Number(value || 0))
    setCart((current) => {
      const next = { ...current }
      if (!quantity) delete next[dish.id]
      else next[dish.id] = quantity
      return next
    })
  }

  async function submitOrder() {
    if (!selected.length) return
    setSubmitting(true)
    setError('')
    setMessage('')
    try {
      const result = await createCustomerOrder({
        qr_token: token,
        phien_ban_id: sessionId,
        items: selected.map((item) => ({
          mon_an_id: item.id,
          so_luong: item.so_luong,
          ghi_chu: item.ghi_chu || null,
        })),
      })
      setSessionId(result.phien_ban_id)
      localStorage.setItem(sessionKey(token), String(result.phien_ban_id))
      setCart({})
      setNotes({})
      setMessage(`Đã gửi ${result.lines.length} món cho bếp. Dự kiến hoàn thành khoảng ${new Date(result.du_kien_hoan_thanh_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}.`)
      await loadOrders()
      await load()
    } catch (err) {
      setError(err.response?.data?.detail || 'Không thể gửi món. Vui lòng thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <main className="customer-qr-page"><Card className="customer-qr-card"><Spin tip="Đang kiểm tra bàn..." /></Card></main>
  }

  return (
    <main className="customer-qr-page">
      <Card className="customer-qr-card">
        <div className="customer-brand"><span>R</span><div><strong>Resto</strong><small>Phục vụ tại bàn</small></div></div>

        {error && (
          <Alert
            type="error"
            showIcon
            message={error}
            action={<Button size="small" onClick={load}>Thử lại</Button>}
          />
        )}

        {!error && table && (
          <>
            <div className="customer-table-heading">
              <div>
                <span className="customer-kicker">MÃ QR BÀN</span>
                <h1>Bàn {table.ma_ban}</h1>
                <p>{table.suc_chua_toi_thieu}–{table.suc_chua_toi_da} khách · {table.loai_ban === 'PHONG_RIENG' ? 'Phòng riêng' : 'Bàn thường'}</p>
              </div>
              <Tag color={table.can_order ? 'green' : 'red'}>{table.can_order ? 'Có thể gọi món' : 'Cần nhân viên'}</Tag>
            </div>

            {!table.can_order && (
              <Alert
                type="warning"
                showIcon
                message="Bàn hiện không thể nhận khách tự gọi món"
                description={table.message}
              />
            )}

            {table.status === 'IN_SERVICE' && table.phien_ban_id && (
              <Alert
                type="success"
                showIcon
                message={`Đang ở chung phiên gọi món của bàn ${table.ma_ban}`}
                description="Bạn có thể xem các món bàn đã gọi trước đó và gọi thêm món."
              />
            )}

            {table.can_order && table.reservation_at && (
              <Alert
                type="info"
                showIcon
                icon={<ClockCircleOutlined />}
                message={`Bàn có lượt đặt tiếp theo lúc ${new Date(table.reservation_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}
                description="Hệ thống chỉ cho phép khách hiện tại sử dụng bàn khi lượt đặt tiếp theo còn cách trên 90 phút."
              />
            )}

            {message && <Alert type="success" showIcon message={message} />}

            {table.can_order && (
              <>
                <section className="customer-menu-section">
                  <div className="customer-section-heading">
                    <div><span className="customer-kicker">MENU HÔM NAY</span><h2>Chọn món</h2></div>
                    {menuLoading && <Spin size="small" />}
                  </div>

                  {!dishes.length && !menuLoading ? (
                    <Empty description="Hôm nay chưa có món đang bán." />
                  ) : (
                    <div className="customer-dish-list">
                      {dishes.map((dish) => {
                        const quantity = cart[dish.id] || 0
                        const soldOut = dish.trang_thai === 'TAM_HET'
                        return (
                          <article className={`customer-dish ${soldOut ? 'sold-out' : ''}`} key={dish.id}>
                            <img src={getMediaUrl(dish.anh_url)} alt={dish.ten_mon} />
                            <div className="customer-dish-info">
                              <div className="customer-dish-title">
                                <strong>{dish.ten_mon}</strong>
                                <b>{formatVnd(dish.gia)}</b>
                              </div>
                              {dish.mo_ta_ngan && <p>{dish.mo_ta_ngan}</p>}
                              <small>{dish.don_vi_tinh} · chế biến khoảng {dish.thoi_gian_che_bien_phut || 0} phút</small>
                         {quantity > 0 && (
  <div className="customer-note">
    <Input
      size="small"
      value={notes[dish.id] || ''}
      onChange={(event) =>
        setNotes((current) => ({
          ...current,
          [dish.id]: event.target.value,
        }))
      }
      placeholder="Ghi chú cho bếp (tuỳ chọn)"
      maxLength={200}
    />

    <div className="customer-note-quick">
      {['Ít cay', 'Không hành', 'Không rau', 'Ít muối', 'Không đá'].map((quickNote) => (
        <Button
          key={quickNote}
          size="small"
          onClick={() =>
            setNotes((current) => {
              const currentNote = current[dish.id] || ''
              const notesList = currentNote
                .split(', ')
                .filter(Boolean)

              if (!notesList.includes(quickNote)) {
                notesList.push(quickNote)
              }

              return {
                ...current,
                [dish.id]: notesList.join(', ').slice(0, 200),
              }
            })
          }
        >
          {quickNote}
        </Button>
      ))}
    </div>

    <small>
      {(notes[dish.id] || '').length}/200 ký tự
    </small>
  </div>
)}
                            </div>
                            <div className="customer-quantity">
                              {soldOut ? <Tag color="orange">Tạm hết</Tag> : (
                                <>
                                  <Button size="small" shape="circle" icon={<MinusOutlined />} disabled={!quantity} onClick={() => setQuantity(dish, quantity - 1)} />
                                  <strong>{quantity}</strong>
                                  <Button size="small" shape="circle" icon={<PlusOutlined />} onClick={() => setQuantity(dish, quantity + 1)} />
                                </>
                              )}
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  )}
                </section>

                <section className="customer-cart">
                  <div>
                    <span><ShoppingCartOutlined /> {selected.reduce((sum, item) => sum + item.so_luong, 0)} phần</span>
                    <strong>Tổng tạm tính {formatVnd(total)}</strong>
                  </div>
                  <Button
                    type="primary"
                    size="large"
                    disabled={!selected.length}
                    loading={submitting}
                    onClick={submitOrder}
                  >
                    Xác nhận đặt món
                  </Button>
                </section>
              </>
            )}

            {sessionId && orders.length > 0 && (
              <section className="customer-orders">
                <div className="customer-section-heading">
                  <div><span className="customer-kicker">THEO DÕI</span><h2>Món đã gọi</h2></div>
                  <Button size="small" onClick={loadOrders}>Cập nhật</Button>
                </div>
                {orders.map((order) => (
                  <div className="customer-order" key={order.dot_id}>
                    <div className="customer-order-head">
                      <strong>Đợt gọi #{order.dot_id}</strong>
                      <Tag color={order.trang_thai === 'DA_XONG' ? 'green' : 'blue'}>{order.trang_thai === 'DA_XONG' ? 'Đã hoàn thành' : order.trang_thai === 'DANG_CHE_BIEN' ? 'Đang chế biến' : 'Đã gửi bếp'}</Tag>
                    </div>
                    {order.lines.map((line) => (
                      <div className="customer-order-line" key={line.id}>
                        <span>{line.ten_mon} × {line.so_luong}</span>
                        <span>{line.trang_thai === 'DA_XONG' ? 'Đã xong' : line.trang_thai === 'DANG_CHE_BIEN' ? 'Đang làm' : `Dự kiến ${new Date(line.du_kien_hoan_thanh_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`}</span>
                      </div>
                    ))}
                    <div className="customer-order-total">Tạm tính đợt này: {formatVnd(order.tong_tien)}</div>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
      </Card>
    </main>
  )
}
