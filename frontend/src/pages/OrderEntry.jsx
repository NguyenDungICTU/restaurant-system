import { useCallback, useEffect, useState } from 'react'
import { ClockCircleOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { Empty, Input, Tag } from 'antd'
import { getMediaUrl, getOrderableDishes } from '../services/api'

const REFRESH_MS = 3000

export default function OrderEntry() {
  const [dishes, setDishes] = useState([])
  const [search, setSearch] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    try {
      setRefreshing(true)
      setDishes(await getOrderableDishes())
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

  return (
    <section className="order-entry-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">GỌI MÓN</p>
          <h1>Chọn món cho khách</h1>
          <p className="subheading">Món tạm hết được khóa chọn và cập nhật tự động mỗi 3 giây.</p>
        </div>
        <div className="live-pill live">
          <ReloadOutlined spin={refreshing} /> Cập nhật tự động
        </div>
      </div>

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
                <button disabled={soldOut} className="order-entry-select">
                  {soldOut ? 'Không thể gọi món' : 'Chọn món'}
                </button>
                {soldOut && <small><ClockCircleOutlined /> Món này đang bị khóa vì tạm hết nguyên liệu.</small>}
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
