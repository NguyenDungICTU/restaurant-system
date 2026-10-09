import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'antd'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  ReloadOutlined,
  EyeOutlined,
} from '@ant-design/icons'

import {
  confirmBooking,
  extendBookingHold,
  getAvailableTables,
  getTodayBookings,
  markBookingNoShow,
  moveBooking,
  rejectBooking,
} from '../services/api'
import './TodayBookings.css'

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'CHO_XAC_NHAN', label: 'Chờ xác nhận' },
  { value: 'DA_XAC_NHAN', label: 'Đã xác nhận' },
  { value: 'DA_HUY', label: 'Đã huỷ' },
  { value: 'KHACH_KHONG_TOI', label: 'Khách không tới' },
]

const STATUS_META = {
  CHO_XAC_NHAN: { text: 'Chờ xác nhận', color: 'orange' },
  DA_XAC_NHAN: { text: 'Đã xác nhận', color: 'green' },
  DA_HUY: { text: 'Đã huỷ', color: 'default' },
  KHACH_KHONG_TOI: { text: 'Khách không tới', color: 'red' },
}

const REJECT_OPTIONS = [
  { value: 'HET_BAN', label: 'Hết bàn' },
  { value: 'NGOAI_GIO_PHUC_VU', label: 'Ngoài giờ phục vụ' },
  { value: 'KHONG_LIEN_LAC_DUOC', label: 'Không liên lạc được' },
]

function errorMessage(error) {
  const detail = error?.response?.data?.detail

  if (typeof detail === 'string') return detail

  if (Array.isArray(detail)) {
    return detail
      .map((item) => item?.msg || item?.message)
      .filter(Boolean)
      .join('; ')
  }

  if (detail && typeof detail === 'object') {
    return detail.message || detail.msg || 'Không thực hiện được thao tác.'
  }

  return error?.message || 'Không thực hiện được thao tác.'
}

