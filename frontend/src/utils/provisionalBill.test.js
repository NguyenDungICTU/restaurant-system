import test from 'node:test'
import assert from 'node:assert/strict'
import { escapeHtml, formatVnd } from './provisionalBill.js'

test('escapeHtml protects user-provided note and names in print document', () => {
  assert.equal(escapeHtml('<script>alert("x")</script>'), '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;')
})

test('formatVnd formats integer VND with Vietnamese separators', () => {
  assert.equal(formatVnd(135000), '135.000 đ')
})
