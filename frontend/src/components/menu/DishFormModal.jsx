import { useEffect, useState } from 'react'
import { Input, InputNumber, Modal, Select, Typography } from 'antd'
import ImageField from './ImageField'

const STATUS_OPTIONS = [
  { value: 'DANG_BAN', label: 'Đang bán' },
  { value: 'TAM_NGUNG', label: 'Tạm ngừng' },
]

export default function DishFormModal({ open, mode = 'create', dish = null, categories = [], loading = false, onCancel, onSubmit }) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState()
  const [status, setStatus] = useState('DANG_BAN')
  const [price, setPrice] = useState(0)
  const [image, setImage] = useState(null)
  const [clearImage, setClearImage] = useState(false)

  useEffect(() => {
    if (!open) {
      setName(''); setCategoryId(undefined); setStatus('DANG_BAN'); setPrice(0); setImage(null); return
    }
    setName(dish?.ten_mon || '')
    setCategoryId(dish?.nhom_mon_id)
    setStatus(dish?.trang_thai || 'DANG_BAN')
    setPrice(Number(dish?.gia || 0))
    setImage(dish?.anh_url || null)
    setClearImage(false)
  }, [open, dish])

  const handleSubmit = () => {
    const normalizedName = name.trim().replace(/\s+/g, ' ')
    if (!normalizedName || !categoryId) return
    if (price < 0) return
    onSubmit({ ten_mon: normalizedName, nhom_mon_id: categoryId, gia: price, trang_thai: status, imageFile: image instanceof File ? image : null, clearImage })
  }

  return (
    <Modal open={open} title={mode === 'edit' ? 'Chỉnh sửa món ăn' : 'Thêm món ăn'} okText={mode === 'edit' ? 'Lưu thay đổi' : 'Thêm món ăn'} cancelText="Hủy" confirmLoading={loading} onCancel={onCancel} onOk={handleSubmit} destroyOnHidden centered width={560}>
      <div className="category-form">
        <Typography.Text strong>Tên món ăn</Typography.Text>
        <Input value={name} maxLength={150} showCount autoFocus placeholder="Ví dụ: Gỏi cuốn" onChange={(event) => setName(event.target.value)} />
        <Typography.Text strong>Nhóm món</Typography.Text>
        <Select value={categoryId} placeholder="Chọn nhóm món" options={categories.map((category) => ({ value: category.id, label: category.ten_nhom }))} onChange={setCategoryId} style={{ width: '100%' }} />
        <Typography.Text strong>Trạng thái</Typography.Text>
        <Select value={status} options={STATUS_OPTIONS} onChange={setStatus} style={{ width: '100%' }} />
        <Typography.Text strong>Giá niêm yết (VNĐ)</Typography.Text>
        <InputNumber min={0} precision={2} value={price} onChange={(value) => setPrice(value ?? 0)} style={{ width: '100%' }} />
        <ImageField value={image} onChange={(next) => { setImage(next); setClearImage(next === null) }} />
      </div>
    </Modal>
  )
}
