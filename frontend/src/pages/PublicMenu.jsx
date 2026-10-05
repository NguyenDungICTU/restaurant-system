import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeftOutlined,
  CheckOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  ShoppingCartOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Button, Empty, Spin } from 'antd'
import { getMediaUrl, getPublicMenu } from '../services/api'
import './PublicMenu.css'

const REFRESH_MS = 3000

function normalizeVietnamese(value = '') {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
}

function formatVnd(value) {
  return `${new Intl.NumberFormat('vi-VN').format(Number(value || 0))} ₫`
}

function flattenDishes(categories) {
  return categories.flatMap((category) => category.mon_an || [])
}

export default function PublicMenu({ onBack }) {
  const [categories, setCategories] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadMenu = useCallback(async (initial = false) => {
    try {
      if (initial) setLoading(true)
      else setRefreshing(true)
      const data = await getPublicMenu()
      setCategories(data?.categories || [])
      setError('')
    } catch {
      setError('Không thể tải thực đơn. Vui lòng thử lại.')
    } finally {
      if (initial) setLoading(false)
      else setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadMenu(true)
    const timer = window.setInterval(() => loadMenu(false), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [loadMenu])

  const allDishes = useMemo(() => flattenDishes(categories), [categories])

  const selectedDishes = useMemo(() => {
    const byId = new Map(allDishes.map((dish) => [dish.id, dish]))
    return selectedIds.map((id) => byId.get(id)).filter(Boolean)
  }, [allDishes, selectedIds])

  const total = useMemo(
    () => selectedDishes.reduce((sum, dish) => sum + Number(dish.gia || 0), 0),
    [selectedDishes],
  )

  const query = normalizeVietnamese(search)
  const visibleCategories = useMemo(() => {
    return categories
      .filter((category) => activeCategory === 'all' || category.id === activeCategory)
      .map((category) => ({
        ...category,
        mon_an: (category.mon_an || []).filter((dish) =>
          !query || normalizeVietnamese(dish.ten_mon).includes(query),
        ),
      }))
      .filter((category) => category.mon_an.length > 0)
  }, [categories, activeCategory, query])

  const toggleDish = (dish) => {
    if (dish.trang_thai === 'TAM_HET') return
    setSelectedIds((current) =>
      current.includes(dish.id)
        ? current.filter((id) => id !== dish.id)
        : [...current, dish.id],
    )
  }

  return (
    <div className="public-menu-page">
      <header className="public-menu-header">
        <div className="public-menu-brand">
          <button className="public-menu-back" onClick={onBack} aria-label="Quay lại">
            <ArrowLeftOutlined />
          </button>
          <div className="brand-mark">R</div>
          <div>
            <strong>Resto</strong>
            <span>Menu</span>
          </div>
        </div>
        <div className="public-menu-status">
          {refreshing && <><ReloadOutlined spin /> Đang cập nhật giá</>}
        </div>
      </header>

      <main className="public-menu-main">
        <section className="public-menu-intro">
          <div>
            <p className="eyebrow">MENU CỦA CHÚNG TÔI</p>
            <h1>Chọn món bạn muốn thưởng thức.</h1>
            <p>Thực đơn và giá được lấy trực tiếp từ hệ thống nhà hàng. Giá hiển thị là giá hiện tại.</p>
          </div>
          <div className="public-menu-count">
            <strong>{allDishes.length}</strong>
            <span>món đang hiển thị</span>
          </div>
        </section>

        <section className="public-menu-toolbar">
          <label className="public-menu-search">
            <SearchOutlined />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Tìm món ăn, ví dụ: com rang"
              aria-label="Tìm món ăn"
            />
          </label>
          <div className="public-category-tabs" role="tablist" aria-label="Nhóm món">
            <button className={activeCategory === 'all' ? 'active' : ''} onClick={() => setActiveCategory('all')}>Tất cả</button>
            {categories.map((category) => (
              <button
                key={category.id}
                className={activeCategory === category.id ? 'active' : ''}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.ten_nhom}
              </button>
            ))}
          </div>
        </section>

        {error && (
          <div className="public-menu-error">
            <span>{error}</span>
            <Button size="small" onClick={() => loadMenu(false)}>Thử lại</Button>
          </div>
        )}

        {loading ? (
          <div className="public-menu-loading"><Spin size="large" /><span>Đang tải thực đơn...</span></div>
        ) : visibleCategories.length === 0 ? (
          <div className="public-menu-empty"><Empty description={search ? 'Không tìm thấy món phù hợp.' : 'Chưa có món ăn đang bán.'} /></div>
        ) : (
          <div className="public-menu-categories">
            {visibleCategories.map((category) => (
              <section className="public-menu-category" key={category.id}>
                <div className="public-category-heading">
                  <div>
                    <span className="public-category-kicker">NHÓM MÓN</span>
                    <h2>{category.ten_nhom}</h2>
                  </div>
                  <span>{category.mon_an.length} món</span>
                </div>
                <div className="public-dish-grid">
                  {category.mon_an.map((dish) => {
                    const selected = selectedIds.includes(dish.id)
                    const soldOut = dish.trang_thai === 'TAM_HET'
                    return (
                      <article
                        className={`public-dish-card ${soldOut ? 'sold-out' : ''} ${selected ? 'selected' : ''}`}
                        key={dish.id}
                      >
                        <div className="public-dish-image-wrap">
                          <img src={getMediaUrl(dish.anh_url)} alt={dish.ten_mon} loading="lazy" />
                          {soldOut && <span className="sold-out-badge">Tạm hết</span>}
                          {selected && <span className="selected-badge"><CheckOutlined /> Đã chọn</span>}
                        </div>
                        <div className="public-dish-body">
                          <div className="public-dish-title-row">
                            <h3>{dish.ten_mon}</h3>
                            <strong>{formatVnd(dish.gia)}</strong>
                          </div>
                          {dish.mo_ta_ngan && <p>{dish.mo_ta_ngan}</p>}
                          <div className="public-dish-meta">
                            <span>{dish.don_vi_tinh}</span>
                            <span><ClockCircleOutlined /> Phục vụ theo tình trạng món</span>
                          </div>
                          <button
                            className="public-dish-select"
                            disabled={soldOut}
                            onClick={() => toggleDish(dish)}
                          >
                            {soldOut ? 'Tạm hết' : selected ? 'Bỏ chọn món' : 'Chọn món'}
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </main>

      <aside className="public-cart-bar" aria-live="polite">
        <div className="public-cart-summary">
          <div className="public-cart-icon"><ShoppingCartOutlined /></div>
          <div>
            <span>{selectedDishes.length} món đã chọn</span>
            <strong>Tạm tính {formatVnd(total)}</strong>
          </div>
        </div>
        <button className="public-cart-clear" disabled={!selectedIds.length} onClick={() => setSelectedIds([])}>
          Bỏ chọn tất cả
        </button>
      </aside>
    </div>
  )
}
