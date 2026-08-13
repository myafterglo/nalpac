import { useState } from 'react'
import RawJsonModal from './RawJsonModal'

// The response fields aren't documented, so show whatever scalar values the
// record carries beyond the ones already displayed above.
function extraFields(item) {
  const shown = new Set(
    [item.sku, item.title, item.price, item.quantity, item.image].filter(Boolean).map(String),
  )
  const entries = Object.entries(item.raw)
    .filter(([, value]) => value !== null && value !== '' && typeof value !== 'object')
    .filter(([, value]) => !shown.has(String(value)))

  // Manufacturer stays in the list, just at the top of it.
  const isManufacturer = ([, value]) => !!item.manufacturer && String(value) === item.manufacturer
  return [...entries.filter(isManufacturer), ...entries.filter((e) => !isManufacturer(e))]
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

      {showRaw && (
        <RawJsonModal
          title={item.sku || 'Nalpac product'}
          data={item.raw}
          onClose={() => setShowRaw(false)}
        />
      )}
    </li>
  )
}
