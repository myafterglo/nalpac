# Shopify Products

A small React app that lists active products from a Shopify store.

## Run

```bash
npm install
npm run dev
```

The left sidebar is grouped: **Home**; under *Shopify*, **Products** (the
product list and SKU editor) and **Orders**; under *Nalpac*, **Orders**
(`GET api/order`, with filters
for ship-to name, PO number, order number, and tracking) and
**Carriers** (`GET api/carrier` — the IDs the create-order form needs as its
shipping option ID).

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

The Orders page lists the 50 most recent orders, with a **Show 50 more** button
that walks the `Link`-header cursor until the store runs out — number, date, customer,
fulfillment and payment status, channel, and total — each with a line-item table
of image, price, quantity, and line total. REST line items carry no image, so
each distinct `product_id` is looked up over GraphQL (`featuredImage`) in
batches of 100 after the orders load; a failure there leaves placeholders rather
than blanking the list. **Unfulfilled only** adds
`fulfillment_status=unfulfilled`; an order Shopify reports as `null` is shown as
unfulfilled. Note the REST endpoint defaults to *oldest* first, so the request
asks for `order=created_at desc` and the results are re-sorted client-side in
case that parameter is ignored. `read_orders` only reaches back 60 days —
further needs `read_all_orders`.

An order containing products that carry a `nalpac_sku` gets a **Create Nalpac
order** button, which opens a form pre-filled from the Shopify order: date, PO number from the order name, notes,
shipping address, phone, email, and one line per tagged product with its
quantity. Each line picks its own warehouse (Detroit 15 / Phoenix 25). Submitting posts to `api/order`, which places a real
order. The shipping option is chosen from the carrier list — wiring up a carrier
dropdown needs the GET Carriers endpoint's documentation.

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
type, so they survive a reload. The store domain defaults to the bare
`.myshopify.com` suffix when nothing is stored yet, so you only type the store
name in front of it. Note that a token in `localStorage` is readable by any
script running on the page — clear the key to remove it.

## Why there's a proxy

Neither the Shopify Admin API nor Nalpac's API returns CORS headers, so the
browser can't call either one directly — and Shopify's OAuth token endpoint
won't answer a cross-origin request either. Every call therefore goes through a
relay on our own origin:

| Route | Forwards to |
| --- | --- |
| `/api/shopify-token` | `https://<store>/admin/oauth/access_token` |
| `/api/shopify/*` | `https://<store>/admin/api/2025-01/*` |
| `/api/nalpac/*` | `https://api2.nalpac.com/api/*` |

The three handlers live in `api/` as Vercel serverless functions. `vite.config.js`
mounts those same handlers onto the dev server, so there is one implementation
rather than a dev copy and a production copy.

`npm run preview` serves the built bundle without them, so use `npm run dev`
locally — under preview the `/api/*` routes 404.

## Deploying

`vercel.json` rewrites every non-`/api` path to `index.html`, which the
path-based routing in `src/usePage.js` needs so a refresh on `/orders` doesn't
404. The Vite preset picks up `dist/` on its own; no build settings to set.

Two things to know about the deployed relay:

- It has **no auth of its own**. Credentials arrive in request headers from the
  browser, so anyone who finds the URL can use it as a proxy to a store of their
  choosing. Keep the deployment private, or move the secrets into environment
  variables server-side and add a check.
- The client secret is kept in `localStorage` and sent on every token request.
  That is fine for a local tool and worth revisiting for anything shared.
