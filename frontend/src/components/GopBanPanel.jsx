import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Select, Space, Typography, message } from 'antd'
import { getMergeGroups, mergeTables, unmergeTables } from '../services/api'

export default function GopBanPanel({ tables = [], areaId, onChanged }) {
  const [ids, setIds] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedGroupId, setSelectedGroupId] = useState()
  const [busy, setBusy] = useState(false)
  const occupied = useMemo(
    () => tables.filter(t => t.trang_thai === 'DANG_SU_DUNG' && t.khu_vuc_id === areaId),
    [tables, areaId],
  )
  const options = occupied.map(t => ({ value: t.id, label: t.ma_ban }))

  async function loadGroups() {
    try {
      const result = await getMergeGroups()
      setGroups(Array.isArray(result) ? result : [])
      setSelectedGroupId(current => result.some(g => g.phien_chinh_id === current) ? current : undefined)
    } catch (error) {
      message.error(error?.response?.data?.detail || 'Không tải được danh sách bàn đã gộp.')
    }
  }

  useEffect(() => { void loadGroups() }, [areaId])

  const visibleGroups = groups.filter(group => group.khu_vuc_id === areaId)
  async function merge() {
    if (ids.length !== 2) return message.warning('Chọn đúng hai bàn đang phục vụ trong khu vực hiện tại.')
    setBusy(true)
    try {
      const result = await mergeTables(ids)
      message.success(result.message)
      setIds([])
      await loadGroups()
      onChanged?.()
    } catch (error) {
      message.error(error?.response?.data?.detail || 'Không thể gộp bàn.')
    } finally { setBusy(false) }
  }
  async function undo() {
    if (!selectedGroupId) return message.warning('Chọn nhóm bàn cần huỷ gộp.')
    setBusy(true)
    try {
      const result = await unmergeTables(selectedGroupId)
      message.success(result.message)
      setSelectedGroupId(undefined)
      await loadGroups()
      onChanged?.()
    } catch (error) {
      message.error(error?.response?.data?.detail || 'Không thể huỷ gộp.')
    } finally { setBusy(false) }
  }
  return (
    <section aria-label="Gộp bàn và huỷ gộp" style={{ padding: 12, border: '1px solid #d9d9d9', borderRadius: 8, marginBottom: 16 }}>
      <Typography.Title level={5}>Gộp bàn / huỷ gộp</Typography.Title>
      <Alert type="info" showIcon message="Chỉ hiển thị bàn đang hoạt động trong khu vực đã chọn. Khi huỷ gộp trước thanh toán, các món được trả về đúng phiên bàn ban đầu." style={{ marginBottom: 12 }} />
      <Space wrap>
        <Select mode="multiple" aria-label="Chọn hai bàn để gộp" placeholder="Chọn đúng 2 bàn đang phục vụ" value={ids} options={options} maxCount={2} onChange={setIds} style={{ minWidth: 280 }} />
        <Button type="primary" onClick={merge} loading={busy} disabled={ids.length !== 2}>Gộp hai bàn</Button>
      </Space>
      <div style={{ marginTop: 12 }}>
        <Space wrap>
          <Select
            aria-label="Nhóm bàn cần huỷ gộp"
            placeholder="Chọn nhóm bàn cần huỷ gộp"
            value={selectedGroupId}
            onChange={setSelectedGroupId}
            options={visibleGroups.map(group => ({ value: group.phien_chinh_id, label: group.label }))}
            style={{ minWidth: 280 }}
            allowClear
            notFoundContent="Không có nhóm bàn chưa thanh toán trong khu vực này"
          />
          <Button danger onClick={undo} loading={busy} disabled={!selectedGroupId}>Huỷ gộp</Button>
        </Space>
      </div>
    </section>
  )
}