export default function TodayBookings() {
  const [status, setStatus] = useState('ALL')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState(null)

  const [tableAction, setTableAction] = useState(null)
  const [tables, setTables] = useState([])
  const [tableId, setTableId] = useState()

  const [rejectRow, setRejectRow] = useState(null)
  const [rejectReason, setRejectReason] = useState()
  const [detailRow, setDetailRow] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      setRows(await getTodayBookings(status))
    } catch (cause) {
      setRows([])
      setError(errorMessage(cause))
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => {
    load()
    const timer = window.setInterval(load, 60_000)
    return () => window.clearInterval(timer)
  }, [load])

  const todayLabel = useMemo(
    () =>
      new Intl.DateTimeFormat('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        dateStyle: 'full',
      }).format(new Date()),
    [],
  )

  async function openTableAction(row, mode) {
    setBusy(true)
    setNotice(null)
    setTables([])
    setTableId(undefined)

    try {
      const result = await getAvailableTables(row.id)
      setTables(result.ban_trong || [])
      setTableAction({ row, mode })
    } catch (cause) {
      setNotice({ type: 'error', text: errorMessage(cause) })
    } finally {
      setBusy(false)
    }
  }

  async function saveTableAction() {
    if (!tableAction || !tableId) return

    setBusy(true)
    setNotice(null)

    try {
      if (tableAction.mode === 'confirm') {
        await confirmBooking(tableAction.row.id, tableId)
        setNotice({
          type: 'success',
          text: 'Đã xác nhận, phân bàn và tạo thông báo cho khách.',
        })
      } else {
        await moveBooking(tableAction.row.id, tableId)
        setNotice({
          type: 'success',
          text: 'Đã đổi bàn và ghi nhật ký thao tác.',
        })
      }

      setTableAction(null)
      setTableId(undefined)
      setTables([])
      await load()
    } catch (cause) {
      setNotice({ type: 'error', text: errorMessage(cause) })
    } finally {
      setBusy(false)
    }
  }

  async function handleExtend(row) {
    setBusy(true)
    setNotice(null)
    try {
      await extendBookingHold(row.id)
      setNotice({ type: 'success', text: `Đã gia hạn giữ bàn ${row.ma_dat_ban} thêm 15 phút.` })
      await load()
    } catch (cause) {
      setNotice({ type: 'error', text: errorMessage(cause) })
    } finally { setBusy(false) }
  }

  function confirmExtend(row) {
    Modal.confirm({
      title: 'Gia hạn giữ bàn?',
      content: `Bàn ${row.ten_ban || 'chưa xếp'} của ${row.ho_ten_khach} sẽ được giữ thêm 15 phút. Mỗi lượt chỉ được gia hạn một lần.`,
      okText: 'Gia hạn 15 phút', cancelText: 'Huỷ',
      onOk: () => handleExtend(row),
    })
  }

  async function handleNoShow(row) {
    setBusy(true)
    setNotice(null)
    try {
      const result = await markBookingNoShow(row.id)
      const count = result?.so_lan_khong_toi_90_ngay ?? row.so_lan_khong_toi_90_ngay ?? 0
      setNotice({ type: 'success', text: `Đã ghi nhận khách không tới, giải phóng bàn. Lịch sử 90 ngày: ${count} lần.` })
      await load()
    } catch (cause) {
      setNotice({ type: 'error', text: errorMessage(cause) })
    } finally { setBusy(false) }
  }

  function confirmNoShow(row) {
    Modal.confirm({
      title: 'Đánh dấu khách không tới?',
      content: `Thao tác này sẽ chuyển ${row.ma_dat_ban} sang “Khách không tới” và giải phóng bàn ngay.`,
      okText: 'Khách không tới', cancelText: 'Huỷ',
      okButtonProps: { danger: true },
      onOk: () => handleNoShow(row),
    })
  }

  async function saveReject() {
    if (!rejectRow || !rejectReason) return

    setBusy(true)
    setNotice(null)

    try {
      await rejectBooking(rejectRow.id, rejectReason)
      setRejectRow(null)
      setRejectReason(undefined)
      setNotice({
        type: 'success',
        text: 'Đã từ chối. Lý do được lưu để khách tra cứu.',
      })
      await load()
    } catch (cause) {
      setNotice({ type: 'error', text: errorMessage(cause) })
    } finally {
      setBusy(false)
    }
  }

  function emailStatusMeta(status) {
    if (status === 'DA_GUI') return { text: 'Đã gửi', color: 'green' }
    if (status === 'DANG_GUI') return { text: 'Đang gửi', color: 'blue' }
    if (status === 'THAT_BAI') return { text: 'Thất bại', color: 'red' }
    if (status === 'CHO_GUI') return { text: 'Chờ gửi', color: 'orange' }
    return { text: 'Chưa tạo', color: 'default' }
  }

  const columns = [
    {
      title: 'Mã đặt bàn',
      dataIndex: 'ma_dat_ban',
      key: 'ma_dat_ban',
      render: (value, row) => (
        <div className="today-bookings-code">
          <strong>{value}</strong>
          {row.qua_gio_hen ? (
            <Tag color="red"><WarningOutlined /> Quá giờ 15 phút</Tag>
          ) : row.sap_den_trong_30_phut ? (
            <Tag color="red"><ClockCircleOutlined /> Trong 30 phút tới</Tag>
          ) : null}
          {row.canh_bao_khong_toi && (
            <Tag color="volcano">⚠ 3+ lần không tới / 90 ngày</Tag>
          )}
        </div>
      ),
    },
    { title: 'Tên khách', dataIndex: 'ho_ten_khach', key: 'ho_ten_khach' },
    {
      title: 'Số điện thoại',
      dataIndex: 'so_dien_thoai_da_che',
      key: 'so_dien_thoai_da_che',
      className: 'today-bookings-phone',
    },
    {
      title: 'Số khách',
      dataIndex: 'so_luong_khach',
      key: 'so_luong_khach',
      align: 'center',
    },
    { title: 'Khung giờ', dataIndex: 'khung_gio', key: 'khung_gio' },
    {
      title: 'Bàn đã xếp',
      dataIndex: 'ten_ban',
      key: 'ten_ban',
      render: (value) =>
        value ? <Tag color="blue">{value}</Tag> : <Tag>Chưa xếp bàn</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      render: (value) => {
        const meta = STATUS_META[value] || { text: value, color: 'default' }
        return (
          <Space wrap>
            <Tag color={meta.color}>{meta.text}</Tag>
            {row.qua_gio_hen && value === 'DA_XAC_NHAN' && <Tag color="red">Cần xử lý</Tag>}
          </Space>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 250,
      render: (_, row) => (
        <Space wrap>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailRow(row)}
          >
            Chi tiết
          </Button>
          {row.trang_thai === 'CHO_XAC_NHAN' && (
            <>
              <Button
                type="primary"
                size="small"
                disabled={busy}
                onClick={() => openTableAction(row, 'confirm')}
              >
                Xác nhận & phân bàn
              </Button>
              <Button
                danger
                size="small"
                disabled={busy}
                onClick={() => {
                  setRejectRow(row)
                  setRejectReason(undefined)
                  setNotice(null)
                }}
              >
                Từ chối
              </Button>
            </>
          )}

          {row.trang_thai === 'DA_XAC_NHAN' && row.co_the_doi_ban && (
            <Button
              size="small"
              disabled={busy}
              onClick={() => openTableAction(row, 'move')}
            >
              Đổi bàn
            </Button>
          )}
          {row.trang_thai === 'DA_XAC_NHAN' && row.qua_gio_hen && row.co_the_gia_han && (
            <Button size="small" disabled={busy} onClick={() => confirmExtend(row)}>Gia hạn 15 phút</Button>
          )}
          {row.trang_thai === 'DA_XAC_NHAN' && row.qua_gio_hen && row.co_the_danh_dau_khong_toi && (
            <Button danger size="small" disabled={busy} onClick={() => confirmNoShow(row)}>Khách không tới</Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <section className="today-bookings-page">
      <div className="today-bookings-heading">
        <div>
          <p className="today-bookings-eyebrow">
            <CalendarOutlined /> S2-05 / S2-06 · PHỤC VỤ
          </p>
          <h1>Danh sách đặt bàn hôm nay</h1>
          <p>{todayLabel} · Xác nhận, từ chối và phân bàn cho khách.</p>
        </div>

        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
          Tải lại
        </Button>
      </div>

      {notice && (
        <Alert
          showIcon
          closable
          type={notice.type}
          message={notice.text}
          onClose={() => setNotice(null)}
        />
      )}

      {rows.some(row => row.qua_gio_hen && row.trang_thai === 'DA_XAC_NHAN') && (
        <Alert
          className="today-bookings-alert"
          type="error" showIcon icon={<WarningOutlined />}
          message="Có đặt bàn đã quá giờ hẹn 15 phút"
          description="Hãy đánh dấu khách không tới để giải phóng bàn, hoặc gia hạn giữ bàn thêm 15 phút (tối đa một lần)."
        />
      )}

      <Card className="today-bookings-card">
        <div className="today-bookings-toolbar">
          <div>
            <strong>Lọc theo trạng thái</strong>
            <span>{rows.length} lượt đặt</span>
          </div>

          <Select
            value={status}
            options={STATUS_OPTIONS}
            onChange={setStatus}
            className="today-bookings-filter"
          />
        </div>

        {error && (
          <Alert
            type="error"
            showIcon
            message="Không tải được danh sách đặt bàn"
            description={error}
            className="today-bookings-alert"
          />
        )}

        {!error && !loading && rows.length === 0 ? (
          <Empty
            description={
              status === 'ALL'
                ? 'Hôm nay chưa có lượt đặt bàn.'
                : 'Không có lượt đặt bàn ở trạng thái đã chọn.'
            }
          />
        ) : (
          <Table
            columns={columns}
            dataSource={rows}
            rowKey="ma_dat_ban"
            loading={loading}
            pagination={false}
            scroll={{ x: 1250 }}
            rowClassName={(row) => {
              if (row.qua_gio_hen) return 'today-bookings-overdue'
              if (row.sap_den_trong_30_phut) return 'today-bookings-upcoming'
              return ''
            }}
          />
        )}
      </Card>

      <Modal
        open={Boolean(tableAction)}
        title={
          tableAction?.mode === 'move'
            ? `Đổi bàn ${tableAction?.row?.ma_dat_ban || ''}`
            : `Xác nhận ${tableAction?.row?.ma_dat_ban || ''}`
        }
        onCancel={() => {
          setTableAction(null)
          setTableId(undefined)
          setTables([])
        }}
        onOk={saveTableAction}
        okText={
          tableAction?.mode === 'move' ? 'Đổi bàn' : 'Xác nhận & phân bàn'
        }
        cancelText="Hủy"
        confirmLoading={busy}
        okButtonProps={{ disabled: !tableId }}
      >
        <p>
          Chỉ hiển thị bàn còn trống trong khung giờ, đủ sức chứa và đúng khu
          vực yêu cầu nếu có.
        </p>

        <Select
          value={tableId}
          onChange={setTableId}
          placeholder={
            tables.length ? 'Chọn bàn phù hợp' : 'Không có bàn phù hợp'
          }
          disabled={!tables.length}
          style={{ width: '100%' }}
          options={tables.map((table) => ({
            value: table.id,
            label: `${table.ma_ban} · ${table.suc_chua_toi_da} chỗ`,
          }))}
        />
      </Modal>

      <Modal
        open={Boolean(detailRow)}
        title={`Chi tiết email ${detailRow?.ma_dat_ban || ''}`}
        footer={null}
        onCancel={() => setDetailRow(null)}
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <div>
            <strong>Email khách</strong>
            <div>{detailRow?.email || 'Không có email'}</div>
          </div>

          <div>
            <strong>Email xác nhận đặt bàn</strong>
            <div>
              {(() => {
                const meta = emailStatusMeta(detailRow?.email_xac_nhan_trang_thai)
                return <Tag color={meta.color}>{meta.text}</Tag>
              })()}
              <span> · Lần thử: {detailRow?.email_xac_nhan_so_lan_thu || 0}/3</span>
            </div>
            {detailRow?.email_xac_nhan_gui_luc && (
              <div>Gửi thành công lúc: {new Date(detailRow.email_xac_nhan_gui_luc).toLocaleString('vi-VN')}</div>
            )}
            {detailRow?.email_xac_nhan_loi_cuoi && (
              <div style={{ color: '#b42318' }}>Lỗi cuối: {detailRow.email_xac_nhan_loi_cuoi}</div>
            )}
          </div>

          <div>
            <strong>Email huỷ đặt bàn</strong>
            <div>
              {(() => {
                const meta = emailStatusMeta(detailRow?.email_huy_trang_thai)
                return <Tag color={meta.color}>{meta.text}</Tag>
              })()}
              <span> · Lần thử: {detailRow?.email_huy_so_lan_thu || 0}/3</span>
            </div>
            {detailRow?.email_huy_gui_luc && (
              <div>Gửi thành công lúc: {new Date(detailRow.email_huy_gui_luc).toLocaleString('vi-VN')}</div>
            )}
            {detailRow?.email_huy_loi_cuoi && (
              <div style={{ color: '#b42318' }}>Lỗi cuối: {detailRow.email_huy_loi_cuoi}</div>
            )}
          </div>
        </div>
      </Modal>

      <Modal
        open={Boolean(rejectRow)}
        title={`Từ chối ${rejectRow?.ma_dat_ban || ''}`}
        onCancel={() => {
          setRejectRow(null)
          setRejectReason(undefined)
        }}
        onOk={saveReject}
        okText="Xác nhận từ chối"
        cancelText="Hủy"
        confirmLoading={busy}
        okButtonProps={{
          danger: true,
          disabled: !rejectReason,
        }}
      >
        <p>Bắt buộc chọn lý do. Lý do sẽ hiển thị khi khách tra cứu.</p>

        <Select
          value={rejectReason}
          onChange={setRejectReason}
          placeholder="Chọn lý do từ chối"
          options={REJECT_OPTIONS}
          style={{ width: '100%' }}
        />
      </Modal>
    </section>
  )
}