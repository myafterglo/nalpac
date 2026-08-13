import { useEffect, useState } from 'react'

// The response fields aren't documented, so show whatever scalar values the
// record carries beyond the ones already displayed above.
function extraFields(item) {
  const shown = new Set(
    [item.sku, item.title, item.price, item.quantity, item.image].filter(Boolean).map(String),
  )
  return Object.entries(item.raw)
    .filter(([, value]) => value !== null && value !== '' && typeof value !== 'object')
    .filter(([, value]) => !shown.has(String(value)))
}

function RawJsonModal({ item, onClose }) {
  useEffect(() => {
    // Capture phase plus stopPropagation so Escape closes this modal without
    // also reaching the drawer's own Escape handler on window.
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{item.sku || 'Nalpac product'}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <pre className="result-raw">{JSON.stringify(item.raw, null, 2)}</pre>
      </div>
    </div>
  )
}

export default function NalpacResultCard({ item, onSelect }) {
  const [showRaw, setShowRaw] = useState(false)

  return (
    <li className="result-box">
      <div className="result-head">
        {item.image && <img className="result-thumb" src={item.image} alt="" loading="lazy" />}
        <div className="result-headings">
          <span className="result-sku">{item.sku || 'No SKU field found'}</span>
          <span className="result-title">{item.title || '—'}</span>
          <span className="result-meta">
            {item.price && <span>${item.price}</span>}
            {item.quantity !== undefined && <span>{item.quantity} in stock</span>}
          </span>
        </div>
      </div>

      <dl className="result-fields">
        {extraFields(item).map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{String(value)}</dd>
          </div>
        ))}
      </dl>

      <div className="result-actions">
        <button className="apply-btn" onClick={() => onSelect(item.sku)} disabled={!item.sku}>
          Select product
        </button>
        <button className="ghost-btn" onClick={() => setShowRaw(true)}>
          Raw JSON
        </button>
      </div>

      {showRaw && <RawJsonModal item={item} onClose={() => setShowRaw(false)} />}
    </li>
  )
}
