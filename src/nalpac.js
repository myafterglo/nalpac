export const LOCATIONS = [
  { id: 15, name: 'Detroit Warehouse' },
  { id: 25, name: 'Phoenix Warehouse' },
]

export const DEFAULT_LOCATION_ID = 15

// sortBy takes a bare field name. Direction syntax isn't documented and
// several forms were tried without effect ("OrderDate:2", "-OrderDate",
// "OrderDate:desc", "desc(OrderNumber)"), so the field is sent on its own and
// whatever direction the API applies is what's shown.
export const DEFAULT_ORDER_SORT = 'OrderNumber'

const PAGE_SIZE = 50

// btoa() only handles latin1, so encode to UTF-8 bytes first.
function basicAuth(username, password) {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

// The exact response shape isn't documented, so pull fields by name rather than
// by position and keep the original record around for anything we missed.
function pick(record, candidates) {
  const entries = Object.entries(record)
  for (const candidate of candidates) {
    const hit = entries.find(([key]) => key.toLowerCase() === candidate)
    if (hit && hit[1] !== null && hit[1] !== '') return hit[1]
  }
  return undefined
}

function pickFuzzy(record, fragment) {
  const hit = Object.entries(record).find(
    ([key, value]) => key.toLowerCase().includes(fragment) && value !== null && value !== '',
  )
  return hit?.[1]
}

function normalize(record) {
  const sku =
    pick(record, ['sku', 'itemnumber', 'itemno', 'item_number', 'productsku', 'productcode', 'code']) ??
    pickFuzzy(record, 'sku')
  const title =
    pick(record, ['name', 'title', 'productname', 'itemname', 'description', 'shortdescription']) ??
    pickFuzzy(record, 'name')
  const image =
    pick(record, ['image', 'imageurl', 'imagelink', 'thumbnail', 'picture', 'imagepath']) ??
    pickFuzzy(record, 'image')
  const manufacturer =
    pick(record, ['manufacturer', 'manufacturername', 'brand', 'brandname', 'vendor', 'mfg']) ??
    pickFuzzy(record, 'manufactur')
  const price = pick(record, ['price', 'yourprice', 'unitprice', 'wholesaleprice', 'msrp'])
  const quantity = pick(record, ['quantity', 'availablequantity', 'quantityavailable', 'qty', 'stock'])

  return {
    sku: sku == null ? '' : String(sku),
    title: title == null ? '' : String(title),
    manufacturer: manufacturer == null ? '' : String(manufacturer),
    image: typeof image === 'string' ? image : undefined,
    price: price == null ? undefined : String(price),
    quantity: quantity == null ? undefined : String(quantity),
    raw: record,
  }
}

// The list may arrive bare or wrapped in any of several envelope keys.
function extractList(body) {
  if (Array.isArray(body)) return body
  if (!body || typeof body !== 'object') return []

  for (const key of ['items', 'data', 'products', 'results', 'records', 'value', 'list']) {
    const hit = Object.entries(body).find(([k]) => k.toLowerCase() === key)
    if (Array.isArray(hit?.[1])) return hit[1]
  }
  // Fall back to the first array of objects anywhere in the envelope.
  const nested = Object.values(body).find(
    (value) => Array.isArray(value) && value.every((v) => v && typeof v === 'object'),
  )
  return nested || []
}

function extractTotal(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined
  const hit = Object.entries(body).find(([key]) =>
    ['totalcount', 'total', 'totalrecords', 'totalitems', 'count'].includes(key.toLowerCase()),
  )
  return typeof hit?.[1] === 'number' ? hit[1] : undefined
}

function authHeaders(creds) {
  return { 'x-nalpac-auth': basicAuth(creds.nalpacUser.trim(), creds.nalpacPassword) }
}

/**
 * Submits an order. `test` posts to api/TestOrder, which validates the request
 * without placing a real order; the real endpoint is api/order.
 */
export async function createNalpacOrder(creds, payload, { test = true } = {}) {
  const res = await fetch(test ? '/api/nalpac/TestOrder' : '/api/nalpac/order', {
    method: 'POST',
    headers: { ...authHeaders(creds), 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) throw new Error('Nalpac rejected the username or password.')
    const detail =
      body.error ||
      body.message ||
      body.Message ||
      (Array.isArray(body.errors) ? body.errors.join('; ') : null)
    throw new Error(detail || `Nalpac returned HTTP ${res.status}`)
  }
  return body
}

export function hasNalpacCredentials(creds) {
  return !!(creds.nalpacUser.trim() && creds.nalpacPassword.trim())
}

async function nalpacGet(creds, path) {
  const res = await fetch(`/api/nalpac${path}`, { headers: authHeaders(creds) })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Nalpac answers a bad credential pair with an HTML page, so the relay's
    // generic message would otherwise win over the useful one.
    if (res.status === 401) throw new Error('Nalpac rejected the username or password.')
    throw new Error(body.error || body.message || `HTTP ${res.status}`)
  }
  return body
}

// The address may arrive as a nested object (as it is sent on create) or as
// flat ShipTo* fields on the order itself.
function normalizeAddress(record) {
  const nested = Object.entries(record).find(
    ([key, value]) =>
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      /(shipping|ship_?to).*address|^address$/.test(key.toLowerCase()),
  )
  const source = nested?.[1] || record

  const get = (candidates) => {
    const value = pick(source, candidates)
    return value == null ? '' : String(value).trim()
  }

  const name = get(['name', 'shiptoname', 'recipientname', 'shipto'])
  const address1 = get(['address1', 'shiptoaddress1', 'addressline1', 'street', 'address'])
  const address2 = get(['address2', 'shiptoaddress2', 'addressline2'])
  const address3 = get(['address3', 'shiptoaddress3', 'addressline3'])
  const city = get(['city', 'shiptocity'])
  const state = get(['state', 'shiptostate', 'province', 'stateorprovince'])
  const zip = get(['zipcode', 'zip', 'shiptozipcode', 'shiptozip', 'postalcode'])
  const country = get(['country', 'shiptocountry', 'countrycode'])
  // Contact details often sit on the order rather than inside the address.
  const getEither = (candidates) => {
    const value = pick(source, candidates) ?? pick(record, candidates)
    return value == null ? '' : String(value).trim()
  }
  const phone = getEither(['phone', 'shiptophonenumber', 'phonenumber'])
  const email = getEither(['email', 'shiptoemailaddress', 'emailaddress'])

  const region = [city, state, zip].filter(Boolean).join(' ')
  return {
    name,
    lines: [address1, address2, address3, region, country].filter(Boolean),
    phone,
    email,
  }
}

function normalizeOrder(record) {
  const get = (candidates, fragment) => {
    const value = pick(record, candidates) ?? (fragment ? pickFuzzy(record, fragment) : undefined)
    return value == null ? '' : String(value)
  }
  return {
    orderNumber: get(['ordernumber', 'nalpacordernumber', 'orderno', 'id'], 'ordernum'),
    poNumber: get(['ponumber', 'po', 'purchaseordernumber']),
    externalOrderNumber: get(['externalordernumber']),
    orderDate: get(['orderdate', 'dateordered', 'createddate', 'date']),
    shipDate: get(['shipdate', 'shippeddate', 'dateshipped']),
    shipToName: get(['shiptoname', 'shipto', 'name']),
    trackingNumber: get(['trackingnumber', 'tracking'], 'tracking'),
    status: get(['status', 'orderstatus']),
    total: get(['total', 'ordertotal', 'totalamount', 'grandtotal']),
    address: normalizeAddress(record),
    raw: record,
  }
}

// A carrier may nest its services under any of several key names.
function carrierOptions(record) {
  const objectArray = ([, value]) =>
    Array.isArray(value) && value.length > 0 && value.every((v) => v && typeof v === 'object')

  const entries = Object.entries(record).filter(objectArray)
  const named = entries.find(([key]) => /option|service|method|rate|level|ship/.test(key.toLowerCase()))
  return (named || entries[0])?.[1] || []
}

function normalizeOption(record) {
  const get = (candidates, fragment) => {
    const value = pick(record, candidates) ?? (fragment ? pickFuzzy(record, fragment) : undefined)
    return value == null ? '' : String(value)
  }
  return {
    id: get(['shippingoptionid', 'id', 'optionid', 'serviceid', 'code'], 'id'),
    name: get(['name', 'description', 'optionname', 'servicename', 'displayname'], 'name'),
    raw: record,
  }
}

function normalizeCarrier(record) {
  const get = (candidates, fragment) => {
    const value = pick(record, candidates) ?? (fragment ? pickFuzzy(record, fragment) : undefined)
    return value == null ? '' : String(value)
  }
  return {
    id: get(['id', 'carrierid', 'shippingoptionid', 'shippingoption'], 'id'),
    name: get(['name', 'carriername', 'description', 'displayname'], 'name'),
    options: carrierOptions(record).map(normalizeOption),
    raw: record,
  }
}

/**
 * Orders placed with Nalpac. Pagination is page-number based rather than
 * cursor based.
 */
export async function fetchNalpacOrders(creds, { pageNumber = 1, filters = {} } = {}) {
  const params = new URLSearchParams({ pageNumber: String(pageNumber) })
  for (const [key, value] of Object.entries(filters)) {
    if (value && String(value).trim()) params.set(key, String(value).trim())
  }

  const body = await nalpacGet(creds, `/order?${params}`)
  const list = extractList(body)
  // total is null when the response carries no count — the caller must not
  // mistake this page's length for the size of the whole result set.
  return { orders: list.map(normalizeOrder), total: extractTotal(body) ?? null }
}

/**
 * Whether another page is worth requesting. Uses the reported total when there
 * is one, otherwise infers the end from a short page.
 */
export function hasMorePages({ received, accumulated, total, pageSize }) {
  if (received === 0) return false
  if (typeof total === 'number') return accumulated < total
  return pageSize > 0 && received >= pageSize
}

/** Shipping carriers and their IDs, used as ShippingOptionId when ordering. */
export async function fetchCarriers(creds) {
  const body = await nalpacGet(creds, '/carrier')
  return extractList(body).map(normalizeCarrier)
}

export async function searchNalpacProducts(creds, { keyword, excludeDiscontinued, locationId }) {
  const params = new URLSearchParams({
    pageNumber: '1',
    pageSize: String(PAGE_SIZE),
    stripDescriptionHTML: 'true',
    excludeDiscontinued: String(!!excludeDiscontinued),
    LocationId: String(locationId ?? DEFAULT_LOCATION_ID),
  })
  if (keyword.trim()) params.set('keyword', keyword.trim())

  const res = await fetch(`/api/nalpac/product?${params}`, {
    headers: authHeaders(creds),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    // Nalpac answers a bad credential pair with an HTML page, so the relay's
    // generic message would otherwise win over the useful one.
    if (res.status === 401) throw new Error('Nalpac rejected the username or password.')
    throw new Error(body.error || body.message || `HTTP ${res.status}`)
  }

  const list = extractList(body)
  return { items: list.map(normalize), total: extractTotal(body) ?? list.length, pageSize: PAGE_SIZE }
}
