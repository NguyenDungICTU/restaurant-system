import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Button,
  Empty,
  Spin,
  Tag,
  Tooltip,
} from 'antd'
import {
  ArrowsAltOutlined,
  ClockCircleOutlined,
  FireOutlined,
  ReloadOutlined,
  ShrinkOutlined,
  WifiOutlined,
  DisconnectOutlined,
} from '@ant-design/icons'
import { getKitchenOrders, updateOrderLineStatus } from '../services/api'
import './OrderOperations.css'

const POLL_INTERVAL_MS = 3000
const RETRY_INTERVAL_MS = 2000
const OVERDUE_MINUTES = 15
const ACTIVE_STATUSES = new Set(['CHO_BEP', 'DANG_CHE_BIEN'])

function receivedAtOf(line) {
  const value = new Date(line.thoi_diem_tiep_nhan).getTime()
  return Number.isFinite(value) ? value : 0
}

function formatTime(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--:--'
  return date.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAge(receivedAt, now) {
  const minutes = Math.max(0, Math.floor((now - receivedAt) / 60000))
  if (minutes < 1) return 'Mới nhận'
  return `${minutes} phút`
}

function statusLabel(status) {
  if (status === 'CHO_BEP') return 'Chờ làm'
  if (status === 'DANG_CHE_BIEN') return 'Đang làm'
  if (status === 'DA_XONG') return 'Đã xong'
  if (status === 'DA_PHUC_VU') return 'Đã phục vụ'
  if (status === 'DA_HUY') return 'Đã hủy'
  return status
}

export default function Kitchen() {
  const [orders, setOrders] = useState([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [updating, setUpdating] = useState(null)
  const [connection, setConnection] = useState('connecting')
  const [largeText, setLargeText] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const requestRef = useRef(null)
  const timerRef = useRef(null)
  const mountedRef = useRef(true)
  const connectionRef = useRef('connecting')

  const load = useCallback(async (isRetry = false) => {
    if (!mountedRef.current) return

    if (timerRef.current) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }

    if (requestRef.current) {
      requestRef.current.abort()
    }

    const controller = new AbortController()
    requestRef.current = controller
    connectionRef.current = 'connecting'
    setConnection('connecting')

    try {
      const data = await getKitchenOrders({ signal: controller.signal })
      if (!mountedRef.current || controller.signal.aborted) return

      // Only show work that is still relevant to the kitchen.
      // Completed/served/cancelled lines are not presented as fresh work.
      const activeOrders = Array.isArray(data)
        ? data.filter((item) => ACTIVE_STATUSES.has(item.trang_thai))
        : []

      setOrders(activeOrders)
      connectionRef.current = 'connected'
      setConnection('connected')
    } catch (error) {
      if (!mountedRef.current || controller.signal.aborted) return

      // A failed refresh means the displayed snapshot is no longer trusted.
      // Clear it so stale tickets cannot look like current orders.
      setOrders([])
      connectionRef.current = 'disconnected'
      setConnection('disconnected')
    } finally {
      if (mountedRef.current && requestRef.current === controller) {
        requestRef.current = null
        setInitialLoading(false)

        const shouldRetry = connectionRef.current === 'disconnected' || isRetry
        const delay = shouldRetry ? RETRY_INTERVAL_MS : POLL_INTERVAL_MS

        timerRef.current = window.setTimeout(
          () => load(shouldRetry),
          delay,
        )
      }
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    load()

    const tick = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    const retryNow = () => {
      if (!requestRef.current) load(true)
    }
    window.addEventListener('online', retryNow)

    return () => {
      mountedRef.current = false
      window.clearInterval(tick)
      window.removeEventListener('online', retryNow)
      if (timerRef.current) window.clearTimeout(timerRef.current)
      requestRef.current?.abort()
    }
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map()

    orders.forEach((item) => {
      const key = `${item.phien_ban_id}-${item.dot_id}`
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    })

    return [...map.values()]
      .map((lines) => [...lines].sort(
        (a, b) => receivedAtOf(a) - receivedAtOf(b) || a.id - b.id,
      ))
      .sort((a, b) => (
        receivedAtOf(a[0]) - receivedAtOf(b[0]) || a[0].id - b[0].id
      ))
  }, [orders])

  async function update(lineId, status) {
    setUpdating(lineId)
    try {
      await updateOrderLineStatus(lineId, status)
      await load()
    } finally {
      setUpdating(null)
    }
  }

  const overdueCount = orders.filter((item) => (
    now - receivedAtOf(item) >= OVERDUE_MINUTES * 60 * 1000
  )).length

  return (
    <section className={`kitchen-page ${largeText ? 'kitchen-page--large' : ''}`}>
      <div className="kitchen-heading">
        <div>
          <p className="eyebrow"><FireOutlined /> BẾP</p>
          <h1>Món cần làm</h1>
          <p className="kitchen-subtitle">
            Phiếu được xếp theo thứ tự nhận. Màn hình tự cập nhật, không cần tải lại trang.
          </p>
        </div>

        <div className="kitchen-toolbar">
          <div className={`kitchen-connection kitchen-connection--${connection}`}>
            {connection === 'connected'
              ? <WifiOutlined />
              : connection === 'connecting'
                ? <ReloadOutlined spin />
                : <DisconnectOutlined />}
            <span>
              {connection === 'connected'
                ? 'Đã kết nối'
                : connection === 'connecting'
                  ? 'Đang kết nối lại...'
                  : 'Mất kết nối · đang tự kết nối lại'}
            </span>
          </div>

          {overdueCount > 0 && (
            <Tag className="kitchen-overdue-summary" color="error">
              {overdueCount} món quá hạn
            </Tag>
          )}

          <Tooltip title={largeText ? 'Thu nhỏ chữ' : 'Tăng cỡ chữ'}>
            <Button
              icon={largeText ? <ShrinkOutlined /> : <ArrowsAltOutlined />}
              onClick={() => setLargeText((value) => !value)}
            >
              {largeText ? 'Chữ thường' : 'Chữ lớn'}
            </Button>
          </Tooltip>

          <Button
            icon={<ReloadOutlined spin={initialLoading} />}
            onClick={() => load(true)}
            disabled={connection === 'connecting'}
          >
            Cập nhật
          </Button>
        </div>
      </div>

      {connection === 'disconnected' && (
        <div className="kitchen-disconnected-banner" role="alert">
          <DisconnectOutlined />
          <div>
            <strong>Mất kết nối với hệ thống đặt món</strong>
            <span>
              Các phiếu hiện tại đã được ẩn để tránh hiển thị dữ liệu cũ như phiếu mới.
              Hệ thống đang tự kết nối lại.
            </span>
          </div>
        </div>
      )}

      {initialLoading ? (
        <div className="kitchen-state">
          <Spin size="large" />
          <strong>Đang tải phiếu bếp...</strong>
        </div>
      ) : !grouped.length && connection === 'connected' ? (
        <div className="kitchen-state">
          <Empty description="Hiện không có món cần làm." />
        </div>
      ) : connection !== 'disconnected' && grouped.length ? (
        <div className="kitchen-ticket-list">
          {grouped.map((lines) => {
            const first = lines[0]
            const receivedAt = receivedAtOf(first)
            const overdue = now - receivedAt >= OVERDUE_MINUTES * 60 * 1000

            return (
              <article
                className={`kitchen-ticket ${overdue ? 'kitchen-ticket--overdue' : ''}`}
                key={`${first.phien_ban_id}-${first.dot_id}`}
              >
                <header className="kitchen-ticket-header">
                  <div>
                    <div className="kitchen-table">
                      Bàn {first.ma_ban}
                      {overdue && <span className="kitchen-overdue-label">QUÁ HẠN</span>}
                    </div>
                    <div className="kitchen-batch">
                      Đợt gọi #{first.dot_id} · nhận lúc {formatTime(first.thoi_diem_tiep_nhan)}
                    </div>
                  </div>

                  <div className="kitchen-ticket-age">
                    <ClockCircleOutlined />
                    <strong>{formatAge(receivedAt, now)}</strong>
                  </div>
                </header>

                <div className="kitchen-ticket-lines">
                  {lines.map((line) => (
                    <div className="kitchen-line" key={line.id}>
                      <div className="kitchen-line-main">
                        <div className="kitchen-dish">
                          <span className="kitchen-quantity">{line.so_luong}×</span>
                          <strong>{line.ten_mon}</strong>
                        </div>

                        {line.ghi_chu && (
                          <div className="kitchen-note">
                            Ghi chú: {line.ghi_chu}
                          </div>
                        )}
                      </div>

                      <div className="kitchen-line-actions">
                        <Tag className={`kitchen-status kitchen-status--${line.trang_thai}`}>
                          {statusLabel(line.trang_thai)}
                        </Tag>

                        {line.trang_thai === 'CHO_BEP' && (
                          <Button
                            type="primary"
                            size="large"
                            loading={updating === line.id}
                            onClick={() => update(line.id, 'DANG_CHE_BIEN')}
                          >
                            Bắt đầu
                          </Button>
                        )}

                        {line.trang_thai === 'DANG_CHE_BIEN' && (
                          <Button
                            type="primary"
                            size="large"
                            loading={updating === line.id}
                            onClick={() => update(line.id, 'DA_XONG')}
                          >
                            Đã xong
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
