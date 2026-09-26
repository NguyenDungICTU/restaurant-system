import { useEffect, useState } from 'react'
import { Input, Modal, Typography } from 'antd'
import ImageField from './ImageField'

const MAX_LENGTH = 50

export default function CategoryFormModal({ open, mode = 'create', category = null, loading = false, onCancel, onSubmit }) {
  const [name, setName] = useState('')
  const [image, setImage] = useState(null)
  const [clearImage, setClearImage] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setImage(null)
      setClearImage(false)
      return
    }
    setName(category?.ten_nhom || '')
    setImage(category?.anh_url || null)
    setClearImage(false)
  }, [open, category])

  const handleSubmit = () => {
    const normalizedName = name.trim().replace(/\s+/g, ' ')
    if (!normalizedName) return
    onSubmit({ ten_nhom: normalizedName, imageFile: image instanceof File ? image : null, clearImage })
  }

  return (
    <Modal open={open} title={mode === 'edit' ? 'Chỉnh sửa nhóm món' : 'Thêm nhóm món'} okText={mode === 'edit' ? 'Lưu thay đổi' : 'Thêm nhóm món'} cancelText="Hủy" confirmLoading={loading} onCancel={onCancel} onOk={handleSubmit} destroyOnHidden centered width={560}>
      <div className="category-form">
        <Typography.Text strong>Tên nhóm món</Typography.Text>
        <Input value={name} maxLength={MAX_LENGTH} showCount autoFocus placeholder="Ví dụ: Khai vị" onChange={(event) => setName(event.target.value)} onPressEnter={handleSubmit} />
        <Typography.Text type="secondary">Tên nhóm món tối đa {MAX_LENGTH} ký tự và không được trùng.</Typography.Text>
        <ImageField value={image} onChange={(next) => { setImage(next); setClearImage(next === null) }} />
      </div>
    </Modal>
  )
}
