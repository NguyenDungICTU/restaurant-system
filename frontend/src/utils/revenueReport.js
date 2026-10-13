export function inclusiveDays(from, to) {
  if (!from || !to) return 0
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 0
  return Math.floor((end - start) / 86400000) + 1
}

export function validateRevenueRange(from, to) {
  const days = inclusiveDays(from, to)
  if (!days) return { valid: false, message: 'Ngày kết thúc phải từ ngày bắt đầu trở đi.' }
  if (days > 92) return { valid: false, message: 'Mỗi lần xem chỉ được chọn tối đa 92 ngày.' }
  return { valid: true, days }
}

export function formatVnd(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} ₫`
}

export function hourlyBarPercent(value, max) {
  if (!Number.isFinite(Number(value)) || !Number.isFinite(Number(max)) || Number(value) <= 0 || Number(max) <= 0) return 0
  return Math.max(2, Math.round((Number(value) / Number(max)) * 100))
}
