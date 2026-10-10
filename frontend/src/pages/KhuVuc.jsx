import { useEffect, useRef, useState } from 'react'
import { Button, Drawer, Input, Select, Table } from 'antd'
import {
  CheckCircleOutlined,
  AppstoreOutlined,
  SearchOutlined,
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
import './RestaurantManagement.css'
import './KhuVuc.css'

const emptyForm = {
  ten_khu_vuc: '',
  thu_tu_hien_thi: 0,
  ghi_chu: '',
}

export default function KhuVuc() {
  const nameInput = useRef(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
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

  function closeDrawer() {
    if (saving) return
    setDrawerOpen(false)
    setEditing(null)
    setForm(emptyForm)
  }

  const normalizedSearch = search.trim().toLocaleLowerCase('vi')
  const visibleAreas = areas.filter(area =>
    String(area.ten_khu_vuc || '')
      .toLocaleLowerCase('vi')
      .includes(normalizedSearch) &&
    (statusFilter === 'all' ||
      (statusFilter === 'active'
        ? area.trang_thai === 'HOAT_DONG'
        : area.trang_thai !== 'HOAT_DONG'))
  )

  const areaColumns = [
    {
      title: 'Tên khu vực',
      dataIndex: 'ten_khu_vuc',
      align: 'center',
      render: value => <strong className="management-area-name">{value}</strong>,
    },
    {
      title: 'Mô tả',
      dataIndex: 'ghi_chu',
      align: 'center',
      render: value => value || '—',
    },
    {
      title: 'Thứ tự',
      dataIndex: 'thu_tu_hien_thi',
      align: 'center',
      render: value => <span className="management-order">{value}</span>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      align: 'center',
      render: value => (
        <span className={`area-status ${value === 'HOAT_DONG' ? 'active' : 'inactive'}`}>
          {value === 'HOAT_DONG' ? 'Đang hoạt động' : 'Ngừng sử dụng'}
        </span>
      ),
    },
    {
      title: 'Thao tác',
      align: 'center',
      render: (_, area) => (
        <div className="area-actions management-table-actions">
          <Button
            title="Sửa khu vực"
            aria-label={`Sửa ${area.ten_khu_vuc}`}
            icon={<EditOutlined />}
            onClick={() => startEdit(area)}
          />
          {area.trang_thai === 'HOAT_DONG' ? (
            <Button
              className="stop"
              title="Ngừng sử dụng"
              aria-label={`Ngừng sử dụng ${area.ten_khu_vuc}`}
              icon={<StopOutlined />}
              onClick={() => stopUsing(area)}
            />
          ) : (
            <Button
              className="activate"
              title="Kích hoạt lại"
              aria-label={`Kích hoạt lại ${area.ten_khu_vuc}`}
              icon={<CheckCircleOutlined />}
              onClick={() => activate(area)}
            />
          )}
        </div>
      ),
    },
  ]

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

        <article className="management-list-card">
          <div className="management-list-heading">
            <div>
              <h2>Danh sách khu vực</h2>
              <p>Chỉ khu vực đang hoạt động mới dùng khi đặt bàn mới.</p>
            </div>
            <span className="management-count-label">
              {loading ? 'Đang tải…' : `${areas.length} khu vực`}
            </span>
          </div>

          <div className="management-toolbar area-list-toolbar">
            <Input
              aria-label="Tìm khu vực"
              placeholder="Tìm tên khu vực…"
              prefix={<SearchOutlined />}
              allowClear
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
            <Select
              aria-label="Lọc trạng thái khu vực"
              value={statusFilter}
              onChange={setStatusFilter}
              className="management-filter"
              options={[
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'active', label: 'Đang hoạt động' },
                { value: 'inactive', label: 'Ngừng sử dụng' },
              ]}
            />
          </div>
          <p className="management-result area-result-summary" aria-live="polite">
            {loading ? 'Đang tải…' : `${visibleAreas.length} / ${areas.length} khu vực phù hợp`}
          </p>
          <Table
            className="management-operational-table"
            rowKey="id"
            dataSource={visibleAreas}
            columns={areaColumns}
            loading={{ spinning: loading, description: 'Đang tải danh sách khu vực…' }}
            pagination={false}
            scroll={{ x: 820 }}
            locale={{
              emptyText: (
                <div className="management-empty">
                  <AppstoreOutlined />
                  <strong>
                    {areas.length ? 'Không tìm thấy khu vực' : 'Chưa có khu vực nào'}
                  </strong>
                  <span>
                    {areas.length
                      ? 'Thử tên khác hoặc chọn trạng thái khác.'
                      : 'Chọn “Thêm khu vực” để tạo không gian đầu tiên.'}
                  </span>
                </div>
              ),
            }}
          />
        </article>
    </section>
  )
}
