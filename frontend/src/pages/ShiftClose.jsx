import { useEffect, useMemo, useState } from 'react'
import { Alert, App as AntdApp, Button, Card, Col, Descriptions, Input, InputNumber, Modal, Row, Space, Table, Tag, Typography } from 'antd'
import { FilePdfOutlined, ReloadOutlined, CheckCircleOutlined, UnlockOutlined } from '@ant-design/icons'
import { closeCurrentShift, getCurrentShift, getShiftHistory, reopenShift } from '../services/api'
import { formatVnd } from '../utils/billing'
import { calculateCashDifference, needsVarianceExplanation } from '../utils/shiftClose'
import './ShiftClose.css'

const { Title, Text } = Typography
const money = formatVnd

function printShift(shift) {
  const w = window.open('', '_blank', 'width=900,height=800')
  if (!w) return
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
  const rows = (shift.hoa_don || []).map(x => `<tr><td>${esc(x.so_hoa_don)}</td><td>${esc(new Date(x.chot_at).toLocaleString('vi-VN'))}</td><td>${x.phuong_thuc === 'TIEN_MAT' ? 'Tiền mặt' : 'Chuyển khoản'}</td><td style="text-align:right">${money(x.tong_thanh_toan)}</td></tr>`).join('')
  w.document.write(`<!doctype html><html lang="vi"><meta charset="utf-8"><title>Biên bản chốt ca ${shift.id}</title><style>body{font:14px Arial;margin:32px;color:#222}h1{text-align:center;font-size:22px}table{border-collapse:collapse;width:100%;margin-top:18px}td,th{border:1px solid #bbb;padding:8px;text-align:left}.stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}.stats p{padding:8px;background:#f4f4f4}small{color:#555}</style><h1>BIÊN BẢN CHỐT CA</h1><p>Mã ca: ${shift.id} · Trạng thái: ${esc(shift.trang_thai)}</p><p>Thời gian: ${esc(shift.bat_dau_at ? new Date(shift.bat_dau_at).toLocaleString('vi-VN') : '')} — ${esc(shift.ket_thuc_at ? new Date(shift.ket_thuc_at).toLocaleString('vi-VN') : 'Đang mở')}</p><div class="stats"><p>Số hóa đơn: <b>${shift.so_hoa_don}</b></p><p>Số bàn phục vụ: <b>${shift.so_ban}</b></p><p>Doanh thu: <b>${money(shift.doanh_thu)}</b></p><p>Tiền mặt theo hệ thống: <b>${money(shift.tien_mat)}</b></p><p>Chuyển khoản: <b>${money(shift.chuyen_khoan)}</b></p><p>Tổng giảm giá: <b>${money(shift.tong_giam_gia)}</b></p><p>Tiền mặt thực đếm: <b>${shift.tien_mat_thuc_te == null ? 'Chưa chốt' : money(shift.tien_mat_thuc_te)}</b></p><p>Chênh lệch: <b>${shift.chenh_lech == null ? '—' : money(shift.chenh_lech)}</b></p></div><p>Giải trình: ${esc(shift.giai_trinh || 'Không có')}</p><table><thead><tr><th>Hóa đơn</th><th>Thời điểm</th><th>Phương thức</th><th>Thành tiền</th></tr></thead><tbody>${rows}</tbody></table><p><small>Biên bản được tổng hợp từ dữ liệu hệ thống.</small></p><script>window.onload=()=>window.print()</script></html>`)
  w.document.close()
}

