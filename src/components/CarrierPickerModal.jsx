import { useEffect, useState } from 'react'
import { fetchCarriers } from '../nalpac'
import { useScrollLock } from '../useScrollLock'

export default function CarrierPickerModal({ creds, onSelect, onClose }) {
  useScrollLock()
  const [carriers, setCarriers] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [manual, setManual] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchCarriers(creds)
      .then((list) => !cancelled && setCarriers(list))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [creds])

  useEffect(() => {
    // Capture phase plus stopPropagation so Escape closes this modal without
    // also reaching the order drawer's Escape handler on window.
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  const choose = (id, label) => onSelect({ id: String(id), label })

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Choose a shipping option</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {loading && <p className="empty">Loading carriers…</p>}
        {error && <p className="error">{error}</p>}
        {carriers?.length === 0 && <p className="empty">No carriers returned.</p>}

        {carriers?.length > 0 && (
          <ul className="carriers">
            {carriers.map((carrier, index) => (
              <li className="carrier" key={carrier.id || index}>
                <div className="carrier-head">
                  <span className="carrier-name">{carrier.name || 'Unnamed carrier'}</span>
                  {carrier.id && <span className="carrier-id">ID {carrier.id}</span>}
                </div>

                {carrier.options.length > 0 ? (
                  <ul className="options">
                    {carrier.options.map((option, i) => (
                      <li key={option.id || i}>
                        <button
                          className="option-btn"
                          onClick={() =>
                            choose(option.id, `${carrier.name} — ${option.name}`.trim())
                          }
                          disabled={!option.id}
                        >
                          <span className="option-id">{option.id || '—'}</span>
                          <span className="option-name">{option.name || 'Unnamed option'}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="options">
                    <li>
                      <button
                        className="option-btn"
                        onClick={() => choose(carrier.id, carrier.name)}
                        disabled={!carrier.id}
                      >
                        <span className="option-id">{carrier.id || '—'}</span>
                        <span className="option-name">Use this carrier</span>
                      </button>
                    </li>
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}

        {/* Escape hatch if the carrier list can't be reached. */}
        <form
          className="manual-id"
          onSubmit={(e) => {
            e.preventDefault()
            if (manual.trim()) choose(manual.trim(), `ID ${manual.trim()}`)
          }}
        >
          <label className="field">
            <span>Or enter an ID directly</span>
            <input
              type="number"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Shipping option ID"
            />
          </label>
          <button className="ghost-btn" type="submit" disabled={!manual.trim()}>
            Use this ID
          </button>
        </form>
      </div>
    </div>
  )
}
