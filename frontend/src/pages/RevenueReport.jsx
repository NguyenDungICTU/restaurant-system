import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Spin } from 'antd'
import dayjs from 'dayjs'
import { getRevenueReport } from '../services/api'
import { inclusiveDays, validateRevenueRange, formatVnd, hourlyBarPercent } from '../utils/revenueReport'
import './RevenueReport.css'

export default function RevenueReport() {
  const today = dayjs().format('YYYY-MM-DD')
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [appliedRange, setAppliedRange] = useState({ from: today, to: today })
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')
  const [rangeError, setRangeError] = useState('')

  const load = useCallback(async (range, quiet = false) => {
    if (quiet) setRefreshing(true)
    else setLoading(true)
    try {
      const result = await getRevenueReport(range.from, range.to)
      setData(result)
      setError('')
    } catch (e) {
      setError(e?.response?.data?.detail || 'Không thể tải báo cáo doanh thu. Hãy thử lại.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    load(appliedRange)
    const timer = window.setInterval(() => load(appliedRange, true), 60000)
    return () => window.clearInterval(timer)
  }, [appliedRange, load])

  const maxRevenue = useMemo(() => Math.max(1, ...(data?.hourly || []).map((x) => x.revenue)), [data])
  const selectedDays = inclusiveDays(from, to)

  function applyRange() {
    const validation = validateRevenueRange(from, to)
    if (!validation.valid) {
      setRangeError(validation.message)
      return
    }
    setRangeError('')
    setAppliedRange({ from, to })
  }

  return (
    <section className="revenue-report">
      <div className="revenue-heading">
        <div>
          <p className="revenue-eyebrow">PHÂN TÍCH VẬN HÀNH</p>
          <h1>Báo cáo doanh thu</h1>
          <p className="revenue-subtitle">Theo dõi doanh thu và khung giờ hoạt động để bố trí ca làm phù hợp.</p>
        </div>
        <Button onClick={() => load(appliedRange, true)} loading={refreshing}>Làm mới</Button>
      </div>

      <div className="revenue-filter">
        <label> Từ ngày
          <DatePicker value={dayjs(from)} format="DD/MM/YYYY" allowClear={false}
            onChange={(v) => v && setFrom(v.format('YYYY-MM-DD'))} />
        </label>
        <label> Đến ngày
          <DatePicker value={dayjs(to)} format="DD/MM/YYYY" allowClear={false}
            onChange={(v) => v && setTo(v.format('YYYY-MM-DD'))} />
        </label>
        <div className="revenue-filter-action">
          <span>{selectedDays > 0 ? `${selectedDays} ngày được chọn` : 'Khoảng ngày không hợp lệ'}</span>
          <Button type="primary" onClick={applyRange}>Xem báo cáo</Button>
        </div>
      </div>
      {rangeError && <Alert type="error" showIcon message={rangeError} />}
      {error && <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => load(appliedRange)}>Thử lại</Button>} />}

      {loading && !data ? <div className="revenue-loading"><Spin size="large" /><span>Đang tổng hợp số liệu...</span></div> : data && <>
        <div className="revenue-meta">
          <span>Khoảng báo cáo: <strong>{dayjs(data.from).format('DD/MM/YYYY')} – {dayjs(data.to).format('DD/MM/YYYY')}</strong></span>
          <span>{refreshing ? 'Đang cập nhật…' : `Tự cập nhật mỗi 60 giây · Cập nhật lúc ${dayjs(data.updated_at).format('HH:mm:ss')}`}</span>
        </div>

        <div className="revenue-metrics">
          <Metric label="Doanh thu" value={formatVnd(data.revenue)} detail="Tổng hóa đơn đã chốt" accent />
          <Metric label="Số hóa đơn" value={data.invoice_count.toLocaleString('vi-VN')} detail="Không tính hóa đơn đã hủy" />
          <Metric label="Lượt khách ghi nhận" value={data.guest_count.toLocaleString('vi-VN')} detail="Khách đã check-in đặt bàn" />
          <Metric label="Trung bình / hóa đơn" value={formatVnd(data.average_invoice)} detail="Doanh thu ÷ số hóa đơn" />
          <Metric label="Bàn đang phục vụ" value={data.active_tables.toLocaleString('vi-VN')} detail="Đang phục vụ hoặc chờ thanh toán" />
        </div>

        <section className="revenue-chart-card">
          <div className="revenue-chart-header">
            <div><h2>Doanh thu theo khung giờ</h2><p>Mỗi cột là doanh thu hóa đơn chốt trong một giờ mở cửa.</p></div>
            <span className="revenue-chart-period">{data.days} ngày</span>
          </div>
          {data.no_data ? (
            <div className="revenue-empty"><div className="revenue-empty-icon">₫</div><h3>Chưa có dữ liệu giao dịch</h3><p>Không có hóa đơn đã chốt trong khoảng ngày đã chọn. Biểu đồ sẽ xuất hiện khi có giao dịch.</p></div>
          ) : data.hourly.length === 0 ? (
            <div className="revenue-empty"><h3>Chưa cấu hình giờ mở cửa</h3><p>Hãy kiểm tra mục “Giờ mở cửa” để xác định các khung giờ cần thống kê.</p></div>
          ) : (
            <div className="revenue-chart" role="img" aria-label="Biểu đồ cột doanh thu theo từng giờ">
              {data.hourly.map((item) => (
                <div className="revenue-bar-column" key={item.hour} title={`${item.label}: ${formatVnd(item.revenue)}`}>
                  <div className="revenue-bar-value">{item.revenue ? formatVnd(item.revenue) : '—'}</div>
                  <div className="revenue-bar-track"><div className={`revenue-bar ${item.revenue ? '' : 'is-zero'}`} style={{ height: `${hourlyBarPercent(item.revenue, maxRevenue)}%` }} /></div>
                  <span className="revenue-bar-label">{String(item.hour).padStart(2, '0')}:00</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <p className="revenue-footnote">Lưu ý: lượt khách hiện tính từ các đặt bàn đã ghi nhận thời điểm khách đến. Phiên khách vãng lai chưa có trường lưu số người trong dữ liệu hiện tại.</p>
      </>}
    </section>
  )
}

function Metric({ label, value, detail, accent = false }) {
  return <article className={`revenue-metric ${accent ? 'revenue-metric--accent' : ''}`}>
    <span>{label}</span><strong>{value}</strong><small>{detail}</small>
  </article>
}
