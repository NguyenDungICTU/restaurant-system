import assert from 'node:assert/strict'
import test from 'node:test'
import { bookingOverlapsWindow, makeScheduleWindow } from './tableSchedule.js'

test('confirmed booking reserves the fixed 15-minute cleanup window', () => {
  const booking = {
    trang_thai: 'DA_XAC_NHAN',
    ngay_dat: '2026-10-11',
    gio_bat_dau: '18:00',
    thoi_luong_giu_ban: 90,
  }
  const cleanupWindow = makeScheduleWindow('2026-10-11', '19:35', '19:40')
  const afterCleanup = makeScheduleWindow('2026-10-11', '19:46', '19:50')
  assert.equal(bookingOverlapsWindow(booking, cleanupWindow), true)
  assert.equal(bookingOverlapsWindow(booking, afterCleanup), false)
})
