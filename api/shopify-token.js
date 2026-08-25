import { json } from './_proxy.js'

// Exchanges client credentials for an access token and hands it back to the
// browser, which stores it and decides when to ask for a new one.
// https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant
export default async function handler(req, res) {
  const shop = req.headers['x-shop-domain']
  const clientId = req.headers['x-shop-client-id']
  const clientSecret = req.headers['x-shop-client-secret']

  if (!shop || !clientId || !clientSecret) {
    return json(res, 400, { error: 'Missing store domain, client ID, or client secret.' })
  }

  try {
    const upstream = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
    })

    // Shopify answers a bad credential pair with an HTML error page, not JSON.
    const raw = await upstream.text()
    let body = {}
    try {
      body = JSON.parse(raw)
    } catch {
      body = {}
    }

    if (!upstream.ok || !body.access_token) {
      const reason =
        body.error_description ||
        body.error ||
        (upstream.status === 400 || upstream.status === 401
          ? 'the store rejected them. Check the client ID and secret, that the app ' +
            'is installed on this store, and that the app and store belong to the ' +
            'same Shopify organization — the client credentials grant is limited ' +
            'to that case.'
          : `HTTP ${upstream.status}`)
      return json(res, 400, {
        error: `Could not exchange client credentials for an access token: ${reason}`,
      })
    }

    json(res, 200, {
      access_token: body.access_token,
      scope: body.scope,
      // Absolute instant, so the browser doesn't have to guess when the clock
      // started on expires_in.
      expires_at: Date.now() + body.expires_in * 1000,
    })
  } catch (err) {
    json(res, 502, { error: `Could not reach ${shop}: ${err.message}` })
  }
}
