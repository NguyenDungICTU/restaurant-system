import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert, App as AntdApp, Button, Card, Col, Descriptions, Empty, Input, InputNumber, Modal, Radio, Row, Select, Space, Table, Tag, Typography } from 'antd'
import { PrinterOutlined, CheckCircleOutlined, StopOutlined } from '@ant-design/icons'
import { cancelInvoice, checkoutSession, getInvoiceDetail, getInvoices, getOpenBillingSessions } from '../services/api'
import { calculateDiscount, formatVnd } from '../utils/billing'
import './Billing.css'

const { Title, Text } = Typography
const money = formatVnd

function printInvoice(invoice, items = invoice.items || []) {
  const rows = items.map((x) => `<tr><td>${String(x.ten_mon).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}${x.ghi_chu ? `<small>${String(x.ghi_chu).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</small>` : ''}</td><td>${x.so_luong}</td><td>${money(x.don_gia)}</td><td>${money(x.thanh_tien)}</td></tr>`).join('')
  const w = window.open('', '_blank', 'width=480,height=720')
  if (!w) return
  w.document.write(`<!doctype html><html lang="vi"><meta charset="utf-8"><title>${invoice.so_hoa_don}</title><style>body{font:13px Arial;max-width:700px;margin:24px auto}h2,p{text-align:center}table{width:100%;border-collapse:collapse}td,th{padding:7px;border-bottom:1px solid #ddd;text-align:left}small{display:block}.total{font-size:18px;font-weight:bold;text-align:right;margin-top:18px}</style><h2>HÓA ĐƠN THANH TOÁN</h2><p>${invoice.so_hoa_don} · Bàn ${invoice.ma_ban || ''}</p><table><thead><tr><th>Món</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${rows}</tbody></table><p>Tổng tiền hàng: ${money(invoice.tong_tien_hang)}</p><p>Giảm giá: ${money(invoice.giam_gia_so_tien || (invoice.tong_tien_hang-invoice.tong_thanh_toan))}</p><p class="total">THANH TOÁN: ${money(invoice.tong_thanh_toan)}</p><p>Phương thức: ${invoice.phuong_thuc === 'TIEN_MAT' ? 'Tiền mặt' : 'Chuyển khoản'}</p><p>${invoice.ma_tham_chieu ? `Mã tham chiếu: ${invoice.ma_tham_chieu}` : `Tiền khách đưa: ${money(invoice.tien_khach_dua)} · Tiền thối: ${money(invoice.tien_thoi)}`}</p><script>window.onload=()=>window.print()</script></html>`)
  w.document.close()
}

export default function Billing({ user, initialMode = 'checkout' }) {
  const { message, modal } = AntdApp.useApp()
  const [sessions, setSessions] = useState([])
  const [invoices, setInvoices] = useState([])
  const [selected, setSelected] = useState(null)
  const [mode, setMode] = useState(initialMode)
  const [discountType, setDiscountType] = useState('NONE')
  const [discountValue, setDiscountValue] = useState(0)
  const [discountReason, setDiscountReason] = useState('')
  const [method, setMethod] = useState('TIEN_MAT')
  const [cash, setCash] = useState(0)
  const [reference, setReference] = useState('')
  const [loading, setLoading] = useState(false)
  const reloadInFlight = useRef(false)
  const isManager = user?.role === 'QUAN_LY'

  async function reload({ silent = false } = {}) {
    if (reloadInFlight.current) return
    reloadInFlight.current = true
    if (!silent) setLoading(true)
    try {
      const [ss, ii] = await Promise.all([getOpenBillingSessions(), getInvoices()])
      setSessions(ss)
      setInvoices(ii)
      setSelected(current => current
        ? (ss.find(x => x.phien_ban_id === current.phien_ban_id) || null)
        : null)
    } catch (e) {
      if (!silent) message.error(e.response?.data?.detail || 'Không tải được dữ liệu thanh toán.')
    } finally {
      reloadInFlight.current = false
      if (!silent) setLoading(false)
    }
  }
  useEffect(() => { setMode(initialMode) }, [initialMode])
  useEffect(() => {
    void reload()
    const timer = window.setInterval(() => {
      if (!document.hidden) void reload({ silent: true })
    }, 3000)
    const onVisibilityChange = () => {
      if (!document.hidden) void reload({ silent: true })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])
  const preview = useMemo(() => {
    if (!selected) return { discount: 0, total: 0 }
    try { return calculateDiscount(selected.tong_tien_hang, discountType, discountValue) }
    catch { return { discount: 0, total: selected.tong_tien_hang } }
  }, [selected, discountType, discountValue])
  const columns = [
    { title: 'Bàn', dataIndex: 'ma_ban', key: 'ma_ban', render: (v) => <b>{v}</b> },
    { title: 'Số món', key: 'items', render: (_, x) => x.items.length },
    { title: 'Tổng tiền', dataIndex: 'tong_tien_hang', key: 'total', render: money },
    { title: 'Bắt đầu', dataIndex: 'bat_dau_at', key: 'started', render: v => v ? new Date(v).toLocaleString('vi-VN') : '—' },
    { title: '', key: 'action', render: (_, x) => <Button type="primary" onClick={() => { setSelected(x); setDiscountType('NONE'); setDiscountValue(0); setDiscountReason(''); setMethod('TIEN_MAT'); setCash(x.tong_tien_hang); setReference('') }}>Thanh toán</Button> },
  ]
  async function doCheckout() {
    if (!selected) return
    if (discountType !== 'NONE' && Number(discountValue) > 0 && !discountReason.trim()) { message.warning('Nhập lý do giảm giá.'); return }
    if (method === 'TIEN_MAT' && Number(cash) < preview.total) { message.warning('Tiền khách đưa chưa đủ.'); return }
    if (method === 'CHUYEN_KHOAN' && !reference.trim()) { message.warning('Nhập mã tham chiếu chuyển khoản.'); return }
    modal.confirm({ title: `Chốt hóa đơn bàn ${selected.ma_ban}?`, content: 'Sau khi chốt, phiên sẽ bị khóa và bàn chuyển sang trạng thái đang dọn.', okText: 'Chốt hóa đơn', cancelText: 'Quay lại', onOk: async () => {
      try {
        const invoice = await checkoutSession({ phien_ban_id: selected.phien_ban_id, loai_giam_gia: discountType, gia_tri_giam_gia: Number(discountValue || 0), ly_do_giam_gia: discountReason.trim() || null, phuong_thuc: method, tien_khach_dua: method === 'TIEN_MAT' ? Number(cash) : null, ma_tham_chieu: method === 'CHUYEN_KHOAN' ? reference.trim() : null })
        message.success(`Đã chốt ${invoice.so_hoa_don}. ${method === 'TIEN_MAT' ? `Tiền thối: ${money(invoice.tien_thoi)}` : 'Đã ghi nhận mã tham chiếu.'}`)
        setSelected(null); await reload()
        modal.confirm({ title: `Hóa đơn ${invoice.so_hoa_don}`, content: `Tổng thanh toán ${money(invoice.tong_thanh_toan)}. Bạn có muốn in hóa đơn không?`, okText: 'In hóa đơn', cancelText: 'Để sau', onOk: () => printInvoice(invoice, invoice.items || []) })
      } catch (e) { message.error(e.response?.data?.detail || 'Chốt hóa đơn thất bại.') }
    } })
  }
  function doCancel(invoice) {
    let reason = ''
    modal.confirm({ title: `Hủy hóa đơn ${invoice.so_hoa_don}?`, content: <div><Alert type="warning" showIcon message="Chỉ quản lý được hủy. Bản ghi hóa đơn sẽ được giữ lại và đánh dấu Đã hủy."/><Input.TextArea style={{ marginTop: 12 }} placeholder="Lý do hủy (bắt buộc)" onChange={e => { reason = e.target.value }} rows={3}/></div>, okText: 'Xác nhận hủy', cancelText: 'Không', onOk: async () => {
      if (reason.trim().length < 3) { message.error('Lý do hủy cần ít nhất 3 ký tự.'); throw new Error('Lý do hủy không hợp lệ') }
      try { await cancelInvoice(invoice.id, reason.trim()); message.success('Đã hủy hóa đơn và lưu nhật ký.'); await reload() }
      catch (e) { message.error(e.response?.data?.detail || 'Hủy hóa đơn thất bại.'); throw e }
    } })
  }
  const invoiceColumns = [
    { title: 'Số hóa đơn', dataIndex: 'so_hoa_don', key: 'no' },
    { title: 'Bàn', dataIndex: 'ma_ban', key: 'table' },
    { title: 'Tổng thanh toán', dataIndex: 'tong_thanh_toan', key: 'total', render: money },
    { title: 'Hình thức', dataIndex: 'phuong_thuc', key: 'method', render: v => v === 'TIEN_MAT' ? 'Tiền mặt' : 'Chuyển khoản' },
    { title: 'Thời điểm', dataIndex: 'chot_at', key: 'date', render: v => v ? new Date(v).toLocaleString('vi-VN') : '—' },
    { title: 'Trạng thái', dataIndex: 'trang_thai', key: 'status', render: v => <Tag color={v === 'DA_HUY' ? 'red' : 'green'}>{v === 'DA_HUY' ? 'Đã hủy' : 'Đã chốt'}</Tag> },
    { title: '', key: 'actions', render: (_, x) => <Space><Button icon={<PrinterOutlined />} onClick={async () => { try { const detail = await getInvoiceDetail(x.id); printInvoice(detail, detail.items || []) } catch (e) { message.error(e.response?.data?.detail || "Không tải được chi tiết hóa đơn.") } }} title="In hóa đơn"/>{isManager && x.trang_thai === 'DA_CHOT' && <Button danger icon={<StopOutlined />} onClick={() => doCancel(x)}>Hủy</Button>}</Space> },
  ]
  return <section className="billing-page">
    <div className="billing-header"><div><Text type="secondary">THU NGÂN · S4</Text><Title level={2}>Thanh toán & hóa đơn</Title><Text type="secondary">Chỉ hiển thị phiên đã được nhân viên phục vụ chuyển sang Chờ thanh toán; danh sách tự động cập nhật mỗi 3 giây.</Text></div></div>
    <Space wrap style={{ marginBottom: 18 }}><Button type={mode === 'checkout' ? 'primary' : 'default'} onClick={() => setMode('checkout')}>Bàn chờ thanh toán ({sessions.length})</Button><Button type={mode === 'invoices' ? 'primary' : 'default'} onClick={() => setMode('invoices')}>Tra cứu hóa đơn ({invoices.length})</Button></Space>
    {mode === 'checkout' ? <Row gutter={[16,16]}><Col xs={24} lg={selected ? 11 : 24}><Card title="Phiên bàn đang mở"><Table rowKey="phien_ban_id" size="small" columns={columns} dataSource={sessions} loading={loading} pagination={{ pageSize: 8 }} locale={{ emptyText: <Empty description="Không có bàn chờ thanh toán"/> }}/></Card></Col>
      {selected && <Col xs={24} lg={13}><Card title={`Chốt bàn ${selected.ma_ban}`} extra={<Button type="text" onClick={() => setSelected(null)}>Đóng</Button>}>
        <Descriptions size="small" column={1} items={[{key:'session',label:'Mã phiên',children:selected.phien_ban_id},{key:'subtotal',label:'Tổng tiền hàng',children:<b>{money(selected.tong_tien_hang)}</b>}]}/>
        <Table rowKey="dong_mon_id" size="small" pagination={false} dataSource={selected.items} columns={[{title:'Món',dataIndex:'ten_mon',key:'dish',render:(v,x)=><>{v}{x.ghi_chu && <Text type="secondary" style={{display:'block'}}>Ghi chú: {x.ghi_chu}</Text>}{x.da_huy && <Tag color="orange">Đã hủy nhưng vẫn tính tiền</Tag>}</>},{title:'SL',dataIndex:'so_luong',key:'qty'},{title:'Đơn giá',dataIndex:'don_gia',key:'price',render:money},{title:'Thành tiền',dataIndex:'thanh_tien',key:'amount',render:money}]}/>
        <div className="billing-form"><Text strong>Giảm giá</Text><Radio.Group value={discountType} onChange={e => setDiscountType(e.target.value)} options={[{label:'Không',value:'NONE'},{label:'Theo %',value:'PERCENT'},{label:'Số tiền',value:'AMOUNT'}]}/>{discountType !== 'NONE' && <InputNumber min={0} max={discountType==='PERCENT'?50:selected.tong_tien_hang} value={discountValue} onChange={v=>setDiscountValue(v ?? 0)} addonAfter={discountType==='PERCENT'?'%':'đ'} style={{width:'100%'}}/>}{discountType !== 'NONE' && Number(discountValue)>0 && <Input.TextArea value={discountReason} onChange={e=>setDiscountReason(e.target.value)} placeholder="Lý do giảm giá (bắt buộc)" maxLength={255} rows={2}/>}
        <Text strong>Phương thức thanh toán</Text><Radio.Group value={method} onChange={e=>setMethod(e.target.value)} options={[{label:'Tiền mặt',value:'TIEN_MAT'},{label:'Chuyển khoản',value:'CHUYEN_KHOAN'}]}/>
        {method==='TIEN_MAT' ? <><Text>Số tiền khách đưa</Text><InputNumber min={0} value={cash} onChange={v=>setCash(v ?? 0)} style={{width:'100%'}}/><Alert type={Number(cash)>=preview.total?'success':'warning'} showIcon message={`Tiền thối: ${money(Math.max(0,Number(cash||0)-preview.total))}`}/></> : <Input value={reference} onChange={e=>setReference(e.target.value)} maxLength={100} placeholder="Mã tham chiếu chuyển khoản (bắt buộc)"/>}
        <div className="billing-totals"><div><span>Tiền hàng</span><b>{money(selected.tong_tien_hang)}</b></div><div><span>Giảm giá</span><b>− {money(preview.discount)}</b></div><div className="grand-total"><span>Khách cần trả</span><strong>{money(preview.total)}</strong></div></div>
        <Button type="primary" block size="large" icon={<CheckCircleOutlined />} onClick={doCheckout}>Chốt hóa đơn và đóng bàn</Button></div>
      </Card></Col>}
    </Row> : <Card title="Hóa đơn đã phát hành"><Table
      rowKey="id"
      columns={invoiceColumns}
      dataSource={invoices}
      loading={loading}
      pagination={{ pageSize: 10 }}
      scroll={{ x: 900 }}
      locale={{ emptyText: 'Chưa có hóa đơn' }}
      expandable={{
        expandedRowRender: invoice => (
          <div style={{ padding: '8px 0' }}>
            <Text strong>Chi tiết món đã gọi</Text>
            <Table
              size="small"
              rowKey="dong_mon_id"
              pagination={false}
              dataSource={invoice.items || []}
              locale={{ emptyText: 'Hóa đơn chưa có dữ liệu chi tiết món.' }}
              columns={[
                { title: 'Món', dataIndex: 'ten_mon', key: 'dish' },
                { title: 'Số lượng', dataIndex: 'so_luong', key: 'qty', width: 100 },
                { title: 'Đơn giá', dataIndex: 'don_gia', key: 'price', render: money, width: 140 },
                { title: 'Thành tiền', dataIndex: 'thanh_tien', key: 'amount', render: money, width: 150 },
                { title: 'Ghi chú', dataIndex: 'ghi_chu', key: 'note' },
              ]}
            />
          </div>
        ),
      }}
    /></Card>}
  </section>
}
