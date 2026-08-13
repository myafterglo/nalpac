import { useState } from 'react'
import RawJsonModal from '../components/RawJsonModal'
import {
  DEFAULT_ORDER_SORT,
  fetchNalpacOrders,
  hasMorePages,
  hasNalpacCredentials,
} from '../nalpac'

function initialFilters() {
  return {
    // Sent on every request but not editable in the form.
    sortBy: DEFAULT_ORDER_SORT,
    shipToName: '',
    poNumber: '',
    orderNumber: '',
    trackingNumber: '',
  }
}

function OrderRow({ order }) {
  const [showRaw, setShowRaw] = useState(false)
  const address = order.address
  const shipToName = address.name || order.shipToName
  const fields = [
    ['PO number', order.poNumber],
    ['Ordered', order.orderDate],
    ['Shipped', order.shipDate],
    ['Tracking', order.trackingNumber],
    ['Status', order.status],
    ['Total', order.total],
  ].filter(([, value]) => value)

  return (
    <li className="nalpac-order">
      <div className="nalpac-order-head">
        <h3>{order.orderNumber || 'Order'}</h3>
        <button className="ghost-btn" onClick={() => setShowRaw(true)}>
          Raw JSON
        </button>
      </div>

      <dl className="nalpac-order-fields">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}

        <div className="nalpac-order-address">
          <dt>Ship to</dt>
          <dd>
            {shipToName && <span className="address-name">{shipToName}</span>}
            {address.lines.map((line) => (
              <span key={line}>{line}</span>
            ))}
            {address.phone && <span className="address-contact">{address.phone}</span>}
            {address.email && <span className="address-contact">{address.email}</span>}
            {!shipToName && !address.lines.length && <span>—</span>}
          </dd>
        </div>
      </dl>

      {showRaw && (
        <RawJsonModal
          title={order.orderNumber || 'Nalpac order'}
          data={order.raw}
          onClose={() => setShowRaw(false)}
        />
      )}
    </li>
  )
}

export default function NalpacOrders({ creds }) {
  const [filters, setFilters] = useState(initialFilters)
  const [orders, setOrders] = useState(null) // null = nothing loaded yet
  const [total, setTotal] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(0)
  const [more, setMore] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)

  const ready = hasNalpacCredentials(creds)
  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }))

  async function load(e) {
    e?.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await fetchNalpacOrders(creds, { pageNumber: 1, filters })
      const received = result.orders.length
      setOrders(result.orders)
      setTotal(result.total)
      setPage(1)
      setPageSize(received)
      setMore(
        hasMorePages({ received, accumulated: received, total: result.total, pageSize: received }),
      )
    } catch (err) {
      setError(err.message)
      setOrders(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    setLoadingMore(true)
    setError(null)
    try {
      const next = page + 1
      const result = await fetchNalpacOrders(creds, { pageNumber: next, filters })
      const combined = [...(orders || []), ...result.orders]
      setOrders(combined)
      setMore(
        hasMorePages({
          received: result.orders.length,
          accumulated: combined.length,
          total: result.total ?? total,
          pageSize,
        }),
      )
      setPage(next)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <>
      <h1 className="page-title">Nalpac orders</h1>

      {!ready && (
        <p className="warning">
          Add your Nalpac username and password under <strong>Credentials</strong> first.
        </p>
      )}

      <form className="search-form search-form-wide" onSubmit={load}>
        <label className="field">
          <span>Ship to name</span>
          <input value={filters.shipToName} onChange={set('shipToName')} autoComplete="off" />
        </label>
        <label className="field">
          <span>PO number</span>
          <input value={filters.poNumber} onChange={set('poNumber')} autoComplete="off" />
        </label>
        <label className="field">
          <span>Order number</span>
          <input value={filters.orderNumber} onChange={set('orderNumber')} autoComplete="off" />
        </label>
        <label className="field">
          <span>Tracking</span>
          <input value={filters.trackingNumber} onChange={set('trackingNumber')} autoComplete="off" />
        </label>

        <button className="load-btn" type="submit" disabled={!ready || loading}>
          {loading ? 'Loading…' : 'Load orders'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {orders === null && !error && <p className="empty">Click <strong>Load orders</strong>.</p>}
      {orders?.length === 0 && <p className="empty">No matching Nalpac orders.</p>}

      {orders?.length > 0 && (
        <>
          <p className="count">
            {orders.length} shown{total > orders.length ? ` of ${total}` : ''}
          </p>
          <ul className="nalpac-orders">
            {orders.map((order, index) => (
              <OrderRow key={order.orderNumber || index} order={order} />
            ))}
          </ul>

          {more && (
            <div className="more">
              <button className="load-btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : 'Show next page'}
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
