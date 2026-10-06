import axios from 'axios'

function isLoopbackUrl(value) {
  try {
    const hostname = new URL(value).hostname
    return ['localhost', '127.0.0.1', '::1'].includes(hostname)
  } catch {
    return false
  }
}

const configuredApiBase = import.meta.env.VITE_API_BASE_URL || ''
const configuredWsBase = import.meta.env.VITE_WS_BASE_URL || ''

// Keep old .env files working on a LAN: when the app is opened from a phone
// using the laptop's LAN address, never send API requests back to localhost.
export const API_BASE_URL =
  configuredApiBase && (!isLoopbackUrl(configuredApiBase) || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? configuredApiBase.replace(/\/$/, '')
    : window.location.origin

export const WS_BASE_URL =
  configuredWsBase && (!isLoopbackUrl(configuredWsBase) || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? configuredWsBase.replace(/\/$/, '')
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  withCredentials: true,
})

const SESSION_KEY = 'restaurant_session_token'
let sessionExpiryNotified = false
export const SESSION_EXPIRED_EVENT = 'restaurant:session-expired'
export const SESSION_ENDING_EVENT = 'restaurant:session-ending'

export function getSessionToken() {
  return sessionStorage.getItem(SESSION_KEY)
}

export function setSessionToken(token) {
  if (token) {
    sessionExpiryNotified = false
    sessionStorage.setItem(SESSION_KEY, token)
  } else {
    sessionStorage.removeItem(SESSION_KEY)
  }
}

function notifySessionExpired() {
  setSessionToken(null)
  if (sessionExpiryNotified) return

  sessionExpiryNotified = true
  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRED_EVENT, {
      detail: {
        message:
          'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      },
    })
  )
}

api.interceptors.request.use((config) => {
  const token = getSessionToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      const requestUrl = error.config?.url?.split('?')[0]
      if (
        requestUrl !== '/api/auth/login' &&
        requestUrl !== '/api/auth/logout'
      ) {
        notifySessionExpired()
      }
    }
    return Promise.reject(error)
  },
)

// ─────────────────────────────────────────────
// System
// ─────────────────────────────────────────────

export async function getHealth() {
  const r = await api.get('/api/health')
  return r.data
}

// ─────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────

export async function login(identifier, password) {
  const r = await api.post('/api/auth/login', { identifier, password })
  setSessionToken(r.data?.access_token)
  return r.data
}

export async function getCurrentUser() {
  const r = await api.get('/api/auth/me')
  return r.data
}

export async function changePassword(payload) {
  const r = await api.post('/api/auth/change-password', payload)
  return r.data
}

export async function checkWorkspaceAccess(resource) {
  const r = await api.get(`/api/workspace/${resource}`)
  return r.data
}

export async function logout() {
  try {
    const r = await api.post('/api/auth/logout')
    return r.data
  } finally {
    setSessionToken(null)
  }
}

// ─────────────────────────────────────────────
// S1-02 - NHÂN VIÊN
// ─────────────────────────────────────────────

export async function getEmployees() {
  const r = await api.get('/api/employees')
  return r.data
}

export async function checkEmployeeUsername(username) {
  const r = await api.get(
    '/api/employees/availability/username',
    {
      params: { username },
    }
  )
  return r.data
}

export async function checkEmployeePhone(phone) {
  const r = await api.get(
    '/api/employees/availability/phone',
    {
      params: { phone },
    }
  )
  return r.data
}

export async function createEmployee(payload) {
  const r = await api.post('/api/employees', payload)
  return r.data
}

export async function changeEmployeeStatus(employeeId, status) {
  const r = await api.patch(
    `/api/employees/${employeeId}/status`,
    { status }
  )
  return r.data
}

// ─────────────────────────────────────────────
// KHU VỰC - NHÁNH HOANG
// ─────────────────────────────────────────────

export async function getAreas({ signal } = {}) {
  const response = await api.get('/api/khu-vuc', { signal })
  return response.data
}

export async function createArea(payload) {
  const response = await api.post('/api/khu-vuc', payload)
  return response.data
}

export async function updateArea(id, payload) {
  const response = await api.put(`/api/khu-vuc/${id}`, payload)
  return response.data
}

export async function deactivateArea(id) {
  const response = await api.patch(
    `/api/khu-vuc/${id}/ngung-su-dung`
  )
  return response.data
}

export async function activateArea(id) {
  const response = await api.patch(
    `/api/khu-vuc/${id}/kich-hoat`
  )
  return response.data
}

// ─────────────────────────────────────────────
// Menu categories
// ─────────────────────────────────────────────

export async function getCategories() {
  const response = await api.get('/api/menu/categories')
  return response.data
}

