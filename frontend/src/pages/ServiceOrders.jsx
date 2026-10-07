import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App as AntdApp,
  Button,
  Empty,
  Modal,
  Radio,
  Tag,
} from 'antd'
import {
  ReloadOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import {
  cancelOrderLine,
  closeServiceSession,
  getServiceOrders,
} from '../services/api'
import './OrderOperations.css'

const CANCEL_REASONS = [
  {
    value: 'KHACH_DOI_Y',
    label: 'Khách đổi ý',
  },
  {
    value: 'GOI_NHAM',
    label: 'Gọi nhầm',
  },
  {
    value: 'HET_NGUYEN_LIEU',
    label: 'Hết nguyên liệu',
  },
]

export default function ServiceOrders({ user }) {
  const { message } = AntdApp.useApp()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(null)

  const [cancelTarget, setCancelTarget] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [canceling, setCanceling] = useState(null)

  const isManager =
    user?.role === 'QUAN_LY' ||
    user?.vai_tro === 'QUAN_LY'

  const load = useCallback(async () => {
    setLoading(true)

    try {
      setOrders(await getServiceOrders())
    } catch (error) {
      message.error(
        error?.response?.data?.detail ||
        'Không thể tải danh sách món đang theo dõi.',
      )
    } finally {
      setLoading(false)
    }
  }, [message])

  useEffect(() => {
    load()

    const timer = window.setInterval(
      load,
      3000,
    )

    return () => window.clearInterval(timer)
  }, [load])

  const grouped = useMemo(() => {
    const map = new Map()

    orders.forEach((item) => {
      if (!map.has(item.ma_ban)) {
        map.set(item.ma_ban, [])
      }

      map.get(item.ma_ban).push(item)
    })

    return [...map.entries()]
  }, [orders])

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
    if (canceling !== null) {
      return
    }

    setCancelTarget(null)
    setCancelReason('')
  }

  async function confirmCancel() {
    if (!cancelTarget) {
      return
    }

    if (!cancelReason) {
      message.warning('Vui lòng chọn lý do huỷ món.')
      return
    }

    const target = cancelTarget

    setCanceling(target.id)

    try {
      await cancelOrderLine(
        target.id,
        cancelReason,
      )

      const reasonLabel =
        CANCEL_REASONS.find(
          (item) => item.value === cancelReason,
        )?.label || cancelReason

      message.success(
        `Đã huỷ món "${target.ten_mon}" — ${reasonLabel}.`,
      )

      setCancelTarget(null)
      setCancelReason('')

      await load()
    } catch (error) {
      message.error(
        error?.response?.data?.detail ||
        'Không thể huỷ món.',
      )
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
            Màn hình cập nhật tự động để phục vụ biết
            bàn nào đang gọi món và món nào đã xong để
            mang ra.
          </p>
        </div>

        <Button
          icon={<ReloadOutlined spin={loading} />}
          onClick={load}
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
          {grouped.map(([table, lines]) => (
            <article
              className="order-ticket"
              key={table}
            >
              <header>
                <div>
                  <strong>Bàn {table}</strong>

                  <span>
                    {lines.length} món đang theo dõi ·
                    {' '}
                    Phiên #{lines[0].phien_ban_id}
                  </span>
                </div>

                <div className="order-ticket-header-actions">
                  <Tag
                    color={
                      lines.every((x) =>
                        [
                          'DA_XONG',
                          'DA_PHUC_VU',
                          'DA_HUY',
                        ].includes(x.trang_thai)
                      )
                        ? 'green'
                        : 'orange'
                    }
                  >
                    {lines.every((x) =>
                      [
                        'DA_XONG',
                        'DA_PHUC_VU',
                        'DA_HUY',
                      ].includes(x.trang_thai)
                    )
                      ? 'Có thể kết thúc'
                      : 'Đang xử lý'}
                  </Tag>

                  <Button
                    size="small"
                    disabled={
                      !lines.every((x) =>
                        [
                          'DA_XONG',
                          'DA_PHUC_VU',
                          'DA_HUY',
                        ].includes(x.trang_thai)
                      )
                    }
                    loading={
                      closing === lines[0].phien_ban_id
                    }
                    onClick={() =>
                      closeSession(
                        lines[0].phien_ban_id,
                      )
                    }
                  >
                    Kết thúc phiên
                  </Button>
                </div>
              </header>

              <div className="order-ticket-lines">
                {lines.map((line) => (
                  <div
                    className="order-line"
                    key={line.id}
                  >
                    <div>
                      <strong>
                        {line.ten_mon} × {line.so_luong}
                      </strong>

                      {line.ghi_chu && (
                        <small>
                          Ghi chú: {line.ghi_chu}
                        </small>
                      )}
                    </div>

                    <div className="order-line-actions">
                      <Tag
                        color={
                          line.trang_thai === 'DA_XONG'
                            ? 'green'
                            : line.trang_thai === 'DA_HUY'
                              ? 'red'
                              : 'blue'
                        }
                      >
                        {line.trang_thai === 'DA_XONG'
                          ? 'Đã xong'
                          : line.trang_thai === 'DA_HUY'
                            ? 'Đã huỷ'
                            : line.trang_thai === 'DANG_CHE_BIEN'
                              ? 'Bếp đang làm'
                              : 'Đã nhận'}
                      </Tag>

                      {(
                        line.trang_thai === 'CHO_BEP' ||
                        (
                          isManager &&
                          line.trang_thai === 'DANG_CHE_BIEN'
                        )
                      ) && (
                        <Button
                          size="small"
                          danger
                          loading={
                            canceling === line.id
                          }
                          onClick={() =>
                            openCancelModal(line)
                          }
                        >
                          Huỷ món
                        </Button>
                      )}

                      {(
                        line.trang_thai === 'DANG_CHE_BIEN' &&
                        !isManager
                      ) && (
                        <Button
                          size="small"
                          disabled
                          title={
                            'Món đã bắt đầu chế biến. ' +
                            'Phục vụ không thể huỷ món này.'
                          }
                        >
                          Không thể huỷ
                        </Button>
                      )}

                      <small>
                        {line.trang_thai === 'DA_XONG'
                          ? 'Mang ra bàn'
                          : `Dự kiến ${new Date(
                              line.du_kien_hoan_thanh_at,
                            ).toLocaleTimeString(
                              'vi-VN',
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                              },
                            )}`}
                      </small>
                    </div>
            ORDER BY id DESC
            LIMIT 1
            """
                  </div>
                ))}
              </div>
            </article>
          ))}
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
        okButtonProps={{
          danger: true,
          disabled: !cancelReason,
        }}
        destroyOnClose
      >
        {cancelTarget && (
          <>
            <p>
              Bạn đang huỷ món:
              {' '}
              <strong>
                {cancelTarget.ten_mon}
              </strong>
              {' × '}
              {cancelTarget.so_luong}
            </p>

            {cancelTarget.trang_thai === 'DANG_CHE_BIEN' ? (
              <p>
                <strong>
                  Món đã bắt đầu chế biến.
                </strong>
                {' '}
                Chỉ Quản lý mới được phép thực hiện
                thao tác này. Món vẫn giữ nguyên giá trị
                tính tiền trên phiên.
              </p>
            ) : (
              <p>
                Món chưa được bếp bắt đầu chế biến.
                Sau khi huỷ, món sẽ không còn được tính
                vào tiền món của phiên.
              </p>
            )}

            <p>
              <strong>Lý do huỷ bắt buộc:</strong>
            </p>

            <Radio.Group
              value={cancelReason}
              onChange={(event) =>
                setCancelReason(
                  event.target.value,
                )
              }
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {CANCEL_REASONS.map((reason) => (
                <Radio
                  key={reason.value}
                  value={reason.value}
                >
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
