import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  AppstoreOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseOutlined,
  DeleteOutlined,
  EditOutlined,
  FilePdfOutlined,
  MoreOutlined,
  PlusOutlined,
  SearchOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import {
  Alert,
  Button,
  Descriptions,
  Dropdown,
  Form,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Slider,
  Table,
  Tag,
  Space,
} from 'antd'

import {
  createTable,
  createTableMapEventStream,
  deleteTable,
  downloadQR,
  getAreas,
  getArrivalBookings,
  getBookings,
  getOpeningSettings,
  getTables,
  getTableDetails,
  receiveTableGuests,
  regenerateQR,
  SESSION_EXPIRED_EVENT,
  SESSION_ENDING_EVENT,
  updateTable,
} from '../services/api'
import { formatAreaName, formatTableName } from '../utils/areaNames'
import {
  bookingEndTime,
  groupConfirmedBookingsByTableOnDate,
  groupBookingsByTableInWindow,
  makeScheduleWindow,
  minuteToTime,
  timeToMinute,
} from '../utils/tableSchedule'
import {
  getTableStatusPresentation,
  statusColors,
  statuses,
  unconfiguredColors,
} from '../utils/tableMapStatus'
import './Ban.css'
import './RestaurantManagement.css'

const types = {
  THUONG: 'Bàn thường',
  PHONG_RIENG: 'Phòng riêng',
}

const options = values =>
  Object.entries(values).map(([value, label]) => ({
    value,
    label,
  }))

function QRActionIcon({ rotate = false }) {
  return (
    <svg
      className="management-qr-icon"
      viewBox="0 0 28 28"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <g stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M2 2h8v8H2zM15 2h8v8h-8zM2 15h8v8H2z" />
        <path d="M5 5h2v2H5zM18 5h2v2h-2zM5 18h2v2H5z" fill="currentColor" stroke="none" />
        <path d="M12 2v3m0 3v5H7m-5 0h2m9 3v-3h4m3 0h3M12 20v3" />
      </g>
      <g stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {rotate ? (
          <>
            <path d="M16 19a5 5 0 0 1 8.5-2L26 19m0-4v4h-4" />
            <path d="M26 22a5 5 0 0 1-8.5 3L16 23m0 4v-4h4" />
          </>
        ) : (
          <>
            <path d="M21 15v8m-3-3 3 3 3-3" />
            <path d="M16 24v3h10v-3" />
          </>
        )}
      </g>
    </svg>
  )
}

function TableTopView({ className = '' }) {
  return (
    <svg
      aria-hidden="true"
      className={`table-top-view ${className}`}
      viewBox="0 0 120 96"
      role="img"
    >
      <g fill="#72502f" stroke="#4a3320" strokeWidth="2">
        <rect x="45" y="2" width="30" height="14" rx="7" />
        <rect x="45" y="80" width="30" height="14" rx="7" />
        <rect x="3" y="33" width="14" height="30" rx="7" />
        <rect x="103" y="33" width="14" height="30" rx="7" />
      </g>
      <rect
        x="24"
        y="19"
        width="72"
        height="58"
        rx="9"
        fill="#8b6239"
        stroke="#50381f"
        strokeWidth="3"
      />
      <rect
        x="30"
        y="25"
        width="60"
        height="46"
        rx="5"
        fill="#9c7044"
        stroke="#b28a60"
        strokeWidth="1.5"
      />
      <path
        d="M35 30h50M35 66h50"
        fill="none"
        opacity=".28"
        stroke="#e3c29b"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function openingHourMarks(openMinute, closeMinute) {
  const marks = {}
  const firstEvenHour = Math.ceil(openMinute / 120) * 120
  marks[openMinute] = minuteToTime(openMinute)
  for (let minute = firstEvenHour; minute < closeMinute; minute += 120) {
    marks[minute] = minuteToTime(minute)
  }
  marks[closeMinute] = minuteToTime(closeMinute)
  return marks
}

function exactTimeToMinute(value) {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null
  return timeToMinute(value)
}

function errorText(error) {
  const detail = error.response?.data?.detail

  if (typeof detail === 'string') return detail
  if (detail?.message) return detail.message

  return error?.message || 'Không thể thực hiện. Kiểm tra dữ liệu và thử lại.'
}

function isCanceledRequest(error) {
  return (
    error?.code === 'ERR_CANCELED' ||
    error?.name === 'CanceledError' ||
    error?.name === 'AbortError'
  )
}

function formatVietnamDateTime(value) {
  if (!value) return 'Chưa có thông tin'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Chưa có thông tin'

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date)
}

function vietnamDateInput() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  )

  return `${values.year}-${values.month}-${values.day}`
}

function formatVnd(value) {
  if (value == null || !Number.isFinite(Number(value))) {
    return 'Chưa có thông tin'
  }

  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value))
}

function floorNumber(name) {
  const match = /^t(?:ầng)?\s*(\d+)$/i.exec(name.trim())

  return match ? Number(match[1]) : null
}

function sortAreasByFloor(areas) {
  return [...areas].sort((left, right) => {
    const leftFloor = floorNumber(left.ten_khu_vuc)
    const rightFloor = floorNumber(right.ten_khu_vuc)

    if (leftFloor !== null && rightFloor === null) return -1
    if (leftFloor === null && rightFloor !== null) return 1
    if (leftFloor !== null && rightFloor !== null && leftFloor !== rightFloor) {
      return leftFloor - rightFloor
    }

    const orderDifference =
      left.thu_tu_hien_thi - right.thu_tu_hien_thi

    return (
      orderDifference ||
      left.ten_khu_vuc.localeCompare(
        right.ten_khu_vuc,
        'vi',
        { sensitivity: 'base', numeric: true }
      )
    )
  })
}

