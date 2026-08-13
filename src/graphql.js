/**
 * Calls the Shopify GraphQL Admin API through the dev-server relay.
 * GraphQL reports its own failures inside a 200 response, so those are
 * unwrapped into thrown errors here.
 */
export async function graphql(creds, token, query, variables) {
  const res = await fetch('/api/shopify/graphql.json', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-shop-domain': creds.shop.trim().replace(/^https?:\/\//, '').replace(/\/$/, ''),
      'x-shop-token': token.access_token,
    },
    body: JSON.stringify({ query, variables }),
  })

  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const error = new Error(body.errors || body.error || `HTTP ${res.status}`)
    error.status = res.status
    throw error
  }
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '))
  return body.data
}

export const productGid = (productId) => `gid://shopify/Product/${productId}`

// nodes(ids:) is billed per id, so keep each query well inside the cost limit.
export const BATCH_SIZE = 100
