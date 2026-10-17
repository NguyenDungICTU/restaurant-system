import { useEffect, useState } from 'react'
import { Alert, Spin, Table, Tag, Typography } from 'antd'
import { api } from '../services/api'

const { Title, Paragraph } = Typography
export default function PermissionMatrix() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    api.get('/api/admin/permission-matrix')
      .then((r) => setData(r.data))
      .catch((e) => setError(e.response?.status === 403
        ? 'Chỉ Quản lý được xem ma trận phân quyền.'
        : e.response?.status === 401
          ? 'Phiên đăng nhập hết hạn. Hãy đăng nhập lại.'
          : 'Không tải được ma trận phân quyền.'))
  }, [])
  if (error) return <Alert type="error" showIcon message={error} />
  if (!data) return <Spin tip="Đang tải ma trận phân quyền..." />
  const columns = [
    { title: 'Module nhạy cảm / nghiệp vụ', dataIndex: 'label', key: 'label', fixed: 'left', width: 230 },
    ...data.roles.map((role) => ({
      title: role.label, key: role.key, align: 'center',
      render: (_, module) => {
        const item = data.matrix.find((x) => x.role === role.key && x.module === module.key)
        return item?.allowed ? <Tag color="green">Cho phép</Tag> : <Tag color="red">Từ chối</Tag>
      },
    })),
  ]
  return <section className="permission-matrix-page">
    <Title level={2}>Rà soát ma trận phân quyền</Title>
    <Paragraph>Kiểm tra quyền theo vai trò trước khi bàn giao. Ma trận này là hợp đồng rà soát; quyền thực tế vẫn phải được xác minh bằng API và kiểm thử tự động.</Paragraph>
    <Table rowKey="key" columns={columns} dataSource={data.modules} pagination={false} bordered scroll={{ x: 850 }} />
    <Alert style={{ marginTop: 16 }} type="warning" showIcon message="Lưu ý nghiệm thu" description="Không coi việc ẩn menu là bảo mật. Thử gọi trực tiếp API với token từng vai trò; chưa đăng nhập phải nhận 401, sai vai trò phải nhận 403." />
  </section>
}
