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

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 401
      && error.response?.data?.detail === 'SESSION_EXPIRED'
    ) {
      window.dispatchEvent(new Event('auth:session-expired'))
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
  const r = await api.post('/api/auth/login', {
    identifier,
    password,
  })
  return r.data
}

export async function getCurrentUser() {
  const r = await api.get('/api/auth/me')
  return r.data
}

export async function logout() {
  const r = await api.post('/api/auth/logout')
  return r.data
}

export async function changePassword(currentPassword, newPassword) {
  const r = await api.post('/api/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  })
  return r.data
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

export async function getAuditLogs(params = {}) {
  const response = await api.get('/api/audit-logs', { params })
  return response.data
}

export async function getBusinessHours() {
  const response = await api.get('/api/business-hours')
  return response.data
}

export async function saveBusinessHours(payload) {
  const response = await api.put('/api/business-hours', payload)
  return response.data
}

export async function getSpecialClosures() {
  const response = await api.get('/api/special-closures')
  return response.data
}

export async function addSpecialClosure(payload) {
  const response = await api.post('/api/special-closures', payload)
  return response.data
}

export async function removeSpecialClosure(id) {
  await api.delete(`/api/special-closures/${id}`)
}

export async function getReservationSlots(date) {
  const response = await api.get('/api/reservations/slots', {
    params: { requested_date: date },
  })
  return response.data
}

export async function createReservation(payload) {
  const response = await api.post('/api/reservations', payload)
  return response.data
}

export async function getReservations(date) {
  const response = await api.get('/api/reservations', {
    params: date ? { requested_date: date } : undefined,
  })
  return response.data
}

export async function getOrders(status) {
  const response = await api.get('/api/orders', { params: status ? { status } : undefined })
  return response.data
}

export async function createOrder(tableId) {
  const response = await api.post('/api/orders', { table_id: tableId })
  return response.data
}

export async function addOrderItem(orderId, payload) {
  const response = await api.post(`/api/orders/${orderId}/items`, payload)
  return response.data
}

export async function updateOrderStatus(orderId, status) {
  const response = await api.patch(`/api/orders/${orderId}/status`, { status })
  return response.data
}

// ─────────────────────────────────────────────
// KHU VỰC - NHÁNH HOANG
// ─────────────────────────────────────────────

export async function getAreas() {
  const response = await api.get('/api/khu-vuc')
  return response.data
}

export async function getActiveAreas() {
  const response = await api.get('/api/khu-vuc/active')
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

export async function deleteArea(id) {
  await api.delete(`/api/khu-vuc/${id}`)
}

export async function getTables() {
  const response = await api.get('/api/tables')
  return response.data
}

export async function getActiveTables() {
  const response = await api.get('/api/tables/active')
  return response.data
}

export async function createTable(payload) {
  const response = await api.post('/api/tables', payload)
  return response.data
}

export async function updateTable(id, payload) {
  const response = await api.put(`/api/tables/${id}`, payload)
  return response.data
}

export async function regenerateTableQr(id) {
  const response = await api.post(`/api/tables/${id}/qr/regenerate`)
  return response.data
}

export async function downloadTableQr(id) {
  const response = await api.get(`/api/tables/${id}/qr.png`, { responseType: 'blob' })
  return response.data
}

export async function downloadAreaQrs(areaId) {
  const response = await api.get(`/api/tables/area/${areaId}/qr.pdf`, { responseType: 'blob' })
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

export async function getQrTableInfo(token) {
  const response = await api.get(`/api/public/table-qr/${encodeURIComponent(token)}/table`)
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