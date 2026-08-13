# Shopify Products

A small React app that lists active products from a Shopify store.

## Run

```bash
npm install
npm run dev
```

A left sidebar holds three pages: **Home** (setup instructions), **Products**
(the product list and SKU editor), and **Orders** (not implemented yet).

Open **Credentials** in the top bar to enter the Shopify store domain, client
ID, and client secret, plus your Nalpac API username and password. All of them
are saved to `localStorage`. Then go to Products and click **Load products**.

The magnifier beside each `nalpac_sku` input opens a drawer that searches
Nalpac's catalog (`GET https://api2.nalpac.com/api/product`, HTTP Basic auth)
through the same dev-server relay. The keyword is pre-filled with the Shopify
product title, **Exclude discontinued** is on, and the location defaults to
Detroit (15); Phoenix is 25. Nothing is searched until you press **Search**.
**Select product** on a result writes that SKU to the Shopify metafield right
away; if the save fails the value stays in the input so **Apply** can retry. The **Active only**
checkbox (on by default) filters to `status=active`; unchecked, you get drafts
and archived products too.

Each card shows the product's status as a badge and its `nalpac_sku` metafield
in an input box. Edit the input and an **Apply** button appears; clicking it
writes the value back to Shopify. When a value is set, a **Remove** button
deletes the metafield outright (via `metafieldsDelete`) — Shopify rejects an
empty string for most defined types, so clearing means deleting. The app finds the metafield's namespace and
type from the store's metafield definitions rather than assuming them, falling
back to `custom` / `single_line_text_field` if no definition exists. Writing
needs the `write_products` scope; reading the values needs `read_products`. The
Orders page will need `read_orders`.

Products are fetched 250 at a time and every page is followed via the cursor in
Shopify's `Link` header, so the full catalog loads rather than just the first
page. The walk stops after 40 pages (10,000 products) and says so in the count
line if it hits that ceiling.

## Credentials

Enter the store domain, client ID (API key), and client secret. The Admin API
itself is authenticated with an access token rather than the secret, so the
relay mints one for you with the [client credentials
grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/client-credentials-grant):

```
POST https://{shop}/admin/oauth/access_token
grant_type=client_credentials&client_id=…&client_secret=…
```

The token it returns lasts 24 hours (`expires_in: 86399`). It's shown in the
bar under the top bar with its expiry and a live countdown, and saved to
`localStorage` under `shopify-access-token` alongside the store and client ID it
belongs to. Loading products reuses that stored token until it is within a
minute of expiring, the credentials change, or the API answers `401` — any of
which trigger a fresh exchange. **New token** forces one at any time.

Click the token to reveal it in full.

This grant only works for an app installed on a store in **the same Shopify
organization** as the app. Public and custom distribution apps have to use token
exchange or the authorization code grant instead. Grant the app `read_products`.

All three fields are saved to `localStorage` under `shopify-credentials` as you
type, so they survive a reload. The store domain defaults to
`afterglosted.myshopify.com` when nothing is stored yet. Note that a token in
`localStorage` is readable by any script running on the page — clear the key to
remove it.

## Why there's a proxy

The Admin API returns no CORS headers, so a browser can't call it directly.
`vite.config.js` registers a small dev-server middleware at `/api/shopify/*`
that forwards each request to `https://<store>/admin/api/2025-01/*` with the
token attached, exchanging the client credentials for an access token first.

Note this is a **dev-server** middleware: `npm run build` + `npm run preview`
serves the static bundle without it, so product loading only works under
`npm run dev`. For a deployed version, move the relay into a real backend.
