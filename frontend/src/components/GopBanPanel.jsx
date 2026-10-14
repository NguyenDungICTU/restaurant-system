import { useState } from 'react'
import { Alert, Button, Select, Space, Typography, message } from 'antd'
import { mergeTables, unmergeTables } from '../services/api'

export default function GopBanPanel({ tables = [], onChanged }) {
  const [ids, setIds] = useState([])
  const [mainSessionId, setMainSessionId] = useState('')
  const [busy, setBusy] = useState(false)
  const occupied = tables.filter(t => t.trang_thai === 'DANG_SU_DUNG')
  const options = occupied.map(t => ({ value: t.id, label: `${t.ma_ban} · khu vực ${t.khu_vuc_id}` }))

  async function merge() {
    if (ids.length !== 2) return message.warning('Chọn đúng hai bàn đang phục vụ.')
    setBusy(true)
    try {
      const result = await mergeTables(ids)
      setMainSessionId(String(result.phien_chinh_id))
      message.success(result.message)
      setIds([])
      onChanged?.()
    } catch (error) {
      message.error(error?.response?.data?.detail || 'Không thể gộp bàn.')
    } finally { setBusy(false) }
  }
  async function undo() {
    if (!mainSessionId) return message.warning('Nhập ID phiên chính để huỷ gộp.')
    setBusy(true)
    try {
      const result = await unmergeTables(Number(mainSessionId))
      message.success(result.message)
      setMainSessionId('')
      onChanged?.()
    } catch (error) {
      message.error(error?.response?.data?.detail || 'Không thể huỷ gộp.')
    } finally { setBusy(false) }
  }
  return (
    <section aria-label="Gộp bàn và huỷ gộp" style={{ padding: 12, border: '1px solid #d9d9d9', borderRadius: 8, marginBottom: 16 }}>
      <Typography.Title level={5}>Gộp bàn / huỷ gộp</Typography.Title>
      <Alert type="info" showIcon message="Chọn hai bàn đang phục vụ trong cùng khu vực. Backend từ chối nếu khác khu vực hoặc có phiên chờ thanh toán." style={{ marginBottom: 12 }} />
      <Space wrap>
        <Select mode="multiple" aria-label="Chọn hai bàn để gộp" placeholder="Chọn đúng 2 bàn đang phục vụ" value={ids} options={options} maxCount={2} onChange={setIds} style={{ minWidth: 280 }} />
        <Button type="primary" onClick={merge} loading={busy} disabled={ids.length !== 2}>Gộp hai bàn</Button>
      </Space>
      <div style={{ marginTop: 12 }}>
        <Space wrap>
          <label htmlFor="merge-main-session">ID phiên chính để huỷ gộp</label>
          <input id="merge-main-session" value={mainSessionId} onChange={e => setMainSessionId(e.target.value)} inputMode="numeric" />
          <Button danger onClick={undo} loading={busy} disabled={!mainSessionId}>Huỷ gộp</Button>
        </Space>
      </div>
    </section>
  )
}
