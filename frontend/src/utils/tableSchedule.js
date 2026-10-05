function dayNumber(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '')
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month, day)
  const parsed = new Date(timestamp)

  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null
  }

  return timestamp
}

function minuteOfDay(value) {
  const match = /^(\d{2}):(\d{2})/.exec(value || '')
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null

  return hours * 60 + minutes
}

export function timeToMinute(value) {
  return minuteOfDay(value)
}

export function minuteToTime(value) {
  if (!Number.isInteger(value) || value < 0 || value > 1439) {
    return ''
  }

  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(
    value % 60
  ).padStart(2, '0')}`
}

function timestamp(day, minute) {
  return day + minute * 60_000
}

export function makeScheduleWindow(date, startTime, endTime) {
  const day = dayNumber(date)
  const startMinute = minuteOfDay(startTime)
  const endMinute = minuteOfDay(endTime)

  if (
    day == null ||
    startMinute == null ||
    endMinute == null ||
    startMinute === endMinute
  ) {
    return null
  }

  const start = timestamp(day, startMinute)
  let end = timestamp(day, endMinute)
  if (endMinute < startMinute) {
    end += 24 * 60 * 60_000
  }

  return { start, end }
}

export function bookingOverlapsWindow(booking, window) {
  if (
    !window ||
    booking?.trang_thai !== 'DA_XAC_NHAN' ||
    !Number.isFinite(Number(booking.thoi_luong_giu_ban)) ||
    Number(booking.thoi_luong_giu_ban) <= 0
  ) {
    return false
  }

  const day = dayNumber(booking.ngay_dat)
  const startMinute = minuteOfDay(booking.gio_bat_dau)
  if (day == null || startMinute == null) return false

  const start = timestamp(day, startMinute)
  const end =
    start + Number(booking.thoi_luong_giu_ban) * 60_000

  return start < window.end && window.start < end
}

export function groupBookingsByTableInWindow(bookings, window) {
  const grouped = new Map()
  if (!window) return grouped

  for (const booking of bookings) {
    if (
      booking.ban_id == null ||
      !bookingOverlapsWindow(booking, window)
    ) {
      continue
    }

    const existing = grouped.get(booking.ban_id) || []
    existing.push(booking)
    grouped.set(booking.ban_id, existing)
  }

  return grouped
}

export function groupConfirmedBookingsByTableOnDate(bookings, date) {
  const grouped = new Map()
  const day = dayNumber(date)
  if (day == null) return grouped

  const dateWindow = {
    start: day,
    end: day + 24 * 60 * 60_000,
  }

  for (const booking of bookings) {
    if (
      booking.ban_id == null ||
      !bookingOverlapsWindow(booking, dateWindow)
    ) {
      continue
    }

    const existing = grouped.get(booking.ban_id) || []
    existing.push(booking)
    grouped.set(booking.ban_id, existing)
  }

  for (const rows of grouped.values()) {
    rows.sort((left, right) =>
      `${left.ngay_dat}T${left.gio_bat_dau}`.localeCompare(
        `${right.ngay_dat}T${right.gio_bat_dau}`
      )
    )
  }

  return grouped
}

export function bookingEndTime(booking) {
  const start = minuteOfDay(booking?.gio_bat_dau)
  const duration = Number(booking?.thoi_luong_giu_ban)
  if (
    start == null ||
    !Number.isInteger(duration) ||
    duration <= 0
  ) {
    return null
  }

  const end = start + duration
  return {
    time: minuteToTime(end % (24 * 60)),
    nextDay: end >= 24 * 60,
  }
}

export function isBookingWindowValid(date, startTime, endTime) {
  return makeScheduleWindow(date, startTime, endTime) !== null
}
