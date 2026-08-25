import { DEFAULT_LOCATION_ID, DEFAULT_SHIPPING_OPTION } from './nalpac'

function today() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Seeds the Nalpac order form from the Shopify order it was opened from. */
export function draftFromShopifyOrder(order, details) {
  const address = order.shipping_address || {}
  const name = address.name || [address.first_name, address.last_name].filter(Boolean).join(' ')

  return {
    OrderDate: today(),
    PoNumber: (order.name || `${order.order_number || ''}`).replace('#', ''),
    OrderNotes: order.note || '',
    ShippingAddress: {
      Name: name,
      Address1: address.address1 || '',
      Address2: address.address2 || '',
      Address3: '',
      City: address.city || '',
      State: address.province_code || address.province || '',
      ZipCode: address.zip || '',
      Country: address.country_code || address.country || '',
    },
    ShipToPhoneNumber: address.phone || order.phone || '',
    ShipToEmailAddress: order.email || order.contact_email || '',
    ShippingOptionId: String(DEFAULT_SHIPPING_OPTION.id),
    ShippingOptionLabel: DEFAULT_SHIPPING_OPTION.label, // display only; stripped by toRequestBody
    DeliveryInstructions: '',
    SignatureRequired: false,
    lines: nalpacLines(order, details),
  }
}

/** Only the Shopify line items whose product carries a nalpac_sku. */
export function nalpacLines(order, details) {
  return (order.line_items || [])
    .map((item) => ({ item, sku: details[item.product_id]?.sku }))
    .filter(({ sku }) => !!sku)
    .map(({ item, sku }) => ({
      key: item.id,
      Sku: sku,
      Quantity: item.quantity || 1,
      ShipLocationId: DEFAULT_LOCATION_ID,
      title: item.title || item.name,
    }))
}

export function hasNalpacLines(order, details) {
  return (order.line_items || []).some((item) => !!details[item.product_id]?.sku)
}

/** Strips the UI-only fields and coerces the numeric ones the API expects. */
export function toRequestBody(draft) {
  return {
    OrderDate: draft.OrderDate,
    PoNumber: draft.PoNumber,
    OrderNotes: draft.OrderNotes,
    ShippingAddress: { ...draft.ShippingAddress },
    ShipToPhoneNumber: draft.ShipToPhoneNumber,
    ShipToEmailAddress: draft.ShipToEmailAddress,
    ShippingOptionId: Number(draft.ShippingOptionId),
    DeliveryInstructions: draft.DeliveryInstructions,
    SignatureRequired: !!draft.SignatureRequired,
    CreateOrderRequestLines: draft.lines.map((line) => ({
      Sku: line.Sku,
      Quantity: Number(line.Quantity),
      ShipLocationId: Number(line.ShipLocationId),
    })),
  }
}

/** Returns a reason the draft can't be submitted, or null when it's good. */
export function validate(draft) {
  if (!draft.lines.length) return 'Add at least one line.'
  if (draft.lines.some((l) => !(Number(l.Quantity) > 0))) return 'Every line needs a quantity of 1 or more.'
  if (!draft.ShippingOptionId || Number.isNaN(Number(draft.ShippingOptionId)))
    return 'A numeric shipping option (carrier) ID is required.'
  if (!draft.ShippingAddress.Name.trim()) return 'The shipping address needs a name.'
  if (!draft.ShippingAddress.Address1.trim()) return 'The shipping address needs a street address.'
  return null
}
