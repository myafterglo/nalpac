import { endAsJson, json, readBody, upstreamPath } from '../_proxy.js'

// Nalpac's API is Basic-authenticated and, like Shopify's, unreachable from the
// browser. The client sends the already-base64-encoded pair so that credentials
// with non-ASCII characters survive the trip through a header.
export default async function handler(req, res) {
  const auth = req.headers['x-nalpac-auth']
  if (!auth) return json(res, 400, { error: 'Missing Nalpac username or password.' })

  try {
    const path = upstreamPath(req, '/api/nalpac')
    const upstream = await fetch(`https://api2.nalpac.com/api${path}`, {
      method: req.method,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: await readBody(req),
    })

    const text = await upstream.text()
    endAsJson(res, upstream.status, text, {
      error: `Nalpac returned HTTP ${upstream.status}`,
    })
  } catch (err) {
    json(res, 502, { error: `Could not reach api2.nalpac.com: ${err.message}` })
  }
}
