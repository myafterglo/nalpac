import { useState } from 'react'
import ProductCard from '../components/ProductCard'
import { fetchProducts } from '../shopify'
import {
  METAFIELD_KEY,
  deleteMetafieldValue,
  fetchMetafieldValues,
  findDefinition,
  setMetafieldValue,
} from '../metafields'
import { isExpired, matchesCredentials } from '../token'

export default function Products({ creds, token, newToken, hasCredentials }) {
  const [activeOnly, setActiveOnly] = useState(true)
  const [products, setProducts] = useState(null) // null = nothing loaded yet
  const [truncated, setTruncated] = useState(false)
  const [metafields, setMetafields] = useState({})
  const [definition, setDefinition] = useState(null)
  const [metafieldWarning, setMetafieldWarning] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Metafields come from GraphQL, so a failure here (missing scope, say) must
  // not take the product list down with it.
  async function loadMetafields(list, activeToken) {
    setMetafields({})
    setDefinition(null)
    setMetafieldWarning(null)
    if (!list.length) return

    try {
      const def = await findDefinition(creds, activeToken)
      setDefinition(def)
      setMetafields(
        await fetchMetafieldValues(
          creds,
          activeToken,
          list.map((p) => p.id),
          def,
        ),
      )
    } catch (err) {
      setMetafieldWarning(`Could not read the ${METAFIELD_KEY} metafield: ${err.message}`)
    }
  }

  async function applyMetafield(product, value) {
    const stored = await setMetafieldValue(creds, token, product.id, definition, value)
    setMetafields((current) => ({ ...current, [product.id]: stored }))
  }

  async function removeMetafield(product) {
    await deleteMetafieldValue(creds, token, product.id, definition)
    setMetafields((current) => ({ ...current, [product.id]: '' }))
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      // Reuse the stored token unless it is expired or belongs to other credentials.
      let active = token
      if (!matchesCredentials(active, creds) || isExpired(active)) {
        active = await newToken()
      }

      let result
      try {
        result = await fetchProducts(creds, active, { activeOnly })
      } catch (err) {
        // A token can be revoked before it expires; take a fresh one and retry once.
        if (err.status !== 401) throw err
        active = await newToken()
        result = await fetchProducts(creds, active, { activeOnly })
      }

      setProducts(result.products)
      setTruncated(result.truncated)
      await loadMetafields(result.products, active)
    } catch (err) {
      setError(err.message)
      setProducts(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="controls">
        <button className="load-btn" onClick={load} disabled={!hasCredentials || loading}>
          {loading ? 'Loading…' : 'Load products'}
        </button>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          <span>Active only</span>
        </label>
      </div>

      {error && <p className="error">{error}</p>}
      {metafieldWarning && <p className="warning">{metafieldWarning}</p>}

      {products === null && !error && (
        <p className="empty">
          Add your store credentials under <strong>Credentials</strong>, then click{' '}
          <strong>Load products</strong>.
        </p>
      )}

      {products !== null && products.length === 0 && (
        <p className="empty">No {activeOnly ? 'active ' : ''}products found.</p>
      )}

      {products?.length > 0 && (
        <>
          <p className="count">
            {products.length} {activeOnly ? 'active ' : ''}product
            {products.length === 1 ? '' : 's'}
            {truncated && ' — stopped at the page limit, more remain on the store'}
          </p>
          <div className="grid">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                creds={creds}
                metafieldValue={metafields[product.id]}
                onApply={applyMetafield}
                onRemove={removeMetafield}
                editable={!!definition}
              />
            ))}
          </div>
        </>
      )}

    </>
  )
}
