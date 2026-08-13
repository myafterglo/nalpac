const PAGE_SIZE = 250 // Shopify's maximum per page
const MAX_PAGES = 40

// Requests go through the Vite dev-server relay in vite.config.js, which
// forwards them to the Shopify Admin API with the access token attached.
export async function adminFetch(path, creds, token) {
  const res = await fetch(`/api/shopify${path}`, {
    headers: {
      'x-shop-domain': creds.shop.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
      'x-shop-token': token.access_token,
    },
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = data.errors || data.error || `HTTP ${res.status}`
    const error = new Error(typeof detail === 'string' ? detail : JSON.stringify(detail))
    error.status = res.status
    throw error
  }
  return { data, link: res.headers.get('x-shopify-link') }
}

// Link: <https://…/products.json?page_info=abc&limit=250>; rel="next"
export function nextPageInfo(link) {
  const match = /<([^>]+)>;\s*rel="next"/.exec(link || '')
  if (!match) return null
  try {
    return new URL(match[1]).searchParams.get('page_info')
  } catch {
    return null
  }
}

/**
 * Walks every page of products. Returns { products, truncated } — truncated is
 * true if the page cap was hit before Shopify ran out of pages.
 */
export async function fetchProducts(creds, token, { activeOnly = true } = {}) {
  const products = []
  let pageInfo = null
  let pages = 0

  do {
    // page_info carries the original filters, and Shopify rejects it alongside
    // any parameter other than limit and fields.
    const query = pageInfo
      ? `?limit=${PAGE_SIZE}&page_info=${encodeURIComponent(pageInfo)}`
      : `?limit=${PAGE_SIZE}${activeOnly ? '&status=active' : ''}`

    const { data, link } = await adminFetch(`/products.json${query}`, creds, token)
    products.push(...(data.products || []))
    pageInfo = nextPageInfo(link)
    pages += 1
  } while (pageInfo && pages < MAX_PAGES)

  return { products, truncated: !!pageInfo }
}

/** Cheapest and dearest variant price, or null when the product has neither. */
export function priceRange(product) {
  // Number(null) is 0, so drop empty values before converting.
  const prices = (product.variants || [])
    .map((v) => v.price)
    .filter((price) => price !== null && price !== undefined && price !== '')
    .map(Number)
    .filter((n) => !Number.isNaN(n))
  if (!prices.length) return null
  return { min: Math.min(...prices), max: Math.max(...prices) }
}

export function plainText(html, limit = 140) {
  const text = (html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > limit ? `${text.slice(0, limit).trimEnd()}…` : text
}
