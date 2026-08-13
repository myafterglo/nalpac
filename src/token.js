const STORAGE_KEY = 'shopify-access-token'

// Treat a token as spent slightly early so one can't expire mid-request.
const EXPIRY_MARGIN_MS = 60_000

export function loadToken() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    return stored && stored.access_token ? stored : null
  } catch {
    return null
  }
}

export function saveToken(token) {
  try {
    if (token) localStorage.setItem(STORAGE_KEY, JSON.stringify(token))
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // storage disabled or full — the token still works for this session
  }
}

export function isExpired(token) {
  return !token || Date.now() >= token.expires_at - EXPIRY_MARGIN_MS
}

// A stored token belongs to one store + app; changing either invalidates it.
export function matchesCredentials(token, creds) {
  return !!token && token.shop === creds.shop.trim() && token.client_id === creds.clientId.trim()
}

export async function requestToken(creds) {
  const res = await fetch('/api/shopify-token', {
    method: 'POST',
    headers: {
      'x-shop-domain': creds.shop.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
      'x-shop-client-id': creds.clientId.trim(),
      'x-shop-client-secret': creds.secret.trim(),
    },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Token request failed (HTTP ${res.status})`)

  return {
    ...data,
    shop: creds.shop.trim(),
    client_id: creds.clientId.trim(),
  }
}
