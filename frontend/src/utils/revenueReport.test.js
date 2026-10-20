import test from 'node:test'
import assert from 'node:assert/strict'
import { inclusiveDays, validateRevenueRange, hourlyBarPercent, formatVnd } from './revenueReport.js'

test('range counts both endpoints and permits exactly 92 days', () => {
  assert.equal(inclusiveDays('2026-01-01', '2026-01-01'), 1)
  assert.equal(validateRevenueRange('2026-01-01', '2026-04-02').valid, true)
  assert.equal(validateRevenueRange('2026-01-01', '2026-04-03').valid, false)
})

test('range rejects reversed and missing dates', () => {
  assert.equal(validateRevenueRange('2026-02-02', '2026-02-01').valid, false)
  assert.equal(validateRevenueRange('', '2026-02-01').valid, false)
})

test('bar percentage is bounded and zero revenue remains zero', () => {
  assert.equal(hourlyBarPercent(0, 100), 0)
  assert.equal(hourlyBarPercent(50, 100), 50)
  assert.equal(hourlyBarPercent(100, 100), 100)
  assert.equal(hourlyBarPercent(1, 100), 2)
})

test('currency uses Vietnamese number formatting', () => {
  assert.match(formatVnd(125000), /125\.000/)
})
