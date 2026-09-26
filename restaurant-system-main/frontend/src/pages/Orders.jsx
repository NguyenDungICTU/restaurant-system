import { useCallback, useEffect, useState } from 'react'
import { App as AntdApp, Button, InputNumber, Select } from 'antd'
import {
  addOrderItem,
  createOrder,
  getActiveTables,
  getOrders,
  getPublicDishes,
  updateOrderStatus,
} from '../services/api'

export default function Orders({ user, mode = 'waiter' }) {
  const { message } = AntdApp.useApp()
  const role = user?.role
  const canCall = role === 'QUAN_LY' || role === 'PHUC_VU'
  const [tables, setTables] = useState([])
  const [dishes, setDishes] = useState([])
  const [orders, setOrders] = useState([])
  const [tableId, setTableId] = useState()
  const [dishId, setDishId] = useState()
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [orderList, tableList, dishList] = await Promise.all([
        getOrders(),
        canCall ? getActiveTables() : Promise.resolve([]),
        canCall ? getPublicDishes() : Promise.resolve([]),
      ])
      setOrders(orderList)
      setTables(tableList)
      setDishes(dishList)
    } catch (requestError) {
      message.error(requestError.response?.data?.detail || 'Không tải được danh sách order.')
    } finally {
      setLoading(false)
    }
  }, [canCall, message])

  useEffect(() => {
    load()
  }, [load])

  async function submitOrder(event) {
    event.preventDefault()
    if (!tableId || !dishId || !quantity) return
    setSaving(true)
    try {
      const order = await createOrder(tableId)
      await addOrderItem(order.id, { dish_id: dishId, quantity })
      message.success('Đã gọi món. Giá được lưu theo thời điểm gọi.')
      await load()
    } catch (requestError) {
      message.error(requestError.response?.data?.detail || 'Không thể gọi món.')
    } finally {
      setSaving(false)
    }
  }

  async function changeStatus(order, status) {
    try {
      await updateOrderStatus(order.id, status)
      message.success('Đã cập nhật trạng thái order.')
      await load()
    } catch (requestError) {
      message.error(requestError.response?.data?.detail || 'Không thể cập nhật trạng thái.')
    }
  }

  const title = mode === 'kitchen' ? 'Màn hình bếp' : mode === 'cashier' ? 'Thanh toán order' : 'Gọi món'
  const visibleOrders = orders.filter((order) => {
    if (mode === 'kitchen') return ['DANG_MO', 'DANG_CHE_BIEN'].includes(order.status)
    if (mode === 'cashier') return order.status === 'DA_PHUC_VU'
    return ['DANG_MO', 'DANG_CHE_BIEN', 'SAN_SANG', 'DA_PHUC_VU'].includes(order.status)
  })

  return (
    <section>
      <header className="page-heading">
        <div><p className="eyebrow">VẬN HÀNH ORDER</p><h1>{title}</h1></div>
      </header>

      {canCall && (
        <form className="panel order-form" onSubmit={submitOrder}>
          <label>Bàn
            <Select
              value={tableId}
              placeholder="Chọn bàn"
              options={tables.map((table) => ({ value: table.id, label: `${table.ma_ban} · ${table.trang_thai}` }))}
              onChange={setTableId}
              style={{ width: '100%' }}
            />
          </label>
          <label>Món
            <Select
              showSearch
              optionFilterProp="label"
              value={dishId}
              placeholder="Chọn món đang bán"
              options={dishes.map((dish) => ({
                value: dish.id,
                label: `${dish.ten_mon} · ${new Intl.NumberFormat('vi-VN').format(dish.gia_ban)} ₫`,
              }))}
              onChange={setDishId}
              style={{ width: '100%' }}
            />
          </label>
          <label>Số lượng<InputNumber min={1} max={100} value={quantity} onChange={setQuantity} /></label>
          <Button type="primary" htmlType="submit" loading={saving}>Gọi món</Button>
        </form>
      )}

      {loading ? <div className="panel table-empty">Đang tải...</div> : visibleOrders.length ? (
        <div className="order-cards">
          {visibleOrders.map((order) => (
            <article className="panel order-card" key={order.id}>
              <header><strong>Order #{order.id} · Bàn {tableLabel(tables, order.table_id)}</strong><span>{statusLabel(order.status)}</span></header>
              <div className="order-lines">
                {order.items.map((item) => (
                  <div key={item.id}>
                    <span>{item.quantity} × {item.dish_name}</span>
                    <span>{new Intl.NumberFormat('vi-VN').format(item.total)} ₫</span>
                  </div>
                ))}
                {!order.items.length && <span>Chưa có món được gọi.</span>}
              </div>
              <strong className="order-total">Tổng: {new Intl.NumberFormat('vi-VN').format(order.total)} ₫</strong>
              <div className="order-actions">
                {mode === 'kitchen' && order.status === 'DANG_MO' && <Button onClick={() => changeStatus(order, 'DANG_CHE_BIEN')}>Nhận chế biến</Button>}
                {mode === 'kitchen' && order.status === 'DANG_CHE_BIEN' && <Button type="primary" onClick={() => changeStatus(order, 'SAN_SANG')}>Món đã sẵn sàng</Button>}
                {mode === 'waiter' && order.status === 'SAN_SANG' && <Button type="primary" onClick={() => changeStatus(order, 'DA_PHUC_VU')}>Đã phục vụ</Button>}
                {mode === 'cashier' && <Button type="primary" onClick={() => changeStatus(order, 'DA_THANH_TOAN')}>Đã thanh toán</Button>}
              </div>
            </article>
          ))}
        </div>
      ) : <div className="panel table-empty">Không có order cần xử lý.</div>}
    </section>
  )
}

function tableLabel(tables, id) {
  return tables.find((table) => table.id === id)?.ma_ban || id
}

function statusLabel(status) {
  return ({
    DANG_MO: 'Đang mở',
    DANG_CHE_BIEN: 'Đang chế biến',
    SAN_SANG: 'Sẵn sàng',
    DA_PHUC_VU: 'Đã phục vụ',
    DA_THANH_TOAN: 'Đã thanh toán',
    HUY: 'Đã hủy',
  })[status] || status
}
