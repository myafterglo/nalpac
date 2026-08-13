export const LOCATIONS = [
  { id: 15, name: 'Detroit Warehouse' },
  { id: 25, name: 'Phoenix Warehouse' },
]

export const DEFAULT_LOCATION_ID = 15
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
  const price = pick(record, ['price', 'yourprice', 'unitprice', 'wholesaleprice', 'msrp'])
  const quantity = pick(record, ['quantity', 'availablequantity', 'quantityavailable', 'qty', 'stock'])

  return {
    sku: sku == null ? '' : String(sku),
    title: title == null ? '' : String(title),
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

export function hasNalpacCredentials(creds) {
  return !!(creds.nalpacUser.trim() && creds.nalpacPassword.trim())
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
    headers: {
      'x-nalpac-auth': basicAuth(creds.nalpacUser.trim(), creds.nalpacPassword),
    },
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
