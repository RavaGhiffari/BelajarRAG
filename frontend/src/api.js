const API_BASE = '/api'

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    let detail = `HTTP ${res.status}`
    try {
      const body = await res.json()
      detail = body.detail || detail
    } catch {
      // body bukan JSON
    }
    throw new Error(detail)
  }
  return res.json()
}

export function getHealth() {
  return request('/health')
}

export function queryAPI(question, k, useCache) {
  return request('/query', {
    method: 'POST',
    body: JSON.stringify({ question, k, use_cache: useCache }),
  })
}

export function getCache() {
  return request('/cache')
}

export function clearCache() {
  return request('/cache', { method: 'DELETE' })
}