export async function getPublicCategories() {
  const response = await api.get('/api/menu/categories/public')
  return response.data
}

export async function createCategory(payload) {
  const response = await api.post('/api/menu/categories', payload)
  return response.data
}

export async function updateCategory(categoryId, payload) {
  const response = await api.patch(
    `/api/menu/categories/${categoryId}`,
    payload,
  )
  return response.data
}

export async function updateCategoryStatus(categoryId, active) {
  const response = await api.patch(
    `/api/menu/categories/${categoryId}/status`,
    {
      dang_su_dung: active,
    },
  )
  return response.data
}

export async function reorderCategories(items) {
  const response = await api.put(
    '/api/menu/categories/reorder',
    {
      items,
    },
  )
  return response.data
}

export async function uploadCategoryImage(categoryId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post(
    `/api/menu/categories/${categoryId}/image`,
    formData,
  )
  return response.data
}

export async function deleteCategory(categoryId) {
  const response = await api.delete(
    `/api/menu/categories/${categoryId}`,
  )
  return response.data
}

// ─────────────────────────────────────────────
// Menu dishes
// ─────────────────────────────────────────────

export async function getDishes(categoryId) {
  const params = categoryId ? { category_id: categoryId } : undefined
  const response = await api.get('/api/menu/dishes', { params })
  return response.data
}

