import { useEffect, useRef, useState } from 'react'
import { plainText, priceRange, variantImage } from '../shopify'
import { METAFIELD_KEY, withSkuAt } from '../metafields'
import NalpacSearchDrawer from './NalpacSearchDrawer'

// Shopify names the lone variant of an option-less product "Default Title".
function variantLabel(variant) {
  const title = variant?.title
  return !title || title === 'Default Title' ? '' : title
}

function LoupeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <line x1="10.4" y1="10.4" x2="14" y2="14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export default function ProductCard({
  product,
  creds,
  metafieldValue,
  onApply,
  onRemove,
  editable,
}) {
  const [draft, setDraft] = useState(metafieldValue ?? '')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [variantIndex, setVariantIndex] = useState(0)
  const [error, setError] = useState(null)
  const submitted = useRef(null)

  const variants = product.variants || []
  const multiVariant = variants.length > 1
  const variant = multiVariant ? variants[variantIndex] : null

  // Adopt the stored value whenever it changes underneath us (reload, or a
  // save that came back normalised by Shopify).
  useEffect(() => {
    setDraft(metafieldValue ?? '')
    // The store has caught up with the last pick, so stop chaining off it.
    if (submitted.current === metafieldValue) submitted.current = null
  }, [metafieldValue])

  // With a switcher on, the thumb follows the variant — including to nothing.
  const image = multiVariant
    ? variantImage(product, variant)
    : product.image || product.images?.[0]
  const label = variantLabel(variant)
  const price = priceRange(product)
  const changed = draft !== (metafieldValue ?? '')
  const isSet = !!metafieldValue
  const busy = saving || removing

  // Wraps around, so either arrow reaches every variant.
  function step(delta) {
    setVariantIndex((current) => (current + delta + variants.length) % variants.length)
  }

  // The field edits the metafield as stored: the whole comma-delimited list.
  // Takes the value explicitly so a Nalpac pick can save without waiting for
  // the draft state to settle.
  async function save(value) {
    setSaving(true)
    setError(null)
    submitted.current = value
    try {
      await onApply(product, value)
    } catch (err) {
      submitted.current = null // never stored, so don't build the next pick on it
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // Picking for several variants in a row can outrun Shopify, so each pick
  // builds on the last value submitted rather than the last one echoed back.
  function pick(sku, index) {
    const next = withSkuAt(submitted.current ?? metafieldValue, index, sku, variants.length)
    setDraft(next)
    // With variants there are more picks to make, so the drawer stays open.
    if (!multiVariant) setSearchOpen(false)
    save(next)
  }

  async function remove() {
    setRemoving(true)
    setError(null)
    submitted.current = null
    try {
      await onRemove(product)
    } catch (err) {
      setError(err.message)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className={`card${multiVariant ? ' card-variants' : ''}`}>
      {multiVariant && (
        <div className="variant-nav">
          <button className="variant-arrow" onClick={() => step(-1)} aria-label="Previous variant">
            ‹
          </button>
          <span className="variant-count">
            {variantIndex + 1}/{variants.length}
          </span>
          <button className="variant-arrow" onClick={() => step(1)} aria-label="Next variant">
            ›
          </button>
        </div>
      )}

      <div className="card-top">
        <div className="card-media">
          <button className="card-thumb" onClick={() => setSearchOpen(true)}>
            {image ? (
              <img src={image.src} alt={image.alt || product.title} loading="lazy" />
            ) : (
              <span className="card-thumb-empty">No image</span>
            )}
          </button>

          <span className={`status status-${product.status}`}>{product.status}</span>
          {price && (
            <span className="card-price">
              ${price.min.toFixed(2)}
              {price.max > price.min && '+'}
            </span>
          )}
        </div>
        <button className="card-main" onClick={() => setSearchOpen(true)}>
          <h3 className="card-title">{product.title}</h3>
          {label && <p className="card-variant">{label}</p>}
          <p className="card-desc">{plainText(product.body_html) || 'No description'}</p>
        </button>
      </div>

      <div className={`metafield${isSet ? ' metafield-set' : ''}`}>
        <label className="metafield-label" htmlFor={`sku-${product.id}`}>
          {METAFIELD_KEY}
        </label>
        <div className="metafield-row">
          <button
            className="loupe-btn"
            onClick={() => setSearchOpen(true)}
            disabled={!editable || busy}
            title="Search Nalpac"
            aria-label="Search Nalpac"
          >
            <LoupeIcon />
          </button>
          <input
            id={`sku-${product.id}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!editable || busy}
            placeholder={editable ? 'Not set' : 'Unavailable'}
            autoComplete="off"
          />
          {changed && (
            <button className="apply-btn" onClick={() => save(draft)} disabled={busy}>
              {saving ? 'Saving…' : 'Apply'}
            </button>
          )}
          {isSet && (
            <button className="remove-btn" onClick={remove} disabled={busy} title="Remove value">
              {removing ? 'Removing…' : 'Remove'}
            </button>
          )}
        </div>
        {error && <p className="metafield-error">{error}</p>}
      </div>

      {searchOpen && (
        <NalpacSearchDrawer
          creds={creds}
          product={product}
          metafieldValue={metafieldValue}
          onSelect={pick}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}
