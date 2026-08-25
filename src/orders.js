import { adminFetch, nextPageInfo } from './shopify'
import { BATCH_SIZE, graphql, productGid } from './graphql'

const PAGE_SIZE = 50

// source_name is a machine value; these are the ones with a familiar label.
const CHANNELS = {
  web: 'Online Store',
  pos: 'Point of Sale',
  shopify_draft_order: 'Draft order',
  iphone: 'iPhone',
  android: 'Android',
}

export function channelName(order) {
  const source = order.source_name
  if (!source) return 'Unknown'
  return CHANNELS[source] || source
}

/** Orders are unfulfilled when Shopify leaves fulfillment_status null. */
export function fulfillmentLabel(order) {
  return order.fulfillment_status || 'unfulfilled'
}

export function paymentLabel(order) {
  return order.financial_status || 'unknown'
}

export function money(amount, currency) {
  const value = Number(amount)
  if (amount == null || Number.isNaN(value)) return '—'
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(
      value,
    )
  } catch {
    // Intl throws on an unknown currency code.
    return `${value.toFixed(2)} ${currency || ''}`.trim()
  }
}

export function lineTotal(item) {
  const price = Number(item.price)
  if (Number.isNaN(price)) return null
  return price * (item.quantity || 0)
}

export const ORDER_PAGE_SIZE = PAGE_SIZE

/**
 * One page of orders, latest first, plus the cursor for the next page (null at
 * the end). The REST endpoint defaults to id ascending — oldest first — so the
 * sort has to be asked for explicitly.
 */
export async function fetchOrders(
  creds,
  token,
  { unfulfilledOnly = false, pageInfo = null, createdBefore = null } = {},
) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE) })
  if (pageInfo) {
    // Shopify rejects page_info alongside anything but limit and fields; the
    // cursor already carries the filter and sort from the first request.
    params.set('page_info', pageInfo)
  } else {
    params.set('status', 'any')
    params.set('order', 'created_at desc')
    if (unfulfilledOnly) params.set('fulfillment_status', 'unfulfilled')
    // Fallback when Shopify stops sending a next cursor: ask for everything
    // older than what we already have. Inclusive, so nothing is skipped at the
    // boundary — the caller drops the duplicate.
    if (createdBefore) params.set('created_at_max', createdBefore)
  }

  const { data, link } = await adminFetch(`/orders.json?${params}`, creds, token)

  // Belt and braces: sort locally too, in case the endpoint ignores `order`.
  const orders = [...(data.orders || [])].sort(
    (a, b) => new Date(b.created_at) - new Date(a.created_at),
  )
  return { orders, pageInfo: nextPageInfo(link) }
}

/** The created_at of the oldest order loaded so far. */
export function oldestCreatedAt(orders) {
  return orders.reduce(
    (oldest, order) => (!oldest || new Date(order.created_at) < new Date(oldest) ? order.created_at : oldest),
    null,
  )
}

/**
 * Order line items carry neither an image nor metafields, so look both up per
 * product in one pass. Returns { [productId]: { image, sku } }.
 */
export async function fetchLineItemDetails(creds, token, orders, definition) {
  const ids = [
    ...new Set(
      orders.flatMap((order) => (order.line_items || []).map((item) => item.product_id)).filter(Boolean),
    ),
  ]
  const details = {}

  for (let i = 0; i < ids.length; i += BATCH_SIZE) {
    const data = await graphql(
      creds,
      token,
      `query LineItemDetails($ids: [ID!]!, $namespace: String!, $key: String!) {
         nodes(ids: $ids) {
           ... on Product {
             id
             featuredImage { url altText }
             metafield(namespace: $namespace, key: $key) { value }
           }
         }
       }`,
      {
        ids: ids.slice(i, i + BATCH_SIZE).map(productGid),
        namespace: definition.namespace,
        key: definition.key,
      },
    )

    for (const node of data?.nodes || []) {
      if (!node?.id) continue
      details[node.id.split('/').pop()] = {
        image: node.featuredImage
          ? { url: node.featuredImage.url, alt: node.featuredImage.altText }
          : null,
        sku: node.metafield?.value || '',
      }
    }
  }

  return details
}

/** Shipping address as readable lines, skipping the parts Shopify left blank. */
export function addressLines(address) {
  if (!address) return []
  const region = [address.city, address.province_code || address.province, address.zip]
    .filter(Boolean)
    .join(' ')
  return [address.address1, address.address2, region, address.country_code || address.country].filter(
    Boolean,
  )
}

// Walk-in sales carry no address; they all happen over the Canadian counter.
const POS_ADDRESS = { country_code: 'CA' }

/** A till sale: rung up in the shop, so nothing ever ships. */
export function isCounterSale(order) {
  return order.source_name === 'pos' && !order.shipping_address
}

/**
 * The address a package would ship to, falling back to the billing address.
 * Null for counter sales, whose billing address describes no shipment.
 */
export function shippingAddress(order) {
  if (isCounterSale(order)) return null
  return order.shipping_address || order.billing_address || null
}

/** The address whose country the order's flag shows. */
export function flagAddress(order) {
  return shippingAddress(order) || (isCounterSale(order) ? POS_ADDRESS : null)
}

// Regional indicator symbols sit this far above the ASCII letters.
const FLAG_OFFSET = 0x1f1e6 - 'A'.charCodeAt(0)

/** The address's ISO 3166-1 alpha-2 code, or '' when it isn't one. */
export function alpha2(address) {
  const code = (address?.country_code || '').trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : ''
}

/** The address's country as a flag emoji, or '' when the code is missing. */
export function countryFlag(address) {
  const code = alpha2(address)
  if (!code) return ''
  return String.fromCodePoint(...[...code].map((letter) => letter.charCodeAt(0) + FLAG_OFFSET))
}

/** Orders bound for the United States. */
export function isUsOrder(order) {
  return alpha2(flagAddress(order)) === 'US'
}

/** Readable country name for the flag's tooltip. */
export function countryName(address) {
  const code = alpha2(address)
  if (!code) return address?.country || ''
  try {
    return new Intl.DisplayNames(undefined, { type: 'region' }).of(code) || code
  } catch {
    // Intl.DisplayNames is missing on older browsers.
    return address?.country || code
  }
}

export function customerName(order) {
  const customer = order.customer
  const named = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ')
  return named || customer?.email || order.email || 'No customer'
}
