import { useEffect, useRef, useState } from 'react'
import { Drawer } from 'antd'
import {
  CheckCircleOutlined,
  AppstoreOutlined,
  SearchOutlined,
  EditOutlined,
  PlusOutlined,
  StopOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import {
  activateArea,
  createArea,
  deactivateArea,
  getAreas,
  updateArea,
} from '../services/api'
import './RestaurantManagement.css'

const emptyForm = {
  ten_khu_vuc: '',
  thu_tu_hien_thi: 0,
  ghi_chu: '',
}

export default function KhuVuc() {
  const nameInput = useRef(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
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
      setDrawerOpen(false)
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
    setDrawerOpen(true)
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

  function closeDrawer() {
    if (saving) return
    setDrawerOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  const visibleAreas = areas.filter(area =>
    area.ten_khu_vuc.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')) &&
    (!statusFilter || (statusFilter === 'active'
      ? area.trang_thai === 'HOAT_DONG' : area.trang_thai !== 'HOAT_DONG'))
  )

  return (
    <section className="area-page management-page">
      <div className="page-heading">
        <div>
          <nav className="management-breadcrumb" aria-label="Đường dẫn">Nhà hàng <span>/</span> Khu vực</nav>
          <h1>Quản lý khu vực</h1>
          <p className="subheading">
            Khai báo tầng, sân vườn hoặc phòng riêng để phục vụ xếp khách.
          </p>
        </div>

        <button className="area-primary management-add" disabled={saving} onClick={() => {
          setEditing(null)
          setForm(emptyForm)
          setNotice(null)
          setDrawerOpen(true)
        }}><PlusOutlined /> Thêm khu vực</button>
      </div>

      <div className="management-stats management-stats-three" aria-label="Thống kê khu vực">
        {[
          ['Tổng khu vực', areas.length, <AppstoreOutlined />, 'wine', 'Không gian trong nhà hàng'],
          ['Đang hoạt động', activeCount, <CheckCircleOutlined />, 'green', 'Sẵn sàng tiếp nhận đặt bàn'],
          ['Ngừng sử dụng', areas.length - activeCount, <StopOutlined />, 'amber', 'Tạm ngừng tiếp nhận khách'],
        ].map(([label, count, icon, tone, description]) => (
          <article className={`management-stat tone-${tone}`} key={label}>
            <span className={`management-stat-icon ${tone}`}>{icon}</span>
            <div><span>{label}</span><strong>{loading ? '—' : count}</strong><small>{description}</small></div>
          </article>
        ))}
      </div>

      {notice && (
        <div role="status" className={`area-notice ${notice.type}`}>{notice.text}</div>
      )}

      <Drawer
        rootClassName="management-area-drawer"
        title={editing ? 'Sửa khu vực' : 'Thêm khu vực'}
        placement="right"
        size={420}
        open={drawerOpen}
        onClose={closeDrawer}
        closable={{ disabled: saving, placement: 'end', 'aria-label': 'Đóng biểu mẫu khu vực' }}
        afterOpenChange={visible => { if (visible) nameInput.current?.focus() }}
        footer={
          <div className="management-drawer-actions">
            <button type="button" className="area-cancel" disabled={saving} onClick={closeDrawer}>Hủy</button>
            <button type="submit" form="area-editor" className="area-primary" disabled={saving}>
              {saving ? 'Đang lưu...' : editing ? 'Lưu thay đổi' : 'Lưu khu vực'}
            </button>
          </div>
        }
      >
        <p className="management-drawer-intro">{editing ? 'Cập nhật thông tin không gian phục vụ.' : 'Thêm không gian mới để sắp xếp và phục vụ khách.'}</p>
        {notice?.type === 'error' && <div role="alert" className="area-notice error">{notice.text}</div>}
        <form id="area-editor" className="area-form" onSubmit={submit}>

          <label htmlFor="area-name">Tên khu vực <span>*</span></label>
          <input
            id="area-name"
            ref={nameInput}
            required
            maxLength="100"
            value={form.ten_khu_vuc}
            onChange={e => change('ten_khu_vuc', e.target.value)}
            placeholder="Ví dụ: Tầng 1"
          />

          <label htmlFor="area-order">Thứ tự hiển thị</label>
          <input
            id="area-order"
            required
            min="0"
            type="number"
            value={form.thu_tu_hien_thi}
            onChange={e => change('thu_tu_hien_thi', e.target.value)}
          />

          <label htmlFor="area-note">Ghi chú</label>
          <textarea
            id="area-note"
            maxLength="1000"
            rows="4"
            value={form.ghi_chu}
            onChange={e => change('ghi_chu', e.target.value)}
            placeholder="Ví dụ: Gần quầy thu ngân"
          />

        </form>
      </Drawer>

        <article className="panel area-list">
          <div className="panel-heading">
            <div>
              <h2>Danh sách khu vực</h2>
              <p>Chỉ khu vực đang hoạt động mới dùng khi đặt bàn mới.</p>
            </div>
          </div>

          <div className="management-toolbar">
            <div className="management-search"><SearchOutlined aria-hidden="true" /><input aria-label="Tìm khu vực" placeholder="Tìm tên khu vực…" value={search} onChange={e => setSearch(e.target.value)} /></div>
          </div>
          <div className="management-chips" role="group" aria-label="Lọc trạng thái khu vực">
            {[
              ['', 'Tất cả', areas.length],
              ['active', 'Đang hoạt động', activeCount],
              ['inactive', 'Ngừng sử dụng', areas.length - activeCount],
            ].map(([value, label, count]) => (
              <button key={value} type="button" aria-pressed={statusFilter === value} onClick={() => setStatusFilter(value)}>
                {label}<span>{loading ? '—' : count}</span>
              </button>
            ))}
          </div>
          <p className="management-result" aria-live="polite">{loading ? 'Đang tải…' : `${visibleAreas.length} / ${areas.length} khu vực`}</p>
          {loading ? (
            <div className="management-empty" role="status"><LoadingOutlined spin /><strong>Đang tải khu vực</strong><span>Danh sách sẽ sẵn sàng trong giây lát.</span></div>
          ) : visibleAreas.length === 0 ? (
            <div className="management-empty"><AppstoreOutlined /><strong>{areas.length ? 'Không tìm thấy khu vực' : 'Chưa có khu vực nào'}</strong><span>{areas.length ? 'Thử tên khác hoặc chọn trạng thái khác.' : 'Chọn “Thêm khu vực” để tạo không gian đầu tiên.'}</span></div>
          ) : (
            <div className="management-area-cards">
              {visibleAreas.map(area => (
                <article className="management-area-card" key={area.id}>
                  <div className="management-area-identity">
                    <span className="management-area-symbol"><AppstoreOutlined /></span>
                    <div><strong className="management-area-name">{area.ten_khu_vuc}</strong>
                    <small>{area.ghi_chu || 'Chưa có ghi chú'}</small></div>
                  </div>

                  <span className="management-order"><span>Thứ tự </span>{area.thu_tu_hien_thi}</span>

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
                    <button title="Sửa khu vực" aria-label={`Sửa ${area.ten_khu_vuc}`} onClick={() => startEdit(area)}>
                      <EditOutlined />
                    </button>

                    {area.trang_thai === 'HOAT_DONG' ? (
                      <button
                        className="stop"
                        title="Ngừng sử dụng"
                        aria-label={`Ngừng sử dụng ${area.ten_khu_vuc}`}
                        onClick={() => stopUsing(area)}
                      >
                        <StopOutlined />
                      </button>
                    ) : (
                      <button
                        className="activate"
                        title="Kích hoạt lại"
                        aria-label={`Kích hoạt lại ${area.ten_khu_vuc}`}
                        onClick={() => activate(area)}
                      >
                        <CheckCircleOutlined />
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>
    </section>
  )
}
