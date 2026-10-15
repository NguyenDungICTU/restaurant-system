import { useState } from 'react'
import { Button } from 'antd'
import { CopyOutlined, DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import { buildAssistantCsv, chartBars, comparisonLabel, metricText, reportText } from '../utils/assistantReports'

function RevenueChart({ chart }) {
  const bars = chartBars(chart.points)
  const width = Math.max(330, bars.length * 28 + 16)
  const barWidth = (width - 16) / Math.max(1, bars.length)
  return <figure className="resto-assistant-chart">
    <figcaption>{chart.title} <small>VND · từng ngày</small></figcaption>
    <div><svg width={width} height="158" role="img" aria-label={chart.title}>
      <title>{chart.title}. Giá trị chi tiết nằm trong bảng dữ liệu bên dưới.</title>
      <line x1="8" y1="120" x2={width - 8} y2="120" stroke="#d9d1c8" />
      {bars.map((point, index) => <g key={point.date}>
        <rect x={8 + (index + 0.5) * barWidth - Math.min(40, Math.max(2, barWidth - 6)) / 2}
          y={120 - point.height} width={Math.min(40, Math.max(2, barWidth - 6))} height={point.height} rx="3" fill="#9f2f27">
          <title>{point.date}: {point.value.toLocaleString('vi-VN')} ₫</title>
        </rect>
        {(index === 0 || index === bars.length - 1 || (bars.length <= 10 || index % 7 === 0)) && <text x={8 + (index + 0.5) * barWidth} y="140" textAnchor="middle" fontSize="10" fill="#766e66">{point.date.slice(8)}/{point.date.slice(5, 7)}</text>}
      </g>)}
    </svg></div>
    {!bars.some(b => b.value) && <small>Chưa có doanh thu trong khoảng này.</small>}
  </figure>
}

export default function AssistantDataCard({ data, onNavigate, onRefresh, busy }) {
  const [feedback, setFeedback] = useState('')
  function download() {
    const url = URL.createObjectURL(new Blob([buildAssistantCsv(data)], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `resto-${data.kind}-${data.start || data.updated_at.slice(0, 10)}.csv`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function copy() {
    try { await navigator.clipboard.writeText(reportText(data)); setFeedback('Đã sao chép báo cáo.') }
    catch { setFeedback('Trình duyệt chưa cho sao chép. Bạn có thể dùng Xuất CSV.') }
  }
  const table = <div className="resto-assistant-table"><table>
    <thead><tr>{data.columns.map(col => <th key={col}>{col}</th>)}</tr></thead>
    <tbody>{data.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{typeof cell === 'number' ? cell.toLocaleString('vi-VN') : cell}</td>)}</tr>)}</tbody>
  </table>{!data.rows.length && <p>Chưa có dữ liệu phù hợp.</p>}</div>
  return <section className="resto-assistant-data" aria-label={data.title}>
    <strong>{data.title}</strong>
    {data.start && <p className="resto-assistant-period">{data.start} → {data.end} · Giờ Việt Nam</p>}
    {data.baseline && <p className="resto-assistant-period">Kỳ so sánh: {data.baseline.start} → {data.baseline.end}</p>}
    {data.summary && <p className="resto-assistant-summary">{data.summary}</p>}
    <div className="resto-assistant-metrics">{data.cards.map(card => <div key={card.label}>
      <span>{card.label}</span><b>{metricText(card)}</b>
    </div>)}</div>
    {data.comparison && <div className="resto-assistant-comparison">
      <small>So với {data.comparison.start} → {data.comparison.end}</small>
      <strong>{comparisonLabel(data.comparison)}</strong>
      <span>Chênh lệch: {data.comparison.delta > 0 ? '+' : ''}{data.comparison.delta.toLocaleString('vi-VN')} ₫</span>
      <small>Doanh thu kỳ so sánh: {data.comparison.revenue.toLocaleString('vi-VN')} ₫</small>
    </div>}
    {data.chart && <RevenueChart chart={data.chart} />}
    {!!data.columns.length && (data.chart ? <details className="resto-assistant-daily-table"><summary>Xem bảng theo ngày ({data.rows.length} ngày)</summary>{table}</details> : table)}
    {!!data.insights?.length && <ul className="resto-assistant-insights">{data.insights.map(text => <li key={text}>{text}</li>)}</ul>}
    <p className="resto-assistant-data-note">{data.note}</p>
    <small>Chụp dữ liệu lúc {new Date(data.updated_at).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })} (giờ Việt Nam)</small>
    <div className="resto-assistant-data-actions">
      <Button size="small" aria-label="Xuất CSV" icon={<DownloadOutlined />} onClick={download}>Xuất CSV</Button>
      <Button size="small" aria-label="Sao chép" icon={<CopyOutlined />} onClick={copy}>Sao chép</Button>
      <Button size="small" aria-label="Cập nhật" icon={<ReloadOutlined />} disabled={busy || !data.request} onClick={() => onRefresh(data.request, data.title)}>Cập nhật</Button>
      <Button size="small" onClick={() => onNavigate(data.page)}>Mở trang chi tiết</Button>
    </div>
    {feedback && <small role="status">{feedback}</small>}
  </section>
}
