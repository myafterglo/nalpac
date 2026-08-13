import { useEffect, useState } from 'react'
import { plainText, priceRange } from '../shopify'
import { METAFIELD_KEY } from '../metafields'
import NalpacSearchDrawer from './NalpacSearchDrawer'

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
  onSelect,
  metafieldValue,
  onApply,
  onRemove,
  editable,
}) {
  const [draft, setDraft] = useState(metafieldValue ?? '')
  const [saving, setSaving] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [error, setError] = useState(null)

  // Adopt the stored value whenever it changes underneath us (reload, or a
  // save that came back normalised by Shopify).
  useEffect(() => {
    setDraft(metafieldValue ?? '')
  }, [metafieldValue])

  const image = product.image || product.images?.[0]
  const price = priceRange(product)
  const changed = draft !== (metafieldValue ?? '')
  const isSet = !!metafieldValue
  const busy = saving || removing

  // Takes the value explicitly so a Nalpac pick can save without waiting for
  // the draft state to settle.
  async function save(value) {
    setSaving(true)
    setError(null)
    try {
      await onApply(product, value)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setRemoving(true)
    setError(null)
    try {
      await onRemove(product)
    } catch (err) {
      setError(err.message)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div className="card">
      <button className="card-main" onClick={() => onSelect(product)}>
        <div className="card-media">
          <div className="card-thumb">
            {image ? (
              <img src={image.src} alt={image.alt || product.title} loading="lazy" />
            ) : (
              <span className="card-thumb-empty">No image</span>
            )}
          </div>
          <span className={`status status-${product.status}`}>{product.status}</span>
          {price && (
            <span className="card-price">
              ${price.min.toFixed(2)}
              {price.max > price.min && '+'}
            </span>
          )}
        </div>
        <div className="card-body">
          <h3 className="card-title">{product.title}</h3>
          <p className="card-desc">{plainText(product.body_html) || 'No description'}</p>
        </div>
      </button>

      <div className={`metafield${metafieldValue ? ' metafield-set' : ''}`}>
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
          onSelect={(sku) => {
            // Fill the input and save straight away. On failure the draft keeps
            // the value, so Apply stays available to retry.
            setDraft(sku)
            setSearchOpen(false)
            save(sku)
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}
