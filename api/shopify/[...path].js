import { API_VERSION, endAsJson, json, readBody, upstreamPath } from '../_proxy.js'

// The Shopify Admin API sends no CORS headers, so the browser can't call it
// directly. This relays the request with the access token attached.
export default async function handler(req, res) {
  const shop = req.headers['x-shop-domain']
  const token = req.headers['x-shop-token']
  if (!shop || !token) {
    return json(res, 400, { error: 'Missing store domain or access token.' })
  }

  try {
    const path = upstreamPath(req, '/api/shopify')
    const upstream = await fetch(`https://${shop}/admin/api/${API_VERSION}${path}`, {
      method: req.method,
      headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
      body: await readBody(req),
    })

    const text = await upstream.text()
    // Cursor pagination lives in the Link header; the client needs it to walk
    // to the next page.
    const link = upstream.headers.get('link')
    if (link) res.setHeader('x-shopify-link', link)
    endAsJson(res, upstream.status, text || '{}', {
      error: `Shopify returned HTTP ${upstream.status}`,
    })
  } catch (err) {
    json(res, 502, { error: `Could not reach ${shop}: ${err.message}` })
  }
}