export function getMediaUrl(path) {
  if (!path) return `${API_BASE_URL}/media/default-dish.svg`
  if (/^https?:\/\//i.test(path)) return path
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export async function getDailyDishes() {
  const response = await api.get('/api/menu/dishes/daily')
  return response.data
}

export async function getOrderableDishes() {
  const response = await api.get('/api/menu/dishes/orderable')
  return response.data
}

export async function toggleDishTemporarySoldOut(dishId, tamHet) {
  const response = await api.patch(
    `/api/menu/dishes/${dishId}/temporary-sold-out`,
    { tam_het: tamHet },
  )
  return response.data
}

export async function getPublicDishes() {
  const response = await api.get('/api/menu/dishes/public')
  return response.data
}

export async function getPublicMenu() {
  const response = await api.get('/api/menu/public')
  return response.data
}

export async function createDish(payload) {
  const response = await api.post('/api/menu/dishes', payload)
  return response.data
}

export async function updateDish(dishId, payload) {
  const response = await api.patch(`/api/menu/dishes/${dishId}`, payload)
  return response.data
}

export async function uploadDishImage(dishId, file) {
  const formData = new FormData()
  formData.append('file', file)
  const response = await api.post(
    `/api/menu/dishes/${dishId}/image`,
    formData,
  )
  return response.data
}

export async function deleteDish(dishId) {
  const response = await api.delete(`/api/menu/dishes/${dishId}`)
  return response.data
}

// ─────────────────────────────────────────────
// Orders WebSocket
// ─────────────────────────────────────────────

export function createOrderSocket(onMessage, onStatus) {
  const socket = new WebSocket(`${WS_BASE_URL}/ws/orders`)

  socket.addEventListener('open', () => {
    onStatus?.('connected')
  })

  socket.addEventListener('close', () => {
    onStatus?.('disconnected')
  })

  socket.addEventListener('error', () => {
    onStatus?.('error')
  })

  socket.addEventListener('message', (event) => {
    onMessage?.(event.data)
  })

  return socket
}
// ===============================
// GIỜ MỞ CỬA & ĐẶT BÀN
// ===============================

export async function getOpeningSettings({ signal } = {}) {
  const response = await api.get('/api/lich-hoat-dong/toan-bo', {
    signal,
  })
  return response.data
}

export async function saveOpeningSettings(payload) {
  const response = await api.put('/api/lich-hoat-dong/toan-bo', payload)
  return response.data
}

export async function getBookings({ signal } = {}) {
  const response = await api.get('/api/dat-ban', { signal })
  return response.data
}

export async function getTodayBookings(status) {
  const params =
    status && status !== 'ALL'
      ? { trang_thai: status }
      : undefined

  const response = await api.get(
    '/api/dat-ban/hom-nay',
    { params },
  )

  return response.data
}

export async function createBooking(payload) {
  const response = await api.post('/api/dat-ban', payload)
  return response.data
}

export async function cancelBooking(id) {
  const response = await api.patch(`/api/dat-ban/${id}/huy`)
  return response.data
}

// ─────────────────────────────────────────────
// Đặt bàn công khai cho khách (S2-02)
// ─────────────────────────────────────────────

export async function getPublicBookingAreas() {
  const response = await api.get('/api/dat-ban/cong-khai/khu-vuc')
  return response.data
}

export async function getPublicTimeSlots(params) {
  const response = await api.get('/api/dat-ban/cong-khai/khung-gio', { params })
  return response.data
}

export async function createPublicBooking(payload) {
  const response = await api.post('/api/dat-ban/cong-khai', payload)
  return response.data
}

export async function lookupPublicBooking(maDatBan, soDienThoai) {
  const response = await api.post('/api/dat-ban/cong-khai/tra-cuu', null, {
    params: { ma_dat_ban: maDatBan, so_dien_thoai: soDienThoai },
  })
  return response.data
}

export async function cancelPublicBooking(maDatBan, soDienThoai) {
  const response = await api.post('/api/dat-ban/cong-khai/huy', null, {
    params: { ma_dat_ban: maDatBan, so_dien_thoai: soDienThoai },
  })
  return response.data
}

// Quản lý bàn vật lý
export async function getRestaurantTables() {
  const response = await api.get('/api/ban')
  return response.data
}

export async function createRestaurantTable(payload) {
  const response = await api.post('/api/ban', payload)
  return response.data
}

export async function updateRestaurantTableStatus(id, hoat_dong) {
  const response = await api.patch(`/api/ban/${id}/trang-thai`, {
    hoat_dong,
  })
  return response.data
}

// Kiểm tra bàn trống và xác nhận đặt bàn
export async function getAvailableTables(bookingId) {
  const response = await api.get(
    `/api/dat-ban/${bookingId}/ban-trong`
  )
  return response.data
}

export async function confirmBooking(bookingId, tableId) {
  const response = await api.post(
    `/api/dat-ban/${bookingId}/xac-nhan`,
    { ban_id: tableId }
  )
  return response.data
}

export async function rejectBooking(bookingId, reason) {
  const response = await api.post(
    `/api/dat-ban/${bookingId}/tu-choi`,
    { ly_do: reason },
  )
  return response.data
}

export async function moveBooking(bookingId, tableId) {
  const response = await api.post(
    `/api/dat-ban/${bookingId}/doi-ban`,
    { ban_id: tableId },
  )
  return response.data
}

export async function lookupBooking(bookingCode, phone) {
  const response = await api.get(
    '/api/dat-ban/tra-cuu',
    {
      params: {
        ma_dat_ban: bookingCode,
        so_dien_thoai: phone,
      },
    },
  )
  return response.data
}

// Physical tables + QR
export async function getTables(areaId, { signal } = {}) {
  const response = await api.get('/api/ban', {
    params: areaId ? { khu_vuc_id: areaId } : undefined,
    signal,
  })
  return response.data
}
export async function getTableDetails(tableId, options = {}) {
  const response = await api.get(`/api/ban/${tableId}`, options)
  return response.data
}

export function createTableMapEventStream(onEvent, onStatus) {
  const controller = new AbortController()
  const eventUrl = `${API_BASE_URL.replace(/\/$/, '')}/api/ban/events`
  let retryDelay = 1000

  async function waitBeforeRetry(delay) {
    await new Promise(resolve => {
      if (controller.signal.aborted) {
        resolve()
        return
      }
      function finish() {
        window.clearTimeout(timer)
        controller.signal.removeEventListener('abort', finish)
        resolve()
      }
      const timer = window.setTimeout(finish, delay)
      controller.signal.addEventListener(
        'abort',
        finish,
        { once: true }
      )
    })
  }

  async function readEventStream(response) {
    const reader = response.body?.getReader()
    if (!reader) throw new Error('Sự kiện không có luồng dữ liệu.')

    const decoder = new TextDecoder()
    let buffer = ''
    let eventName = 'message'
    let eventData = []
    let connectedAt = null

    function dispatchBlock(block) {
      for (const line of block.replace(/\r/g, '').split('\n')) {
        if (line.startsWith('event:')) {
          eventName = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
          eventData.push(line.slice(5).trimStart())
        }
      }

      if (eventData.length > 0) {
        const data = JSON.parse(eventData.join('\n'))
        if (eventName === 'ready') {
          connectedAt = Date.now()
          onStatus?.('connected')
          onEvent?.({ type: 'ready' })
        } else if (eventName === 'auth-expired') {
          notifySessionExpired()
          controller.abort()
        } else if (eventName === 'forbidden') {
          onStatus?.('forbidden')
          controller.abort()
        } else if (eventName === 'update') {
          onEvent?.(data)
        }
      }

      eventName = 'message'
      eventData = []
    }

    while (!controller.signal.aborted) {
      let heartbeatTimer
      const heartbeatExpired = Symbol('heartbeat-expired')
      let result
      try {
        result = await Promise.race([
          reader.read(),
          new Promise(resolve => {
            heartbeatTimer = window.setTimeout(
              () => resolve(heartbeatExpired),
              45000,
            )
          }),
        ])
      } finally {
        window.clearTimeout(heartbeatTimer)
      }
      if (result === heartbeatExpired) {
        await reader.cancel()
        throw new Error('Luồng sự kiện không phản hồi.')
      }
      const { done, value } = result
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        dispatchBlock(buffer.slice(0, boundary))
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')
      }
    }

    if (!controller.signal.aborted) {
      throw new Error('Luồng sự kiện đã đóng.')
    }
    return connectedAt
  }

  async function connect() {
    while (!controller.signal.aborted) {
      onStatus?.('connecting')
      const token = getSessionToken()

      try {
        const response = await fetch(eventUrl, {
          headers: {
            Accept: 'text/event-stream',
            ...(token
              ? { Authorization: `Bearer ${token}` }
              : {}),
          },
          credentials: 'include',
          cache: 'no-store',
          signal: controller.signal,
        })

        if (response.status === 401) {
          notifySessionExpired()
          return
        }
        if (response.status === 403) {
          onStatus?.('forbidden')
          return
        }
        if (!response.ok) {
          throw new Error(`Event stream returned ${response.status}.`)
        }

        const connectedAt = await readEventStream(response)
        if (
          connectedAt !== null &&
          Date.now() - connectedAt >= 30000
        ) {
          retryDelay = 1000
        }
      } catch (error) {
        if (controller.signal.aborted) return
        onStatus?.('disconnected')
        await waitBeforeRetry(retryDelay)
        retryDelay = Math.min(retryDelay * 2, 30000)
      }
    }
  }

  void connect()
  return () => controller.abort()
}

export async function getTableDetailsByCode(tableCode, options = {}) {
  const response = await api.get(
    `/api/ban/ma/${encodeURIComponent(tableCode)}`,
    options,
  )
  return response.data
}
export async function getArrivalBookings(tableId) {
  const response = await api.get(`/api/ban/${tableId}/dat-ban-cho-nhan`)
  return response.data
}
export async function receiveTableGuests(tableId, bookingId) {
  const response = await api.post(`/api/ban/${tableId}/nhan-khach`, {
    dat_ban_id: bookingId,
  })
  return response.data
}
export async function createTable(areaId) {
  const response = await api.post('/api/ban', {
    khu_vuc_id: areaId,
  })
  return response.data
}
export async function updateTable(id, payload) {
  const response = await api.put(`/api/ban/${id}`, payload)
  return response.data
}
export async function deleteTable(id) {
  await api.delete(`/api/ban/${id}`)
}
export async function checkTableCode(maBan, excludeId) {
  const response = await api.get('/api/ban/availability', { params: { ma_ban: maBan, ...(excludeId ? { exclude_id: excludeId } : {}) } })
  return response.data
}
export async function scanQR(token) {
  const response = await api.get(`/api/ban/qr/${encodeURIComponent(token)}`)
  return response.data
}

export async function getCustomerTable(qrToken, phienBanId) {
  const response = await api.get(`/api/customer/qr/${encodeURIComponent(qrToken)}`, {
    params: phienBanId ? { phien_ban_id: phienBanId } : undefined,
  })
  return response.data
}

export async function createCustomerOrder(payload) {
  const response = await api.post('/api/customer/orders', payload)
  return response.data
}

export async function getCustomerOrders(phienBanId, qrToken) {
  const response = await api.get(`/api/customer/orders/${phienBanId}`, {
    params: { qr_token: qrToken },
  })
  return response.data
}

export async function getKitchenOrders() {
  const response = await api.get('/api/order-ops/kitchen')
  return response.data
}

export async function getServiceOrders() {
  const response = await api.get('/api/order-ops/service')
  return response.data
}

export async function closeServiceSession(sessionId) {
  const response = await api.post(`/api/order-ops/sessions/${sessionId}/close`)
  return response.data
}

export async function updateOrderLineStatus(lineId, status) {
  const response = await api.patch(`/api/order-ops/lines/${lineId}/status`, {
    trang_thai: status,
  })
  return response.data
}
export async function regenerateQR(id) {
  const response = await api.post(`/api/ban/${id}/qr/regenerate`)
  return response.data
}
export async function downloadQR(path, filename) {
  const separator = path.includes('?') ? '&' : '?'
  const qrPath = path.includes('/qr.') || path.includes('/qr/')
    ? `${path}${separator}frontend_origin=${encodeURIComponent(window.location.origin)}`
    : path
  const response = await api.get(qrPath, { responseType: 'blob' })
  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

// Audit log
export async function getAuditActions(params = {}) {
  const response = await api.get('/api/audit-logs/actions', { params })
  return response.data
}
export async function getLoginSessions() {
  const response = await api.get('/api/audit-logs/sessions')
  return response.data
}
