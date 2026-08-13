import { useState } from 'react'
import RawJsonModal from '../components/RawJsonModal'
import { fetchCarriers, hasNalpacCredentials } from '../nalpac'

export default function Carriers({ creds }) {
  const [carriers, setCarriers] = useState(null) // null = nothing loaded yet
  const [inspecting, setInspecting] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const ready = hasNalpacCredentials(creds)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      setCarriers(await fetchCarriers(creds))
    } catch (err) {
      setError(err.message)
      setCarriers(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <h1 className="page-title">Carriers</h1>
      <p className="empty">
        Each carrier's ID is what the create-order form wants as its shipping option ID.
      </p>

      {!ready && (
        <p className="warning">
          Add your Nalpac username and password under <strong>Credentials</strong> first.
        </p>
      )}

      <div className="controls">
        <button className="load-btn" onClick={load} disabled={!ready || loading}>
          {loading ? 'Loading…' : 'Load carriers'}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
      {carriers?.length === 0 && <p className="empty">No carriers returned.</p>}

      {carriers?.length > 0 && (
        <>
          <p className="count">{carriers.length} carriers</p>
          <ul className="carriers">
            {carriers.map((carrier, index) => (
              <li className="carrier" key={carrier.id || index}>
                <div className="carrier-head">
                  <span className="carrier-name">{carrier.name || 'Unnamed carrier'}</span>
                  {carrier.id && <span className="carrier-id">ID {carrier.id}</span>}
                  <button className="ghost-btn" onClick={() => setInspecting(carrier)}>
                    Raw JSON
                  </button>
                </div>

                {carrier.options.length > 0 ? (
                  <ul className="options">
                    {carrier.options.map((option, i) => (
                      <li key={option.id || i}>
                        <span className="option-id">{option.id || '—'}</span>
                        <span className="option-name">{option.name || 'Unnamed option'}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="options-empty">
                    No nested shipping options — use this carrier's own ID.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      {inspecting && (
        <RawJsonModal
          title={inspecting.name || 'Carrier'}
          data={inspecting.raw}
          onClose={() => setInspecting(null)}
        />
      )}
    </>
  )
}
