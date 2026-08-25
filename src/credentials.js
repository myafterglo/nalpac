const STORAGE_KEY = 'shopify-credentials'

export const DEFAULT_CREDENTIALS = {
  // Shopify
  shop: '.myshopify.com',
  clientId: '',
  secret: '',
  // Nalpac
  nalpacUser: '',
  nalpacPassword: '',
}

export function loadCredentials() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    return { ...DEFAULT_CREDENTIALS, ...stored }
  } catch {
    return { ...DEFAULT_CREDENTIALS }
  }
}

export function saveCredentials(creds) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds))
  } catch {
    // storage disabled or full — the app still works for this session
  }
}
