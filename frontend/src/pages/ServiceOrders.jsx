jsx
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button, Empty, Modal, Radio, Tag, Tooltip, message } from 'antd'
import { ReloadOutlined, ShoppingCartOutlined } from '@ant-design/icons'
import {
  cancelOrderLine,
  closeServiceSession,
  getServiceOrders,
} from '../services/api'
import './OrderOperations.css'

const CANCEL_REASONS = [
  { value: 'KHACH_DOI_Y', label: 'Khách đổi ý' },
  { value: 'GOI_NHAM', label: 'Gọi nhầm' },
  { value: 'HET_NGUYEN_LIEU', label: 'Hết nguyên liệu' },
]

const TERMINAL_STATUSES = new Set([
  'DA_XONG',
  'DA_PHUC_VU',
  'DA_HUY',
])

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
  if (status === 'DANG_CHE_BIEN') {
    return { color: 'orange', label: 'Bếp đang làm' }
  }
  return { color: 'blue', label: 'Chờ bếp' }
}

export default function ServiceOrders({ user }) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [canceling, setCanceling] = useState(null)

  const role = user?.vai_tro || user?.role || ''
  const isManager = role === 'QUAN_LY'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getServiceOrders()
      setOrders(Array.isArray(data) ? data : [])
    } catch (error) {
      message.error(
        error?.response?.data?.detail ||
          'Không thể tải danh sách món đang theo dõi.',
      )
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      void load()
    }, 0)

    const refreshTimer = window.setInterval(() => {
      void load()
    }, 3000)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(refreshTimer)
    }
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map()

    orders.forEach((item) => {
      const key = item.phien_ban_id
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    })

    return [...map.entries()]
  }, [orders])

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
    if (!cancelTarget || canceling !== null) return

    if (!cancelReason) {
      message.warning('Vui lòng chọn lý do huỷ món.')
      return
    }

    const target = cancelTarget
    const status = target.trang_thai

    // Kiểm tra lại quyền trên giao diện; backend vẫn phải xác thực quyền.
    if (
      status !== 'CHO_BEP' &&
      !(isManager && status === 'DANG_CHE_BIEN')
    ) {
      message.error(
        status === 'DANG_CHE_BIEN'
          ? 'Món đã bắt đầu chế biến. Chỉ quản lý mới được huỷ.'
          : 'Trạng thái món không cho phép huỷ.',
      )
      return
    }

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
        error?.response?.data?.detail || 'Không thể huỷ món.',
      )
      await load()
    } finally {
      setCanceling(null)
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

  return (
    <section className="order-ops-page">
      <div className="order-ops-heading">
        <div>
          <p className="eyebrow">
            <ShoppingCartOutlined /> PHỤC VỤ
          </p>
          <h1>Theo dõi món theo bàn</h1>
          <p>
            Danh sách tự cập nhật mỗi 3 giây. Nhân viên phục vụ chỉ
            được huỷ món đang chờ bếp; món đang chế biến chỉ quản lý
            được huỷ và vẫn tính tiền.
          </p>
        </div>

        <Button
          icon={<ReloadOutlined spin={loading} />}
          onClick={load}
          loading={loading}
        >
          Cập nhật
        </Button>
      </div>

      {!grouped.length ? (
        <div className="order-ops-empty">
          <Empty description="Chưa có bàn nào đang gọi món." />
        </div>
      ) : (
        <div className="order-ops-grid">
          {grouped.map(([sessionId, lines]) => {
            const canClose = lines.every((line) =>
              TERMINAL_STATUSES.has(line.trang_thai),
            )

            const subtotal = lines.reduce((sum, line) => {
              if (line.tinh_tien === false) return sum

              return (
                sum +
                Number(line.don_gia || 0) *
                  Number(line.so_luong || 0)
              )
            }, 0)

            return (
              <article className="order-ticket" key={sessionId}>
                <header>
                  <div>
                    <strong>Bàn {lines[0].ma_ban || sessionId}</strong>
                    <span>
                      {lines.length} dòng món · Phiên #{sessionId} ·
                      {' '}Tạm tính {money(subtotal)}
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
                    const canCancel =
                      line.trang_thai === 'CHO_BEP' ||
                      (isManager &&
                        line.trang_thai === 'DANG_CHE_BIEN')

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

                          {cancelled && (
                            <small className="cancel-detail">
                              Lý do: {reasonLabel(line.ly_do_huy)} ·{' '}
                              {line.tinh_tien
                                ? 'Vẫn tính tiền'
                                : 'Không tính tiền'}
                            </small>
                          )}
                        </div>

                        <div className="order-line-actions">
                          <Tag color={meta.color}>{meta.label}</Tag>

                          {!cancelled && canCancel && (
                            <Button
                              size="small"
                              danger
                              loading={canceling === line.id}
                              disabled={canceling !== null}
                              onClick={() => openCancelModal(line)}
                            >
                              Huỷ món
                            </Button>
                          )}

                          {!cancelled &&
                            line.trang_thai === 'DANG_CHE_BIEN' &&
                            !isManager && (
                              <Tooltip title="Bếp đã bắt đầu chế biến. Chỉ quản lý mới được huỷ; món vẫn tính tiền.">
                                <span>
                                  <Button size="small" danger disabled>
                                    Không thể huỷ
                                  </Button>
                                </span>
                              </Tooltip>
                            )}

                          {!cancelled && (
                            <small>
                              {line.trang_thai === 'DA_XONG'
                                ? 'Mang ra bàn'
                                : line.trang_thai === 'DA_PHUC_VU'
                                  ? 'Đã giao cho khách'
                                  : line.du_kien_hoan_thanh_at
                                    ? `Dự kiến ${new Date(
                                        line.du_kien_hoan_thanh_at,
                                      ).toLocaleTimeString('vi-VN', {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}`
                                    : ''}
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
        title={
          cancelTarget
            ? `Huỷ món: ${cancelTarget.ten_mon}`
            : 'Xác nhận huỷ món'
        }
        onCancel={closeCancelModal}
        onOk={confirmCancel}
        confirmLoading={canceling !== null}
        okButtonProps={{
          danger: true,
          disabled: !cancelReason || canceling !== null,
        }}
        okText="Xác nhận huỷ"
        cancelText="Đóng"
        destroyOnClose
      >
        {cancelTarget && (
          <>
            <p>
              Bạn đang huỷ món:{' '}
              <strong>{cancelTarget.ten_mon}</strong> ×{' '}
              {cancelTarget.so_luong}
            </p>

            {cancelTarget.trang_thai === 'DANG_CHE_BIEN' ? (
              <p>
                <strong>Món đã bắt đầu chế biến.</strong> Chỉ quản lý
                mới được huỷ. Món vẫn được giữ trên hoá đơn và tính tiền.
              </p>
            ) : (
              <p>
                Món đang chờ bếp. Sau khi huỷ thành công, món sẽ rời
                hàng đợi bếp và không được tính vào tạm tính.
              </p>
            )}

            <p>
              <strong>Lý do huỷ bắt buộc:</strong>
            </p>

            <Radio.Group
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
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
