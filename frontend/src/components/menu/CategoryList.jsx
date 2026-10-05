import { useState } from 'react'
import {
  ArrowDownOutlined,
  ArrowUpOutlined,
  DeleteOutlined,
  EditOutlined,
  HolderOutlined,
  MoreOutlined,
  PictureOutlined,
} from '@ant-design/icons'
import {
  Avatar,
  Badge,
  Button,
  Card,
  Collapse,
  Dropdown,
  Empty,
  Image,
  Skeleton,
  Space,
  Switch,
  Tag,
  Tooltip,
  Typography,
} from 'antd'
import { getMediaUrl } from '../../services/api'

const { Text, Title } = Typography

function moveItem(items, fromIndex, toIndex) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= items.length ||
    toIndex >= items.length
  )
    return items
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next.map((category, index) => ({ ...category, thu_tu: index + 1 }))
}

export default function CategoryList({
  categories = [],
  dishes = [],
  loading,
  filter,
  reorderDirty,
  updatingStatusId,
  onEdit,
  onDelete,
  onStatusChange,
  onReorder,
}) {
  const [expandedIds, setExpandedIds] = useState(new Set())

  const visibleCategories = categories.filter((category) =>
    filter === 'active'
      ? category.dang_su_dung
      : filter === 'inactive'
        ? !category.dang_su_dung
        : true,
  )

  if (loading) {
    return (
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {[1, 2, 3, 4].map((item) => (
          <Card key={item} style={{ borderRadius: '12px' }}>
            <Skeleton active avatar paragraph={{ rows: 1 }} />
          </Card>
        ))}
      </Space>
    )
  }

  if (!visibleCategories.length) {
    return (
      <Card style={{ borderRadius: '12px', textAlign: 'center', padding: '24px 0' }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            filter === 'inactive'
              ? 'Chưa có nhóm món đang tắt'
              : filter === 'active'
                ? 'Chưa có nhóm món đang sử dụng'
                : 'Chưa có nhóm món'
          }
        />
      </Card>
    )
  }

  const toggle = (id) =>
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const handleDragStart = (event, categoryId) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-category-id', String(categoryId))
  }

  const handleDrop = (event, targetIndex) => {
    event.preventDefault()
    const categoryId = Number(
      event.dataTransfer.getData('application/x-category-id'),
    )
    if (!categoryId) return
    const sourceIndex = categories.findIndex((category) => category.id === categoryId)
    if (sourceIndex === -1 || sourceIndex === targetIndex) return
    onReorder(moveItem(categories, sourceIndex, targetIndex))
  }

  const handleMove = (index, direction) => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= categories.length) return
    onReorder(moveItem(categories, index, targetIndex))
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      {visibleCategories.map((category) => {
        const actualIndex = categories.findIndex((item) => item.id === category.id)
        const categoryDishes = dishes.filter(
          (dish) => dish.nhom_mon_id === category.id,
        )
        const expanded = expandedIds.has(category.id)

        return (
          <Card
            key={category.id}
            bordered
            draggable
            onDragStart={(event) => handleDragStart(event, category.id)}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
            }}
            onDrop={(event) => handleDrop(event, actualIndex)}
            style={{
              borderRadius: '12px',
              borderColor: '#e2e8f0',
              boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)',
              overflow: 'hidden',
              transition: 'all 0.2s ease',
            }}
            bodyStyle={{ padding: '16px' }}
          >
            {/* Thanh hàng ngang nhóm món */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justify: 'space-between',
                gap: '16px',
                flexWrap: 'wrap',
              }}
            >
              {/* Bên trái: Tay cầm + Số thứ tự + Ảnh + Tên nhóm */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '260px' }}>
                <div
                  style={{
                    color: '#94a3b8',
                    cursor: 'grab',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title="Kéo để sắp xếp"
                >
                  <HolderOutlined style={{ fontSize: '18px' }} />
                </div>

                <div
                  style={{
                    backgroundColor: '#f1f5f9',
                    color: '#475569',
                    fontWeight: 700,
                    fontSize: '12px',
                    padding: '2px 8px',
                    borderRadius: '6px',
                  }}
                >
                  {String(category.thu_tu).padStart(2, '0')}
                </div>

                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    alignItems: 'center',
                    justify: 'center',
                    flexShrink: 0,
                  }}
                >
                  {category.anh_url ? (
                    <Image
                      src={getMediaUrl(category.anh_url)}
                      alt={category.ten_nhom}
                      width={56}
                      height={56}
                      style={{ objectFit: 'cover' }}
                      preview
                    />
                  ) : (
                    <Avatar shape="square" size={48} icon={<PictureOutlined />} style={{ backgroundColor: '#e2e8f0' }} />
                  )}
                </div>

                <div
                  onClick={() => toggle(category.id)}
                  style={{ cursor: 'pointer', flex: 1 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Title level={5} style={{ margin: 0, color: '#1e293b' }}>
                      {category.ten_nhom}
                    </Title>
                    <Badge
                      count={`${categoryDishes.length} món`}
                      style={{
                        backgroundColor: '#fff7ed',
                        color: '#c2410c',
                        borderColor: '#ffedd5',
                        fontSize: '11px',
                      }}
                    />
                  </div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Nhấn để {expanded ? 'thu gọn' : 'xem chi tiết món'}
                  </Text>
                </div>
              </div>

              {/* Bên phải: Trạng thái + Nút điều hướng + Nút thao tác */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Switch
                    size="small"
                    checked={category.dang_su_dung}
                    loading={updatingStatusId === category.id}
                    onChange={(checked) => onStatusChange(category, checked)}
                  />
                  <Text style={{ fontSize: '13px', color: category.dang_su_dung ? '#059669' : '#64748b', fontWeight: 500 }}>
                    {category.dang_su_dung ? 'Đang sử dụng' : 'Đã tắt'}
                  </Text>
                </div>

                <Button.Group size="small">
                  <Tooltip title="Đưa lên">
                    <Button
                      icon={<ArrowUpOutlined />}
                      disabled={actualIndex === 0}
                      onClick={() => handleMove(actualIndex, 'up')}
                    />
                  </Tooltip>
                  <Tooltip title="Đưa xuống">
                    <Button
                      icon={<ArrowDownOutlined />}
                      disabled={actualIndex === categories.length - 1}
                      onClick={() => handleMove(actualIndex, 'down')}
                    />
                  </Tooltip>
                </Button.Group>

                <Dropdown
                  menu={{
                    items: [
                      { key: 'edit', label: 'Chỉnh sửa', icon: <EditOutlined /> },
                      { type: 'divider' },
                      { key: 'delete', label: 'Xóa nhóm món', icon: <DeleteOutlined />, danger: true },
                    ],
                    onClick: ({ key }) => {
                      if (key === 'edit') onEdit(category)
                      if (key === 'delete') onDelete(category)
                    },
                  }}
                  trigger={['click']}
                >
                  <Button type="text" icon={<MoreOutlined style={{ fontSize: '18px' }} />} />
                </Dropdown>
              </div>
            </div>

            {/* Chi tiết danh sách món ăn mở rộng bên dưới */}
            {expanded && (
              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid #f1f5f9',
                  backgroundColor: '#fafafa',
                  borderRadius: '8px',
                  padding: '12px',
                }}
              >
                {categoryDishes.length === 0 ? (
                  <Text type="secondary" style={{ fontStyle: 'italic', fontSize: '13px' }}>
                    Nhóm này chưa có món ăn.
                  </Text>
                ) : (
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    {categoryDishes.map((dish) => (
                      <div
                        key={dish.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justify: 'space-between',
                          backgroundColor: '#ffffff',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <Image
                            src={getMediaUrl(dish.anh_url)}
                            alt={dish.ten_mon}
                            width={48}
                            height={40}
                            style={{ objectFit: 'cover', borderRadius: '6px' }}
                            preview
                          />
                          <div>
                            <Text bold style={{ fontSize: '14px', color: '#1e293b' }}>
                              {dish.ten_mon}
                            </Text>
                            {dish.gia && (
                              <div>
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  Giá: {dish.gia.toLocaleString('vi-VN')} đ
                                </Text>
                              </div>
                            )}
                          </div>
                        </div>

                        <Tag color={dish.trang_thai === 'DANG_BAN' || dish.trang_thai === 'dang_ban' ? 'green' : 'default'}>
                          {dish.trang_thai === 'DANG_BAN' || dish.trang_thai === 'dang_ban' ? 'Đang bán' : 'Tạm ngừng'}
                        </Tag>
                      </div>
                    ))}
                  </Space>
                )}
              </div>
            )}
          </Card>
        )
      })}

      {reorderDirty && (
        <div
          style={{
            backgroundColor: '#eff6ff',
            color: '#1d4ed8',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '1px solid #bfdbfe',
          }}
        >
          <HolderOutlined /> Kéo thả hoặc dùng nút ↑ ↓ để thay đổi thứ tự. Nhớ bấm nút "Lưu thứ tự" ở góc trên sau khi sắp xếp.
        </div>
      )}
    </Space>
  )
}