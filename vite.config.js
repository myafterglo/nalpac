import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_VERSION = '2025-01'

function json(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function credentials(req) {
  return {
    shop: req.headers['x-shop-domain'],
    clientId: req.headers['x-shop-client-id'],
    clientSecret: req.headers['x-shop-client-secret'],
  }
}

// Exchanges client credentials for an access token and hands it back to the
// browser, which stores it and decides when to ask for a new one.
// https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant
function tokenEndpoint() {
  return {
    name: 'shopify-token',
    configureServer(server) {
      server.middlewares.use('/api/shopify-token', async (req, res) => {
        const { shop, clientId, clientSecret } = credentials(req)
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
            // Absolute instant, so the browser doesn't have to guess when the
            // clock started on expires_in.
            expires_at: Date.now() + body.expires_in * 1000,
          })
        } catch (err) {
          json(res, 502, { error: `Could not reach ${shop}: ${err.message}` })
        }
      })
    },
  }
}

// Nalpac's API is Basic-authenticated and, like Shopify's, unreachable from the
// browser. The client sends the already-base64-encoded pair so that credentials
// with non-ASCII characters survive the trip through a header.
function nalpacProxy() {
  return {
    name: 'nalpac-proxy',
    configureServer(server) {
      server.middlewares.use('/api/nalpac', async (req, res) => {
        const auth = req.headers['x-nalpac-auth']
        if (!auth) return json(res, 400, { error: 'Missing Nalpac username or password.' })

        // Everything after /api/nalpac is the Nalpac API path, e.g. /product?…
        try {
          const writes = req.method !== 'GET' && req.method !== 'HEAD'
          let body
          if (writes) {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            body = Buffer.concat(chunks)
          }

          const upstream = await fetch(`https://api2.nalpac.com/api${req.url}`, {
            method: req.method,
            headers: {
              Authorization: `Basic ${auth}`,
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            body,
          })
          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json')
          // Nalpac answers an auth failure with an HTML page, not JSON.
          res.end(text.trimStart().startsWith('{') || text.trimStart().startsWith('[')
            ? text
            : JSON.stringify({ error: `Nalpac returned HTTP ${upstream.status}` }))
        } catch (err) {
          json(res, 502, { error: `Could not reach api2.nalpac.com: ${err.message}` })
        }
      })
    },
  }
}

// The Shopify Admin API sends no CORS headers, so the browser can't call it
// directly. This dev-server middleware relays the request instead.
function apiProxy() {
  return {
    name: 'shopify-proxy',
    configureServer(server) {
      server.middlewares.use('/api/shopify', async (req, res) => {
        const shop = req.headers['x-shop-domain']
        const token = req.headers['x-shop-token']
        if (!shop || !token) {
          return json(res, 400, { error: 'Missing store domain or access token.' })
        }

        // Everything after /api/shopify is the Admin API path, e.g. /products.json
        // or /graphql.json.
        try {
          const writes = req.method !== 'GET' && req.method !== 'HEAD'
          let body
          if (writes) {
            const chunks = []
            for await (const chunk of req) chunks.push(chunk)
            body = Buffer.concat(chunks)
          }

          const upstream = await fetch(`https://${shop}/admin/api/${API_VERSION}${req.url}`, {
            method: req.method,
            headers: { 'X-Shopify-Access-Token': token, 'Content-Type': 'application/json' },
            body,
          })
          const text = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json')
          // Cursor pagination lives in the Link header; the client needs it to
          // walk to the next page.
          const link = upstream.headers.get('link')
          if (link) res.setHeader('x-shopify-link', link)
          res.end(text || '{}')
        } catch (err) {
          json(res, 502, { error: `Could not reach ${shop}: ${err.message}` })
        }
      })
    },
  }
}

export default defineConfig({
  // The two paths don't collide: connect only matches a mount prefix at a '/'
  // or '?' boundary, so /api/shopify-token never falls into /api/shopify.
  plugins: [react(), tokenEndpoint(), nalpacProxy(), apiProxy()],
})
