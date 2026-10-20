import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAssistantCsv, chartBars, comparisonLabel, metricText, reportText } from './assistantReports.js'

const report = { kind: 'dishes', title: 'Món bán chạy', summary: 'Dữ liệu mẫu', updated_at: '2026-10-15T12:00:00+07:00', start: '2026-10-15', end: '2026-10-15', cards: [],
  columns: ['Món', 'Số lượng'], rows: [[' =HYPERLINK("evil")', 2], ['Cơm, "ngon"', 3]], note: 'Chỉ món đã phục vụ.' }

test('CSV preserves Vietnamese and blocks formula injection in text', () => {
  const csv = buildAssistantCsv(report)
  assert.ok(csv.startsWith('\uFEFF'))
  assert.ok(csv.includes("' =HYPERLINK"))
  assert.ok(csv.includes('"Cơm, ""ngon"""'))
  assert.ok(csv.includes('2026-10-15'))
})

test('comparison handles zero baseline and signed changes without invented percentages', () => {
  assert.equal(comparisonLabel({ percent: null, delta: 100 }), 'Chưa tính tỷ lệ vì kỳ so sánh bằng 0')
  assert.equal(comparisonLabel({ percent: -50, delta: -100 }), 'Giảm 50%')
  assert.equal(comparisonLabel({ percent: 0, delta: 0 }), 'Không thay đổi')
})

test('chart bars preserve exact values and show zero as zero height', () => {
  const bars = chartBars([{ date: 'a', value: 0 }, { date: 'b', value: 100 }, { date: 'c', value: 50 }])
  assert.deepEqual(bars.map(b => b.height), [0, 110, 55])
  assert.deepEqual(chartBars([{ value: 0 }]).map(b => b.height), [0])
  assert.ok(reportText(report).includes('Chỉ món đã phục vụ.'))
})

test('missing duration stays unknown in UI, copy and CSV, while a real zero stays zero', () => {
  assert.equal(metricText({ value: null, unit: 'minute' }), 'Chưa đủ dữ liệu')
  assert.equal(metricText({ value: 0, unit: 'minute' }), '0 phút')
  const data = { ...report, cards: [{ label: 'Thời gian', value: null, unit: 'minute' }], baseline: { start: '2026-10-01', end: '2026-10-07' } }
  assert.ok(buildAssistantCsv(data).includes('Chưa đủ dữ liệu'))
  assert.ok(buildAssistantCsv(data).includes('Kỳ so sánh số lượng'))
  assert.ok(reportText(data).includes('Chưa đủ dữ liệu'))
})
