import { useCallback, useEffect, useState } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import {
  Alert,
  Button,
  Select,
  Table,
  Tag,
  Tabs,
} from 'antd'
import {
  getAuditActions,
  getLoginSessions,
} from '../services/api'

const actionNames = {
  DANG_NHAP: 'Đăng nhập',
  DANG_XUAT: 'Đăng xuất',
  CAP_NHAT_GIA_MON: 'Đổi giá món',
  HUY_MON: 'Huỷ món',
}

const date = (value) =>
  value
    ? new Date(value).toLocaleString('vi-VN')
    : '—'

const money = (value) =>
  value == null
    ? '—'
    : `${Number(value).toLocaleString('vi-VN')} đ`

export default function AuditLogs() {
  const [actions, setActions] = useState([])
  const [cancellations, setCancellations] =
    useState([])
  const [sessions, setSessions] = useState([])

  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')

    try {
      const actionRows =
        await getAuditActions(
          filter === 'all'
            ? {}
            : { action: filter },
        )

      const [
        cancellationRows,
        sessionRows,
      ] = await Promise.all([
        filter === 'HUY_MON'
          ? Promise.resolve(actionRows)
          : getAuditActions({
              action: 'HUY_MON',
            }),
        getLoginSessions(),
      ])

      setActions(actionRows)
      setCancellations(cancellationRows)
      setSessions(sessionRows)
    } catch {
      setError(
        'Không thể tải nhật ký. Vui lòng thử lại.',
      )
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const actionColumns = [
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      render: date,
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'actor_name',
    },
    {
      title: 'Thao tác',
      dataIndex: 'action',
      render: (value) => (
        <Tag
          color={
            value === 'HUY_MON'
              ? 'red'
              : value === 'CAP_NHAT_GIA_MON'
                ? 'orange'
                : 'blue'
          }
        >
          {actionNames[value] || value}
        </Tag>
      ),
    },
    {
      title: 'Món / đối tượng',
      render: (_, row) =>
        row.action === 'HUY_MON'
          ? row.new_data?.ten_mon ||
            `Dòng món #${row.object_id}`
          : row.object_name ||
            (
              row.object_id
                ? `${row.object_type} #${row.object_id}`
                : row.object_type
            ),
    },
    {
      title: 'Chi tiết',
      render: (_, row) => {
        if (row.action === 'HUY_MON') {
          const data = row.new_data || {}

          return (
            <div>
              <div>
                Lý do:
                {' '}
                {data.ly_do_huy_text ||
                  data.ly_do_huy ||
                  '—'}
              </div>

              <div>
                SL:
                {' '}
                {data.so_luong ?? '—'}
                {' · '}
                Tiền:
                {' '}
                {money(data.thanh_tien)}
              </div>
            </div>
          )
        }

        if (row.action === 'CAP_NHAT_GIA_MON') {
          return (
            `${row.old_data?.gia || '—'} → ` +
            `${row.new_data?.gia || '—'}`
          )
        }

        return '—'
      },
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      render: (value) =>
        value || '—',
    },
  ]

  const cancellationColumns = [
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      render: date,
    },
    {
      title: 'Người huỷ',
      dataIndex: 'actor_name',
    },
    {
      title: 'Quyền',
      render: (_, row) => (
        <Tag
          color={
            row.new_data?.quyen_huy === 'QUAN_LY'
              ? 'red'
              : 'blue'
          }
        >
          {row.new_data?.quyen_huy === 'QUAN_LY'
            ? 'Quản lý'
            : 'Phục vụ'}
        </Tag>
      ),
    },
    {
      title: 'Món',
      render: (_, row) =>
        row.new_data?.ten_mon ||
        `Dòng món #${row.object_id}`,
    },
    {
      title: 'Số lượng',
      render: (_, row) =>
        row.new_data?.so_luong ?? '—',
    },
    {
      title: 'Lý do',
      render: (_, row) =>
        row.new_data?.ly_do_huy_text ||
        row.new_data?.ly_do_huy ||
        '—',
    },
    {
      title: 'Bàn',
      render: (_, row) =>
        row.new_data?.ma_ban || '—',
    },
    {
      title: 'Hoá đơn',
      render: (_, row) =>
        row.new_data?.so_hoa_don ||
        (
          row.new_data?.hoa_don_id
            ? `#${row.new_data.hoa_don_id}`
            : 'Chưa có'
        ),
    },
    {
      title: 'Ca',
      render: (_, row) =>
        row.new_data?.ca_lam_viec_id
          ? `#${row.new_data.ca_lam_viec_id}`
          : '—',
    },
    {
      title: 'Giá trị',
      render: (_, row) =>
        money(row.new_data?.thanh_tien),
    },
    {
      title: 'Tính tiền',
      render: (_, row) =>
        row.new_data?.tinh_tien ? (
          <Tag color="green">
            Vẫn tính
          </Tag>
        ) : (
          <Tag color="default">
            Không tính
          </Tag>
        ),
    },
  ]

  const sessionColumns = [
    {
      title: 'Đăng nhập lúc',
      dataIndex: 'created_at',
      render: date,
    },
    {
      title: 'Nhân viên',
      render: (_, row) =>
        `${row.employee_name} (${row.username})`,
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      render: (value) =>
        value || '—',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'revoked_at',
      render: (value) => (
        <Tag
          color={
            value ? 'default' : 'green'
          }
        >
          {value
            ? 'Đã kết thúc'
            : 'Đang hoạt động'}
        </Tag>
      ),
    },
    {
      title: 'Kết thúc lúc',
      dataIndex: 'revoked_at',
      render: date,
    },
  ]

  return (
    <section className="page-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">
            SECURITY & AUDIT
          </p>

          <h1>Nhật ký hệ thống</h1>

          <p className="subheading">
            Tra cứu thao tác hệ thống, lịch sử huỷ món
            và dữ liệu phục vụ đối soát cuối ca.
          </p>
        </div>

        <Button
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={load}
        >
          Làm mới
        </Button>
      </div>

      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
        />
      )}

      <div
        className="panel"
        style={{ marginTop: 24 }}
      >
        <Tabs
          items={[
            {
              key: 'actions',
              label: 'Thao tác hệ thống',
              children: (
                <>
                  <Select
                    value={filter}
                    onChange={setFilter}
                    style={{
                      width: 240,
                      marginBottom: 16,
                    }}
                    options={[
                      {
                        value: 'all',
                        label: 'Tất cả thao tác',
                      },
                      {
                        value: 'HUY_MON',
                        label: 'Chỉ huỷ món',
                      },
                      {
                        value: 'CAP_NHAT_GIA_MON',
                        label: 'Chỉ thay đổi giá',
                      },
                      {
                        value: 'DANG_NHAP',
                        label: 'Đăng nhập',
                      },
                      {
                        value: 'DANG_XUAT',
                        label: 'Đăng xuất',
                      },
                    ]}
                  />

                  <Table
                    rowKey="id"
                    loading={loading}
                    columns={actionColumns}
                    dataSource={actions}
                    pagination={{
                      pageSize: 10,
                    }}
                  />
                </>
              ),
            },
            {
              key: 'cancellations',
              label: 'Huỷ món / cuối ca',
              children: (
                <Table
                  rowKey="id"
                  loading={loading}
                  columns={cancellationColumns}
                  dataSource={cancellations}
                  pagination={{
                    pageSize: 10,
                  }}
                  locale={{
                    emptyText:
                      'Chưa có lịch sử huỷ món.',
                  }}
                />
              ),
            },
            {
              key: 'sessions',
              label: 'Phiên đăng nhập',
              children: (
                <Table
                  rowKey="id"
                  loading={loading}
                  columns={sessionColumns}
                  dataSource={sessions}
                  pagination={{
                    pageSize: 10,
                  }}
                />
              ),
            },
          ]}
        />
      </div>
    </section>
  )
}
