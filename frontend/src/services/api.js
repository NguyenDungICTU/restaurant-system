import axios from 'axios'

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const WS_BASE_URL =
  import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 8000,
  withCredentials: true,
})

const SESSION_KEY = 'restaurant_session_token'

export function getSessionToken() {
  return sessionStorage.getItem(SESSION_KEY)
}

export function setSessionToken(token) {
  if (token) sessionStorage.setItem(SESSION_KEY, token)
  else sessionStorage.removeItem(SESSION_KEY)
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
      setSessionToken(null)
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

export async function getAreas() {
  const response = await api.get('/api/khu-vuc')
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

export async function getOpeningSettings() {
  const response = await api.get('/api/lich-hoat-dong/toan-bo')
  return response.data
}

export async function saveOpeningSettings(payload) {
  const response = await api.put('/api/lich-hoat-dong/toan-bo', payload)
  return response.data
}

export async function getBookings() {
  const response = await api.get('/api/dat-ban')
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

// Physical tables + QR
export async function getTables(areaId) {
  const response = await api.get('/api/ban', { params: areaId ? { khu_vuc_id: areaId } : undefined })
  return response.data
}
export async function createTable(payload) {
  const response = await api.post('/api/ban', payload)
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
export async function regenerateQR(id) {
  const response = await api.post(`/api/ban/${id}/qr/regenerate`)
  return response.data
}
export async function downloadQR(path, filename) {
  const response = await api.get(path, { responseType: 'blob' })
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
