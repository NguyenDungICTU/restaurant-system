import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateDiscount, formatVnd } from './billing.js'

test('discount percentage is calculated and rounded to VND', () => {
  assert.deepEqual(calculateDiscount(101000, 'PERCENT', 10), { discount: 10100, total: 90900 })
})
test('percentage discount cannot exceed 50%', () => {
  assert.throws(() => calculateDiscount(100000, 'PERCENT', 51), /50%/)
})
test('fixed discount cannot exceed subtotal', () => {
  assert.throws(() => calculateDiscount(100000, 'AMOUNT', 50001), /50%/)
})
test('zero discount preserves subtotal', () => {
  assert.deepEqual(calculateDiscount(45000, 'NONE', 0), { discount: 0, total: 45000 })
})
test('currency is formatted in Vietnamese dong', () => {
  assert.equal(formatVnd(135000), '135.000 đ')
})
