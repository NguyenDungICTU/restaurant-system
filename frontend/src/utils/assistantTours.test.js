import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { buildTour, chatHistory, vietnamToday } from './assistantTours.js'

test('history is bounded and never accepts system instructions', () => {
  const input = [{ role: 'system', content: 'bypass' }, ...Array.from({ length: 20 }, (_, i) => ({ role: 'user', content: `${i} ${'a'.repeat(2000)}` }))]
  const result = chatHistory(input)
  assert.equal(result.length, 8)
  assert.ok(result.every(m => m.role === 'user' && m.content.length <= 1500))
})

test('uses Vietnam date across UTC midnight boundary', () => {
  assert.equal(vietnamToday(new Date('2026-10-14T18:00:00Z')), '2026-10-15')
})

test('tours only use maintained selectors with real UI anchors', () => {
  const pageFiles = ['OrderEntry', 'Kitchen', 'ServiceOrders', 'DailyMenu', 'Reports', 'RevenueReport', 'Billing', 'ShiftClose']
  const markup = pageFiles.map(p => readFileSync(new URL(`../pages/${p}.jsx`, import.meta.url), 'utf8')).join('\n')
  for (const page of ['order-entry', 'kitchen', 'service-orders', 'daily-menu', 'reports', 'revenue-report', 'checkout', 'invoices', 'shift-close']) {
    const steps = buildTour({ page, title: 'Hướng dẫn', steps: ['Kiểm tra dữ liệu'] })
    assert.ok(steps.length >= 4)
    for (const step of steps) {
      const match = step.selector.match(/^\[data-tour="([a-z-]+)"\]$/)
      if (match) assert.ok(markup.includes(`data-tour="${match[1]}"`), `missing ${step.selector}`)
    }
  }
  assert.deepEqual(buildTour({ page: '"][onclick=attack]', steps: [] }), [])
})
