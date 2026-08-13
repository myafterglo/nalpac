import { useEffect, useState } from 'react'
import { isExpired } from '../token'

function countdown(expiresAt) {
  const ms = expiresAt - Date.now()
  if (ms <= 0) return 'expired'
  const hours = Math.floor(ms / 3_600_000)
  const minutes = Math.floor((ms % 3_600_000) / 60_000)
  return hours > 0 ? `in ${hours}h ${minutes}m` : `in ${minutes}m`
}

export default function CredentialsModal({
  creds,
  onChange,
  token,
  error,
  onRefresh,
  refreshing,
  canRefresh,
  onClose,
}) {
  const [revealed, setRevealed] = useState(false)
  const [, tick] = useState(0)

  // Keep the countdown honest while the modal sits open.
  useEffect(() => {
    if (!token) return
    const id = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(id)
  }, [token])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (key) => (e) => onChange({ ...creds, [key]: e.target.value })
  const expired = token && isExpired(token)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Credentials</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <h3 className="modal-section modal-section-first">Shopify</h3>

        <label className="field">
          <span>Store domain</span>
          <input
            value={creds.shop}
            onChange={set('shop')}
            placeholder="my-store.myshopify.com"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Client ID</span>
          <input
            value={creds.clientId}
            onChange={set('clientId')}
            placeholder="API key"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Client secret</span>
          <input
            type="password"
            value={creds.secret}
            onChange={set('secret')}
            placeholder="API secret key"
            autoComplete="off"
          />
        </label>

        <h3 className="modal-section">Nalpac</h3>

        <label className="field">
          <span>Username</span>
          <input
            value={creds.nalpacUser}
            onChange={set('nalpacUser')}
            placeholder="Registered email address"
            autoComplete="off"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={creds.nalpacPassword}
            onChange={set('nalpacPassword')}
            placeholder="API password"
            autoComplete="off"
          />
        </label>

        <h3 className="modal-section">Shopify access token</h3>

        <section className={`token-section${expired ? ' token-section-expired' : ''}`}>
          <div className="token-head">
            <h3>Token</h3>
            <button className="token-btn" onClick={onRefresh} disabled={!canRefresh || refreshing}>
              {refreshing ? 'Requesting…' : token ? 'New token' : 'Get access token'}
            </button>
          </div>

          {error && <p className="metafield-error">{error}</p>}

          {token ? (
            <>
              <code className="token-value" onClick={() => setRevealed(!revealed)} title="Click to toggle">
                {revealed
                  ? token.access_token
                  : `${token.access_token.slice(0, 10)}…${token.access_token.slice(-4)}`}
              </code>
              <dl className="token-meta">
                <div>
                  <dt>Expires</dt>
                  <dd className={expired ? 'token-expired' : undefined}>
                    {new Date(token.expires_at).toLocaleString()} ({countdown(token.expires_at)})
                  </dd>
                </div>
                {token.scope && (
                  <div>
                    <dt>Scopes</dt>
                    <dd className="token-scope">{token.scope}</dd>
                  </div>
                )}
              </dl>
            </>
          ) : (
            <p className="token-hint">
              None yet — one is requested automatically when you load products.
            </p>
          )}
        </section>
      </div>
    </div>
  )
}
