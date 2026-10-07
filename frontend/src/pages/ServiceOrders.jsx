import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  App as AntdApp,
  Badge,
  Button,
  Empty,
  Modal,
  Radio,
  Tag,
} from 'antd'
import {
  BellOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import {
  cancelOrderLine,
  closeServiceSession,
  getServiceOrders,
  updateOrderLineStatus,
} from '../services/api'
import './OrderOperations.css'

const CANCEL_REASONS = [
  { value: 'KHACH_DOI_Y', label: 'Khách đổi ý' },
  { value: 'GOI_NHAM', label: 'Gọi nhầm' },
  { value: 'HET_NGUYEN_LIEU', label: 'Hết nguyên liệu' },
]

const CLOSEABLE_STATUSES = new Set([
  'DA_PHUC_VU',
  'DA_HUY',
])

const READY_STATUS = 'DA_XONG'
const OVERDUE_MS = 5 * 60 * 1000

function reasonLabel(value) {
  return (
    CANCEL_REASONS.find((item) => item.value === value)?.label ||
    value ||
    'Không rõ lý do'
  )
}

function money(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`
}

function statusMeta(status) {
  if (status === 'DA_HUY') return { color: 'red', label: 'Đã huỷ' }
  if (status === 'DA_XONG') return { color: 'green', label: 'Đã xong' }
  if (status === 'DA_PHUC_VU') return { color: 'cyan', label: 'Đã phục vụ' }
  if (status === 'DANG_CHE_BIEN') return { color: 'orange', label: 'Bếp đang làm' }
  return { color: 'blue', label: 'Đã nhận' }
}

function completionTime(line) {
  const value = line.hoan_thanh_at || line.du_kien_hoan_thanh_at
  const timestamp = value ? new Date(value).getTime() : Number.MAX_SAFE_INTEGER
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp
}

function waitingMs(line, nowTs) {
  const value = line.hoan_thanh_at
  if (!value) return 0

  const completedAt = new Date(value).getTime()
  if (Number.isNaN(completedAt)) return 0

  return Math.max(0, nowTs - completedAt)
}

function waitingLabel(milliseconds) {
  const totalSeconds = Math.floor(milliseconds / 1000)
  if (totalSeconds <= 0) return 'Vừa hoàn thành'

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) return `Đã chờ ${seconds} giây`
  return `Đã chờ ${minutes} phút ${String(seconds).padStart(2, '0')} giây`
}

function completedAtLabel(line) {
  if (!line.hoan_thanh_at) return 'Chưa có thời điểm hoàn thành'

  const value = new Date(line.hoan_thanh_at)
  if (Number.isNaN(value.getTime())) return 'Không xác định'

  return value.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function ServiceOrders({ user }) {
  const { message, notification } = AntdApp.useApp()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(null)
  const [serving, setServing] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [canceling, setCanceling] = useState(null)
  const [nowTs, setNowTs] = useState(() => Date.now())

  const readyInitializedRef = useRef(false)
  const seenReadyIdsRef = useRef(new Set())

  const isManager =
    user?.role === 'QUAN_LY' ||
    user?.vai_tro === 'QUAN_LY'

  const load = useCallback(async () => {
    setLoading(true)

    try {
      const nextOrders = await getServiceOrders()
      const readyLines = nextOrders
        .filter((item) => item.trang_thai === READY_STATUS)
        .sort((left, right) => completionTime(left) - completionTime(right))

      if (readyInitializedRef.current) {
        readyLines.forEach((line) => {
          if (seenReadyIdsRef.current.has(line.id)) return

          notification.open({
            key: `ready-${line.id}`,
            icon: <BellOutlined />,
            message: `Món xong · Bàn ${line.ma_ban}`,
            description: `${line.ten_mon} × ${line.so_luong} đã sẵn sàng mang ra.`,
            duration: 4,
          })
        })
      }

      readyLines.forEach((line) => {
        seenReadyIdsRef.current.add(line.id)
      })
      readyInitializedRef.current = true
      setOrders(nextOrders)
    } catch (error) {
      message.error(
        error?.response?.data?.detail ||
        'Không thể tải danh sách món đang theo dõi.',
      )
    } finally {
      setLoading(false)
    }
  }, [message, notification])

  useEffect(() => {
    const runLoad = () => {
      void load()
    }

    const initialTimer = window.setTimeout(runLoad, 0)
    const refreshTimer = window.setInterval(runLoad, 3000)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(refreshTimer)
    }
  }, [load])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowTs(Date.now())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  const readyItems = useMemo(
    () => orders
      .filter((item) => item.trang_thai === READY_STATUS)
      .sort((left, right) => completionTime(left) - completionTime(right)),
    [orders],
  )

  const grouped = useMemo(() => {
    const map = new Map()

    orders.forEach((item) => {
      const key = item.phien_ban_id
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    })

    return [...map.entries()]
  }, [orders])

  async function markServed(line) {
    if (serving === line.id) return

    setServing(line.id)

    try {
      await updateOrderLineStatus(line.id, 'DA_PHUC_VU')

      setOrders((current) => current.map((item) => (
        item.id === line.id
          ? {
              ...item,
              trang_thai: 'DA_PHUC_VU',
              phuc_vu_at: new Date().toISOString(),
            }
          : item
      )))

      message.success(
        `Đã xác nhận mang "${line.ten_mon}" ra bàn ${line.ma_ban}.`,
      )
      await load()
    } catch (error) {
      const detail = error?.response?.data?.detail
      const status = error?.response?.status

      if (status === 409) {
        message.warning(
          detail?.includes('bạn khác')
            ? detail
            : 'Món đã được bạn khác mang ra.',
        )
      } else {
        message.error(detail || 'Không thể xác nhận món đã phục vụ.')
      }

      await load()
    } finally {
      setServing(null)
    }
  }

  async function closeSession(sessionId) {
    setClosing(sessionId)

    try {
      await closeServiceSession(sessionId)
      message.success('Đã kết thúc phiên phục vụ.')
      await load()
    } catch (error) {
      message.error(
        error?.response?.data?.detail ||
        'Không thể kết thúc phiên phục vụ.',
      )
    } finally {
      setClosing(null)
    }
  }

  function openCancelModal(line) {
    setCancelTarget(line)
    setCancelReason('')
  }

  function closeCancelModal() {
    if (canceling !== null) return
    setCancelTarget(null)
    setCancelReason('')
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    if (!cancelReason) {
      message.warning('Vui lòng chọn lý do huỷ món.')
      return
    }

    const target = cancelTarget
    setCanceling(target.id)

    try {
      await cancelOrderLine(target.id, cancelReason)
      message.success(
        `Đã huỷ món "${target.ten_mon}" — ${reasonLabel(cancelReason)}.`,
      )
      setCancelTarget(null)
      setCancelReason('')
      await load()
    } catch (error) {
      message.error(
        error?.response?.data?.detail ||
        'Không thể huỷ món.',
      )
      await load()
    } finally {
      setCanceling(null)
    }
  }

  return (
    <section className="order-ops-page">
      <div className="order-ops-heading">
        <div>
          <p className="eyebrow">
            <ShoppingCartOutlined /> PHỤC VỤ
          </p>
          <h1>Theo dõi món theo bàn</h1>
          <p>
            Màn hình tự cập nhật mỗi 3 giây. Món vừa hoàn thành sẽ xuất hiện
            trong danh sách chờ mang ra; món chờ quá 5 phút được ưu tiên cảnh báo.
          </p>
        </div>

        <Button
          icon={<ReloadOutlined spin={loading} />}
          onClick={load}
        >
          Cập nhật
        </Button>
      </div>

      <section className="ready-orders-panel">
        <div className="ready-orders-heading">
          <div>
            <p className="eyebrow">
              <BellOutlined /> MÓN CHỜ MANG RA
            </p>
            <h2>Món bếp đã hoàn thành</h2>
            <p>
              Sắp xếp từ món hoàn thành lâu nhất đến mới nhất.
              Xác nhận ngay sau khi đã mang món ra bàn.
            </p>
          </div>

          <Badge
            count={readyItems.length}
            showZero
            overflowCount={99}
          />
        </div>

        {!readyItems.length ? (
          <div className="ready-orders-empty">
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Hiện chưa có món nào chờ mang ra."
            />
          </div>
        ) : (
          <div className="ready-orders-list">
            {readyItems.map((line) => {
              const wait = waitingMs(line, nowTs)
              const overdue = wait > OVERDUE_MS

              return (
                <article
                  className={`ready-order-card${overdue ? ' is-overdue' : ''}`}
                  key={line.id}
                >
                  <div className="ready-order-main">
                    <div className="ready-order-table">
                      <span>Bàn</span>
                      <strong>{line.ma_ban}</strong>
                    </div>

                    <div className="ready-order-dish">
                      <strong>{line.ten_mon} × {line.so_luong}</strong>
                      {line.ghi_chu && (
                        <small>Ghi chú: {line.ghi_chu}</small>
                      )}
                      <small>
                        Hoàn thành lúc {completedAtLabel(line)}
                      </small>
                    </div>
                  </div>

                  <div className="ready-order-actions">
                    <Tag color={overdue ? 'red' : 'green'}>
                      <ClockCircleOutlined />{' '}
                      {overdue ? 'Quá 5 phút' : 'Sẵn sàng'}
                    </Tag>

                    <span className={`ready-wait-time${overdue ? ' overdue' : ''}`}>
                      {waitingLabel(wait)}
                    </span>

                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      loading={serving === line.id}
                      disabled={serving === line.id}
                      onClick={() => markServed(line)}
                    >
                      Đã mang ra
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <div className="order-history-heading">
        <div>
          <p className="eyebrow">TOÀN BỘ PHIÊN PHỤC VỤ</p>
          <h2>Trạng thái món theo bàn</h2>
        </div>
      </div>

      {!grouped.length ? (
        <div className="order-ops-empty">
          <Empty description="Chưa có bàn nào đang gọi món." />
        </div>
      ) : (
        <div className="order-ops-grid">
          {grouped.map(([sessionId, lines]) => {
            const canClose = lines.every((line) =>
              CLOSEABLE_STATUSES.has(line.trang_thai)
            )
            const subtotal = lines.reduce((sum, line) => {
              if (line.tinh_tien === false) return sum
              return sum + Number(line.don_gia || 0) * Number(line.so_luong || 0)
            }, 0)

            return (
              <article className="order-ticket" key={sessionId}>
                <header>
                  <div>
                    <strong>Bàn {lines[0].ma_ban}</strong>
                    <span>
                      {lines.length} dòng món · Phiên #{sessionId} · Tạm tính {money(subtotal)}
                    </span>
                  </div>

                  <div className="order-ticket-header-actions">
                    <Tag color={canClose ? 'green' : 'orange'}>
                      {canClose ? 'Có thể kết thúc' : 'Đang xử lý'}
                    </Tag>
                    <Button
                      size="small"
                      disabled={!canClose}
                      loading={closing === sessionId}
                      onClick={() => closeSession(sessionId)}
                    >
                      Kết thúc phiên
                    </Button>
                  </div>
                </header>

                <div className="order-ticket-lines">
                  {lines.map((line) => {
                    const meta = statusMeta(line.trang_thai)
                    const cancelled = line.trang_thai === 'DA_HUY'

                    return (
                      <div
                        className={`order-line${cancelled ? ' is-cancelled' : ''}`}
                        key={line.id}
                      >
                        <div>
                          <strong>
                            {line.ten_mon} × {line.so_luong}
                          </strong>

                          {line.ghi_chu && (
                            <small>Ghi chú: {line.ghi_chu}</small>
                          )}

                          {line.hoan_thanh_at && (
                            <small>
                              Hoàn thành: {completedAtLabel(line)}
                            </small>
                          )}

                          {cancelled && (
                            <small className="cancel-detail">
                              Lý do: {reasonLabel(line.ly_do_huy)} ·{' '}
                              {line.tinh_tien
                                ? 'Vẫn tính tiền (Quản lý huỷ sau khi bếp bắt đầu)'
                                : 'Không tính tiền'}
                            </small>
                          )}
                        </div>

                        <div className="order-line-actions">
                          <Tag color={meta.color}>{meta.label}</Tag>

                          {(
                            line.trang_thai === 'CHO_BEP' ||
                            (isManager && line.trang_thai === 'DANG_CHE_BIEN')
                          ) && (
                            <Button
                              size="small"
                              danger
                              loading={canceling === line.id}
                              onClick={() => openCancelModal(line)}
                            >
                              Huỷ món
                            </Button>
                          )}

                          {line.trang_thai === 'DANG_CHE_BIEN' && !isManager && (
                            <Button
                              size="small"
                              disabled
                              title="Món đã bắt đầu chế biến. Chỉ Quản lý mới được huỷ."
                            >
                              Không thể huỷ
                            </Button>
                          )}

                          {line.trang_thai === READY_STATUS && (
                            <Button
                              size="small"
                              type="primary"
                              loading={serving === line.id}
                              disabled={serving === line.id}
                              onClick={() => markServed(line)}
                            >
                              Đã mang ra
                            </Button>
                          )}

                          {!cancelled && line.trang_thai !== READY_STATUS && (
                            <small>
                              {line.trang_thai === 'DA_PHUC_VU'
                                ? 'Đã giao cho khách'
                                : `Dự kiến ${new Date(
                                    line.du_kien_hoan_thanh_at,
                                  ).toLocaleTimeString('vi-VN', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}`}
                            </small>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </div>
      )}

      <Modal
        open={Boolean(cancelTarget)}
        title="Xác nhận huỷ món"
        onCancel={closeCancelModal}
        onOk={confirmCancel}
        confirmLoading={canceling !== null}
        okText="Xác nhận huỷ"
        cancelText="Không"
        okButtonProps={{ danger: true, disabled: !cancelReason }}
        destroyOnClose
      >
        {cancelTarget && (
          <>
            <p>
              Bạn đang huỷ món:{' '}
              <strong>{cancelTarget.ten_mon}</strong> × {cancelTarget.so_luong}
            </p>

            {cancelTarget.trang_thai === 'DANG_CHE_BIEN' ? (
              <p>
                <strong>Món đã bắt đầu chế biến.</strong>{' '}
                Chỉ Quản lý mới được huỷ. Món sẽ được đánh dấu Đã huỷ
                nhưng vẫn giữ nguyên giá trị tính tiền.
              </p>
            ) : (
              <p>
                Món chưa được bếp bắt đầu chế biến. Sau khi huỷ, món sẽ
                rời hàng đợi bếp và không còn được tính tiền.
              </p>
            )}

            <p><strong>Lý do huỷ bắt buộc:</strong></p>
            <Radio.Group
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {CANCEL_REASONS.map((reason) => (
                <Radio key={reason.value} value={reason.value}>
                  {reason.label}
                </Radio>
              ))}
            </Radio.Group>
          </>
        )}
      </Modal>
    </section>
  )
}