export default function Ban({ user }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const isManager = user?.role === 'QUAN_LY'
  const canReceiveGuests = ['QUAN_LY', 'PHUC_VU'].includes(user?.role)
  const [tables, setTables] = useState([])
  const [areas, setAreas] = useState([])
  const [areaId, setAreaId] = useState()
  const [areaFilterId, setAreaFilterId] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(null)
  const [open, setOpen] = useState(false)
  const [notice, setNotice] = useState(null)
  const [checkInTable, setCheckInTable] = useState(null)
  const [checkInBookings, setCheckInBookings] = useState([])
  const [selectedBookingId, setSelectedBookingId] = useState()
  const [checkInLoading, setCheckInLoading] = useState(false)
  const [checkInError, setCheckInError] = useState('')
  const [detailTable, setDetailTable] = useState(null)
  const [detailData, setDetailData] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailReloadKey, setDetailReloadKey] = useState(0)
  const [connectionLost, setConnectionLost] = useState(false)
  const [viewMode, setViewMode] = useState('current')
  const [scheduleDate, setScheduleDate] = useState(vietnamDateInput)
  const [scheduleStartTime, setScheduleStartTime] = useState('00:00')
  const [scheduleEndTime, setScheduleEndTime] = useState('23:59')
  const [scheduleBookings, setScheduleBookings] = useState([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleHours, setScheduleHours] = useState(null)
  const [scheduleHoursLoading, setScheduleHoursLoading] = useState(true)
  const [scheduleHoursError, setScheduleHoursError] = useState('')

  const [form] = Form.useForm()
  const detailTableRef = useRef(detailTable)
  const detailRequestIdRef = useRef(0)
  const refreshVersionRef = useRef(0)
  const tableListRequestRef = useRef(null)
  const viewModeRef = useRef(viewMode)
  const scheduleRefreshRef = useRef(null)
  const selectedTableId = detailTable?.id ?? null

  const loadTablesFresh = useCallback(async (
    freshAfterCurrent = false,
    signal
  ) => {
    if (freshAfterCurrent) {
      while (tableListRequestRef.current) {
        await tableListRequestRef.current.catch(() => {})
      }
    } else if (tableListRequestRef.current) {
      return tableListRequestRef.current
    }

    signal?.throwIfAborted()
    const request = getTables(undefined, { signal })
    tableListRequestRef.current = request
    try {
      return await request
    } finally {
      if (tableListRequestRef.current === request) {
        tableListRequestRef.current = null
      }
    }
  }, [])

  const sortedAreas = useMemo(
    () => sortAreasByFloor(areas),
    [areas]
  )

  const activeAreas = areas.filter(
    area => area.trang_thai === 'HOAT_DONG'
  )
  const scheduleWindow = useMemo(
    () => {
      if (!scheduleHours) return null
      const startMinute = exactTimeToMinute(scheduleStartTime)
      const endMinute = exactTimeToMinute(scheduleEndTime)
      if (
        startMinute == null ||
        endMinute == null ||
        startMinute < scheduleHours.openMinute ||
        startMinute >= endMinute ||
        endMinute > scheduleHours.closeMinute
      ) {
        return null
      }

      return makeScheduleWindow(
        scheduleDate,
        scheduleStartTime,
        scheduleEndTime
      )
    },
    [
      scheduleDate,
      scheduleEndTime,
      scheduleHours,
      scheduleStartTime,
    ]
  )
  const bookingsByTable = useMemo(() => {
    return groupBookingsByTableInWindow(
      scheduleBookings,
      scheduleWindow
    )
  }, [scheduleBookings, scheduleWindow])
  const bookingsByDate = useMemo(
    () =>
      groupConfirmedBookingsByTableOnDate(
        scheduleBookings,
        scheduleDate
      ),
    [scheduleBookings, scheduleDate]
  )

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const [year, month, day] = scheduleDate.split('-').map(Number)
    const dateIsValid =
      Boolean(year && month && day) &&
      new Date(Date.UTC(year, month - 1, day))
        .toISOString()
        .startsWith(scheduleDate)

    if (!dateIsValid) {
      setScheduleHoursLoading(false)
      setScheduleHoursError('Ngày đã chọn không hợp lệ.')
      return undefined
    }

    getOpeningSettings({ signal: controller.signal })
      .then(settings => {
        if (!active) return

        const weekday =
          (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) %
          7
        const specialDay = (settings.ngay_nghi || []).find(
          holiday => holiday.ngay === scheduleDate
        )
        const daySettings = (settings.ngay || []).find(
          item => item.thu === weekday
        )

        if (
          specialDay ||
          !daySettings ||
          daySettings.la_ngay_nghi ||
          !daySettings.gio_mo_cua ||
          !daySettings.gio_dong_cua
        ) {
          setScheduleHours(null)
          setScheduleHoursError(
            specialDay
              ? `Nhà hàng nghỉ: ${specialDay.ten_ngay_nghi}.`
              : daySettings?.la_ngay_nghi
                ? 'Nhà hàng nghỉ theo lịch tuần trong ngày đã chọn.'
                : 'Chưa có giờ hoạt động được cấu hình cho ngày này.'
          )
          setScheduleHoursLoading(false)
          return
        }

        const opensAt = String(daySettings.gio_mo_cua).slice(0, 5)
        const closesAt = String(daySettings.gio_dong_cua).slice(0, 5)
        const openMinute = timeToMinute(opensAt)
        const closeMinute = timeToMinute(closesAt)
        if (
          openMinute == null ||
          closeMinute == null ||
          closeMinute <= openMinute
        ) {
          setScheduleHours(null)
          setScheduleHoursError(
            'Giờ hoạt động trong cấu hình chưa hợp lệ.'
          )
          setScheduleHoursLoading(false)
          return
        }
        setScheduleHours({
          opensAt,
          closesAt,
          openMinute,
          closeMinute,
        })
        setScheduleHoursError('')
        setScheduleStartTime(current =>
          timeToMinute(current) != null &&
          timeToMinute(current) >= timeToMinute(opensAt) &&
          timeToMinute(current) < timeToMinute(closesAt)
            ? current
            : opensAt
        )
        setScheduleEndTime(current =>
          timeToMinute(current) != null &&
          timeToMinute(current) > timeToMinute(opensAt) &&
          timeToMinute(current) <= timeToMinute(closesAt)
            ? current
            : closesAt
        )
        setScheduleHoursLoading(false)
      })
      .catch(error => {
        if (!active || isCanceledRequest(error)) return
        setScheduleHours(null)
        setScheduleHoursError(errorText(error))
        setScheduleHoursLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [scheduleDate])

  useEffect(() => {
    let active = true
    let stopped = false
    let snapshotRunning = false
    let snapshotPending = false
    let pendingClearWarning = false
    let pendingRefreshDetail = false
    let streamConnected = false
    let closeEventStream = () => {}
    let snapshotRetryTimer
    let snapshotRetryDelay = 1000
    const controller = new AbortController()

    function stopSync() {
      stopped = true
      window.clearTimeout(snapshotRetryTimer)
      closeEventStream()
      controller.abort()
    }

    function scheduleSnapshotRetry() {
      window.clearTimeout(snapshotRetryTimer)
      snapshotRetryTimer = window.setTimeout(() => {
        refreshVersionRef.current += 1
        void refreshSnapshot({
          afterReconnect: streamConnected,
          refreshDetail: true,
        })
      }, snapshotRetryDelay)
      snapshotRetryDelay = Math.min(snapshotRetryDelay * 2, 30000)
    }

    function handleRequestError(error) {
      if (isCanceledRequest(error) || !active || stopped) return
      if (error.response?.status === 401) {
        setConnectionLost(false)
        stopSync()
      } else if (error.response?.status === 403) {
        setConnectionLost(false)
        setNotice({
          type: 'error',
          title: 'Bạn không có quyền xem sơ đồ bàn.',
        })
        stopSync()
      } else {
        setConnectionLost(true)
        scheduleSnapshotRetry()
      }
    }

    async function refreshSnapshot({
      initial = false,
      afterReconnect = false,
      refreshDetail = false,
    } = {}) {
      if (!active || stopped) return
      if (snapshotRunning) {
        snapshotPending = true
        pendingClearWarning ||= afterReconnect
        pendingRefreshDetail ||= refreshDetail
        return
      }

      snapshotRunning = true

      try {
        do {
          snapshotPending = false
          const clearWarning =
            afterReconnect || pendingClearWarning
          const refreshSelectedDetail =
            refreshDetail || pendingRefreshDetail
          pendingClearWarning = false
          pendingRefreshDetail = false
          const requestVersion = refreshVersionRef.current
          const includeBookings =
            viewModeRef.current === 'schedule'

          if (includeBookings) setScheduleLoading(true)

          try {
            const [rows, regions, bookings] = await Promise.all([
              loadTablesFresh(false, controller.signal),
              getAreas({ signal: controller.signal }),
              includeBookings
                ? getBookings({ signal: controller.signal })
                : Promise.resolve(null),
            ])

            if (!active || stopped) return
            if (requestVersion !== refreshVersionRef.current) {
              snapshotPending = true
              continue
            }

            setTables(rows)
            setAreas(regions)
            if (
              bookings &&
              viewModeRef.current === 'schedule'
            ) {
              setScheduleBookings(bookings)
              setScheduleLoading(false)
            }
            setAreaId(currentAreaId => {
              const orderedAreas = sortAreasByFloor(regions)
              return orderedAreas.some(
                area => area.id === currentAreaId
              )
                ? currentAreaId
                : orderedAreas[0]?.id
            })
            if (streamConnected) {
              window.clearTimeout(snapshotRetryTimer)
              snapshotRetryDelay = 1000
              setConnectionLost(false)
            }
            if (clearWarning && streamConnected) {
              setNotice(current =>
                current?.title ===
                'Bạn không có quyền xem sơ đồ bàn.'
                  ? null
                  : current
              )
            }

            const selectedTable = detailTableRef.current
            if (selectedTable) {
              const refreshedTable = rows.find(
                table => table.id === selectedTable.id
              )
              if (refreshedTable) {
                if (refreshSelectedDetail) {
                  detailTableRef.current = refreshedTable
                  setDetailTable(refreshedTable)
                  detailRequestIdRef.current += 1
                  setDetailReloadKey(current => current + 1)
                }
              } else {
                detailRequestIdRef.current += 1
                setDetailData(null)
                setDetailError(
                  'Bàn này không còn trong danh sách hiện tại.'
                )
                setDetailLoading(false)
              }
            }
          } catch (error) {
            if (
              requestVersion !== refreshVersionRef.current &&
              !stopped
            ) {
              snapshotPending = true
              continue
            }
            if (viewModeRef.current === 'schedule') {
              setScheduleLoading(false)
            }
            handleRequestError(error)
            break
          }
        } while (snapshotPending && active && !stopped)
      } finally {
        snapshotRunning = false
        if (initial && active) setLoading(false)
      }
    }

    function handleTableEvent(event) {
      refreshVersionRef.current += 1
      const selected = detailTableRef.current
      const tableId = event.table?.id
      const affectedTableIds = event.table_ids
      const refreshDetail =
        selected != null &&
        (event.type === 'table_changed'
          ? selected.id === tableId
          : event.type === 'bookings_changed' &&
            (!affectedTableIds?.length ||
              affectedTableIds.includes(selected.id)))

      void refreshSnapshot({ refreshDetail })
    }

    function handleEvent(event) {
      if (event.type === 'ready') {
        refreshVersionRef.current += 1
        void refreshSnapshot({
          afterReconnect: true,
          refreshDetail: true,
        })
      } else {
        handleTableEvent(event)
      }
    }

    function handleStreamStatus(status) {
      if (status === 'connected') {
        streamConnected = true
      } else if (status === 'disconnected') {
        streamConnected = false
        setConnectionLost(true)
      } else if (status === 'forbidden') {
        streamConnected = false
        setConnectionLost(false)
        setNotice({
          type: 'error',
          title: 'Bạn không có quyền xem sơ đồ bàn.',
        })
        stopSync()
      }
    }

    function onVisibilityChange() {
      if (!document.hidden && !stopped) {
        refreshVersionRef.current += 1
        void refreshSnapshot({
          afterReconnect: streamConnected,
          refreshDetail: true,
        })
      }
    }

    function onSessionEnding() {
      stopSync()
    }

    function onSessionExpired() {
      stopSync()
    }

    scheduleRefreshRef.current = () => {
      refreshVersionRef.current += 1
      void refreshSnapshot()
    }

    void refreshSnapshot({ initial: true })
    closeEventStream = createTableMapEventStream(
      handleEvent,
      handleStreamStatus
    )
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener(SESSION_ENDING_EVENT, onSessionEnding)
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)

    return () => {
      active = false
      stopSync()
      scheduleRefreshRef.current = null
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener(SESSION_ENDING_EVENT, onSessionEnding)
      window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired)
    }
  }, [loadTablesFresh])

  useEffect(() => {
    viewModeRef.current = viewMode
  }, [viewMode])

  useEffect(() => {
    if (viewMode === 'schedule') {
      scheduleRefreshRef.current?.()
    }
  }, [viewMode, scheduleDate])

  useEffect(() => {
    detailTableRef.current = detailTable
  }, [detailTable])

  useEffect(() => {
    if (!detailTable) return undefined

    let active = true
    const requestId = ++detailRequestIdRef.current
    const controller = new AbortController()

    getTableDetails(detailTable.id, { signal: controller.signal })
      .then(data => {
        if (
          active &&
          requestId === detailRequestIdRef.current
        ) {
          setDetailData(data)
          setDetailError('')
          setDetailLoading(false)
        }
      })
      .catch(error => {
        if (
          active &&
          requestId === detailRequestIdRef.current
        ) {
          if (!isCanceledRequest(error)) {
            setDetailError(errorText(error))
          }
          setDetailLoading(false)
        }
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [detailTable, detailReloadKey])

  function openTableDetails(table) {
    detailRequestIdRef.current += 1
    detailTableRef.current = table
    setDetailData(null)
    setDetailError('')
    setDetailLoading(true)
    setDetailTable(table)
  }

  function closeTableDetails() {
    detailRequestIdRef.current += 1
    detailTableRef.current = null
    setDetailTable(null)
    setDetailData(null)
    setDetailError('')
    setDetailLoading(false)
  }

  function showCurrentView() {
    viewModeRef.current = 'current'
    setScheduleLoading(false)
    setViewMode('current')
  }

  function showScheduleView() {
    if (!scheduleWindow || !scheduleHours) return

    viewModeRef.current = 'schedule'
    setScheduleLoading(true)
    setViewMode('schedule')
  }

  function changeScheduleDate(value) {
    setScheduleHoursLoading(true)
    setScheduleHoursError('')
    setScheduleHours(null)
    setScheduleLoading(true)
    setScheduleDate(value)
  }

  function changeScheduleRange([start, end]) {
    setScheduleStartTime(minuteToTime(start))
    setScheduleEndTime(minuteToTime(end))
  }

  function openBooking(bookingId) {
    window.dispatchEvent(
      new CustomEvent('restaurant:open-booking', {
        detail: { bookingId },
      })
    )
  }

  function retryTableDetails() {
    setDetailData(null)
    setDetailError('')
    setDetailLoading(true)
    detailRequestIdRef.current += 1
    setDetailReloadKey(current => current + 1)
  }

  async function run(
    action,
    success,
    reload = true,
  ) {
    setBusy(true)
    setNotice(null)
    refreshVersionRef.current += 1

    try {
      const result = await action()

      if (reload) {
        setTables(await loadTablesFresh(true))
      }

      setNotice({
        type: 'success',
        title:
          typeof success === 'function'
            ? success(result)
            : success,
      })
      return result
    } catch (error) {
      setNotice({
        type: 'error',
        title: errorText(error),
      })
    } finally {
      setBusy(false)
    }
    return undefined
  }

  function edit(row) {
    setNotice(null)
    setEditing(row)

    form.resetFields()
    form.setFieldsValue({
      suc_chua_toi_thieu: row.da_cau_hinh
        ? row.suc_chua_toi_thieu
        : undefined,
      suc_chua_toi_da: row.da_cau_hinh
        ? row.suc_chua_toi_da
        : undefined,
      loai_ban: row.da_cau_hinh
        ? row.loai_ban
        : undefined,
    })

    setOpen(true)
  }

  async function save(values) {
    if (!editing) return

    const wasConfigured = editing.da_cau_hinh
    setBusy(true)
    setNotice(null)
    refreshVersionRef.current += 1

    try {
      const updated = await updateTable(editing.id, values)
      setTables(current =>
        current.some(table => table.id === updated.id)
          ? current.map(table =>
              table.id === updated.id ? updated : table
            )
          : [...current, updated]
      )
      setDetailTable(current =>
        current?.id === updated.id ? updated : current
      )
      setDetailData(current =>
        current?.id === updated.id
          ? { ...current, ...updated }
          : current
      )
      setOpen(false)
      setEditing(null)
      form.resetFields()
      setNotice({
        type: 'success',
        title: wasConfigured
          ? 'Đã cập nhật thông tin bàn.'
          : 'Đã cấu hình và kích hoạt bàn.',
      })

      try {
        setTables(await loadTablesFresh(true))
      } catch (error) {
        setNotice({
          type: 'warning',
          title: `Đã lưu cấu hình bàn nhưng không tải lại được sơ đồ. ${errorText(error)}`,
        })
      }
    } catch (error) {
      setNotice({
        type: 'error',
        title: errorText(error),
      })
    } finally {
      setBusy(false)
    }
  }

  async function startCheckIn(table) {
    setNotice(null)
    setCheckInTable(table)
    setCheckInBookings([])
    setSelectedBookingId(undefined)
    setCheckInError('')

    if (table.trang_thai !== 'DA_DAT') return

    setCheckInLoading(true)

    try {
      const bookings = await getArrivalBookings(table.id)
      setCheckInBookings(bookings)
      setSelectedBookingId(
        bookings.length === 1 ? bookings[0].id : undefined
      )
    } catch (error) {
      setCheckInError(errorText(error))

      if (error.response?.status === 409) {
        try {
          setTables(await loadTablesFresh(true))
          setCheckInTable(null)
          setNotice({
            type: 'error',
            title: errorText(error),
          })
        } catch (reloadError) {
          setCheckInError(
            `${errorText(error)} Không thể tải lại sơ đồ: ${errorText(reloadError)}`
          )
        }
      }
    } finally {
      setCheckInLoading(false)
    }
  }

  async function confirmCheckIn() {
    if (
      !checkInTable ||
      busy ||
      checkInLoading ||
      checkInError ||
      (checkInTable.trang_thai === 'DA_DAT' &&
        !selectedBookingId)
    ) {
      return
    }

    setBusy(true)
    setCheckInError('')
    refreshVersionRef.current += 1

    try {
      await receiveTableGuests(
        checkInTable.id,
        checkInTable.trang_thai === 'DA_DAT'
          ? selectedBookingId
          : undefined
      )
      setCheckInTable(null)

      const reloadErrors = []

      try {
        setTables(await loadTablesFresh(true))
      } catch (reloadError) {
        reloadErrors.push(
          `Không tải lại được sơ đồ: ${errorText(reloadError)}`
        )
      }

      if (detailTable?.id === checkInTable.id) {
        retryTableDetails()
      }

      if (reloadErrors.length === 0) {
        setNotice({
          type: 'success',
          title: 'Đã xác nhận khách vào bàn.',
        })
      } else {
        setNotice({
          type: 'error',
          title: `Đã nhận khách. ${reloadErrors.join(' ')}`,
        })
      }
    } catch (error) {
      if (error.response?.status === 409) {
        setCheckInTable(null)

        try {
          setTables(await loadTablesFresh(true))
          setNotice({
            type: 'error',
            title: errorText(error),
          })
        } catch (reloadError) {
          setNotice({
            type: 'error',
            title: `${errorText(error)} Không thể tải lại sơ đồ: ${errorText(reloadError)}`,
          })
        }
      } else {
        setCheckInError(errorText(error))
      }
    } finally {
      setBusy(false)
    }
  }

  function remove(row) {
    Modal.confirm({
      title: `Xóa bàn ${row.ma_ban}?`,
      content:
        'Bàn sẽ bị xóa vĩnh viễn và các mã QR của bàn không còn sử dụng được.',
      okText: 'Xóa bàn',
      cancelText: 'Hủy',
      okButtonProps: {
        className: 'table-map-delete-confirm-button',
      },
      onOk: () =>
        run(
          async () => {
            await deleteTable(row.id)

            setTables(current =>
              current.filter(
                table => table.id !== row.id
              )
            )

            if (editing?.id === row.id) {
              setOpen(false)
              setEditing(null)
              form.resetFields()
            }
          },
          'Đã xóa bàn.',
          false
        ),
    })
  }

  function rotate(row) {
    Modal.confirm({
      title: `Sinh lại QR cho ${row.ma_ban}?`,
      content:
        'QR cũ sẽ ngừng hiệu lực ngay. Ảnh QR mới sẽ tự tải về để bạn in lại.',
      okText: 'Sinh lại QR',
      cancelText: 'Hủy',
      onOk: async () => {
        setBusy(true)
        setNotice(null)
        refreshVersionRef.current += 1

        let regenerated = false

        try {
          const updated = await regenerateQR(
            row.id
          )

          regenerated = true

          setTables(current =>
            current.map(table =>
              table.id === row.id
                ? updated
                : table
            )
          )

          await downloadQR(
            `/api/ban/${row.id}/qr.png`,
            `ban-${row.id}-qr.png`
          )

          setNotice({
            type: 'success',
            title: 'Đã sinh và tải QR mới',
          })
        } catch (error) {
          setNotice({
            type: 'error',
            title: regenerated
              ? `QR đã được sinh lại và QR cũ đã vô hiệu, nhưng tải PNG thất bại. ${errorText(
                  error
                )} Bấm “Tải PNG” để tải lại QR hiện tại.`
              : `Không thể sinh QR mới. ${errorText(
                  error
                )}`,
          })
        } finally {
          setBusy(false)
        }
      },
    })
  }

  const columns = [
    {
      title: 'Mã bàn',
      dataIndex: 'ma_ban',
      align: 'center',
      render: value => (
        <strong className="management-table-code">{value}</strong>
      ),
    },
    {
      title: 'Khu vực',
      dataIndex: 'khu_vuc_id',
      align: 'center',
      render: id => (
        <span className="management-table-area">
          <AppstoreOutlined />
          <span>
            {areas.find(area => area.id === id)?.ten_khu_vuc || id}
          </span>
        </span>
      ),
    },
    {
      title: 'Sức chứa',
      align: 'center',
      render: (_, row) => (
        <span className="management-capacity">
          <TeamOutlined />
          <span>
            {row.suc_chua_toi_thieu}–{row.suc_chua_toi_da}{' '}
            <small>khách</small>
          </span>
        </span>
      ),
    },
    {
      title: 'Loại',
      dataIndex: 'loai_ban',
      align: 'center',
      render: value => types[value] || value || 'Chưa cấu hình',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      align: 'center',
      render: value => (
        <Tag
          className="management-status"
          color={
            {
              TRONG: 'green',
              DA_DAT: 'gold',
              DANG_SU_DUNG: 'blue',
              NGUNG_SU_DUNG: 'default',
            }[value]
          }
        >
          {statuses[value] || value}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      align: 'center',
      render: (_, row) => (
        <div className="management-table-actions">
          <div
            className="management-qr-actions"
            role="group"
            aria-label={`Thao tác QR · ${row.ma_ban}`}
          >
            {row.da_cau_hinh && (
              <>
                <Button
                  className="management-qr-download"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () =>
                        downloadQR(
                          `/api/ban/${row.id}/qr.png`,
                          `ban-${row.id}-qr.png`
                        ),
                      'Đã tải PNG.',
                      false
                    )
                  }
                  title="Tải mã QR định dạng PNG"
                  aria-label={`Tải QR PNG · ${row.ma_ban}`}
                  icon={<QRActionIcon />}
                />
                <Button
                  className="management-qr-rotate"
                  disabled={busy}
                  onClick={() => rotate(row)}
                  title="Đổi QR: sinh mã QR mới và vô hiệu hóa mã cũ"
                  aria-label={`Sinh lại QR · ${row.ma_ban}`}
                  icon={<QRActionIcon rotate />}
                />
              </>
            )}
          </div>
          <div
            className="management-record-actions"
            role="group"
            aria-label={`Thông tin bàn · ${row.ma_ban}`}
          >
            <Button
              disabled={busy}
              onClick={() => edit(row)}
              title="Sửa thông tin bàn"
              aria-label={`Sửa · ${row.ma_ban}`}
              icon={<EditOutlined />}
            />
            <Button
              className="table-map-delete-button"
              disabled={busy}
              onClick={() => remove(row)}
              title="Xóa bàn"
              aria-label={`Xóa · ${row.ma_ban}`}
              icon={<DeleteOutlined />}
            />
          </div>
        </div>
      ),
    },
  ]

  const visibleTables = tables.filter(
    table => table.khu_vuc_id === areaId
  )
  const tablesByArea = visibleTables.reduce(
    (groups, table) => {
      const group = groups.get(table.khu_vuc_id) || []
      group.push(table)
      groups.set(table.khu_vuc_id, group)
      return groups
    },
    new Map()
  )
  const areaGroups = [...tablesByArea].map(
    ([id, areaTables]) => ({
      id,
      name: formatAreaName(
        areas.find(area => area.id === id)
          ?.ten_khu_vuc || `Khu vực ${id}`
      ),
      tables: areaTables,
    })
  )
  const activeAreaName = formatAreaName(
    areas.find(area => area.id === areaId)?.ten_khu_vuc ||
      `Khu vực ${areaId}`
  )
  const scheduleMarks = scheduleHours
    ? openingHourMarks(
        scheduleHours.openMinute,
        scheduleHours.closeMinute
      )
    : undefined
  const openingMinute = scheduleHours?.openMinute ?? 0
  const closingMinute = scheduleHours?.closeMinute ?? 0
  const rangeStep = Math.min(30, closingMinute - openingMinute)
  const sliderStart = Math.max(
    openingMinute,
    Math.min(
      closingMinute - rangeStep,
      exactTimeToMinute(scheduleStartTime) ?? openingMinute
    )
  )
  const sliderEnd = Math.max(
    sliderStart + rangeStep,
    Math.min(
      closingMinute,
      exactTimeToMinute(scheduleEndTime) ?? closingMinute
    )
  )

  return (
    <section className="table-map-page">
      <div className="table-map-page-heading">
        <div>
          <h1>Quản lý bàn</h1>
          <p className="subheading">
            Theo dõi tình trạng bàn và lịch đặt theo thời gian thực.
          </p>
        </div>
        <div className="table-map-header-controls">
          <Input
            aria-label="Ngày xem lịch bàn"
            type="date"
            value={scheduleDate}
            onChange={event =>
              changeScheduleDate(event.target.value)
            }
            className="table-map-date-input"
          />
          <Segmented
            aria-label="Chế độ sơ đồ bàn"
            value={viewMode}
            options={[
              { label: 'Hiện tại', value: 'current' },
              {
                label: 'Lịch đặt',
                value: 'schedule',
                disabled:
                  !scheduleWindow ||
                  !scheduleHours ||
                  scheduleHoursLoading ||
                  loading,
              },
            ]}
            onChange={value => {
              if (value === 'current') showCurrentView()
              else showScheduleView()
            }}
          />
        </div>
      </div>

      {notice && (
        <Alert
          {...notice}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {connectionLost && (
        <Alert
          type="warning"
          showIcon
          title="Mất kết nối — dữ liệu có thể đã cũ. Đang thử kết nối lại..."
          style={{ marginBottom: 16 }}
        />
      )}

      {!loading && !activeAreas.length && (
        <Alert
          title="Hãy tạo hoặc kích hoạt khu vực trước khi thêm bàn."
          type="info"
          style={{ marginBottom: 16 }}
        />
      )}

      {isManager && (
        <div className="table-map-toolbar">
          <Button
            type="primary"
            className="table-map-add-button"
            disabled={
              loading ||
              busy ||
              !activeAreas.some(area => area.id === areaId)
            }
            onClick={() =>
              run(
                () => createTable(areaId),
                table =>
                  `Đã tạo ${formatTableName(
                    activeAreaName,
                    table.ma_ban
                  )}. Bàn đang chờ cấu hình.`
              )
            }
          >
            Thêm bàn
          </Button>
          <Button
            disabled={!areaId || busy}
            onClick={() =>
              run(
                () =>
                  downloadQR(
                    `/api/ban/khu-vuc/${areaId}/qr.pdf`,
                    `khu-vuc-${areaId}-qr.pdf`
                  ),
                'Đã tải PDF QR của khu vực.',
                false
              )
            }
          >
            Tải PDF QR
          </Button>
        </div>
      )}

      {viewMode === 'schedule' && scheduleHours && (
        <div className="table-map-time-range">
          <div className="table-map-time-range-heading">
            <span>Chọn khoảng giờ trong ngày</span>
            <strong>
              {scheduleStartTime} – {scheduleEndTime}
            </strong>
          </div>
          <Slider
            range
            min={scheduleHours.openMinute}
            max={scheduleHours.closeMinute}
            step={30}
            value={[sliderStart, sliderEnd]}
            marks={scheduleMarks}
            onChange={changeScheduleRange}
            aria-label="Chọn khoảng giờ lịch đặt"
          />
          <div className="table-map-time-inputs">
            <label>
              <span>Giờ bắt đầu</span>
              <Input
                aria-label="Giờ bắt đầu xem lịch"
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="HH:mm"
                value={scheduleStartTime}
                onChange={event => setScheduleStartTime(event.target.value)}
                onBlur={() => {
                  const minute = exactTimeToMinute(scheduleStartTime)
                  if (
                    minute == null ||
                    minute < scheduleHours.openMinute ||
                    minute >= scheduleHours.closeMinute
                  ) setScheduleStartTime(scheduleHours.opensAt)
                }}
              />
            </label>
            <label>
              <span>Giờ kết thúc</span>
              <Input
                aria-label="Giờ kết thúc xem lịch"
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="HH:mm"
                value={scheduleEndTime}
                onChange={event => setScheduleEndTime(event.target.value)}
                onBlur={() => {
                  const minute = exactTimeToMinute(scheduleEndTime)
                  if (
                    minute == null ||
                    minute <= scheduleHours.openMinute ||
                    minute > scheduleHours.closeMinute
                  ) setScheduleEndTime(scheduleHours.closesAt)
                }}
              />
            </label>
          </div>
          <p className="table-map-hours-note">
            Giờ hoạt động: {scheduleHours.opensAt} –{' '}
            {scheduleHours.closesAt}
          </p>
        </div>
      )}
      {scheduleHoursLoading && (
        <p role="status">Đang tải giờ hoạt động...</p>
      )}
      {scheduleHoursError && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          title={scheduleHoursError}
        />
      )}

      {!scheduleWindow && viewMode === 'schedule' && scheduleHours && (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
          title="Khoảng thời gian không hợp lệ. Hãy chọn giờ bắt đầu trước giờ kết thúc trong giờ hoạt động."
        />
      )}

      <article className="management-list-card">
        <div className="management-list-heading">
          <div>
            <h2>Danh sách bàn</h2>
            <p>Theo dõi không gian phục vụ và quản lý mã QR của từng bàn.</p>
          </div>
          <span className="management-count-label">
            {loading ? 'Đang tải…' : `${tables.length} bàn`}
          </span>
        </div>
        <div className="management-toolbar">
          <Input
            aria-label="Tìm mã bàn"
            placeholder="Tìm mã bàn…"
            prefix={<SearchOutlined />}
            allowClear
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
          <Select
            aria-label="Lọc tầng"
            value={areaFilterId}
            onChange={setAreaFilterId}
            className="management-filter"
            options={[
              { value: 'all', label: 'Tất cả khu vực' },
              ...areas.map(area => ({
                value: area.id,
                label: area.ten_khu_vuc,
              })),
            ]}
          />
          <Select
            aria-label="Lọc trạng thái bàn"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'Tất cả trạng thái' },
              ...options(statuses),
            ]}
            className="management-filter"
          />
          <Button
            icon={<FilePdfOutlined />}
            title="Chọn khu vực để tải PDF QR"
            disabled={areaFilterId === 'all' || busy}
            onClick={() =>
              run(
                () =>
                  downloadQR(
                    `/api/ban/khu-vuc/${areaFilterId}/qr.pdf`,
                    `khu-vuc-${areaFilterId}-qr.pdf`
                  ),
                'Đã tải PDF QR của khu vực.',
                false
              )
            }
          >
            Tải PDF khu vực
          </Button>
        </div>
        <Table
          className="management-operational-table"
          rowKey="id"
          loading={{ spinning: loading, description: 'Đang tải danh sách bàn…' }}
          dataSource={tables.filter(
            row =>
              (areaFilterId === 'all' ||
                row.khu_vuc_id === areaFilterId) &&
              (statusFilter === 'all' || row.trang_thai === statusFilter) &&
              String(row.ma_ban || '')
                .toLocaleLowerCase('vi')
                .includes(search.trim().toLocaleLowerCase('vi'))
          )}
          columns={columns}
          scroll={{ x: 950 }}
          locale={{
            emptyText: (
              <div className="management-empty">
                <AppstoreOutlined />
                <strong>
                  {tables.length
                    ? 'Không tìm thấy bàn phù hợp'
                    : 'Chưa có bàn nào'}
                </strong>
                <span>
                  {tables.length
                    ? 'Thử mã bàn, khu vực hoặc trạng thái khác.'
                    : 'Thêm bàn để bắt đầu quản lý không gian phục vụ.'}
                </span>
              </div>
            ),
          }}
        />
      </article>

      {loading ? (
        <p role="status">Đang tải sơ đồ bàn...</p>
      ) : areas.length === 0 ? (
        <p>Chưa có khu vực / tầng</p>
      ) : visibleTables.length === 0 ? (
        <p>Chưa có bàn.</p>
      ) : (
        <div
          className={`table-map-layout ${
            detailTable ? 'table-map-layout--detail-open' : ''
          }`}
        >
          <div className="table-map-schematic">
            <header className="table-map-schematic-heading">
              <div>
                <h2>Sơ đồ bàn — {activeAreaName}</h2>
                <p>
                  {viewMode === 'current'
                    ? 'Trạng thái hiện tại'
                    : `Lịch đặt ngày ${scheduleDate} · ${scheduleStartTime}–${scheduleEndTime}`}
                </p>
              </div>
              <div
                className="table-map-legend"
                aria-label={
                  viewMode === 'current'
                    ? 'Chú giải trạng thái hiện tại'
                    : 'Chú giải khả năng đặt'
                }
              >
                {(viewMode === 'current'
                  ? [
                      ...Object.entries(statusColors).map(
                        ([key, colors]) => ({
                          key,
                          label: statuses[key],
                          colors,
                        })
                      ),
                      {
                        key: 'unconfigured',
                        label: 'Chưa cấu hình',
                        colors: unconfiguredColors,
                      },
                      {
                        key: 'disabled',
                        label: 'Ngừng sử dụng',
                        colors: unconfiguredColors,
                      },
                    ]
                  : [
                      {
                        key: 'available',
                        label: 'Còn chỗ',
                        colors: statusColors.TRONG,
                      },
                      {
                        key: 'booked',
                        label: 'Có lịch đặt',
                        colors: statusColors.DA_DAT,
                      },
                      {
                        key: 'unconfigured',
                        label: 'Chưa cấu hình',
                        colors: unconfiguredColors,
                      },
                      {
                        key: 'disabled',
                        label: 'Ngừng sử dụng',
                        colors: unconfiguredColors,
                      },
                    ]
                ).map(item => (
                  <span className="table-map-legend-item" key={item.key}>
                    <i style={{ background: item.colors.border }} />
                    {item.label}
                  </span>
                ))}
              </div>
            </header>
            {areaGroups.map(group => (
              <section
                key={group.id}
                aria-labelledby={`area-${group.id}`}
                className="table-map-area"
              >
              <h2
                id={`area-${group.id}`}
                className="table-map-area-heading"
              >
                {group.name}
              </h2>
                <div className="table-map-grid">
                {group.tables.map(table => {
                  const configured = table.da_cau_hinh
                  const currentStatus =
                    getTableStatusPresentation(table)
                  const tableScheduleBookings =
                    bookingsByTable.get(table.id) || []
                  const canCheckIn =
                    viewMode === 'current' &&
                    configured &&
                    canReceiveGuests &&
                    ['TRONG', 'DA_DAT'].includes(
                      table.trang_thai
                    )
                  const scheduleStatus = !configured
                    ? {
                        label: 'Chưa cấu hình',
                        colors: unconfiguredColors,
                      }
                    : table.trang_thai === 'NGUNG_SU_DUNG'
                      ? {
                          label: 'Ngừng sử dụng',
                          colors: unconfiguredColors,
                        }
                      : tableScheduleBookings.length
                        ? {
                            label: 'Có lịch đặt',
                            colors: statusColors.DA_DAT,
                          }
                        : {
                            label: 'Còn chỗ',
                            colors: statusColors.TRONG,
                          }
                  const colors =
                    viewMode === 'schedule'
                      ? scheduleStatus.colors
                      : currentStatus.colors
                  const statusLabel =
                    viewMode === 'schedule'
                      ? scheduleStatus.label
                      : currentStatus.label
                  const managementItems = [
                    ...(configured
                      ? [
                          {
                            key: 'download-qr',
                            label: 'Tải QR (PNG)',
                            onClick: () =>
                              run(
                                () =>
                                  downloadQR(
                                    `/api/ban/${table.id}/qr.png`,
                                    `ban-${table.id}-qr.png`
                                  ),
                                'Đã tải PNG.',
                                false
                              ),
                          },
                          {
                            key: 'regenerate-qr',
                            label: 'Sinh lại QR',
                            onClick: () => rotate(table),
                          },
                        ]
                      : []),
                    {
                      key: 'delete',
                      label: 'Xóa',
                      className: 'table-map-delete-menu-item',
                      onClick: () => remove(table),
                    },
                  ]

                  return (
                    <article
                      key={table.id}
                      role="group"
                      tabIndex={0}
                      aria-label={`Mở chi tiết ${formatTableName(
                        group.name,
                        table.ma_ban
                      )}`}
                      onClick={() => openTableDetails(table)}
                      onKeyDown={event => {
                        if (
                          event.target === event.currentTarget &&
                          (event.key === 'Enter' ||
                            event.key === ' ')
                        ) {
                          event.preventDefault()
                          openTableDetails(table)
                        }
                      }}
                      style={{
                        '--table-card-background':
                          colors?.background || '#fff',
                        '--table-card-border':
                          colors?.border || '#d9d9d9',
                        '--table-card-text':
                          colors?.text || 'inherit',
                      }}
                      className="table-map-card"
                      data-selected={
                        selectedTableId === table.id
                          ? 'true'
                          : undefined
                      }
                    >
                      <div className="table-map-card-heading">
                        <h3 className="table-map-card-title">
                          {table.ma_ban}
                        </h3>
                        {isManager && (
                          <Dropdown
                            trigger={['click']}
                            menu={{ items: managementItems }}
                          >
                            <Button
                              type="text"
                              aria-label={`Thao tác quản lý ${table.ma_ban}`}
                              className="table-map-menu-button"
                              icon={<MoreOutlined />}
                              disabled={busy}
                              onClick={event =>
                                event.stopPropagation()
                              }
                            />
                          </Dropdown>
                        )}
                      </div>
                      <p className="table-map-card-capacity">
                        {configured &&
                        table.suc_chua_toi_thieu != null &&
                        table.suc_chua_toi_da != null
                          ? <>
                              <UserOutlined aria-hidden="true" />
                              {` ${table.suc_chua_toi_thieu}–${table.suc_chua_toi_da} khách`}
                            </>
                          : 'Chưa cấu hình sức chứa'}
                      </p>
                      <TableTopView className="table-map-card-table" />
                      <span className="table-map-card-status">
                        <i
                          style={{
                            background: colors?.border || '#8c8c8c',
                          }}
                        />
                        {statusLabel}
                      </span>
                      {(isManager || canCheckIn) && (
                        <div className="table-map-card-actions">
                          {isManager &&
                            (configured ? (
                              <Button
                                className="table-map-edit-button"
                                disabled={busy}
                                onClick={event => {
                                  event.stopPropagation()
                                  edit(table)
                                }}
                              >
                                Sửa
                              </Button>
                            ) : (
                              <Button
                                type="primary"
                                className="table-map-configure-button"
                                disabled={busy}
                                onClick={event => {
                                  event.stopPropagation()
                                  edit(table)
                                }}
                              >
                                Cấu hình
                              </Button>
                            ))}
                          {canCheckIn && (
                            <Button
                              type="primary"
                              className="table-map-checkin-button"
                              disabled={busy || checkInLoading}
                              onClick={event => {
                                event.stopPropagation()
                                startCheckIn(table)
                              }}
                            >
                              Nhận khách
                            </Button>
                          )}
                        </div>
                      )}
                    </article>
                  )
                })}
                </div>
              </section>
            ))}
          </div>
          {detailTable && (
            <>
              <button
                type="button"
                className="table-map-drawer-backdrop"
                aria-label="Đóng chi tiết bàn"
                onClick={closeTableDetails}
              />
              <aside
                className="table-map-detail-panel"
                aria-label={`Chi tiết bàn ${detailTable.ma_ban}`}
              >
              <header className="table-map-detail-heading">
                <div className="table-map-detail-heading-main">
                  <strong>{detailData?.ma_ban || detailTable.ma_ban}</strong>
                  {isManager && detailData && (
                    <Button
                      className="table-map-detail-edit"
                      onClick={() => edit(detailData)}
                    >
                      {detailData.da_cau_hinh ? 'Sửa' : 'Cấu hình'}
                    </Button>
                  )}
                </div>
                <Button
                  type="text"
                  aria-label="Đóng chi tiết bàn"
                  icon={<CloseOutlined />}
                  onClick={closeTableDetails}
                />
              </header>
              {detailLoading && !detailData ? (
                <p role="status">Đang tải thông tin bàn...</p>
              ) : detailError && !detailData ? (
                <Alert
                  type="error"
                  showIcon
                  title="Không tải được thông tin bàn."
                  description={detailError}
                  action={
                    <Button size="small" onClick={retryTableDetails}>
                      Thử lại
                    </Button>
                  }
                />
              ) : detailData ? (
                <>
                  {detailError && (
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 16 }}
                      title="Không cập nhật được thông tin mới nhất."
                      description={detailError}
                      action={
                        <Button
                          size="small"
                          onClick={retryTableDetails}
                        >
                          Thử lại
                        </Button>
                      }
                    />
                  )}
                  {!detailData.da_cau_hinh && (
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                      title="Bàn chưa được cấu hình nên chưa thể dùng để đặt bàn hoặc nhận khách."
                    />
                  )}
                  {detailData.da_cau_hinh &&
                    detailData.trang_thai === 'NGUNG_SU_DUNG' && (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: 16 }}
                        title="Bàn đang ngừng sử dụng."
                      />
                    )}
                  <section className="table-map-detail-overview">
                    <TableTopView className="table-map-detail-table" />
                    <dl className="table-map-detail-facts">
                      <div>
                        <dt>Khu vực</dt>
                        <dd>
                          {areas.find(
                            area =>
                              area.id === detailData.khu_vuc_id
                          )?.ten_khu_vuc || 'Chưa có thông tin'}
                        </dd>
                      </div>
                      <div>
                        <dt>Tầng</dt>
                        <dd>
                          {floorNumber(
                            areas.find(
                              area =>
                                area.id === detailData.khu_vuc_id
                            )?.ten_khu_vuc || ''
                          ) !== null
                            ? formatAreaName(
                                areas.find(
                                  area =>
                                    area.id === detailData.khu_vuc_id
                                )?.ten_khu_vuc || ''
                              )
                            : 'Chưa có thông tin'}
                        </dd>
                      </div>
                      <div>
                        <dt>Sức chứa</dt>
                        <dd>
                          {detailData.da_cau_hinh &&
                          detailData.suc_chua_toi_thieu != null &&
                          detailData.suc_chua_toi_da != null
                            ? `${detailData.suc_chua_toi_thieu}–${detailData.suc_chua_toi_da} khách`
                            : 'Chưa cấu hình'}
                        </dd>
                      </div>
                      <div>
                        <dt>Loại bàn</dt>
                        <dd>
                          {detailData.loai_ban
                            ? types[detailData.loai_ban] ||
                              detailData.loai_ban
                            : 'Chưa cấu hình'}
                        </dd>
                      </div>
                    </dl>
                  </section>
                  {viewMode === 'current' ? (
                    <section className="table-map-detail-section">
                      <h3>Trạng thái hiện tại</h3>
                      <Descriptions
                        column={1}
                        bordered
                        size="small"
                      >
                        <Descriptions.Item label="Trạng thái">
                          {detailData.da_cau_hinh
                            ? statuses[detailData.trang_thai] ||
                              detailData.trang_thai
                            : 'Chưa cấu hình'}
                        </Descriptions.Item>
                        {!detailData.da_cau_hinh ||
                        detailData.trang_thai === 'NGUNG_SU_DUNG' ? (
                          <Descriptions.Item label="Thông tin">
                            {detailData.da_cau_hinh
                              ? 'Bàn đang ngừng sử dụng'
                              : 'Bàn chưa được cấu hình'}
                          </Descriptions.Item>
                        ) : detailData.trang_thai === 'TRONG' ? (
                          <Descriptions.Item label="Thông tin">
                            Bàn đang trống, chưa có khách đang phục vụ
                          </Descriptions.Item>
                        ) : detailData.trang_thai === 'DANG_DON' ? (
                          <Descriptions.Item label="Thông tin">
                            Bàn đang dọn, chưa thể nhận khách
                          </Descriptions.Item>
                        ) : detailData.trang_thai === 'DA_DAT' ? (
                          <Descriptions.Item label="Đặt bàn sắp tới">
                            {detailData.dat_ban_sap_toi
                              ? `${detailData.dat_ban_sap_toi.ho_ten_khach} · ${formatVietnamDateTime(detailData.dat_ban_sap_toi.thoi_gian_den_at)} · ${detailData.dat_ban_sap_toi.so_luong_khach} khách`
                              : 'Chưa có đặt bàn sắp tới'}
                          </Descriptions.Item>
                        ) : detailData.trang_thai === 'DANG_SU_DUNG' ? (
                          <>
                            <Descriptions.Item label="Khách đang ngồi">
                              {detailData.khach_dang_ngoi
                                ? `${detailData.khach_dang_ngoi.ho_ten_khach} · ${detailData.khach_dang_ngoi.so_luong_khach} khách`
                                : 'Chưa có thông tin'}
                            </Descriptions.Item>
                            <Descriptions.Item label="Bắt đầu phục vụ">
                              {formatVietnamDateTime(
                                detailData.bat_dau_phuc_vu_at
                              )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Tạm tính hiện tại">
                              {formatVnd(
                                detailData.tam_tinh_hien_tai
                              )}
                            </Descriptions.Item>
                          </>
                        ) : (
                          <Descriptions.Item label="Thông tin">
                            Chưa có thông tin
                          </Descriptions.Item>
                        )}
                      </Descriptions>
                    </section>
                  ) : (
                    <section className="table-map-detail-section">
                      <h3>Lịch đặt theo ngày</h3>
                      <p className="table-map-detail-date">
                        {scheduleDate} · {scheduleStartTime}–
                        {scheduleEndTime}
                      </p>
                      {scheduleLoading ? (
                        <p role="status">Đang tải lịch đặt...</p>
                      ) : (
                        (bookingsByDate.get(detailData.id) || [])
                          .length > 0 ? (
                          <ul className="table-map-booking-list">
                            {(bookingsByDate.get(detailData.id) || [])
                              .map(booking => {
                                const overlaps =
                                  (bookingsByTable.get(
                                    detailData.id
                                  ) || []).some(
                                    selected =>
                                      selected.id === booking.id
                                  )
                                const end = bookingEndTime(booking)

                                return (
                                  <li
                                    key={booking.id}
                                    className={
                                      overlaps
                                        ? 'table-map-booking--overlap'
                                        : ''
                                    }
                                  >
                                    <div>
                                      <strong>
                                        {booking.ngay_dat !== scheduleDate
                                          ? `${booking.ngay_dat} · `
                                          : ''}
                                        {String(
                                          booking.gio_bat_dau
                                        ).slice(0, 5)}
                                        {' – '}
                                        {end
                                          ? `${end.time}${end.nextDay ? ' (+1 ngày)' : ''}`
                                          : 'Chưa có thông tin'}
                                      </strong>
                                      <span>
                                        {booking.ho_ten_khach} ·{' '}
                                        {booking.so_luong_khach} khách
                                      </span>
                                      {overlaps && (
                                        <em>
                                          Giao với khoảng giờ đã chọn
                                        </em>
                                      )}
                                    </div>
                                    <Button
                                      size="small"
                                      onClick={() =>
                                        openBooking(booking.id)
                                      }
                                    >
                                      Xem đặt bàn
                                    </Button>
                                  </li>
                                )
                              })}
                          </ul>
                        ) : (
                          <p>
                            Không có đặt bàn đã xác nhận trong ngày.
                          </p>
                        )
                      )}
                      <Alert
                        type="info"
                        showIcon
                        title="Lịch sử đang phục vụ/đang dọn: Chưa có dữ liệu lịch sử."
                      />
                    </section>
                  )}
                </>
              ) : null}
              </aside>
            </>
          )}
        </div>
      )}

      {isManager && <Modal
        title={
          editing?.da_cau_hinh
            ? 'Sửa thông tin bàn'
            : 'Cấu hình bàn'
        }
        open={open}
        onCancel={() => {
          if (!busy) {
            setOpen(false)
            setEditing(null)
            form.resetFields()
          }
        }}
        footer={null}
        forceRender
      >
        {notice?.type === 'error' && (
          <Alert
            {...notice}
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={save}
        >
          <Form.Item
            label="Mã bàn"
          >
            <Input value={editing?.ma_ban} readOnly />
          </Form.Item>

          <Form.Item
            name="suc_chua_toi_thieu"
            label="Sức chứa tối thiểu"
            rules={[
              {
                required: true,
                message:
                  'Nhập sức chứa tối thiểu.',
              },
            ]}
          >
            <InputNumber
              min={1}
              max={2147483647}
              precision={0}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="suc_chua_toi_da"
            label="Sức chứa tối đa"
            dependencies={[
              'suc_chua_toi_thieu',
            ]}
            rules={[
              {
                required: true,
                message:
                  'Nhập sức chứa tối đa.',
              },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const minimum =
                    getFieldValue(
                      'suc_chua_toi_thieu'
                    )

                  if (
                    value == null ||
                    minimum == null ||
                    value >= minimum
                  ) {
                    return Promise.resolve()
                  }

                  return Promise.reject(
                    new Error(
                      'Tối đa phải lớn hơn hoặc bằng tối thiểu.'
                    )
                  )
                },
              }),
            ]}
          >
            <InputNumber
              min={1}
              max={2147483647}
              precision={0}
              style={{ width: '100%' }}
            />
          </Form.Item>

          <Form.Item
            name="loai_ban"
            label="Loại bàn"
            rules={[
              {
                required: true,
                message: 'Chọn loại bàn.',
              },
            ]}
          >
            <Select
              options={options(types)}
            />
          </Form.Item>

          <Space>
            <Button
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setEditing(null)
                form.resetFields()
              }}
            >
              Hủy
            </Button>
            <Button
              type="primary"
              htmlType="submit"
              loading={busy}
            >
              {editing?.da_cau_hinh
                ? 'Lưu thay đổi'
                : 'Lưu và kích hoạt'}
            </Button>
          </Space>
        </Form>
      </Modal>}

      <Modal
        title={
          checkInTable
            ? `Nhận khách - ${formatTableName(
                formatAreaName(
                  areas.find(
                    area => area.id === checkInTable.khu_vuc_id
                  )?.ten_khu_vuc || `Khu vực ${checkInTable.khu_vuc_id}`
                ),
                checkInTable.ma_ban
              )}`
            : 'Nhận khách'
        }
        open={Boolean(checkInTable)}
        okText="Xác nhận"
        cancelText="Hủy"
        confirmLoading={busy}
        okButtonProps={{
          disabled:
            busy ||
            checkInLoading ||
            Boolean(checkInError) ||
            (checkInTable?.trang_thai === 'DA_DAT' &&
              !selectedBookingId),
        }}
        onOk={confirmCheckIn}
        onCancel={() => {
          if (!busy) setCheckInTable(null)
        }}
      >
        <p>Xác nhận khách đã vào bàn này?</p>
        {checkInTable?.trang_thai === 'DA_DAT' && (
          <>
            {checkInLoading ? (
              <p role="status">Đang tải đơn đặt bàn phù hợp...</p>
            ) : checkInBookings.length > 0 ? (
              <>
                <p>Chọn đúng đơn đặt bàn của khách đã đến:</p>
                <Select
                  aria-label="Chọn đơn đặt bàn"
                  value={selectedBookingId}
                  onChange={setSelectedBookingId}
                  style={{ width: '100%' }}
                  options={checkInBookings.map(booking => ({
                    value: booking.id,
                    label: `${booking.ho_ten_khach} · ${booking.so_luong_khach} khách · ${String(
                      booking.gio_bat_dau
                    ).slice(0, 5)}`,
                  }))}
                />
              </>
            ) : (
              !checkInError && (
                <Alert
                  type="info"
                  showIcon
                  title="Chưa có đơn đặt bàn phù hợp đến giờ nhận khách."
                />
              )
            )}
          </>
        )}
        {checkInError && (
          <Alert
            type="error"
            showIcon
            title={checkInError}
            style={{ marginTop: 12 }}
          />
        )}
      </Modal>

    </section>
  )
}
