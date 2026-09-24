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

// ─────────────────────────────────────────────
// System
// ─────────────────────────────────────────────

export async function getHealth() {
  const response = await api.get('/api/health')
  return response.data
}

// ─────────────────────────────────────────────
// Authentication
// ─────────────────────────────────────────────

export async function login(identifier, password) {
  const response = await api.post('/api/auth/login', {
    identifier,
    password,
  })

  return response.data
}

export async function getCurrentUser() {
  const response = await api.get('/api/auth/me')
  return response.data
}

export async function logout() {
  const response = await api.post('/api/auth/logout')
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
  const response = await api.post(`/api/menu/categories/${categoryId}/image`, formData)
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
  const response = await api.post(`/api/menu/dishes/${dishId}/image`, formData)
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