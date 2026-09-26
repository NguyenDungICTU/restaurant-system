import { useCallback, useEffect, useState } from 'react'
import { App as AntdApp, Button, Input, InputNumber, Modal, Select, Tag } from 'antd'
import { PlusOutlined, QrcodeOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  createTable,
  downloadAreaQrs,
  downloadTableQr,
  getActiveAreas,
  getActiveTables,
  getAreas,
  getTables,
  regenerateTableQr,
  updateTable,
} from '../services/api'

const EMPTY_FORM = {
  ma_ban: '',
  khu_vuc_id: undefined,
  suc_chua_toi_thieu: 1,
  suc_chua_toi_da: 4,
  loai_ban: 'THUONG',
  trang_thai: 'TRONG',
}
const STATUS_LABELS = {
  TRONG: 'Trống',
  DANG_PHUC_VU: 'Đang phục vụ',
  DA_DAT: 'Đã đặt',
  TAM_NGUNG: 'Tạm ngưng',
}

export default function Tables({ user }) {
  const { message, modal } = AntdApp.useApp()
  const manager = user?.role === 'QUAN_LY'
  const [tables, setTables] = useState([])
  const [areas, setAreas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [tableList, areaList] = await Promise.all([
        manager ? getTables() : getActiveTables(),
        manager ? getAreas() : getActiveAreas(),
      ])
      setTables(tableList)
      setAreas(areaList)
    } catch (requestError) {
      setError(requestError.response?.data?.detail || 'Không tải được sơ đồ bàn.')
    } finally {
      setLoading(false)
    }
  }, [manager])

  useEffect(() => {
    load()
  }, [load])

  function openForm(table = null) {
    setEditing(table)
    setForm(table ? {
      ma_ban: table.ma_ban,
      khu_vuc_id: table.khu_vuc_id,
      suc_chua_toi_thieu: table.suc_chua_toi_thieu,
      suc_chua_toi_da: table.suc_chua_toi_da,
      loai_ban: table.loai_ban,
      trang_thai: table.trang_thai,
    } : { ...EMPTY_FORM, khu_vuc_id: areas.find((area) => area.trang_thai === 'HOAT_DONG')?.id })
    setOpen(true)
  }

  async function submit() {
    if (
      !form.ma_ban.trim()
      || !form.khu_vuc_id
      || form.suc_chua_toi_da < form.suc_chua_toi_thieu
    ) return
    setSaving(true)
    try {
      const payload = { ...form, ma_ban: form.ma_ban.trim() }
      if (editing) await updateTable(editing.id, payload)
      else await createTable(payload)
      setOpen(false)
      message.success(editing ? 'Đã cập nhật bàn.' : 'Đã tạo bàn và mã QR riêng.')
      await load()
    } catch (requestError) {
      message.error(requestError.response?.data?.detail || 'Không thể lưu bàn.')
    } finally {
      setSaving(false)
    }
  }

  async function downloadQr(table) {
    try {
      downloadBlob(await downloadTableQr(table.id), `qr-table-${table.id}.png`)
    } catch (requestError) {
      message.error(requestError.response?.data?.detail || 'Không tải được mã QR.')
    }
  }

  async function downloadArea(area) {
    try {
      downloadBlob(await downloadAreaQrs(area.id), `qr-area-${area.id}.pdf`)
    } catch (requestError) {
      message.error(requestError.response?.data?.detail || 'Không tải được PDF QR.')
    }
  }

  function regenerate(table) {
    modal.confirm({
      title: 'Sinh lại mã QR?',
      content: 'Mã QR cũ sẽ mất hiệu lực ngay sau khi xác nhận.',
      okText: 'Sinh lại',
      cancelText: 'Hủy',
      onOk: async () => {
        try {
          await regenerateTableQr(table.id)
          message.success('Đã sinh mã QR mới. Mã cũ đã hết hiệu lực.')
        } catch (requestError) {
          message.error(requestError.response?.data?.detail || 'Không sinh lại được QR.')
          throw requestError
        }
      },
    })
  }

  const areaName = (id) => areas.find((area) => area.id === id)?.ten_khu_vuc || '—'

  return (
    <section>
      <header className="page-heading">
        <div>
          <p className="eyebrow">VẬN HÀNH</p>
          <h1>{manager ? 'Quản lý bàn & mã QR' : 'Sơ đồ bàn'}</h1>
          <p className="subheading">Bàn được sắp xếp theo khu vực và sức chứa.</p>
        </div>
        {manager && (
          <div className="table-page-actions">
            {areas.filter((area) => area.trang_thai === 'HOAT_DONG').map((area) => (
              <Button key={area.id} icon={<QrcodeOutlined />} onClick={() => downloadArea(area)}>
                PDF QR {area.ten_khu_vuc}
              </Button>
            ))}
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()}>
              Thêm bàn
            </Button>
          </div>
        )}
      </header>
      {error && <div className="employee-error">{String(error)}</div>}
      <div className="employee-table-wrap">
        <table className="employee-table">
          <thead>
            <tr><th>Mã bàn</th><th>Khu vực</th><th>Sức chứa</th><th>Loại bàn</th><th>Trạng thái</th>{manager && <th>Thao tác</th>}</tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={manager ? 6 : 5} className="table-empty">Đang tải...</td></tr>
              : tables.length ? tables.map((table) => (
                <tr key={table.id}>
                  <td><b>{table.ma_ban}</b></td>
                  <td>{areaName(table.khu_vuc_id)}</td>
                  <td>{table.suc_chua_toi_thieu}–{table.suc_chua_toi_da} khách</td>
                  <td>{table.loai_ban === 'PHONG_RIENG' ? 'Phòng riêng' : 'Thường'}</td>
                  <td><Tag color={table.trang_thai === 'TRONG' ? 'green' : table.trang_thai === 'TAM_NGUNG' ? 'default' : 'blue'}>{STATUS_LABELS[table.trang_thai] || table.trang_thai}</Tag></td>
                  {manager && <td>
                    <Button type="link" onClick={() => openForm(table)}>Sửa</Button>
                    <Button type="link" icon={<QrcodeOutlined />} onClick={() => downloadQr(table)}>QR</Button>
                    <Button type="link" icon={<ReloadOutlined />} onClick={() => regenerate(table)}>Sinh lại</Button>
                  </td>}
                </tr>
              )) : <tr><td colSpan={manager ? 6 : 5} className="table-empty">Chưa có bàn trong khu vực đang hoạt động.</td></tr>}
          </tbody>
        </table>
      </div>

      <Modal
        open={open}
        title={editing ? 'Cập nhật bàn' : 'Thêm bàn'}
        onCancel={() => setOpen(false)}
        onOk={submit}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
      >
        <div className="category-form">
          <label>Mã bàn</label>
          <Input maxLength={50} value={form.ma_ban} onChange={(event) => setForm({ ...form, ma_ban: event.target.value })} />
          <label>Khu vực</label>
          <Select
            value={form.khu_vuc_id}
            options={areas.filter((area) => area.trang_thai === 'HOAT_DONG' || area.id === editing?.khu_vuc_id).map((area) => ({ value: area.id, label: area.ten_khu_vuc }))}
            onChange={(khu_vuc_id) => setForm({ ...form, khu_vuc_id })}
            style={{ width: '100%' }}
          />
          <label>Sức chứa tối thiểu</label>
          <InputNumber min={1} value={form.suc_chua_toi_thieu} onChange={(suc_chua_toi_thieu) => setForm({ ...form, suc_chua_toi_thieu })} style={{ width: '100%' }} />
          <label>Sức chứa tối đa</label>
          <InputNumber min={1} value={form.suc_chua_toi_da} onChange={(suc_chua_toi_da) => setForm({ ...form, suc_chua_toi_da })} style={{ width: '100%' }} />
          <label>Loại bàn</label>
          <Select value={form.loai_ban} options={[{ value: 'THUONG', label: 'Thường' }, { value: 'PHONG_RIENG', label: 'Phòng riêng' }]} onChange={(loai_ban) => setForm({ ...form, loai_ban })} style={{ width: '100%' }} />
          <label>Trạng thái</label>
          <Select value={form.trang_thai} options={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))} onChange={(trang_thai) => setForm({ ...form, trang_thai })} style={{ width: '100%' }} />
        </div>
      </Modal>
    </section>
  )
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
