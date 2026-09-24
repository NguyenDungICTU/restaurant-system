import { useState } from 'react'
import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, HolderOutlined, MoreOutlined, RightOutlined } from '@ant-design/icons'
import { Button, Dropdown, Empty, Image, Skeleton, Switch, Tag, Tooltip } from 'antd'
import { getMediaUrl } from '../../services/api'

function moveItem(items, fromIndex, toIndex) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items
  const next = [...items]
  const [item] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, item)
  return next.map((category, index) => ({ ...category, thu_tu: index + 1 }))
}

export default function CategoryList({ categories, dishes = [], loading, filter, reorderDirty, updatingStatusId, onEdit, onDelete, onStatusChange, onReorder }) {
  const [expandedIds, setExpandedIds] = useState(new Set())
  const visibleCategories = categories.filter((category) => filter === 'active' ? category.dang_su_dung : filter === 'inactive' ? !category.dang_su_dung : true)

  if (loading) return <div className="menu-category-list">{[1,2,3,4].map((item) => <div className="category-skeleton" key={item}><Skeleton active paragraph={{ rows: 1 }} /></div>)}</div>
  if (!visibleCategories.length) return <div className="menu-empty-state"><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={filter === 'inactive' ? 'Chưa có nhóm món đang tắt' : filter === 'active' ? 'Chưa có nhóm món đang sử dụng' : 'Chưa có nhóm món'} /></div>

  const toggle = (id) => setExpandedIds((current) => {
    const next = new Set(current)
    if (next.has(id)) next.delete(id); else next.add(id)
    return next
  })

  const handleDragStart = (event, categoryId) => {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('application/x-category-id', String(categoryId))
  }
  const handleDrop = (event, targetIndex) => {
    event.preventDefault()
    const categoryId = Number(event.dataTransfer.getData('application/x-category-id'))
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
    <div className="menu-category-list">
      {visibleCategories.map((category) => {
        const actualIndex = categories.findIndex((item) => item.id === category.id)
        const categoryDishes = dishes.filter((dish) => dish.nhom_mon_id === category.id)
        const expanded = expandedIds.has(category.id)
        return (
          <div className="category-expand-wrap" key={category.id}>
            <article className={`category-row ${expanded ? 'category-row-expanded' : ''}`} draggable onDragStart={(event) => handleDragStart(event, category.id)} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={(event) => handleDrop(event, actualIndex)}>
              <button className="category-expand-button" type="button" onClick={() => toggle(category.id)} aria-expanded={expanded} title="Mở danh sách món">
                <RightOutlined className={expanded ? 'category-chevron-open' : ''} />
              </button>
              <div className="category-drag-handle" title="Kéo để sắp xếp"><HolderOutlined /></div>
              <div className="category-image-thumb"><Image src={getMediaUrl(category.anh_url)} alt={category.ten_nhom} preview /></div>
              <div className="category-order">{String(category.thu_tu).padStart(2, '0')}</div>
              <button className="category-main category-main-button" type="button" onClick={() => toggle(category.id)}>
                <strong>{category.ten_nhom}</strong>
                <span>{categoryDishes.length} món ăn</span>
              </button>
              <div className="category-status"><Switch size="small" checked={category.dang_su_dung} loading={updatingStatusId === category.id} onChange={(checked) => onStatusChange(category, checked)} /><span>{category.dang_su_dung ? 'Đang sử dụng' : 'Đã tắt'}</span></div>
              <div className="category-mobile-actions">
                <Tooltip title="Đưa lên"><Button type="text" size="small" icon={<ArrowUpOutlined />} disabled={actualIndex === 0} onClick={() => handleMove(actualIndex, 'up')} /></Tooltip>
                <Tooltip title="Đưa xuống"><Button type="text" size="small" icon={<ArrowDownOutlined />} disabled={actualIndex === categories.length - 1} onClick={() => handleMove(actualIndex, 'down')} /></Tooltip>
              </div>
              <Dropdown menu={{ items: [{ key: 'edit', label: 'Chỉnh sửa', icon: <EditOutlined /> }, { type: 'divider' }, { key: 'delete', label: 'Xóa nhóm món', icon: <DeleteOutlined />, danger: true }], onClick: ({ key }) => { if (key === 'edit') onEdit(category); if (key === 'delete') onDelete(category) } }} trigger={['click']}>
                <Button type="text" icon={<MoreOutlined />} className="category-more-button" />
              </Dropdown>
            </article>
            {expanded && (
              <div className="category-dishes-panel">
                {categoryDishes.length === 0 ? <div className="category-dishes-empty">Nhóm này chưa có món ăn.</div> : categoryDishes.map((dish) => (
                  <div className="category-dish-preview" key={dish.id}>
                    <Image src={getMediaUrl(dish.anh_url)} alt={dish.ten_mon} width={64} height={52} preview />
                    <div><strong>{dish.ten_mon}</strong><span>{dish.trang_thai === 'DANG_BAN' ? 'Đang bán' : 'Tạm ngừng'}</span></div>
                    <Tag color={dish.trang_thai === 'DANG_BAN' ? 'green' : 'default'}>{dish.trang_thai === 'DANG_BAN' ? 'Đang bán' : 'Tạm ngừng'}</Tag>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {reorderDirty && <div className="reorder-hint"><HolderOutlined /> Kéo thả hoặc dùng ↑ ↓ để thay đổi thứ tự. Nhớ lưu lại sau khi sắp xếp.</div>}
    </div>
  )
}
