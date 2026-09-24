import { DeleteOutlined, EditOutlined, MoreOutlined } from '@ant-design/icons'
import { Button, Dropdown, Empty, Image, Skeleton, Tag } from 'antd'
import { getMediaUrl } from '../../services/api'

const STATUS_LABELS = { DANG_BAN: 'Đang bán', TAM_NGUNG: 'Tạm ngừng' }

export default function DishList({ dishes, loading, categories, onEdit, onDelete }) {
  if (loading) return <div className="menu-category-list">{[1,2,3].map((item) => <div className="category-skeleton" key={item}><Skeleton active paragraph={{ rows: 1 }} /></div>)}</div>
  if (!dishes.length) return <div className="menu-empty-state"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có món ăn. Hãy thêm món và chọn nhóm món." /></div>
  const categoryName = (id) => categories.find((category) => category.id === id)?.ten_nhom || 'Không rõ nhóm'
  return <div className="menu-category-list">
    {dishes.map((dish) => <article className="category-row dish-row" key={dish.id}>
      <div className="category-image-thumb"><Image src={getMediaUrl(dish.anh_url)} alt={dish.ten_mon} preview /></div>
      <div className="category-order">{String(dish.id).padStart(2, '0')}</div>
      <div className="category-main"><strong>{dish.ten_mon}</strong><span>{dish.nhom_mon_ten || categoryName(dish.nhom_mon_id)}</span></div>
      <div className="category-status"><Tag color={dish.trang_thai === 'DANG_BAN' ? 'green' : 'default'}>{STATUS_LABELS[dish.trang_thai] || dish.trang_thai}</Tag></div>
      <Dropdown menu={{ items: [{ key: 'edit', label: 'Chỉnh sửa', icon: <EditOutlined /> }, { type: 'divider' }, { key: 'delete', label: 'Xóa món ăn', icon: <DeleteOutlined />, danger: true }], onClick: ({ key }) => { if (key === 'edit') onEdit(dish); if (key === 'delete') onDelete(dish) } }} trigger={['click']}>
        <Button type="text" icon={<MoreOutlined />} />
      </Dropdown>
    </article>)}
  </div>
}
