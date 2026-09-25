import { useEffect, useState } from 'react'
import { Alert, Button, Form, Input, InputNumber, Modal, Select, Space, Table, Tag } from 'antd'
import { createTable, deleteTable, downloadQR, getAreas, getTables, regenerateQR, updateTable } from '../services/api'

const statuses = { TRONG: 'Trống', DANG_SU_DUNG: 'Đang sử dụng', DA_DAT: 'Đã đặt', NGUNG_SU_DUNG: 'Ngừng sử dụng' }
const types = { THUONG: 'Thường', PHONG_RIENG: 'Phòng riêng' }
const options = values => Object.entries(values).map(([value, label]) => ({ value, label }))
const defaults = { suc_chua_toi_thieu: 1, suc_chua_toi_da: 4, loai_ban: 'THUONG', trang_thai: 'TRONG' }
function errorText(error) {
  const detail = error.response?.data?.detail
  return typeof detail === 'string' ? detail : 'Không thể thực hiện. Kiểm tra dữ liệu và thử lại.'
}

export default function Ban() {
  const [tables, setTables] = useState([])
  const [areas, setAreas] = useState([])
  const [areaId, setAreaId] = useState()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState(null)
  const [form] = Form.useForm()
  const activeAreas = areas.filter(area => area.trang_thai === 'HOAT_DONG')
  const currentInactiveArea = editing && areas.find(area => area.id === editing.khu_vuc_id && area.trang_thai !== 'HOAT_DONG')
  const formAreaOptions = areas.map(area => {
    const inactive = area.trang_thai !== 'HOAT_DONG'
    return {
      value: area.id,
      label: `${area.ten_khu_vuc}${inactive ? ' (ngừng sử dụng)' : ''}`,
      disabled: inactive,
      style: inactive ? { color: '#8c8c8c' } : undefined,
    }
  })

  useEffect(() => {
    let active = true
    Promise.all([getTables(), getAreas()]).then(([rows, regions]) => {
      if (active) { setTables(rows); setAreas(regions) }
    }).catch(error => { if (active) setNotice({ type: 'error', title: errorText(error) }) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  async function run(action, success, reload = true) {
    setBusy(true)
    setNotice(null)
    try {
      await action()
      if (reload) setTables(await getTables())
      setNotice({ type: 'success', title: success })
    } catch (error) {
      setNotice({ type: 'error', title: errorText(error) })
    } finally { setBusy(false) }
  }

  function edit(row = null) {
    setNotice(null)
    setEditing(row)
    form.resetFields()
    form.setFieldsValue(row || { ...defaults, khu_vuc_id: activeAreas.some(area => area.id === areaId) ? areaId : undefined })
    setOpen(true)
  }

  async function save(values) {
    await run(async () => {
      if (editing) await updateTable(editing.id, values)
      else await createTable(values)
      setOpen(false)
    }, editing ? 'Đã cập nhật bàn.' : 'Đã thêm bàn và sinh QR.')
  }

  function remove(row) {
    Modal.confirm({
      title: `Xóa bàn ${row.ma_ban}?`,
      content: 'Bàn sẽ bị xóa vĩnh viễn và các mã QR của bàn không còn sử dụng được.',
      okText: 'Xóa bàn', cancelText: 'Hủy', okButtonProps: { danger: true },
      onOk: () => run(async () => {
        await deleteTable(row.id)
        setTables(current => current.filter(table => table.id !== row.id))
        if (editing?.id === row.id) {
          setOpen(false)
          setEditing(null)
          form.resetFields()
        }
      }, 'Đã xóa bàn.', false),
    })
  }

  function rotate(row) {
    Modal.confirm({
      title: `Sinh lại QR cho ${row.ma_ban}?`,
      content: 'QR cũ sẽ ngừng hiệu lực ngay. Ảnh QR mới sẽ tự tải về để bạn in lại.',
      okText: 'Sinh lại QR', cancelText: 'Hủy',
      onOk: async () => {
        setBusy(true)
        setNotice(null)
        let regenerated = false
        try {
          const updated = await regenerateQR(row.id)
          regenerated = true
          setTables(current => current.map(table => table.id === row.id ? updated : table))
          await downloadQR(`/api/ban/${row.id}/qr.png`, `ban-${row.id}-qr.png`)
          setNotice({ type: 'success', title: 'Đã sinh và tải QR mới' })
        } catch (error) {
          setNotice({
            type: 'error',
            title: regenerated
              ? `QR đã được sinh lại và QR cũ đã vô hiệu, nhưng tải PNG thất bại. ${errorText(error)} Bấm “Tải PNG” để tải lại QR hiện tại.`
              : `Không thể sinh QR mới. ${errorText(error)}`,
          })
        } finally { setBusy(false) }
      },
    })
  }

  const columns = [
    { title: 'Mã bàn', dataIndex: 'ma_ban' },
    { title: 'Khu vực', dataIndex: 'khu_vuc_id', render: id => areas.find(a => a.id === id)?.ten_khu_vuc || id },
    { title: 'Sức chứa', render: (_, row) => `${row.suc_chua_toi_thieu}–${row.suc_chua_toi_da}` },
    { title: 'Loại', dataIndex: 'loai_ban', render: value => types[value] },
    { title: 'Trạng thái', dataIndex: 'trang_thai', render: value => <Tag>{statuses[value]}</Tag> },
    { title: 'Thao tác', render: (_, row) => <Space wrap>
      <Button disabled={busy} onClick={() => edit(row)}>Sửa</Button>
      <Button disabled={busy} onClick={() => run(() => downloadQR(`/api/ban/${row.id}/qr.png`, `ban-${row.id}-qr.png`), 'Đã tải PNG.', false)}>Tải PNG</Button>
      <Button disabled={busy} onClick={() => rotate(row)}>Sinh lại QR</Button>
      <Button danger disabled={busy} onClick={() => remove(row)}>Xóa</Button>
    </Space> },
  ]

  return <section>
    <div className="page-heading"><div><h1>Quản lý bàn</h1><p className="subheading">Khai báo bàn, sức chứa và quản lý mã QR.</p></div>
      <Button type="primary" disabled={loading || busy || !activeAreas.length} onClick={() => edit()}>Thêm bàn</Button></div>
    {notice && <Alert {...notice} showIcon style={{ marginBottom: 16 }} />}
    {!loading && !activeAreas.length && <Alert title="Hãy tạo hoặc kích hoạt khu vực trước khi thêm bàn." type="info" />}
    <Space wrap style={{ marginBottom: 16 }}>
      <Select aria-label="Lọc khu vực" placeholder="Tất cả khu vực" allowClear value={areaId} onChange={setAreaId} style={{ minWidth: 220 }} options={areas.map(a => ({ value: a.id, label: a.ten_khu_vuc }))} />
      <Button disabled={!areaId || busy} onClick={() => run(() => downloadQR(`/api/ban/khu-vuc/${areaId}/qr.pdf`, `khu-vuc-${areaId}-qr.pdf`), 'Đã tải PDF QR của khu vực.', false)}>Tải PDF khu vực</Button>
    </Space>
    <Table rowKey="id" loading={loading} dataSource={tables.filter(row => !areaId || row.khu_vuc_id === areaId)} columns={columns} scroll={{ x: 950 }} locale={{ emptyText: 'Chưa có bàn.' }} />
    <Modal title={editing ? 'Sửa bàn' : 'Thêm bàn'} open={open} onCancel={() => { if (!busy) setOpen(false) }} footer={null} forceRender>
      {notice?.type === 'error' && <Alert {...notice} showIcon style={{ marginBottom: 16 }} />}
      <Form form={form} layout="vertical" initialValues={defaults} onFinish={save}>
        <Form.Item name="ma_ban" label="Mã bàn" rules={[{ required: true, whitespace: true, message: 'Nhập mã bàn.' }]}><Input maxLength={50} /></Form.Item>
        <Form.Item name="khu_vuc_id" label="Khu vực" extra={currentInactiveArea ? 'Khu vực hiện tại đã ngừng sử dụng. Bạn có thể giữ nguyên hoặc chuyển sang khu vực đang hoạt động.' : undefined} rules={[
          { required: true, message: 'Chọn khu vực.' },
          { validator: (_, value) => value == null || (editing && value === editing.khu_vuc_id) || activeAreas.some(area => area.id === value)
            ? Promise.resolve()
            : Promise.reject(new Error('Khu vực đã ngừng sử dụng. Vui lòng chọn khu vực đang hoạt động.')) },
        ]}><Select
          options={formAreaOptions}
          labelRender={({ value, label }) => currentInactiveArea && value === currentInactiveArea.id
            ? <span style={{ color: '#8c8c8c' }}>{currentInactiveArea.ten_khu_vuc} (ngừng sử dụng)</span>
            : label ?? value}
        /></Form.Item>
        <Form.Item name="suc_chua_toi_thieu" label="Sức chứa tối thiểu" rules={[{ required: true }]}><InputNumber min={1} max={2147483647} precision={0} /></Form.Item>
        <Form.Item name="suc_chua_toi_da" label="Sức chứa tối đa" dependencies={['suc_chua_toi_thieu']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator(_, value) { return value >= getFieldValue('suc_chua_toi_thieu') ? Promise.resolve() : Promise.reject(new Error('Tối đa phải lớn hơn hoặc bằng tối thiểu.')) } })]}><InputNumber min={1} max={2147483647} precision={0} /></Form.Item>
        <Form.Item name="loai_ban" label="Loại bàn"><Select options={options(types)} /></Form.Item>
        <Form.Item name="trang_thai" label="Trạng thái"><Select options={options(statuses)} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={busy}>Lưu bàn</Button>
      </Form>
    </Modal>
  </section>
}
