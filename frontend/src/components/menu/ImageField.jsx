import { useEffect, useRef, useState } from 'react'
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons'
import { Button, Image, Typography } from 'antd'
import { getMediaUrl } from '../../services/api'

export default function ImageField({
  value,
  onChange,
  label = 'Ảnh mô tả (không bắt buộc)',
}) {
  const [preview, setPreview] = useState(
    typeof value === 'string' ? value : null,
  )

  const objectUrlRef = useRef(null)

  useEffect(() => {
    // Khi form mở với ảnh hiện tại từ server
    if (typeof value === 'string') {
      setPreview(value)
      return
    }

    // Khi xóa ảnh / dùng ảnh mặc định
    if (value === null || value === undefined) {
      setPreview(null)
    }

    // Nếu value là File thì KHÔNG ghi đè preview.
    // Preview đã được tạo bằng URL.createObjectURL() trong handleFile.
  }, [value])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
        objectUrlRef.current = null
      }
    }
  }, [])

  const handleFile = (file) => {
    if (!file) return

    if (!file.type.startsWith('image/')) {
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      return
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    const objectUrl = URL.createObjectURL(file)

    objectUrlRef.current = objectUrl
    setPreview(objectUrl)

    onChange?.(file)
  }

  const handleUseDefault = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }

    setPreview(null)
    onChange?.(null)
  }

  const previewSrc =
    typeof preview === 'string'
      ? preview.startsWith('blob:')
        ? preview
        : getMediaUrl(preview)
      : null

  return (
    <div className="menu-image-field">
      <Typography.Text strong>{label}</Typography.Text>

      <div className="menu-image-field-row">
        <div className="menu-image-preview">
          {previewSrc ? (
            <Image
              src={previewSrc}
              alt="Ảnh mô tả"
              preview
            />
          ) : (
            <span>Ảnh mặc định</span>
          )}
        </div>

        <div className="menu-image-actions">
          <label className="menu-upload-button">
            <UploadOutlined /> Chọn ảnh

            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              hidden
              onChange={(event) =>
                handleFile(event.target.files?.[0])
              }
            />
          </label>

          {value && typeof value === 'string' && (
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={handleUseDefault}
            >
              Dùng ảnh mặc định
            </Button>
          )}
        </div>
      </div>

      <Typography.Text type="secondary">
        Tối đa 5 MB. Có thể bỏ qua; hệ thống sẽ dùng ảnh mặc định.
      </Typography.Text>
    </div>
  )
}
