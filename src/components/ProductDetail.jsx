import { buildProductRows } from '../productRows'
import { useScrollLock } from '../useScrollLock'

export default function ProductDetail({ product, metafieldValue, onClose }) {
  useScrollLock()
  const image = product.image || product.images?.[0]

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="detail" onClick={(e) => e.stopPropagation()}>
        <div className="detail-head">
          <h2>{product.title}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {image && <img className="detail-image" src={image.src} alt={product.title} />}

        <dl className="kv">
          {buildProductRows(product, metafieldValue).map(([key, value]) => (
            <div className="kv-row" key={key}>
              <dt>{key}</dt>
              <dd>{String(value)}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>
  )
}
