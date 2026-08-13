import { plainText, priceRange } from './shopify'
import { METAFIELD_KEY } from './metafields'

function money(product) {
  const range = priceRange(product)
  if (!range) return '—'
  return range.min === range.max
    ? range.min.toFixed(2)
    : `${range.min.toFixed(2)} – ${range.max.toFixed(2)}`
}

function date(value) {
  return value ? new Date(value).toLocaleString() : '—'
}

/** The full product, flattened to key/value pairs for display. */
export function buildProductRows(product, metafieldValue) {
  return [
    [METAFIELD_KEY, metafieldValue || '—'],
    ['ID', product.id],
    ['Title', product.title],
    ['Handle', product.handle],
    ['Status', product.status],
    ['Vendor', product.vendor || '—'],
    ['Product type', product.product_type || '—'],
    ['Tags', product.tags || '—'],
    ['Price', money(product)],
    ['Variants', (product.variants || []).length],
    [
      'Inventory',
      (product.variants || []).reduce((sum, v) => sum + (v.inventory_quantity || 0), 0),
    ],
    ['Options', (product.options || []).map((o) => o.name).join(', ') || '—'],
    ['Images', (product.images || []).length],
    ['Published', date(product.published_at)],
    ['Created', date(product.created_at)],
    ['Updated', date(product.updated_at)],
    ['Description', plainText(product.body_html, 2000) || '—'],
  ]
}
