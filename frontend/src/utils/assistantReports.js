function csvCell(value) {
  let text = String(value ?? '')
  // Dish names/codes are untrusted. Prevent formulas even after leading whitespace.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text.trimStart())) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

export function buildAssistantCsv(data) {
  const rows = [
    ['BÁO CÁO RESTO', data.title],
    ['Lấy dữ liệu lúc', data.updated_at],
    ...(data.start ? [['Từ ngày', data.start], ['Đến ngày', data.end]] : []),
    ['Tóm tắt', data.summary || ''], [], ['Chỉ số', 'Giá trị', 'Đơn vị'],
    ...data.cards.map(card => [card.label, card.value ?? 'Chưa đủ dữ liệu', card.unit || '']),
  ]
  if (data.baseline) rows.push(['Kỳ so sánh số lượng', data.baseline.start, data.baseline.end])
  if (data.comparison) rows.push([], ['Kỳ so sánh', data.comparison.start, data.comparison.end],
    ['Doanh thu kỳ so sánh', data.comparison.revenue, 'VND'],
    ['Chênh lệch', data.comparison.delta, 'VND'],
    ['Thay đổi (%)', data.comparison.percent ?? 'Không tính được: kỳ so sánh bằng 0'])
  if (data.columns.length) rows.push([], data.columns, ...data.rows)
  rows.push([], ['Ghi chú', data.note], ...(data.insights || []).map(text => ['Nhận xét', text]))
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n')
}

export function reportText(data) {
  const money = value => Number(value).toLocaleString('vi-VN') + ' ₫'
  return [data.title, data.start ? `${data.start} → ${data.end}` : 'Trạng thái hiện tại', data.summary,
    ...data.cards.map(c => `${c.label}: ${metricText(c)}`),
    data.baseline ? `Kỳ so sánh số lượng: ${data.baseline.start} → ${data.baseline.end}` : '',
    data.comparison ? `Kỳ so sánh ${data.comparison.start} → ${data.comparison.end}: ${money(data.comparison.revenue)}. Chênh lệch: ${money(data.comparison.delta)}.` : '',
    data.note, `Lấy dữ liệu lúc: ${data.updated_at}`].filter(Boolean).join('\n')
}

export function metricText(card) {
  if (card.value == null) return 'Chưa đủ dữ liệu'
  return Number(card.value).toLocaleString('vi-VN') + (card.unit === 'VND' ? ' ₫' : card.unit === 'minute' ? ' phút' : '')
}

export function comparisonLabel(comparison) {
  if (!comparison) return ''
  if (comparison.percent == null) return 'Chưa tính tỷ lệ vì kỳ so sánh bằng 0'
  if (comparison.delta === 0) return 'Không thay đổi'
  return `${comparison.delta > 0 ? 'Tăng' : 'Giảm'} ${Math.abs(comparison.percent).toLocaleString('vi-VN')}%`
}

export function chartBars(points) {
  const max = Math.max(0, ...points.map(p => p.value))
  return points.map(p => ({ ...p, height: max > 0 ? p.value / max * 110 : 0 }))
}
