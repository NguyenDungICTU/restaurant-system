import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircleFilled,
  DownOutlined,
  FireOutlined,
  ReloadOutlined,
  SearchOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { App as AntdApp, Empty, Input, Skeleton, Switch, Tag } from 'antd'
import { getDailyDishes, getMediaUrl, toggleDishTemporarySoldOut } from '../services/api'

const REFRESH_MS = 3000

function groupDishes(dishes) {
  const groups = new Map()

  dishes.forEach((dish) => {
    const id = dish.nhom_mon_id ?? `unknown-${dish.nhom_mon_ten || 'unknown'}`
    if (!groups.has(id)) {
      groups.set(id, {
        id,
        name: dish.nhom_mon_ten || 'Chưa phân nhóm',
        dishes: [],
      })
    }
    groups.get(id).dishes.push(dish)
  })

  return [...groups.values()]
}

export default function DailyMenu() {
  const { message } = AntdApp.useApp()
  const [dishes, setDishes] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [updatingId, setUpdatingId] = useState(null)
  const [expandedGroups, setExpandedGroups] = useState(new Set())
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')

  const load = useCallback(async (initial = false) => {
    try {
      if (initial) setLoading(true)
      else setRefreshing(true)

      const data = await getDailyDishes()
      setDishes(data || [])
      setError('')
    } catch (err) {
      setError(err?.response?.data?.detail?.message || 'Không thể tải danh sách món trong ngày.')
    } finally {
      if (initial) setLoading(false)
      else setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(true)
    const timer = window.setInterval(() => load(false), REFRESH_MS)
    return () => window.clearInterval(timer)
  }, [load])

  const groups = useMemo(() => groupDishes(dishes), [dishes])
  const query = search.trim().toLocaleLowerCase('vi-VN')

  const visibleGroups = useMemo(() => {
    if (!query) return groups

    return groups
      .map((group) => ({
        ...group,
        dishes: group.dishes.filter((dish) =>
          dish.ten_mon.toLocaleLowerCase('vi-VN').includes(query),
        ),
      }))
      .filter((group) => group.dishes.length > 0)
  }, [groups, query])

  const soldOutCount = dishes.filter((dish) => dish.trang_thai === 'TAM_HET').length
  const availableCount = Math.max(dishes.length - soldOutCount, 0)

  const toggleGroup = (groupId) => {
    setExpandedGroups((current) => {
      const next = new Set(current)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }

  const expandAll = () => setExpandedGroups(new Set(visibleGroups.map((group) => group.id)))
  const collapseAll = () => setExpandedGroups(new Set())

  async function handleToggle(dish, tamHet) {
    setUpdatingId(dish.id)
    const previous = dishes

    setDishes((current) => current.map((item) =>
      item.id === dish.id
        ? { ...item, trang_thai: tamHet ? 'TAM_HET' : 'DANG_BAN' }
        : item,
    ))

    try {
      await toggleDishTemporarySoldOut(dish.id, tamHet)
      message.success(
        tamHet
          ? `Đã đánh dấu "${dish.ten_mon}" tạm hết.`
          : `Đã mở bán lại "${dish.ten_mon}".`,
      )
    } catch (err) {
      setDishes(previous)
      message.error(err?.response?.data?.detail?.message || 'Không thể cập nhật trạng thái món.')
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <section className="daily-menu-page">
      <div className="page-heading daily-menu-heading">
        <div>
          <p className="eyebrow"><FireOutlined /> MÓN TRONG NGÀY</p>
          <h1>Trạng thái nguyên liệu</h1>
          <p className="subheading">
            Mở từng nhóm món để xem nhanh các món trong nhóm và bật <strong>Tạm hết</strong> ngay khi hết nguyên liệu.
          </p>
        </div>
        <div className={`live-pill ${refreshing ? 'live' : ''}`}>
          {refreshing ? <ReloadOutlined spin /> : <CheckCircleFilled />}
          {refreshing ? 'Đang cập nhật' : 'Tự động đồng bộ 3 giây'}
        </div>
      </div>

      <div className="daily-menu-summary">
        <div><strong>{groups.length}</strong><span>Nhóm món</span></div>
        <div><strong>{dishes.length}</strong><span>Tổng số món</span></div>
        <div className={soldOutCount ? 'has-sold-out' : ''}><strong>{soldOutCount}</strong><span>Đang tạm hết</span></div>
        <div><strong>{availableCount}</strong><span>Còn hàng</span></div>
      </div>

      <div className="daily-menu-toolbar">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm món trong danh sách..."
        />
        <div className="daily-menu-toolbar-actions">
          <button type="button" onClick={expandAll}>Mở tất cả</button>
          <button type="button" onClick={collapseAll}>Thu gọn</button>
          <button type="button" className="daily-refresh-button" onClick={() => load(false)} disabled={refreshing}>
            <ReloadOutlined spin={refreshing} /> Làm mới
          </button>
        </div>
      </div>

      {error && <div className="menu-error">{error}</div>}

      {loading ? (
        <div className="daily-category-list">
          {[1, 2, 3].map((item) => (
            <div className="daily-category-card" key={item}>
              <Skeleton active paragraph={{ rows: 2 }} />
            </div>
          ))}
        </div>
      ) : !visibleGroups.length ? (
        <div className="menu-empty daily-empty">
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có món phù hợp." />
        </div>
      ) : (
        <div className="daily-category-list">
          {visibleGroups.map((group) => {
            const expanded = expandedGroups.has(group.id)
            const soldOutInGroup = group.dishes.filter((dish) => dish.trang_thai === 'TAM_HET').length

            return (
              <section className={`daily-category-card ${expanded ? 'expanded' : ''}`} key={group.id}>
                <button
                  type="button"
                  className="daily-category-header"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={expanded}
                >
                  <span className="daily-category-marker" />
                  <span className="daily-category-title">
                    <strong>{group.name}</strong>
                    <span>{group.dishes.length} món trong nhóm</span>
                  </span>
                  <span className="daily-category-stats">
                    {soldOutInGroup > 0 && <Tag color="orange">{soldOutInGroup} tạm hết</Tag>}
                    <span className="daily-category-count">{group.dishes.length}</span>
                    {expanded ? <UpOutlined /> : <DownOutlined />}
                  </span>
                </button>

                {expanded && (
                  <div className="daily-category-content">
                    <div className="daily-dish-grid">
                      {group.dishes.map((dish) => {
                        const soldOut = dish.trang_thai === 'TAM_HET'

                        return (
                          <article className={`daily-dish-card ${soldOut ? 'sold-out' : ''}`} key={dish.id}>
                            <div className="daily-dish-image-wrap">
                              <img src={getMediaUrl(dish.anh_url)} alt={dish.ten_mon} />
                              <Tag
                                color={soldOut ? 'default' : 'green'}
                                className={`daily-dish-status ${soldOut ? 'daily-dish-status--soldout' : 'daily-dish-status--available'}`}
                              >
                                {soldOut ? 'Tạm hết' : 'Còn hàng'}
                              </Tag>
                            </div>

                            <div className="daily-dish-body">
                              <div className="daily-dish-title-row">
                                <strong>{dish.ten_mon}</strong>
                                <b>{Number(dish.gia || 0).toLocaleString('vi-VN')} đ</b>
                              </div>
                              <span className="daily-dish-meta">
                                {dish.don_vi_tinh || 'phần'} · {dish.thoi_gian_che_bien_phut || 0} phút
                              </span>
                              {dish.mo_ta_ngan && <p>{dish.mo_ta_ngan}</p>}

                              <div className="daily-dish-control">
                                <span>{soldOut ? 'Khách không thể gọi món này' : 'Có thể nhận order'}</span>
                                <Switch
                                  checked={soldOut}
                                  loading={updatingId === dish.id}
                                  onChange={(checked) => handleToggle(dish, checked)}
                                  checkedChildren="Tạm hết"
                                  unCheckedChildren="Còn hàng"
                                />
                              </div>
                            </div>
                          </article>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}

      <div className="daily-menu-note">
        <strong>⏱ Tự động đặt lại</strong>
        <span>Tất cả món tạm hết sẽ tự chuyển về Còn hàng lúc 00:00 mỗi ngày theo múi giờ Asia/Ho_Chi_Minh.</span>
      </div>
    </section>
  )
}
