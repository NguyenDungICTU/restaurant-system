import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Card,
  Empty,
  Select,
  Table,
  Tag,
} from 'antd'
import {
  CalendarOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons'

import { getTodayBookings } from '../services/api'
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
    return detail.message || detail.msg || 'Không tải được dữ liệu.'
  }

  return error?.message || 'Không tải được dữ liệu.'
}

export default function TodayBookings() {
  const [status, setStatus] = useState('ALL')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  const columns = [
    {
      title: 'Mã đặt bàn',
      dataIndex: 'ma_dat_ban',
      key: 'ma_dat_ban',
      render: (value, row) => (
        <div className="today-bookings-code">
          <strong>{value}</strong>
          {row.sap_den_trong_30_phut && (
            <Tag color="red">
              <ClockCircleOutlined /> Trong 30 phút tới
            </Tag>
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
        return <Tag color={meta.color}>{meta.text}</Tag>
      },
    },
  ]

  return (
    <section className="today-bookings-page">
      <div className="today-bookings-heading">
        <div>
          <p className="today-bookings-eyebrow">
            <CalendarOutlined /> S2-05 · PHỤC VỤ
          </p>
          <h1>Danh sách đặt bàn hôm nay</h1>
          <p>{todayLabel} · Sắp xếp theo giờ hẹn và ưu tiên khách sắp tới.</p>
        </div>

        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
          Tải lại
        </Button>
      </div>

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
            scroll={{ x: 980 }}
            rowClassName={(row) =>
              row.sap_den_trong_30_phut
                ? 'today-bookings-upcoming'
                : ''
            }
          />
        )}
      </Card>
    </section>
  )
}
