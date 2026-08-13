import { useEffect } from 'react'
import { useScrollLock } from '../useScrollLock'

/** Shows an API record verbatim, for fields the UI doesn't map explicitly. */
export default function RawJsonModal({ title, data, onClose }) {
  useScrollLock()

  useEffect(() => {
    // Capture phase plus stopPropagation so Escape closes this modal without
    // also reaching a parent drawer's Escape handler on window.
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
          <h2>{title}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <pre className="result-raw">{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  )
}
