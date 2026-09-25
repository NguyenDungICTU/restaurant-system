import axios from 'axios'
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
export const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000'
export const api = axios.create({ baseURL: API_BASE_URL, timeout: 8000, withCredentials: true })
export async function getHealth(){const r=await api.get('/api/health');return r.data}
export async function login(identifier,password){const r=await api.post('/api/auth/login',{identifier,password});return r.data}
export async function getCurrentUser(){const r=await api.get('/api/auth/me');return r.data}
export async function logout(){const r=await api.post('/api/auth/logout');return r.data}
export function createOrderSocket(onMessage,onStatus){const s=new WebSocket(`${WS_BASE_URL}/ws/orders`);s.addEventListener('open',()=>onStatus?.('connected'));s.addEventListener('close',()=>onStatus?.('disconnected'));s.addEventListener('error',()=>onStatus?.('error'));s.addEventListener('message',e=>onMessage?.(e.data));return s}
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

export async function deleteArea(id) {
  await api.delete(`/api/khu-vuc/${id}`)
}

export async function getTables() { return (await api.get('/api/ban')).data }
export async function createTable(payload) { return (await api.post('/api/ban', payload)).data }
export async function deleteTable(id) { await api.delete(`/api/ban/${id}`) }
export async function updateTable(id, payload) { return (await api.put(`/api/ban/${id}`, payload)).data }
export async function regenerateQR(id) { return (await api.post(`/api/ban/${id}/qr/regenerate`)).data }
export async function scanQR(token) { return (await api.get(`/api/ban/qr/${encodeURIComponent(token)}`)).data }
export async function downloadQR(path, filename) {
  let response
  try {
    response = await api.get(path, { responseType: 'blob', timeout: 60000 })
  } catch (error) {
    if (error.response?.data instanceof Blob) {
      try { error.response.data = JSON.parse(await error.response.data.text()) } catch { /* Keep fallback error. */ }
    }
    throw error
  }
  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
