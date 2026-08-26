import { BATCH_SIZE, graphql, productGid as gid } from './graphql'

// The product metafield surfaced and edited on each card.
export const METAFIELD_KEY = 'nalpac_sku'

/**
 * The metafield carries one SKU per variant, in variant order, comma
 * separated — "123,456". Spaces around the commas are tolerated on the way in.
 */
export function parseSkuList(value) {
  return String(value ?? '')
    .split(',')
    .map((part) => part.trim())
}

/** The SKU covering one variant. A lone SKU stands for every variant. */
export function skuAt(value, index) {
  const list = parseSkuList(value)
  if (list.length === 1) return list[0]
  return list[index] || ''
}

/** The value with `sku` put at `index`, leaving the other variants alone. */
export function withSkuAt(value, index, sku, variantCount = 1) {
  const list = parseSkuList(value)
  const next = Array.from({ length: Math.max(list.length, variantCount, index + 1) }, (_, i) =>
    list[i] || '',
  )
  next[index] = sku.trim()
  // A blank between SKUs holds its variant's place; trailing ones say nothing.
  while (next.length && !next[next.length - 1]) next.pop()
  return next.join(',')
}

// Used when the store has no definition for the key — the metafield still gets
// created, it just isn't backed by a definition.
const FALLBACK_DEFINITION = { namespace: 'custom', key: METAFIELD_KEY, type: 'single_line_text_field' }

/**
 * Looks the key up in the store's metafield definitions so the namespace and
 * type don't have to be guessed. Falls back to custom/single_line_text_field.
 */
export async function findDefinition(creds, token) {
  const data = await graphql(
    creds,
    token,
    `query FindDefinition($key: String!) {
       metafieldDefinitions(ownerType: PRODUCT, key: $key, first: 10) {
         nodes { namespace key type { name } }
       }
     }`,
    { key: METAFIELD_KEY },
  )

  const found = data?.metafieldDefinitions?.nodes?.[0]
  if (!found) return { ...FALLBACK_DEFINITION, defined: false }
  return { namespace: found.namespace, key: found.key, type: found.type.name, defined: true }
}

/** Returns { [productId]: value } for the products that have the metafield set. */
export async function fetchMetafieldValues(creds, token, productIds, definition) {
  const values = {}

  for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
    const batch = productIds.slice(i, i + BATCH_SIZE)
    const data = await graphql(
      creds,
      token,
      `query MetafieldValues($ids: [ID!]!, $namespace: String!, $key: String!) {
         nodes(ids: $ids) {
           ... on Product {
             id
             metafield(namespace: $namespace, key: $key) { value }
           }
         }
       }`,
      { ids: batch.map(gid), namespace: definition.namespace, key: definition.key },
    )

    for (const node of data?.nodes || []) {
      if (!node?.id) continue
      const id = node.id.split('/').pop()
      values[id] = node.metafield?.value ?? ''
    }
  }

  return values
}

/** Writes one product's metafield. Resolves to the stored value. */
export async function setMetafieldValue(creds, token, productId, definition, value) {
  const data = await graphql(
    creds,
    token,
    `mutation SetMetafield($metafields: [MetafieldsSetInput!]!) {
       metafieldsSet(metafields: $metafields) {
         metafields { value }
         userErrors { field message code }
       }
     }`,
    {
      metafields: [
        {
          ownerId: gid(productId),
          namespace: definition.namespace,
          key: definition.key,
          type: definition.type,
          value,
        },
      ],
    },
  )

  const result = data?.metafieldsSet
  if (result?.userErrors?.length) throw new Error(result.userErrors.map((e) => e.message).join('; '))
  return result?.metafields?.[0]?.value ?? value
}

/**
 * Removes one product's metafield entirely. Shopify rejects an empty string for
 * most defined types, so clearing a value means deleting it rather than setting
 * it blank.
 */
export async function deleteMetafieldValue(creds, token, productId, definition) {
  const data = await graphql(
    creds,
    token,
    `mutation DeleteMetafield($metafields: [MetafieldIdentifierInput!]!) {
       metafieldsDelete(metafields: $metafields) {
         deletedMetafields { key }
         userErrors { field message }
       }
     }`,
    {
      metafields: [
        { ownerId: gid(productId), namespace: definition.namespace, key: definition.key },
      ],
    },
  )

  const result = data?.metafieldsDelete
  if (result?.userErrors?.length) throw new Error(result.userErrors.map((e) => e.message).join('; '))
}
