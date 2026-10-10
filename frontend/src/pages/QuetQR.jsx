import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Input, Spin, Tag, Tooltip } from 'antd'
import {
  ClockCircleOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
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
const CART_KEY_PREFIX = 'restaurant_customer_cart_'
const PENDING_KEY_PREFIX = 'restaurant_customer_pending_order_'
const REFRESH_MS = 5000
const MAX_QUANTITY = 20

function formatVnd(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} ₫`
}

function sessionKey(token) {
  return `${SESSION_KEY_PREFIX}${token}`
}

function cartKey(token) {
  return `${CART_KEY_PREFIX}${token}`
}

function pendingKey(token) {
  return `${PENDING_KEY_PREFIX}${token}`
}

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) ?? fallback
  } catch {
    return fallback
  }
}

function newRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `customer-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function statusLabel(status) {
  if (status === 'DA_HUY') return 'Đã huỷ'
  if (status === 'DA_XONG') return 'Chờ mang ra'
  if (status === 'DA_PHUC_VU') return 'Đã phục vụ'
  if (status === 'DANG_CHE_BIEN') return 'Đang chế biến'
  return 'Chờ bếp'
}

function statusColor(status) {
  if (status === 'DA_HUY') return 'red'
  if (status === 'DA_XONG') return 'green'
  if (status === 'DA_PHUC_VU') return 'cyan'
  if (status === 'DANG_CHE_BIEN') return 'orange'
  return 'blue'
}

export default function QuetQR({ token }) {
  const savedCart = readJson(cartKey(token), { cart: {}, notes: {} })
  const savedPending = readJson(pendingKey(token), null)

  const [table, setTable] = useState(null)
  const [categories, setCategories] = useState([])
  const [cart, setCart] = useState(savedCart.cart || {})
  const [notes, setNotes] = useState(savedCart.notes || {})
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [menuLoading, setMenuLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [quantityNotice, setQuantityNotice] = useState('')
  const [pendingRequestId, setPendingRequestId] = useState(
    savedPending?.requestId || null,
  )
  const [sessionId, setSessionId] = useState(
    () => Number(localStorage.getItem(sessionKey(token))) || null,
  )

  useEffect(() => {
    localStorage.setItem(cartKey(token), JSON.stringify({ cart, notes }))
  }, [cart, notes, token])

  const load = useCallback(async () => {
    try {
      const state = await getCustomerTable(token, sessionId)
      setTable(state)
      setError('')

      if (state.phien_ban_id && !sessionId) {
        setSessionId(state.phien_ban_id)
        localStorage.setItem(sessionKey(token), String(state.phien_ban_id))
      }

      if (sessionId && !state.phien_ban_id) {
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
      setError(
        err.response?.data?.detail ||
        'Không thể kiểm tra mã QR. Vui lòng thử lại.',
      )
    } finally {
      setLoading(false)
      setMenuLoading(false)
    }
  }, [token, sessionId])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void load()
    }, 0)
    return () => window.clearTimeout(initialTimer)
  }, [load])

  const loadOrders = useCallback(async () => {
    if (!sessionId) return
    try {
      setOrders(await getCustomerOrders(sessionId, token))
    } catch {
      // The next QR scan will restore the state when the session changes.
    }
  }, [sessionId, token])

  useEffect(() => {
    if (!sessionId) return undefined

    const runLoadOrders = () => {
      void loadOrders()
    }
    const initialTimer = window.setTimeout(runLoadOrders, 0)
    const refreshTimer = window.setInterval(runLoadOrders, REFRESH_MS)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(refreshTimer)
    }
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

  const totalQuantity = selected.reduce(
    (sum, item) => sum + item.so_luong,
    0,
  )

  function resetPendingRequest() {
    setPendingRequestId(null)
    localStorage.removeItem(pendingKey(token))
  }

  function setQuantity(dish, rawValue) {
    const requested = Number(rawValue || 0)
    const quantity = Math.min(
      MAX_QUANTITY,
      Math.max(0, Number.isFinite(requested) ? requested : 0),
    )

    if (requested > MAX_QUANTITY) {
      setQuantityNotice(
        `${dish.ten_mon} chỉ được tối đa ${MAX_QUANTITY} phần cho một dòng.`,
      )
    } else {
      setQuantityNotice('')
    }

    setCart((current) => {
      const next = { ...current }
      if (!quantity) delete next[dish.id]
      else next[dish.id] = quantity
      return next
    })

    if (!quantity) {
      setNotes((current) => {
        const next = { ...current }
        delete next[dish.id]
        return next
      })
    }

    if (pendingRequestId) resetPendingRequest()
  }

  function rememberPendingRequest(requestId) {
    setPendingRequestId(requestId)
    localStorage.setItem(
      pendingKey(token),
      JSON.stringify({ requestId, createdAt: new Date().toISOString() }),
    )
  }

  async function submitOrder() {
    if (!selected.length || submitting) return

    const requestId = pendingRequestId || newRequestId()
    if (!pendingRequestId) rememberPendingRequest(requestId)

    setSubmitting(true)
    setError('')
    setMessage('')

    try {
      const result = await createCustomerOrder({
        qr_token: token,
        phien_ban_id: sessionId,
        client_request_id: requestId,
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
      localStorage.removeItem(cartKey(token))
      resetPendingRequest()
      setMessage(
        `Order #${result.dot_id} đã được ghi nhận. ` +
        `${result.lines.length} dòng món đang chờ bếp.`,
      )
      await loadOrders()
      await load()
    } catch (err) {
      const networkFailure = !err.response

      if (networkFailure) {
        setError(
          'Mất kết nối khi gửi order. Giỏ món vẫn được giữ nguyên. ' +
          'Khi có mạng, bấm “Gửi lại order”.',
        )
      } else {
        setError(
          err.response?.data?.detail ||
          'Không thể gửi món. Giỏ vẫn được giữ nguyên.',
        )

        if (err.response?.status && err.response.status < 500) {
          resetPendingRequest()
        }
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <main className="customer-qr-page">
        <Card className="customer-qr-card">
          <Spin tip="Đang kiểm tra bàn..." />
        </Card>
      </main>
    )
  }

  return (
    <main className="customer-qr-page">
      <Card className="customer-qr-card">
        <div className="customer-brand">
          <span>R</span>
          <div>
            <strong>Resto</strong>
            <small>Khách hàng tự gọi món</small>
          </div>
        </div>

        {error && <Alert type="error" showIcon message={error} />}
        {quantityNotice && (
          <Alert
            type="warning"
            showIcon
            closable
            message={quantityNotice}
            onClose={() => setQuantityNotice('')}
          />
        )}

        {table && (
          <>
            <div className="customer-table-heading">
              <div>
                <span className="customer-kicker">MÃ QR BÀN</span>
                <h1>Bàn {table.ma_ban}</h1>
                <p>
                  {table.suc_chua_toi_thieu}–{table.suc_chua_toi_da} khách ·{' '}
                  {table.loai_ban === 'PHONG_RIENG'
                    ? 'Phòng riêng'
                    : 'Bàn thường'}
                </p>
              </div>
              <Tag color={table.can_order ? 'green' : 'red'}>
                {table.can_order ? 'Có thể gọi món' : 'Cần nhân viên'}
              </Tag>
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
                message={
                  `Bàn có lượt đặt tiếp theo lúc ${new Date(
                    table.reservation_at,
                  ).toLocaleTimeString('vi-VN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                }
              />
            )}

            {message && <Alert type="success" showIcon message={message} />}

            {table.can_order && (
              <>
                <section className="customer-menu-section">
                  <div className="customer-section-heading">
                    <div>
                      <span className="customer-kicker">THỰC ĐƠN</span>
                      <h2>Chọn món theo nhóm</h2>
                    </div>
                    <Button
                      size="small"
                      icon={<ReloadOutlined spin={menuLoading} />}
                      onClick={load}
                    >
                      Làm mới
                    </Button>
                  </div>

                  {!dishes.length && !menuLoading ? (
                    <Empty description="Hôm nay chưa có món đang bán." />
                  ) : (
                    <div className="customer-menu-groups">
                      {categories.map((category) => {
                        const categoryDishes = category.mon_an || []
                        if (!categoryDishes.length) return null

                        return (
                          <section className="customer-menu-group" key={category.id}>
                            <div className="customer-menu-group-heading">
                              <div>
                                <span className="customer-kicker">NHÓM MÓN</span>
                                <h3>{category.ten_nhom}</h3>
                              </div>
                              <Tag>{categoryDishes.length} món</Tag>
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

                            <div className="customer-dish-list">
                              {categoryDishes.map((dish) => {
                                const quantity = cart[dish.id] || 0
                                const soldOut = dish.trang_thai === 'TAM_HET'
                                const maxed = quantity >= MAX_QUANTITY

                                return (
                                  <article
                                    className={`customer-dish${soldOut ? ' sold-out' : ''}`}
                                    key={dish.id}
                                  >
                                    <img
                                      src={getMediaUrl(dish.anh_url)}
                                      alt={dish.ten_mon}
                                    />

                                    <div className="customer-dish-info">
                                      <div className="customer-dish-title">
                                        <strong>{dish.ten_mon}</strong>
                                        <b>{formatVnd(dish.gia)}</b>
                                      </div>

                                      {dish.mo_ta_ngan && <p>{dish.mo_ta_ngan}</p>}

                                      <small>
                                        {dish.don_vi_tinh} · chế biến khoảng{' '}
                                        {dish.thoi_gian_che_bien_phut || 0} phút
                                      </small>

                                      {quantity > 0 && (
                                        <>
                                          <div className="customer-line-price">
                                            <span>
                                              {quantity} × {formatVnd(dish.gia)}
                                            </span>
                                            <strong>
                                              {formatVnd(Number(dish.gia || 0) * quantity)}
                                            </strong>
                                          </div>
                                          <Input
                                            size="small"
                                            value={notes[dish.id] || ''}
                                            onChange={(event) => {
                                              setNotes((current) => ({
                                                ...current,
                                                [dish.id]: event.target.value,
                                              }))
                                            }}
                                            placeholder="Ghi chú cho bếp (tuỳ chọn)"
                                            maxLength={200}
                                          />
                                        </>
                                      )}
                                    </div>

                                    <div className="customer-quantity">
                                      {soldOut ? (
                                        <Tag color="orange">Tạm hết</Tag>
                                      ) : (
                                        <>
                                          <Button
                                            size="small"
                                            shape="circle"
                                            icon={<MinusOutlined />}
                                            disabled={!quantity}
                                            onClick={() => setQuantity(dish, quantity - 1)}
                                          />
                                          <strong>{quantity}</strong>
                                          <Tooltip
                                            title={maxed ? `Tối đa ${MAX_QUANTITY} phần` : ''}
                                          >
                                            <Button
                                              size="small"
                                              shape="circle"
                                              icon={<PlusOutlined />}
                                              disabled={maxed}
                                              onClick={() => setQuantity(dish, quantity + 1)}
                                            />
                                          </Tooltip>
                                        </>
                                      )}
                                    </div>
                                  </article>
                                )
                              })}
                            </div>
                          </section>
                        )
                      })}
                    </div>
                  )}
                </section>

                <section className="customer-cart-panel">
                  <div className="customer-cart-title">
                    <div>
                      <span className="customer-kicker">GIỎ MÓN</span>
                      <h2>
                        <ShoppingCartOutlined /> {totalQuantity} phần
                      </h2>
                    </div>
                    <Tag color="blue">Tối đa {MAX_QUANTITY} phần / món</Tag>
                  </div>

                  {!selected.length ? (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description="Chưa có món nào trong giỏ."
                    />
                  ) : (
                    <div className="customer-cart-lines">
                      {selected.map((item) => (
                        <div className="customer-cart-line" key={item.id}>
                          <div>
                            <strong>{item.ten_mon}</strong>
                            <small>
                              {formatVnd(item.gia)} × {item.so_luong}
                            </small>
                          </div>
                          <strong>
                            {formatVnd(Number(item.gia || 0) * item.so_luong)}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="customer-cart-total">
                    <span>Tạm tính</span>
                    <strong>{formatVnd(total)}</strong>
                  </div>

                  <Button
                    type="primary"
                    size="large"
                    block
                    disabled={!selected.length || submitting}
                    loading={submitting}
                    onClick={submitOrder}
                  >
                    {pendingRequestId ? 'Gửi lại order' : 'Gửi order cho bếp'}
                  </Button>

                  {pendingRequestId && (
                    <small className="customer-retry-note">
                      Giỏ và mã yêu cầu đang được giữ lại sau lần gửi lỗi.
                    </small>
                  )}
                </section>
              </>
            )}

            {sessionId && orders.length > 0 && (
              <section className="customer-orders">
                <div className="customer-section-heading">
                  <div>
                    <span className="customer-kicker">ORDER ĐÃ GỬI</span>
                    <h2>Theo dõi món</h2>
                  </div>
                  <Button size="small" onClick={loadOrders}>Cập nhật</Button>
                </div>

                {orders.map((order) => (
                  <div className="customer-order" key={order.dot_id}>
                    <div className="customer-order-head">
                      <div>
                        <strong>Order #{order.dot_id}</strong>
                        <small>
                          Gửi lúc{' '}
                          {new Date(order.gui_at).toLocaleTimeString('vi-VN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </small>
                      </div>
                      <Tag color={statusColor(order.trang_thai)}>
                        {statusLabel(order.trang_thai)}
                      </Tag>
                    </div>

                    {order.lines.map((line) => (
                      <div className="customer-order-line" key={line.id}>
                        <div>
                          <strong>{line.ten_mon} × {line.so_luong}</strong>
                          <small>
                            Giá chốt: {formatVnd(line.don_gia)} · Thành tiền:{' '}
                            {formatVnd(line.thanh_tien)}
                          </small>
                        </div>
                        <Tag color={statusColor(line.trang_thai)}>
                          {statusLabel(line.trang_thai)}
                        </Tag>
                      </div>
                    ))}

                    <div className="customer-order-total">
                      <span>Tổng order</span>
                      <strong>{formatVnd(order.tong_tien)}</strong>
                    </div>
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
