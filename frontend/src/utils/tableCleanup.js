export function canReportTableCleaned(table, role, viewMode = 'current') {
  return (
    viewMode === 'current' &&
    Boolean(table?.da_cau_hinh) &&
    ['QUAN_LY', 'PHUC_VU'].includes(role) &&
    table?.trang_thai === 'DANG_DON'
  )
}

export function isCleanupOverdue(table, nowMs = Date.now()) {
  if (table?.trang_thai !== 'DANG_DON' || !table?.trang_thai_changed_at) {
    return false
  }
  const startedAt = new Date(table.trang_thai_changed_at).getTime()
  return Number.isFinite(startedAt) && nowMs - startedAt >= 10 * 60 * 1000
}
