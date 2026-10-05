import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircleFilled,
  DownOutlined,
  FireOutlined,
  ReloadOutlined,
  SearchOutlined,
  UpOutlined,
} from '@ant-design/icons'
import { App as AntdApp, Empty, Input, Skeleton, Switch, Tag, Card, Button } from 'antd'
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

  // Lần đầu tải xong sẽ mở tất cả các nhóm
  useEffect(() => {
    if (visibleGroups.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set(visibleGroups.map((g) => g.id)))
    }
  }, [visibleGroups])

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
    <section className="daily-menu-page" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <p style={{ color: '#8B2626', fontWeight: 600, fontSize: '13px', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <FireOutlined /> MÓN TRONG NGÀY
          </p>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: '4px 0 6px', color: '#1f1f1f' }}>Trạng thái nguyên liệu</h1>
          <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
            Mở từng nhóm món để xem nhanh các món trong nhóm và bật <strong>Tạm hết</strong> ngay khi hết nguyên liệu.
          </p>
        </div>
        <div style={{
          background: '#fff', border: '1px solid #e8e8e8', padding: '6px 14px', borderRadius: '20px',
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#555', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
        }}>
          {refreshing ? <ReloadOutlined spin style={{ color: '#1890ff' }} /> : <CheckCircleFilled style={{ color: '#52c41a' }} />}
          {refreshing ? 'Đang cập nhật' : 'Tự động đồng bộ 3 giây'}
        </div>
      </div>

      {/* Khối thống kê số lượng */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
        <Card size="small" bodyStyle={{ padding: '16px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#1f1f1f' }}>{groups.length}</div>
          <div style={{ fontSize: '13px', color: '#8c8c8c' }}>Nhóm món</div>
        </Card>
        <Card size="small" bodyStyle={{ padding: '16px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#1f1f1f' }}>{dishes.length}</div>
          <div style={{ fontSize: '13px', color: '#8c8c8c' }}>Tổng số món</div>
        </Card>
        <Card size="small" bodyStyle={{ padding: '16px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: soldOutCount ? '#ff4d4f' : '#1f1f1f' }}>{soldOutCount}</div>
          <div style={{ fontSize: '13px', color: '#8c8c8c' }}>Đang tạm hết</div>
        </Card>
        <Card size="small" bodyStyle={{ padding: '16px' }}>
          <div style={{ fontSize: '22px', fontWeight: 700, color: '#52c41a' }}>{availableCount}</div>
          <div style={{ fontSize: '13px', color: '#8c8c8c' }}>Còn hàng</div>
        </Card>
      </div>

      {/* Thanh công cụ Tìm kiếm & Thao tác */}
      <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #f0f0f0', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm món trong danh sách..."
          style={{ width: '320px' }}
        />
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button onClick={expandAll} size="middle">Mở tất cả</Button>
          <Button onClick={collapseAll} size="middle">Thu gọn</Button>
          <Button icon={<ReloadOutlined spin={refreshing} />} onClick={() => load(false)} disabled={refreshing}>
            Làm mới
          </Button>
        </div>
      </div>

      {error && <div style={{ padding: '12px', background: '#fff2f0', border: '1px solid #ffccc7', borderRadius: '6px', color: '#ff4d4f', marginBottom: '16px' }}>{error}</div>}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[1, 2, 3].map((item) => (
            <Card key={item}><Skeleton active paragraph={{ rows: 2 }} /></Card>
          ))}
        </div>
      ) : !visibleGroups.length ? (
        <Card style={{ textAlign: 'center', padding: '40px 0' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có món phù hợp." />
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {visibleGroups.map((group) => {
            const expanded = expandedGroups.has(group.id)
            const soldOutInGroup = group.dishes.filter((dish) => dish.trang_thai === 'TAM_HET').length

            return (
              <div key={group.id} style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
                <div
                  onClick={() => toggleGroup(group.id)}
                  style={{
                    padding: '14px 20px', background: '#fafafa', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyBetween: 'space-between', borderBottom: expanded ? '1px solid #e8e8e8' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                    <span style={{ fontWeight: 600, fontSize: '15px', color: '#262626' }}>{group.name}</span>
                    <span style={{ fontSize: '12px', color: '#8c8c8c' }}>{group.dishes.length} món trong nhóm</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {soldOutInGroup > 0 && <Tag color="orange">{soldOutInGroup} tạm hết</Tag>}
                    {expanded ? <UpOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} /> : <DownOutlined style={{ fontSize: '12px', color: '#8c8c8c' }} />}
                  </div>
                </div>

                {expanded && (
                  <div style={{ padding: '16px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                      {group.dishes.map((dish) => {
                        const soldOut = dish.trang_thai === 'TAM_HET'

                        return (
                          <div
                            key={dish.id}
                            style={{
                              border: '1px solid #e8e8e8', borderRadius: '8px', padding: '12px',
                              background: soldOut ? '#fffbe6' : '#fff', opacity: soldOut ? 0.85 : 1,
                              display: 'flex', flexDirection: 'column', justifyBetween: 'space-between'
                            }}
                          >
                            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
                              <img
                                src={getMediaUrl(dish.anh_url)}
                                alt={dish.ten_mon}
                                style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '6px', border: '1px solid #f0f0f0' }}
                              />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'flex-start' }}>
                                  <strong style={{ fontSize: '14px', color: '#262626', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {dish.ten_mon}
                                  </strong>
                                </div>
                                <div style={{ color: '#8B2626', fontWeight: 600, fontSize: '13px', marginTop: '2px' }}>
                                  {Number(dish.gia || 0).toLocaleString('vi-VN')} đ
                                </div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: '2px' }}>
                                  {dish.don_vi_tinh || 'phần'} · {dish.thoi_gian_che_bien_phut || 0} phút
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: '8px', borderTop: '1px dashed #f0f0f0' }}>
                              <span style={{ fontSize: '12px', color: soldOut ? '#fa8c16' : '#52c41a' }}>
                                {soldOut ? 'Tạm hết' : 'Đang bán'}
                              </span>
                              <Switch
                                checked={soldOut}
                                loading={updatingId === dish.id}
                                onChange={(checked) => handleToggle(dish, checked)}
                                checkedChildren="Tạm hết"
                                unCheckedChildren="Còn hàng"
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Ghi chú */}
      <div style={{ marginTop: '20px', padding: '12px 16px', background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '6px', fontSize: '12px', color: '#d48806' }}>
        <strong>⏱ Tự động đặt lại: </strong>
        <span>Tất cả món tạm hết sẽ tự chuyển về Còn hàng lúc 00:00 mỗi ngày theo múi giờ Asia/Ho_Chi_Minh.</span>
      </div>
    </section>
  )
}