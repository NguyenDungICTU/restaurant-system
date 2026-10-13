import test from 'node:test'
import assert from 'node:assert/strict'
import { canReportTableCleaned, isCleanupOverdue } from './tableCleanup.js'

const table = {
  da_cau_hinh: true,
  trang_thai: 'DANG_DON',
  trang_thai_changed_at: '2026-10-13T04:00:00.000Z',
}

test('only configured cleaning tables show cleanup-complete action to service staff', () => {
  assert.equal(canReportTableCleaned(table, 'PHUC_VU'), true)
  assert.equal(canReportTableCleaned(table, 'QUAN_LY'), true)
  assert.equal(canReportTableCleaned({ ...table, trang_thai: 'TRONG' }, 'PHUC_VU'), false)
  assert.equal(canReportTableCleaned(table, 'BEP'), false)
  assert.equal(canReportTableCleaned(table, 'PHUC_VU', 'schedule'), false)
})

test('cleanup warning appears at 10 minutes, not before', () => {
  const start = new Date(table.trang_thai_changed_at).getTime()
  assert.equal(isCleanupOverdue(table, start + 9 * 60 * 1000), false)
  assert.equal(isCleanupOverdue(table, start + 10 * 60 * 1000), true)
  assert.equal(isCleanupOverdue({ ...table, trang_thai: 'TRONG' }, start + 60 * 60 * 1000), false)
})
