import {
  getCurrentTableStatusPresentation,
  statuses,
} from './tableMapStatus.js'

export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'

export function vietnamDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VIETNAM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = type => parts.find(part => part.type === type).value
  return `${value('year')}-${value('month')}-${value('day')}`
}

export function summarizeOverviewTables(tables, now = new Date()) {
  const summary = {
    total: tables.length,
    serving: 0,
    empty: 0,
    reserved: 0,
    cleaning: 0,
    unconfigured: 0,
    inactive: 0,
    other: 0,
  }
  const statusKeys = {
    [statuses.DANG_SU_DUNG]: 'serving',
    [statuses.TRONG]: 'empty',
    [statuses.DA_DAT]: 'reserved',
    [statuses.DANG_DON]: 'cleaning',
  }

  for (const table of tables) {
    if (!table.da_cau_hinh) {
      summary.unconfigured += 1
    } else if (table.trang_thai === 'NGUNG_SU_DUNG') {
      summary.inactive += 1
    } else {
      // Count physical tables, including secondary tables in a merged session.
      // A payment request keeps the physical table in DANG_SU_DUNG.
      const { label } = getCurrentTableStatusPresentation(table, now)
      summary[statusKeys[label] || 'other'] += 1
    }
  }

  return summary
}

export function summarizePendingPayments(sessions) {
  const waitingSessions = new Set()
  const waitingTables = new Set()

  for (const session of sessions) {
    if (session.trang_thai_phien !== 'CHO_THANH_TOAN') continue

    waitingSessions.add(session.phien_ban_id)
    // The current API supplies the representative ban_id of a merged group.
    // Include physical member IDs if a later API response also provides them.
    const tableIds = [session.ban_id, ...(session.ban_ids || [])]
    for (const tableId of tableIds) {
      if (tableId !== null && tableId !== undefined) waitingTables.add(tableId)
    }
  }

  return {
    tableCount: waitingTables.size,
    sessionCount: waitingSessions.size,
  }
}

export function sortOverviewBookings(rows) {
  return [...rows].sort((left, right) => {
    const timeDifference = bookingArrivalMinutes(left) - bookingArrivalMinutes(right)
    return timeDifference || Number(left.id) - Number(right.id)
  })
}

function bookingArrivalMinutes(booking) {
  const match = /^(\d{1,2}):(\d{2})/.exec(booking.khung_gio)
  if (!match) return Number.POSITIVE_INFINITY
  return Number(match[1]) * 60 + Number(match[2])
}

function requiredNumber(value, field, { integer = false } = {}) {
  const hasValue = typeof value === 'number' ||
    (typeof value === 'string' && value.trim() !== '')
  const number = hasValue ? Number(value) : Number.NaN
  if (!Number.isFinite(number) || number < 0 || (integer && !Number.isSafeInteger(number))) {
    throw new Error(`API báo cáo doanh thu thiếu hoặc trả dữ liệu không hợp lệ cho ${field}.`)
  }
  return number
}

export function normalizeOverviewRevenue(report, date) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    throw new Error('API chưa trả dữ liệu báo cáo doanh thu. Vui lòng thử lại.')
  }
  for (const field of ['from', 'to']) {
    if (Object.hasOwn(report, field) && report[field] !== date) {
      throw new Error('Báo cáo doanh thu không thuộc ngày hiện tại tại Việt Nam. Vui lòng tải lại.')
    }
  }

  const revenue = requiredNumber(report.revenue, 'revenue')
  const invoiceCount = requiredNumber(report.invoice_count, 'invoice_count', { integer: true })
  if (!Array.isArray(report.hourly)) {
    throw new Error('API chưa trả dữ liệu doanh thu theo giờ (hourly).')
  }

  const seenHours = new Set()
  const hourly = report.hourly.map(item => {
    const hour = requiredNumber(item?.hour, 'hourly.hour', { integer: true })
    if (hour > 23 || seenHours.has(hour)) {
      throw new Error('API trả khung giờ doanh thu không hợp lệ hoặc bị trùng.')
    }
    seenHours.add(hour)
    const amount = requiredNumber(item?.revenue, 'hourly.revenue')
    return {
      ...item,
      hour,
      revenue: amount,
      label: typeof item.label === 'string' && item.label.trim()
        ? item.label
        : `${String(hour).padStart(2, '0')}:00–${String((hour + 1) % 24).padStart(2, '0')}:00`,
    }
  }).sort((left, right) => left.hour - right.hour)

  return {
    ...report,
    revenue,
    invoice_count: invoiceCount,
    hourly,
    no_data: invoiceCount === 0,
    has_transactions: invoiceCount > 0,
  }
}