export default function ShiftClose({ user }) {
  const { message, modal } = AntdApp.useApp()
  const [shift, setShift] = useState(null)
  const [history, setHistory] = useState([])
  const [cash, setCash] = useState(null)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const isManager = user?.role === 'QUAN_LY'
  const difference = useMemo(() => cash == null || !shift ? null : calculateCashDifference(Number(shift.tien_mat || 0), Number(cash)), [cash, shift])

  async function reload() {
    setLoading(true)
    try {
      const [current, old] = await Promise.all([getCurrentShift(), getShiftHistory()])
      setShift(current); setHistory(old)
      setCash(current.tien_mat_thuc_te ?? null)
    } catch (e) { message.error(e.response?.data?.detail?.message || e.response?.data?.detail || 'Không tải được dữ liệu ca.') }
    finally { setLoading(false) }
  }
  useEffect(() => { reload() }, [])

  async function submitClose() {
    if (cash == null || Number(cash) < 0) { message.warning('Nhập số tiền mặt thực đếm.'); return }
    if (needsVarianceExplanation(difference) && reason.trim().length < 3) { message.warning('Chênh lệch vượt 50.000 VND, cần giải trình ít nhất 3 ký tự.'); return }
    try {
      const closed = await closeCurrentShift({ tien_mat_thuc_te: Number(cash), giai_trinh: reason.trim() || null })
      setShift(closed); message.success('Đã chốt ca thành công.')
      await reload()
      modal.confirm({ title: 'Ca đã được chốt', content: 'Bạn có muốn in hoặc lưu biên bản dưới dạng PDF không?', okText: 'In / Lưu PDF', cancelText: 'Để sau', onOk: () => printShift(closed) })
    } catch (e) {
      const detail = e.response?.data?.detail
      if (detail?.ban_chua_dong) {
        modal.error({ title: 'Chưa thể chốt ca', content: <div><p>{detail.message}</p><ul>{detail.ban_chua_dong.map(x => <li key={x.phien_ban_id}>Bàn {x.ma_ban} — {x.trang_thai}</li>)}</ul></div> })
      } else message.error(detail?.message || detail || 'Chốt ca thất bại.')
    }
  }

  function doReopen(row) {
    let why = ''
    modal.confirm({ title: `Mở lại ca #${row.id}?`, content: <div><Alert type="warning" message="Chỉ quản lý được mở lại ca. Thao tác sẽ được lưu nhật ký."/><Input.TextArea rows={3} maxLength={1000} placeholder="Lý do mở lại ca (bắt buộc)" onChange={e => { why = e.target.value }}/></div>, okText: 'Mở lại ca', cancelText: 'Hủy', onOk: async () => {
      if (why.trim().length < 3) { message.error('Lý do cần ít nhất 3 ký tự.'); throw new Error('Lý do không hợp lệ') }
      try { await reopenShift(row.id, why.trim()); message.success('Đã mở lại ca.'); await reload() }
      catch (e) { message.error(e.response?.data?.detail || 'Không mở lại được ca.'); throw e }
    } })
  }

  const historyColumns = [
    { title: 'Ca', dataIndex: 'id', key: 'id', render: v => `#${v}` },
    { title: 'Nhân viên', dataIndex: 'nhan_vien_id', key: 'staff' },
    { title: 'Bắt đầu', dataIndex: 'bat_dau_at', key: 'start', render: v => v ? new Date(v).toLocaleString('vi-VN') : '—' },
    { title: 'Hóa đơn', dataIndex: 'so_hoa_don', key: 'count' },
    { title: 'Doanh thu', dataIndex: 'doanh_thu', key: 'revenue', render: money },
    { title: 'Trạng thái', dataIndex: 'trang_thai', key: 'status', render: v => <Tag color={v === 'DA_CHOT' ? 'green' : 'blue'}>{v === 'DA_CHOT' ? 'Đã chốt' : v === 'DANG_MO' ? 'Đang mở' : v}</Tag> },
    ...(isManager ? [{ title: '', key: 'action', render: (_, x) => x.trang_thai === 'DA_CHOT' ? <Button icon={<UnlockOutlined />} onClick={() => doReopen(x)}>Mở lại</Button> : null }] : []),
  ]

  return <section className="shift-close-page">
    <div className="shift-header"><div><Text type="secondary">THU NGÂN · S4-04</Text><Title level={2}>Chốt ca cuối buổi</Title><Text type="secondary">Đối chiếu số liệu hệ thống với tiền mặt thực đếm trong két.</Text></div><Button icon={<ReloadOutlined />} loading={loading} onClick={reload}>Làm mới</Button></div>
    {shift && <>
      <Card title={`Ca #${shift.id}`} extra={<Tag color={shift.trang_thai === 'DANG_MO' ? 'blue' : 'green'}>{shift.trang_thai === 'DANG_MO' ? 'Đang mở' : shift.trang_thai === 'DA_CHOT' ? 'Đã chốt' : shift.trang_thai}</Tag>}>
        <Row gutter={[12,12]}>
          {[['Số hóa đơn',shift.so_hoa_don],['Doanh thu',money(shift.doanh_thu)],['Tiền mặt',money(shift.tien_mat)],['Chuyển khoản',money(shift.chuyen_khoan)],['Tổng giảm giá',money(shift.tong_giam_gia)],['Số bàn đã phục vụ',shift.so_ban]].map(([label,value]) => <Col xs={12} md={8} key={label}><div className="shift-stat"><Text type="secondary">{label}</Text><Title level={4}>{value}</Title></div></Col>)}
        </Row>
        {shift.trang_thai === 'DANG_MO' ? <div className="shift-close-form">
          <Title level={4}>Đối chiếu tiền mặt</Title>
          <Text>Số tiền mặt thực đếm trong két (VND)</Text>
          <InputNumber min={0} precision={0} value={cash} onChange={setCash} style={{width:'100%'}} size="large" placeholder="Nhập số tiền đếm được"/>
          {difference != null && <Alert style={{marginTop:12}} type={needsVarianceExplanation(difference) ? 'warning' : difference === 0 ? 'success' : 'info'} showIcon message={`Chênh lệch: ${money(difference)} (${difference > 0 ? 'thừa' : difference < 0 ? 'thiếu' : 'khớp'})`} description={needsVarianceExplanation(difference) ? 'Bắt buộc giải trình vì chênh lệch vượt 50.000 VND.' : 'Có thể chốt ca; giải trình không bắt buộc.'}/>}
          {difference != null && needsVarianceExplanation(difference) && <Input.TextArea value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000} rows={3} placeholder="Giải trình chênh lệch (bắt buộc)"/>}
          <Button type="primary" size="large" block icon={<CheckCircleOutlined />} onClick={submitClose} style={{marginTop:16}}>Chốt ca</Button>
        </div> : <Space wrap><Button icon={<FilePdfOutlined />} onClick={() => printShift(shift)}>In / Lưu PDF</Button></Space>}
      </Card>
      <Card title="Lịch sử ca" style={{marginTop:16}}><Table rowKey="id" dataSource={history} columns={historyColumns} loading={loading} scroll={{x:850}} pagination={{pageSize:8}}/></Card>
    </>}
  </section>
}
