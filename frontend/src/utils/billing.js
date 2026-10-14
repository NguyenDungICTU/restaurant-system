export function calculateDiscount(subtotal, type = 'NONE', value = 0) {
  const total = Number(subtotal)
  const amount = Number(value || 0)
  if (!Number.isFinite(total) || total < 0 || !Number.isFinite(amount) || amount < 0) throw new Error('Số tiền không hợp lệ')
  let discount = 0
  if (type === 'PERCENT') {
    if (amount > 50) throw new Error('Giảm giá phần trăm tối đa 50%')
    discount = Math.round(total * amount / 100)
  } else if (type === 'AMOUNT') {
    if (amount > total / 2) throw new Error('Giảm giá theo số tiền tối đa 50% tổng tiền hàng')
    discount = amount
  } else if (type !== 'NONE') throw new Error('Loại giảm giá không hợp lệ')
  return { discount, total: total - discount }
}
export function formatVnd(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`
}
