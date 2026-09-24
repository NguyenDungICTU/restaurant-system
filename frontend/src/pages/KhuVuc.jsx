import { useEffect, useState } from 'react'
import {
  CheckCircleOutlined,
  EditOutlined,
  PlusOutlined,
  StopOutlined,
} from '@ant-design/icons'
import {
  activateArea,
  createArea,
  deactivateArea,
  getAreas,
  updateArea,
} from '../services/api'

const emptyForm = {
  ten_khu_vuc: '',
  thu_tu_hien_thi: 0,
  ghi_chu: '',
}

export default function KhuVuc() {
  const [areas, setAreas] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState(null)

  async function loadAreas() {
    setLoading(true)
    try {
      setAreas(await getAreas())
    } catch (error) {
      setNotice({
        type: 'error',
        text: error.response?.data?.detail || 'Không tải được danh sách khu vực.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAreas()
  }, [])

  function change(field, value) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setSaving(true)
    setNotice(null)

    const payload = {
      ...form,
      thu_tu_hien_thi: Number(form.thu_tu_hien_thi),
    }

    try {
      if (editing) {
        await updateArea(editing.id, payload)
      } else {
        await createArea(payload)
      }

      setNotice({
        type: 'success',
        text: editing ? 'Đã cập nhật khu vực.' : 'Đã thêm khu vực mới.',
      })

      setForm(emptyForm)
      setEditing(null)
      await loadAreas()
    } catch (error) {
      setNotice({
        type: 'error',
        text: error.response?.data?.detail || 'Không thể lưu khu vực.',
      })
    } finally {
      setSaving(false)
    }
  }

  function startEdit(area) {
    setEditing(area)
    setForm({
      ten_khu_vuc: area.ten_khu_vuc,
      thu_tu_hien_thi: area.thu_tu_hien_thi,
      ghi_chu: area.ghi_chu || '',
    })
    setNotice(null)
  }

  async function stopUsing(area) {
    if (!window.confirm(`Ngừng sử dụng khu vực "${area.ten_khu_vuc}"?`)) return

    try {
      await deactivateArea(area.id)
      setNotice({
        type: 'success',
        text: `Đã ngừng sử dụng ${area.ten_khu_vuc}.`,
      })
      await loadAreas()
    } catch (error) {
      setNotice({
        type: 'error',
        text: error.response?.data?.detail || 'Không thể ngừng sử dụng khu vực.',
      })
    }
  }

  async function activate(area) {
    try {
      await activateArea(area.id)
      setNotice({
        type: 'success',
        text: `Đã kích hoạt lại ${area.ten_khu_vuc}.`,
      })
      await loadAreas()
    } catch (error) {
      setNotice({
        type: 'error',
        text: error.response?.data?.detail || 'Không thể kích hoạt lại khu vực.',
      })
    }
  }

  const activeCount = areas.filter(
    area => area.trang_thai === 'HOAT_DONG'
  ).length

  return (
    <section className="area-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">CÀI ĐẶT NHÀ HÀNG</p>
          <h1>Quản lý khu vực</h1>
          <p className="subheading">
            Khai báo tầng, sân vườn hoặc phòng riêng để phục vụ xếp khách.
          </p>
        </div>

        <div className="area-count">
          <CheckCircleOutlined /> {activeCount} đang hoạt động
        </div>
      </div>

      {notice && (
        <div className={`area-notice ${notice.type}`}>{notice.text}</div>
      )}

      <div className="area-layout">
        <form className="area-form panel" onSubmit={submit}>
          <div className="panel-heading">
            <div>
              <h2>{editing ? 'Sửa khu vực' : 'Thêm khu vực'}</h2>
              <p>Nhập thông tin khu vực trong quán.</p>
            </div>
          </div>

          <label>Tên khu vực <span>*</span></label>
          <input
            required
            maxLength="100"
            value={form.ten_khu_vuc}
            onChange={e => change('ten_khu_vuc', e.target.value)}
            placeholder="Ví dụ: Tầng 1"
          />

          <label>Thứ tự hiển thị</label>
          <input
            required
            min="0"
            type="number"
            value={form.thu_tu_hien_thi}
            onChange={e => change('thu_tu_hien_thi', e.target.value)}
          />

          <label>Ghi chú</label>
          <textarea
            maxLength="1000"
            rows="4"
            value={form.ghi_chu}
            onChange={e => change('ghi_chu', e.target.value)}
            placeholder="Ví dụ: Gần quầy thu ngân"
          />

          <div className="area-form-actions">
            <button className="area-primary" disabled={saving}>
              <PlusOutlined />
              {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Thêm khu vực'}
            </button>

            {editing && (
              <button
                type="button"
                className="area-cancel"
                onClick={() => {
                  setEditing(null)
                  setForm(emptyForm)
                }}
              >
                Hủy
              </button>
            )}
          </div>
        </form>

        <article className="panel area-list">
          <div className="panel-heading">
            <div>
              <h2>Danh sách khu vực</h2>
              <p>Chỉ khu vực đang hoạt động mới dùng khi đặt bàn mới.</p>
            </div>
          </div>

          {loading ? (
            <p className="area-empty">Đang tải dữ liệu...</p>
          ) : areas.length === 0 ? (
            <p className="area-empty">Chưa có khu vực nào.</p>
          ) : (
            <div className="area-table">
              <div className="area-row area-row-header">
                <span>Khu vực</span>
                <span>Thứ tự</span>
                <span>Trạng thái</span>
                <span />
              </div>

              {areas.map(area => (
                <div className="area-row" key={area.id}>
                  <div>
                    <strong>{area.ten_khu_vuc}</strong>
                    {area.ghi_chu && <small>{area.ghi_chu}</small>}
                  </div>

                  <span>{area.thu_tu_hien_thi}</span>

                  <span
                    className={`area-status ${
                      area.trang_thai === 'HOAT_DONG' ? 'active' : 'inactive'
                    }`}
                  >
                    {area.trang_thai === 'HOAT_DONG'
                      ? 'Đang hoạt động'
                      : 'Ngừng sử dụng'}
                  </span>

                  <div className="area-actions">
                    <button title="Sửa" onClick={() => startEdit(area)}>
                      <EditOutlined />
                    </button>

                    {area.trang_thai === 'HOAT_DONG' ? (
                      <button
                        className="stop"
                        title="Ngừng sử dụng"
                        onClick={() => stopUsing(area)}
                      >
                        <StopOutlined />
                      </button>
                    ) : (
                      <button
                        className="activate"
                        title="Kích hoạt lại"
                        onClick={() => activate(area)}
                      >
                        <CheckCircleOutlined />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>
    </section>
  )
}