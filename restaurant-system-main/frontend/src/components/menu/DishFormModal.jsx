import { useEffect, useState } from 'react'
import { Input, InputNumber, Modal, Select, Typography } from 'antd'
import ImageField from './ImageField'

const STATUS_OPTIONS = [
  { value: 'DANG_BAN', label: 'Đang bán' },
  { value: 'TAM_NGUNG', label: 'Tạm ngừng' },
]

export default function DishFormModal({
  open,
  mode = 'create',
  dish = null,
  categories = [],
  loading = false,
  onCancel,
  onSubmit,
}) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState()
  const [price, setPrice] = useState(null)
  const [unit, setUnit] = useState('phần')
  const [description, setDescription] = useState('')
  const [prepTime, setPrepTime] = useState(1)
  const [status, setStatus] = useState('DANG_BAN')
  const [image, setImage] = useState(null)
  const [clearImage, setClearImage] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setCategoryId(undefined)
      setPrice(null)
      setUnit('phần')
      setDescription('')
      setPrepTime(1)
      setStatus('DANG_BAN')
      setImage(null)
      setClearImage(false)
      return
    }
    setName(dish?.ten_mon || '')
    setCategoryId(dish?.nhom_mon_id)
    setPrice(dish?.gia_ban ?? null)
    setUnit(dish?.don_vi_tinh || 'phần')
    setDescription(dish?.mo_ta || '')
    setPrepTime(dish?.thoi_gian_che_bien_phut || 1)
    setStatus(dish?.trang_thai || 'DANG_BAN')
    setImage(dish?.anh_url || null)
    setClearImage(false)
  }, [open, dish])

  const handleSubmit = () => {
    const normalizedName = name.trim().replace(/\s+/g, ' ')
    if (!normalizedName || !categoryId || !price || !unit.trim() || !prepTime) return
    onSubmit({
      ten_mon: normalizedName,
      nhom_mon_id: categoryId,
      gia_ban: Number(price),
      don_vi_tinh: unit.trim(),
      mo_ta: description.trim() || null,
      thoi_gian_che_bien_phut: Number(prepTime),
      trang_thai: status,
      imageFile: image instanceof File ? image : null,
      clearImage,
    })
  }

  return (
    <Modal
      open={open}
      title={mode === 'edit' ? 'Chỉnh sửa món ăn' : 'Thêm món ăn'}
      okText={mode === 'edit' ? 'Lưu thay đổi' : 'Thêm món ăn'}
      cancelText="Hủy"
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={handleSubmit}
      destroyOnHidden
      centered
      width={600}
    >
      <div className="category-form">
        <Typography.Text strong>Tên món ăn</Typography.Text>
        <Input
          value={name}
          maxLength={150}
          showCount
          autoFocus
          placeholder="Ví dụ: Gỏi cuốn"
          onChange={(event) => setName(event.target.value)}
        />
        <Typography.Text strong>Nhóm món</Typography.Text>
        <Select
          value={categoryId}
          placeholder="Chọn nhóm món"
          options={categories.map((category) => ({
            value: category.id,
            label: category.ten_nhom,
          }))}
          onChange={setCategoryId}
          style={{ width: '100%' }}
        />
        <Typography.Text strong>Giá bán (VND)</Typography.Text>
        <InputNumber
          value={price}
          min={1}
          max={50000000}
          precision={0}
          step={1000}
          placeholder="Ví dụ: 85000"
          onChange={setPrice}
          style={{ width: '100%' }}
        />
        <Typography.Text strong>Đơn vị tính</Typography.Text>
        <Input value={unit} maxLength={30} onChange={(event) => setUnit(event.target.value)} placeholder="phần, ly, chai..." />
        <Typography.Text strong>Mô tả ngắn</Typography.Text>
        <Input.TextArea value={description} maxLength={1000} rows={3} onChange={(event) => setDescription(event.target.value)} />
        <Typography.Text strong>Thời gian chế biến (phút)</Typography.Text>
        <InputNumber value={prepTime} min={1} max={1440} precision={0} onChange={setPrepTime} style={{ width: '100%' }} />
        <Typography.Text strong>Trạng thái</Typography.Text>
        <Select value={status} options={STATUS_OPTIONS} onChange={setStatus} style={{ width: '100%' }} />
        <ImageField value={image} onChange={(next) => { setImage(next); setClearImage(next === null) }} />
      </div>
    </Modal>
  )
}
