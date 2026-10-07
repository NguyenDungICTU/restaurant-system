import { useCallback, useEffect, useMemo, useState } from 'react'
import { ClockCircleOutlined, MinusOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import { Alert, Button, Empty, Input, InputNumber, Select, Spin, Tag } from 'antd'
import {
  createStaffOrder,
  getMediaUrl,
  getOrderableDishes,
  getTables,
} from '../services/api'
import './OrderEntry.css'

const REFRESH_MS = 3000

export default function OrderEntry() {
  const [dishes, setDishes] = useState([])
  const [tables, setTables] = useState([])
  const [selectedTableId, setSelectedTableId] = useState(null)
  const [cart, setCart] = useState([])
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState(null)

  const load = useCallback(async () => {
    try {
      setRefreshing(true)
      const [nextDishes, nextTables] = await Promise.all([
        getOrderableDishes(),
        getTables(),
      ])
      setDishes(nextDishes)
      setTables(nextTables.filter(table => table.da_cau_hinh && table.trang_thai === 'DANG_SU_DUNG'))
    } catch (error) {
      setNotice({
        type: 'error',
        message: error?.response?.data?.detail || 'Không thể tải bàn và danh sách món.',
      })
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const visible = dishes.filter(dish =>
    dish.ten_mon.toLowerCase().includes(search.toLowerCase().trim()),
  )

  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + Number(item.gia || 0) * item.so_luong, 0),
    [cart],
  )

  const selectedTable = tables.find(table => table.id === selectedTableId)

  function addDish(dish) {
    setNotice(null)
    setCart(current => {
      const existing = current.find(item => item.id === dish.id)
      if (existing) {
        return current.map(item => item.id === dish.id
          ? { ...item, so_luong: Math.min(item.so_luong + 1, 50) }
          : item)
      }
      return [...current, { ...dish, so_luong: 1, ghi_chu: '' }]
    })
  }

  function changeQuantity(dishId, quantity) {
    const next = Math.max(1, Math.min(50, Number(quantity) || 1))
    setCart(current => current.map(item => item.id === dishId ? { ...item, so_luong: next } : item))
  }

  function removeDish(dishId) {
    setCart(current => current.filter(item => item.id !== dishId))
  }

  async function sendToKitchen() {
    if (!selectedTableId) {
      setNotice({ type: 'error', message: 'Vui lòng chọn bàn đang phục vụ.' })
      return
    }
    if (!cart.length) {
      setNotice({ type: 'error', message: 'Vui lòng chọn ít nhất một món.' })
      return
    }

    setSending(true)
    setNotice(null)
    try {
      const result = await createStaffOrder(selectedTableId, {
        items: cart.map(item => ({
          mon_an_id: item.id,
          so_luong: item.so_luong,
          ghi_chu: item.ghi_chu?.trim() || null,
        })),
      })
      setCart([])
      setNotice({
        type: 'success',
        message: `Đã gửi ${result.so_dong_mon} dòng món của bàn ${result.ma_ban} xuống bếp.`,
      })
    } catch (error) {
      setNotice({
        type: 'error',
        message: error?.response?.data?.detail || 'Không thể gửi món xuống bếp.',
      })
      await load()
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="order-entry-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">GỌI MÓN</p>
          <h1>Chọn món cho khách</h1>
          <p className="subheading">Chọn bàn đang phục vụ, thêm món vào đơn rồi gửi xuống bếp để theo dõi trạng thái.</p>
        </div>
        <div className="live-pill live">
          <ReloadOutlined spin={refreshing} /> Cập nhật tự động
        </div>
      </div>

      {notice && <Alert type={notice.type} showIcon message={notice.message} closable onClose={() => setNotice(null)} style={{ marginBottom: 14 }} />}

      <div className="order-entry-toolbar order-entry-table-toolbar">
        <div>
          <strong>Bàn đang phục vụ</strong>
          <span>Chỉ hiển thị bàn đã nhận khách và đang có phiên phục vụ.</span>
        </div>
        <Select
          value={selectedTableId ?? undefined}
          onChange={setSelectedTableId}
          placeholder="Chọn bàn"
          options={tables.map(table => ({ value: table.id, label: table.ma_ban }))}
          style={{ minWidth: 240 }}
          notFoundContent={refreshing ? <Spin size="small" /> : 'Chưa có bàn đang phục vụ'}
        />
      </div>

      <div className="order-entry-layout">
        <div className="order-entry-menu">
          <div className="order-entry-toolbar">
            <Input
              prefix={<SearchOutlined />}
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Tìm món ăn..."
            />
          </div>

          {!visible.length ? (
            <div className="menu-empty"><Empty description="Không có món phù hợp." /></div>
          ) : (
            <div className="order-entry-grid">
              {visible.map(dish => {
                const soldOut = dish.trang_thai === 'TAM_HET'
                return (
                  <article className={`order-entry-card ${soldOut ? 'sold-out' : ''}`} key={dish.id}>
                    <img src={getMediaUrl(dish.anh_url)} alt="" />
                    <div className="order-entry-card-body">
                      <div>
                        <strong>{dish.ten_mon}</strong>
                        <span>{Number(dish.gia || 0).toLocaleString('vi-VN')} đ · {dish.don_vi_tinh}</span>
                      </div>
                      <Tag color={soldOut ? 'orange' : 'green'}>{soldOut ? 'Tạm hết' : 'Còn hàng'}</Tag>
                    </div>
                    <button
                      type="button"
                      disabled={soldOut}
                      className="order-entry-select"
                      onClick={() => addDish(dish)}
                    >
                      {soldOut ? 'Không thể gọi món' : 'Chọn món'}
                    </button>
                    {soldOut && <small><ClockCircleOutlined /> Món này đang bị khóa vì tạm hết nguyên liệu.</small>}
                  </article>
                )
              })}
            </div>
          )}
        </div>

        <aside className="order-entry-cart">
          <div className="order-entry-cart-heading">
            <div>
              <p className="eyebrow"><ShoppingCartOutlined /> ĐƠN MỚI</p>
              <h2>{selectedTable ? `Bàn ${selectedTable.ma_ban}` : 'Chưa chọn bàn'}</h2>
            </div>
            <Tag color={cart.length ? 'blue' : 'default'}>{cart.length} món</Tag>
          </div>

          {!cart.length ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa chọn món. Bấm “Chọn món” để thêm vào đơn." />
          ) : (
            <div className="order-entry-cart-lines">
              {cart.map(item => (
                <div className="order-entry-cart-line" key={item.id}>
                  <div className="order-entry-cart-line-main">
                    <strong>{item.ten_mon}</strong>
                    <span>{Number(item.gia || 0).toLocaleString('vi-VN')} đ</span>
                    <Input
                      size="small"
                      value={item.ghi_chu}
                      onChange={event => setCart(current => current.map(row => row.id === item.id ? { ...row, ghi_chu: event.target.value } : row))}
                      placeholder="Ghi chú cho bếp"
                      maxLength={200}
                    />
                  </div>
                  <div className="order-entry-qty">
                    <Button size="small" icon={<MinusOutlined />} onClick={() => item.so_luong <= 1 ? removeDish(item.id) : changeQuantity(item.id, item.so_luong - 1)} />
                    <InputNumber min={1} max={50} value={item.so_luong} onChange={value => changeQuantity(item.id, value)} controls={false} size="small" />
                    <Button size="small" icon={<PlusOutlined />} onClick={() => changeQuantity(item.id, item.so_luong + 1)} disabled={item.so_luong >= 50} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="order-entry-cart-footer">
            <div><strong>Tạm tính</strong><b>{cartTotal.toLocaleString('vi-VN')} đ</b></div>
            <Button type="primary" size="large" block loading={sending} disabled={!selectedTableId || !cart.length} onClick={sendToKitchen}>
              Gửi bếp
            </Button>
          </div>
        </aside>
      </div>
    </section>
  )
}
