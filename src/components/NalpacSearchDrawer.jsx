import { useEffect, useState } from 'react'
import NalpacResultCard from './NalpacResultCard'
import RawJsonModal from './RawJsonModal'
import { buildProductRows } from '../productRows'
import { variantImage } from '../shopify'
import { parseSkuList } from '../metafields'
import {
  DEFAULT_LOCATION_ID,
  LOCATIONS,
  hasNalpacCredentials,
  searchNalpacProducts,
} from '../nalpac'
import { useScrollLock } from '../useScrollLock'

// Every variant, under the description.
function VariantTable({ product }) {
  const variants = product.variants || []

  return (
    <table className="variant-table">
      <thead>
        <tr>
          <th className="variant-thumb-col" />
          <th>Variant</th>
          <th>SKU</th>
          <th className="num">Price</th>
          <th className="num">Stock</th>
        </tr>
      </thead>
      <tbody>
        {variants.map((variant) => {
          const image = variantImage(product, variant)
          return (
            <tr key={variant.id}>
              <td className="variant-thumb-col">
                {image ? (
                  <img className="variant-thumb" src={image.src} alt="" loading="lazy" />
                ) : (
                  <span className="variant-thumb variant-thumb-empty" />
                )}
              </td>
              <td>{variant.title}</td>
              <td className="variant-sku">{variant.sku || '—'}</td>
              <td className="num">{variant.price ? `$${variant.price}` : '—'}</td>
              <td className="num">{variant.inventory_quantity ?? '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// The full Shopify product, kept in view while searching Nalpac.
function ShopifyProductPanel({ product, metafieldValue }) {
  const [showRaw, setShowRaw] = useState(false)
  const image = product.image || product.images?.[0]

  return (
    <section className="shopify-ref">
      {image && <img className="shopify-ref-image" src={image.src} alt="" loading="lazy" />}
      <div className="shopify-ref-main">
        <div className="shopify-ref-actions">
          <button className="ghost-btn" onClick={() => setShowRaw(true)}>
            Raw JSON
          </button>
        </div>

        <dl className="kv kv-grid">
          {buildProductRows(product, metafieldValue).map(([key, value]) => (
            <div className={`kv-row${key === 'Description' ? ' kv-row-wide' : ''}`} key={key}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>

        {(product.variants || []).length > 1 && <VariantTable product={product} />}
      </div>

      {showRaw && (
        <RawJsonModal title={product.title} data={product} onClose={() => setShowRaw(false)} />
      )}
    </section>
  )
}

/** The variants a Nalpac SKU is already assigned to, by index. */
function assignedTo(sku, product, metafieldValue) {
  if (!sku) return []
  const list = parseSkuList(metafieldValue)
  const variants = product.variants || []
  // A lone SKU covers every variant, so it is assigned to all of them.
  if (list.length === 1) return list[0] === sku ? variants.map((_, index) => index) : []
  return list.flatMap((stored, index) => (stored === sku ? [index] : []))
}

export default function NalpacSearchDrawer({
  creds,
  product,
  metafieldValue,
  onSelect,
  onClose,
}) {
  useScrollLock()
  const [keyword, setKeyword] = useState(product.title)
  const [excludeDiscontinued, setExcludeDiscontinued] = useState(true)
  const [locationId, setLocationId] = useState(DEFAULT_LOCATION_ID)
  const [results, setResults] = useState(null) // null = no search run yet
  const [total, setTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ready = hasNalpacCredentials(creds)
  // Empty for a single-variant product: it gets one plain Select button.
  const variants = product.variants?.length > 1
    ? product.variants.map((variant, index) => ({ index, title: variant.title }))
    : []

  async function search(e) {
    e?.preventDefault()
    setSearching(true)
    setError(null)
    try {
      const found = await searchNalpacProducts(creds, { keyword, excludeDiscontinued, locationId })
      setResults(found.items)
      setTotal(found.total)
    } catch (err) {
      setError(err.message)
      setResults(null)
    } finally {
      setSearching(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="detail-head">
          <div>
              <h2>Nalpac search</h2>
              <p className="drawer-sub">for {product.title}</p>
            </div>
            <button className="close-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          <ShopifyProductPanel product={product} metafieldValue={metafieldValue} />

          {!ready && (
            <p className="warning">
              Add your Nalpac username and password under <strong>Credentials</strong> first.
            </p>
          )}

          <form className="search-form search-form-wide" onSubmit={search}>
            <label className="field">
              <span>Keyword</span>
              <input
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                autoComplete="off"
              />
            </label>

            <label className="field">
              <span>Location</span>
              <select value={locationId} onChange={(e) => setLocationId(Number(e.target.value))}>
                {LOCATIONS.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={excludeDiscontinued}
                onChange={(e) => setExcludeDiscontinued(e.target.checked)}
              />
              <span>Exclude discontinued</span>
            </label>

            <button className="load-btn" type="submit" disabled={!ready || searching}>
              {searching ? 'Searching…' : 'Search'}
            </button>
          </form>

          {error && <p className="error">{error}</p>}

          {results === null && !error && !searching && (
            <p className="empty">Enter a keyword and search.</p>
          )}
          {results?.length === 0 && !searching && (
            <p className="empty">No matching Nalpac products.</p>
          )}

          {results?.length > 0 && (
            <p className="count">
              {results.length} shown{total > results.length ? ` of ${total} matches` : ''}
            </p>
          )}
        </div>

        {(results?.length > 0 || searching) && (
          <div className="drawer-results">
            <div className={`results-wrap${searching ? ' is-loading' : ''}`}>
              {results?.length > 0 && (
                <ul className="results">
                  {results.map((item, index) => (
                    <NalpacResultCard
                      key={item.sku || index}
                      item={item}
                      variants={variants}
                      assignedTo={assignedTo(item.sku, product, metafieldValue)}
                      onSelect={onSelect}
                    />
                  ))}
                </ul>
              )}

              {searching && (
                <div className="loading-overlay">
                  <span className="spinner" />
                  <span>Searching Nalpac…</span>
                </div>
              )}
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
