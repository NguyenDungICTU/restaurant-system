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

export async function getHealth() {
  const r = await api.get('/api/health')
  return r.data
}

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

export async function changePassword(payload) {
  const r = await api.post('/api/auth/change-password', payload)
  return r.data
}

export async function checkWorkspaceAccess(resource) {
  const r = await api.get(`/api/workspace/${resource}`)
  return r.data
}

export function createOrderSocket(onMessage, onStatus) {
  const s = new WebSocket(`${WS_BASE_URL}/ws/orders`)

  s.addEventListener('open', () =>
    onStatus?.('connected')
  )

  s.addEventListener('close', () =>
    onStatus?.('disconnected')
  )

  s.addEventListener('error', () =>
    onStatus?.('error')
  )

  s.addEventListener('message', (e) =>
    onMessage?.(e.data)
  )

  return s
}


// ===============================
// S1-02 - NHÂN VIÊN
// ===============================

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
  const r = await api.post(
    '/api/employees',
    payload
  )

  return r.data
}

export async function changeEmployeeStatus(
  employeeId,
  status
) {
  const r = await api.patch(
    `/api/employees/${employeeId}/status`,
    { status }
  )

  return r.data
}


// ===============================
// KHU VỰC - NHÁNH HOANG
// ===============================

export async function getAreas() {
  const response = await api.get('/api/khu-vuc')
  return response.data
}

export async function createArea(payload) {
  const response = await api.post(
    '/api/khu-vuc',
    payload
  )

  return response.data
}

export async function updateArea(id, payload) {
  const response = await api.put(
    `/api/khu-vuc/${id}`,
    payload
  )

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
