import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeOverviewRevenue,
  sortOverviewBookings,
  summarizeOverviewTables,
  summarizePendingPayments,
  VIETNAM_TIME_ZONE,
  vietnamDateKey,
} from './overview.js'

test('overview dates switch at midnight in Vietnam regardless of the device timezone', () => {
  assert.equal(VIETNAM_TIME_ZONE, 'Asia/Ho_Chi_Minh')
  assert.equal(vietnamDateKey(new Date('2026-10-14T16:59:59Z')), '2026-10-14')
  assert.equal(vietnamDateKey(new Date('2026-10-14T17:00:00Z')), '2026-10-15')
  assert.equal(vietnamDateKey(new Date('2026-12-31T17:00:00Z')), '2027-01-01')
})

test('table counts match the live map and retain every physical table in merged groups', () => {
  const configured = (id, trang_thai, extra = {}) => ({ id, trang_thai, da_cau_hinh: true, ...extra })
  const summary = summarizeOverviewTables([
    configured(1, 'DANG_SU_DUNG', { trang_thai_phien: 'DANG_PHUC_VU' }),
    configured(2, 'DANG_SU_DUNG', { trang_thai_phien: 'DA_GOP' }),
    configured(3, 'DANG_SU_DUNG', { trang_thai_phien: 'CHO_THANH_TOAN' }),
    configured(4, 'TRONG'),
    configured(5, 'DA_DAT', { dat_ban_sap_toi: { thoi_gian_den_at: '2026-10-15T12:00:00+07:00' } }),
    configured(6, 'DA_DAT', { dat_ban_sap_toi: { thoi_gian_den_at: '2026-10-15T10:00:00+07:00' } }),
    configured(7, 'DANG_DON'),
    configured(8, 'TRONG', { da_cau_hinh: false }),
    configured(9, 'NGUNG_SU_DUNG'),
    configured(10, 'UNKNOWN'),
  ], new Date('2026-10-15T10:00:00+07:00'))

  assert.deepEqual(summary, {
    total: 10,
    serving: 3,
    empty: 2,
    reserved: 1,
    cleaning: 1,
    unconfigured: 1,
    inactive: 1,
    other: 1,
  })
  assert.equal(Object.entries(summary).filter(([key]) => key !== 'total')
    .reduce((sum, [, count]) => sum + count, 0), summary.total)
})

test('unconfigured tables remain separate even when their stored status is inactive', () => {
  const summary = summarizeOverviewTables([
    { id: 1, da_cau_hinh: false, trang_thai: 'NGUNG_SU_DUNG' },
  ])
  assert.equal(summary.unconfigured, 1)
  assert.equal(summary.inactive, 0)
  assert.equal(summary.empty, 0)
})

test('pending payments count only explicit requests and deduplicate sessions and physical members', () => {
  assert.deepEqual(summarizePendingPayments([
    { phien_ban_id: 10, ban_id: 1, trang_thai_phien: 'DANG_PHUC_VU' },
    { phien_ban_id: 11, ban_id: 2, trang_thai_phien: 'CHO_THANH_TOAN', ban_ids: [2, 3] },
    { phien_ban_id: 11, ban_id: 2, trang_thai_phien: 'CHO_THANH_TOAN', ban_ids: [2, 3] },
    { phien_ban_id: 12, ban_id: 4, trang_thai_phien: 'CHO_THANH_TOAN' },
    { phien_ban_id: 13, ban_id: 5, trang_thai_phien: 'DA_DONG' },
  ]), { tableCount: 3, sessionCount: 2 })
  assert.deepEqual(summarizePendingPayments([]), { tableCount: 0, sessionCount: 0 })
})

test('the current payment API counts a merged group by its provided representative table', () => {
  assert.deepEqual(summarizePendingPayments([
    { phien_ban_id: 11, ban_id: 2, trang_thai_phien: 'CHO_THANH_TOAN' },
  ]), { tableCount: 1, sessionCount: 1 })
})

test('today bookings are sorted by arrival time and ID without changing API rows', () => {
  const rows = [
    { id: 4, khung_gio: '12:00 - 13:30' },
    { id: 3, khung_gio: '09:30 - 11:00' },
    { id: 2, khung_gio: '09:30 - 11:00' },
    { id: 1, khung_gio: '8:00 - 09:30' },
  ]
  assert.deepEqual(sortOverviewBookings(rows).map(row => row.id), [1, 2, 3, 4])
  assert.deepEqual(rows.map(row => row.id), [4, 3, 2, 1])
})

test('revenue accepts real numeric values and numeric strings and preserves hourly data', () => {
  const report = normalizeOverviewRevenue({
    from: '2026-10-15',
    to: '2026-10-15',
    revenue: '150000',
    invoice_count: '2',
    hourly: [
      { hour: '13', revenue: '50000', label: '13:00–14:00' },
      { hour: 9, revenue: 100000, label: '09:00–10:00' },
    ],
  }, '2026-10-15')
  assert.equal(report.revenue, 150000)
  assert.equal(report.invoice_count, 2)
  assert.equal(report.no_data, false)
  assert.deepEqual(report.hourly.map(item => [item.hour, item.revenue]), [[9, 100000], [13, 50000]])
})

test('zero sales remains valid and missing opening-hour buckets are not fabricated', () => {
  const report = normalizeOverviewRevenue({ revenue: 0, invoice_count: 0, hourly: [] }, '2026-10-15')
  assert.equal(report.no_data, true)
  assert.equal(report.has_transactions, false)
  assert.deepEqual(report.hourly, [])
  const missingHours = normalizeOverviewRevenue({ revenue: 100000, invoice_count: 1, hourly: [] }, '2026-10-15')
  assert.deepEqual(missingHours.hourly, [])
  assert.equal(missingHours.no_data, false)
})

test('missing and invalid revenue fields fail visibly instead of becoming zero', () => {
  const valid = { revenue: 100000, invoice_count: 1, hourly: [{ hour: 9, revenue: 100000 }] }
  const invalidReports = [
    null,
    [],
    { ...valid, revenue: undefined },
    { ...valid, revenue: null },
    { ...valid, revenue: '' },
    { ...valid, revenue: ' ' },
    { ...valid, revenue: false },
    { ...valid, revenue: 'invalid' },
    { ...valid, revenue: -1 },
    { ...valid, revenue: Infinity },
    { ...valid, invoice_count: undefined },
    { ...valid, invoice_count: 1.5 },
    { ...valid, invoice_count: -1 },
    { ...valid, hourly: undefined },
    { ...valid, hourly: null },
    { ...valid, hourly: [{ hour: 9 }] },
    { ...valid, hourly: [{ hour: 24, revenue: 100000 }] },
    { ...valid, hourly: [{ hour: 9, revenue: 50000 }, { hour: 9, revenue: 50000 }] },
    { ...valid, from: '2026-10-14', to: '2026-10-15' },
    { ...valid, from: '2026-10-15', to: '2026-10-16' },
  ]
  for (const report of invalidReports) {
    assert.throws(() => normalizeOverviewRevenue(report, '2026-10-15'), /API|doanh thu/)
  }
})
