import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCashDifference, needsVarianceExplanation } from './shiftClose.js'

test('cash difference supports shortage and surplus', () => {
  assert.equal(calculateCashDifference(100000, 90000), -10000)
  assert.equal(calculateCashDifference(100000, 110000), 10000)
  assert.equal(calculateCashDifference(100000, 100000), 0)
})

test('explanation required only when absolute difference exceeds 50000', () => {
  assert.equal(needsVarianceExplanation(50000), false)
  assert.equal(needsVarianceExplanation(-50000), false)
  assert.equal(needsVarianceExplanation(50001), true)
  assert.equal(needsVarianceExplanation(-50001), true)
})

test('difference is unavailable until counted cash is entered', () => {
  assert.equal(calculateCashDifference(100000, null), null)
})
