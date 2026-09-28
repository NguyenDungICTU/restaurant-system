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
  const [price, setPrice] = useState(1000)
  const [unit, setUnit] = useState('phần')
  const [description, setDescription] = useState('')
  const [prepMinutes, setPrepMinutes] = useState(15)
  const [image, setImage] = useState(null)
  const [clearImage, setClearImage] = useState(false)

  useEffect(() => {
    if (!open) {
      setName(''); setCategoryId(undefined); setStatus('DANG_BAN'); setPrice(1000)
      setUnit('phần'); setDescription(''); setPrepMinutes(15); setImage(null); setClearImage(false)
      return
    }
    setName(dish?.ten_mon || '')
    setCategoryId(dish?.nhom_mon_id)
    setStatus(dish?.trang_thai || 'DANG_BAN')
    setPrice(Number(dish?.gia || 1000))
    setUnit(dish?.don_vi_tinh || 'phần')
    setDescription(dish?.mo_ta_ngan || '')
    setPrepMinutes(Number(dish?.thoi_gian_che_bien_phut || 15))
    setImage(dish?.anh_url || null)
    setClearImage(false)
  }, [open, dish])

  const handleSubmit = () => {
    const normalizedName = name.trim().replace(/\s+/g, ' ')
    const normalizedUnit = unit.trim().replace(/\s+/g, ' ')
    const normalizedDescription = description.trim()
    if (!normalizedName || !categoryId || !normalizedUnit) return
    if (!Number.isInteger(price) || price <= 0 || price > 50000000) return
    if (!Number.isInteger(prepMinutes) || prepMinutes < 1 || prepMinutes > 1440) return

    onSubmit({
      ten_mon: normalizedName,
      nhom_mon_id: categoryId,
      gia: price,
      don_vi_tinh: normalizedUnit,
      mo_ta_ngan: normalizedDescription || null,
      thoi_gian_che_bien_phut: prepMinutes,
      trang_thai: status,
      imageFile: image instanceof File ? image : null,
      clearImage,
    })
  }

  return (
    <Modal open={open} title={mode === 'edit' ? 'Chỉnh sửa món ăn' : 'Thêm món ăn'} okText={mode === 'edit' ? 'Lưu thay đổi' : 'Thêm món ăn'} cancelText="Hủy" confirmLoading={loading} onCancel={onCancel} onOk={handleSubmit} destroyOnHidden centered width={600}>
      <div className="category-form">
        <Typography.Text strong>Tên món ăn</Typography.Text>
        <Input value={name} maxLength={150} showCount autoFocus placeholder="Ví dụ: Gỏi cuốn" onChange={(event) => setName(event.target.value)} />

        <Typography.Text strong>Nhóm món</Typography.Text>
        <Select value={categoryId} placeholder="Chọn nhóm món" options={categories.map((category) => ({ value: category.id, label: category.ten_nhom }))} onChange={setCategoryId} style={{ width: '100%' }} />

        <Typography.Text strong>Giá bán (VND)</Typography.Text>
        <InputNumber min={1} max={50000000} precision={0} value={price} onChange={(value) => setPrice(value ?? 0)} formatter={(value) => value == null ? '' : String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.')} parser={(value) => Number(String(value || '').replace(/\./g, ''))} style={{ width: '100%' }} />
        <Typography.Text type="secondary">Số nguyên dương, tối đa 50.000.000 VND.</Typography.Text>

        <Typography.Text strong>Đơn vị tính</Typography.Text>
        <Input value={unit} maxLength={30} placeholder="phần, đĩa, ly..." onChange={(event) => setUnit(event.target.value)} />

        <Typography.Text strong>Mô tả ngắn</Typography.Text>
        <Input.TextArea value={description} maxLength={500} showCount rows={3} placeholder="Mô tả ngắn về món ăn" onChange={(event) => setDescription(event.target.value)} />

        <Typography.Text strong>Thời gian chế biến ước tính (phút)</Typography.Text>
        <InputNumber min={1} max={1440} precision={0} value={prepMinutes} onChange={(value) => setPrepMinutes(value ?? 1)} style={{ width: '100%' }} />

        <Typography.Text strong>Trạng thái</Typography.Text>
        <Select value={status} options={STATUS_OPTIONS} onChange={setStatus} style={{ width: '100%' }} />

        <ImageField value={image} onChange={(next) => { setImage(next); setClearImage(next === null) }} label="Ảnh đại diện món ăn (không bắt buộc)" />
      </div>
    </Modal>
  )
}
