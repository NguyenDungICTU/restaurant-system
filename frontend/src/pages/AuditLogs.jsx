import { useCallback, useEffect, useState } from 'react'
import { ReloadOutlined } from '@ant-design/icons'
import { Alert, Button, Select, Table, Tag, Tabs } from 'antd'
import { getAuditActions, getLoginSessions } from '../services/api'

const actionNames = {
  DANG_NHAP: 'Đăng nhập',
  DANG_XUAT: 'Đăng xuất',
  CAP_NHAT_GIA_MON: 'Đổi giá món',
}

const date = (value) => value ? new Date(value).toLocaleString('vi-VN') : '—'

export default function AuditLogs() {
  const [actions, setActions] = useState([])
  const [sessions, setSessions] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [actionRows, sessionRows] = await Promise.all([
        getAuditActions(filter === 'all' ? {} : { action: filter }),
        getLoginSessions(),
      ])
      setActions(actionRows)
      setSessions(sessionRows)
    } catch {
      setError('Không thể tải nhật ký. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  const actionColumns = [
    { title: 'Thời gian', dataIndex: 'created_at', render: date },
    { title: 'Người thực hiện', dataIndex: 'actor_name' },
    { title: 'Thao tác', dataIndex: 'action', render: (value) => <Tag color={value === 'CAP_NHAT_GIA_MON' ? 'orange' : 'blue'}>{actionNames[value] || value}</Tag> },
    {
      title: 'Món / đối tượng',
      render: (_, row) =>
        row.object_name ||
        (row.object_id
          ? `${row.object_type} #${row.object_id}`
          : row.object_type),
    },
    { title: 'Thay đổi giá', render: (_, row) => row.action === 'CAP_NHAT_GIA_MON' ? `${row.old_data?.gia || '—'} → ${row.new_data?.gia || '—'}` : '—' },
    { title: 'IP', dataIndex: 'ip_address', render: (value) => value || '—' },
  ]
  const sessionColumns = [
    { title: 'Đăng nhập lúc', dataIndex: 'created_at', render: date },
    { title: 'Nhân viên', render: (_, row) => `${row.employee_name} (${row.username})` },
    { title: 'IP', dataIndex: 'ip_address', render: (value) => value || '—' },
    { title: 'Trạng thái', dataIndex: 'revoked_at', render: (value) => <Tag color={value ? 'default' : 'green'}>{value ? 'Đã kết thúc' : 'Đang hoạt động'}</Tag> },
    { title: 'Kết thúc lúc', dataIndex: 'revoked_at', render: date },
  ]

  return (
    <section className="page-content">
      <div className="page-heading">
        <div>
          <p className="eyebrow">SECURITY & AUDIT</p>
          <h1>Nhật ký hệ thống</h1>
          <p className="subheading">Tra cứu ai đăng nhập và ai đã thay đổi giá niêm yết.</p>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>Làm mới</Button>
      </div>
      {error && <Alert type="error" message={error} showIcon />}
      <div className="panel" style={{ marginTop: 24 }}>
        <Tabs items={[
          {
            key: 'actions',
            label: 'Thay đổi giá & thao tác',
            children: (
              <>
                <Select
                  value={filter}
                  onChange={setFilter}
                  style={{ width: 220, marginBottom: 16 }}
                  options={[
                    { value: 'all', label: 'Tất cả thao tác' },
                    { value: 'CAP_NHAT_GIA_MON', label: 'Chỉ thay đổi giá' },
                    { value: 'DANG_NHAP', label: 'Đăng nhập' },
                    { value: 'DANG_XUAT', label: 'Đăng xuất' }
                  ]}
                />
                <Table rowKey="id" loading={loading} columns={actionColumns} dataSource={actions} pagination={{ pageSize: 10 }} />
              </>
            )
          },
          {
            key: 'sessions',
            label: 'Phiên đăng nhập',
            children: <Table rowKey="id" loading={loading} columns={sessionColumns} dataSource={sessions} pagination={{ pageSize: 10 }} />
          },
        ]} />
      </div>
    </section>
  )
}