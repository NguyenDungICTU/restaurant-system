import { api } from './api'

export async function getAssistantCatalog(signal) {
  const { data } = await api.get('/api/assistant/catalog', { signal })
  return data
}

export async function askAssistant(payload, signal) {
  // Keep the longer timeout local to chat, without changing other business APIs.
  const { data } = await api.post('/api/assistant/chat', payload, { signal, timeout: 40000 })
  return data
}

export async function checkAssistantConnection(signal) {
  const { data } = await api.post('/api/assistant/connection-check', {}, { signal, timeout: 40000 })
  return data
}
