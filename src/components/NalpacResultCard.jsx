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

export default function NalpacResultCard({ item, variants, assignedTo, onSelect }) {
  const [showRaw, setShowRaw] = useState(false)
  const selected = assignedTo.length > 0

  return (
    <li className={`result-box${selected ? ' result-box-selected' : ''}`}>
      <div className="result-head">
        {item.image && <img className="result-thumb" src={item.image} alt="" loading="lazy" />}
        <div className="result-headings">
          <span className="result-sku">{item.sku || 'No SKU field found'}</span>
          {selected && <span className="result-selected">✓ Selected</span>}
          <span className="result-title">{item.title || '—'}</span>
          <span className="result-meta">
            {item.price && <span>${item.price}</span>}
            {item.quantity !== undefined && <span>{item.quantity} in stock</span>}
          </span>
        </div>
        <button className="ghost-btn result-json-btn" onClick={() => setShowRaw(true)}>
          Raw JSON
        </button>
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
        {variants.length ? (
          <>
            <span className="result-actions-label">Use for</span>
            {variants.map(({ index, title }) => {
              const taken = assignedTo.includes(index)
              return (
                <button
                  key={index}
                  className={`apply-btn${taken ? ' apply-btn-done' : ''}`}
                  onClick={() => onSelect(item.sku, index)}
                  disabled={!item.sku || taken}
                  title={taken ? `${title} already uses this SKU` : `Use this SKU for ${title}`}
                >
                  {taken ? `✓ ${title}` : title}
                </button>
              )
            })}
          </>
        ) : (
          <button
            className={`apply-btn${selected ? ' apply-btn-done' : ''}`}
            onClick={() => onSelect(item.sku, 0)}
            disabled={!item.sku || selected}
          >
            {selected ? '✓ Selected' : 'Select product'}
          </button>
        )}
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
