import { useEffect, useState } from 'react'
import { LOCATIONS, createNalpacOrder, hasNalpacCredentials } from '../nalpac'
import { addressLines, customerName, money } from '../orders'
import { draftFromShopifyOrder, toRequestBody, validate } from '../nalpacOrder'
import CarrierPickerModal from './CarrierPickerModal'
import { useScrollLock } from '../useScrollLock'

export default function NalpacOrderDrawer({ creds, order, details, onClose }) {
  useScrollLock()
  const [draft, setDraft] = useState(() => draftFromShopifyOrder(order, details))
  const [test, setTest] = useState(true) // default to the non-committal endpoint
  const [pickerOpen, setPickerOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const ready = hasNalpacCredentials(creds)
  const set = (key) => (e) =>
    setDraft((d) => ({ ...d, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const setAddress = (key) => (e) =>
    setDraft((d) => ({ ...d, ShippingAddress: { ...d.ShippingAddress, [key]: e.target.value } }))
  const setLine = (key, field) => (e) =>
    setDraft((d) => ({
      ...d,
      lines: d.lines.map((l) => (l.key === key ? { ...l, [field]: e.target.value } : l)),
    }))
  const dropLine = (key) =>
    setDraft((d) => ({ ...d, lines: d.lines.filter((l) => l.key !== key) }))

  async function submit(e) {
    e.preventDefault()
    const problem = validate(draft)
    if (problem) return setError(problem)

    setSubmitting(true)
    setError(null)
    try {
      setCreated(await createNalpacOrder(creds, toRequestBody(draft), { test }))
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer drawer-form" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="detail-head">
            <div>
              <h2>Create Nalpac order</h2>
              <p className="drawer-sub">from Shopify order {order.name}</p>
            </div>
            <button className="close-btn" onClick={onClose} aria-label="Close">
              ×
            </button>
          </div>

          <section className="order-summary">
            <h3 className="order-summary-label">From Shopify</h3>
            <dl className="order-summary-grid">
              <div>
                <dt>Order</dt>
                <dd>{order.name}</dd>
              </div>
              <div>
                <dt>Placed</dt>
                <dd>{new Date(order.created_at).toLocaleDateString()}</dd>
              </div>
              <div>
                <dt>Total</dt>
                <dd>{money(order.total_price, order.currency)}</dd>
              </div>
              <div>
                <dt>Customer</dt>
                <dd>
                  {customerName(order)}
                  {order.email && <span className="summary-sub">{order.email}</span>}
                  {(order.shipping_address?.phone || order.phone) && (
                    <span className="summary-sub">
                      {order.shipping_address?.phone || order.phone}
                    </span>
                  )}
                </dd>
              </div>
              <div className="order-summary-address">
                <dt>Ship to</dt>
                <dd>
                  {addressLines(order.shipping_address).length ? (
                    addressLines(order.shipping_address).map((line) => (
                      <span className="summary-line" key={line}>
                        {line}
                      </span>
                    ))
                  ) : (
                    <span className="summary-line">No shipping address</span>
                  )}
                </dd>
              </div>
              <div>
                <dt>Nalpac lines</dt>
                <dd>
                  {draft.lines.length} line{draft.lines.length === 1 ? '' : 's'}
                  <span className="summary-sub">
                    {draft.lines.reduce((sum, l) => sum + (Number(l.Quantity) || 0), 0)} units
                  </span>
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="drawer-results">
          {!ready && (
            <p className="warning">
              Add your Nalpac username and password under <strong>Credentials</strong> first.
            </p>
          )}

          {created ? (
            <>
              <p className="success">
                {test ? 'Test order submitted to Nalpac — nothing was placed.' : 'Order placed with Nalpac.'}
              </p>
              <pre className="result-raw">{JSON.stringify(created, null, 2)}</pre>
              <button className="load-btn" onClick={onClose}>
                Done
              </button>
            </>
          ) : (
            <form onSubmit={submit}>
              <h3 className="modal-section modal-section-first">Order</h3>
              <div className="form-row">
                <label className="field">
                  <span>Submit as</span>
                  <select value={test ? 'test' : 'real'} onChange={(e) => setTest(e.target.value === 'test')}>
                    <option value="test">Test order (api/TestOrder)</option>
                    <option value="real">Real order (api/order)</option>
                  </select>
                </label>
                <label className="field">
                  <span>Order date</span>
                  <input type="date" value={draft.OrderDate} onChange={set('OrderDate')} />
                </label>
                <label className="field">
                  <span>PO number</span>
                  <input value={draft.PoNumber} onChange={set('PoNumber')} />
                </label>
              </div>
              <label className="field">
                <span>Order notes</span>
                <textarea rows="2" value={draft.OrderNotes} onChange={set('OrderNotes')} />
              </label>

              <h3 className="modal-section">Shipping address</h3>
              <label className="field">
                <span>Name</span>
                <input value={draft.ShippingAddress.Name} onChange={setAddress('Name')} />
              </label>
              <label className="field">
                <span>Address 1</span>
                <input value={draft.ShippingAddress.Address1} onChange={setAddress('Address1')} />
              </label>
              <div className="form-row">
                <label className="field">
                  <span>Address 2</span>
                  <input value={draft.ShippingAddress.Address2} onChange={setAddress('Address2')} />
                </label>
                <label className="field">
                  <span>Address 3</span>
                  <input value={draft.ShippingAddress.Address3} onChange={setAddress('Address3')} />
                </label>
              </div>
              <div className="form-row">
                <label className="field">
                  <span>City</span>
                  <input value={draft.ShippingAddress.City} onChange={setAddress('City')} />
                </label>
                <label className="field">
                  <span>State</span>
                  <input value={draft.ShippingAddress.State} onChange={setAddress('State')} />
                </label>
                <label className="field">
                  <span>ZIP code</span>
                  <input value={draft.ShippingAddress.ZipCode} onChange={setAddress('ZipCode')} />
                </label>
                <label className="field">
                  <span>Country</span>
                  <input value={draft.ShippingAddress.Country} onChange={setAddress('Country')} />
                </label>
              </div>

              <h3 className="modal-section">Delivery</h3>
              <div className="form-row">
                <label className="field">
                  <span>Phone</span>
                  <input value={draft.ShipToPhoneNumber} onChange={set('ShipToPhoneNumber')} />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input value={draft.ShipToEmailAddress} onChange={set('ShipToEmailAddress')} />
                </label>
                <div className="field">
                  <span>Shipping option</span>
                  <div className="option-picker">
                    {draft.ShippingOptionId ? (
                      <span className="option-chosen">
                        <strong>{draft.ShippingOptionId}</strong>
                        {draft.ShippingOptionLabel && ` · ${draft.ShippingOptionLabel}`}
                      </span>
                    ) : (
                      <span className="option-chosen option-unset">Not chosen</span>
                    )}
                    <button type="button" className="link-btn" onClick={() => setPickerOpen(true)}>
                      {draft.ShippingOptionId ? 'Change' : 'Choose carrier'}
                    </button>
                  </div>
                </div>
              </div>
              <label className="field">
                <span>Delivery instructions</span>
                <input
                  value={draft.DeliveryInstructions}
                  onChange={set('DeliveryInstructions')}
                />
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={draft.SignatureRequired}
                  onChange={set('SignatureRequired')}
                />
                <span>Signature required</span>
              </label>

              <h3 className="modal-section">Lines</h3>
              <table className="line-items">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th className="num">Qty</th>
                    <th>Ship from</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {draft.lines.map((line) => (
                    <tr key={line.key}>
                      <td>
                        {line.Sku}
                        <span className="line-variant">{line.title}</span>
                      </td>
                      <td className="num">
                        <input
                          className="qty-input"
                          type="number"
                          min="1"
                          value={line.Quantity}
                          onChange={setLine(line.key, 'Quantity')}
                        />
                      </td>
                      <td>
                        <select
                          value={line.ShipLocationId}
                          onChange={setLine(line.key, 'ShipLocationId')}
                        >
                          {LOCATIONS.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="num">
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => dropLine(line.key)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!draft.lines.length && <p className="empty">No lines left.</p>}

              {error && <p className="error">{error}</p>}

              <div className="form-actions">
                <button className="load-btn" type="submit" disabled={!ready || submitting}>
                  {submitting ? 'Submitting…' : test ? 'Create test order' : 'Create real order'}
                </button>
                {!test && (
                  <p className="live-warning">
                    This places a real order with Nalpac.
                  </p>
                )}
              </div>
            </form>
          )}
        </div>

        {pickerOpen && (
          <CarrierPickerModal
            creds={creds}
            onSelect={({ id, label }) => {
              setDraft((d) => ({ ...d, ShippingOptionId: id, ShippingOptionLabel: label }))
              setPickerOpen(false)
            }}
            onClose={() => setPickerOpen(false)}
          />
        )}
      </aside>
    </div>
  )
}
