import { useState } from 'react'
import OrderCard from '../components/OrderCard'
import { ORDER_PAGE_SIZE, fetchLineItemDetails, fetchOrders } from '../orders'
import { findDefinition } from '../metafields'
import { isExpired, matchesCredentials } from '../token'

export default function Orders({ creds, token, newToken, hasCredentials }) {
  const [unfulfilledOnly, setUnfulfilledOnly] = useState(false)
  const [orders, setOrders] = useState(null) // null = nothing loaded yet
  const [pageInfo, setPageInfo] = useState(null) // cursor for the next page
  const [details, setDetails] = useState({})
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState(null)

  async function activeToken() {
    if (!matchesCredentials(token, creds) || isExpired(token)) return newToken()
    return token
  }

  // Images and SKUs are a nicety — a failure here must not blank the list.
  async function mergeDetails(list, tokenForCall) {
    try {
      const definition = await findDefinition(creds, tokenForCall)
      const found = await fetchLineItemDetails(creds, tokenForCall, list, definition)
      setDetails((current) => ({ ...current, ...found }))
    } catch {
      // leave the placeholders in place
    }
  }

  async function load() {
    setLoading(true)
    setError(null)
    try {
      let active = await activeToken()

      let page
      try {
        page = await fetchOrders(creds, active, { unfulfilledOnly })
      } catch (err) {
        // A token can be revoked before it expires; take a fresh one and retry once.
        if (err.status !== 401) throw err
        active = await newToken()
        page = await fetchOrders(creds, active, { unfulfilledOnly })
      }

      setOrders(page.orders)
      setPageInfo(page.pageInfo)
      setDetails({})
      await mergeDetails(page.orders, active)
    } catch (err) {
      setError(err.message)
      setOrders(null)
      setPageInfo(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    setLoadingMore(true)
    setError(null)
    try {
      const active = await activeToken()
      const page = await fetchOrders(creds, active, { unfulfilledOnly, pageInfo })
      setOrders((current) => [...(current || []), ...page.orders])
      setPageInfo(page.pageInfo)
      await mergeDetails(page.orders, active)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <>
      <div className="controls">
        <button className="load-btn" onClick={load} disabled={!hasCredentials || loading}>
          {loading ? 'Loading…' : 'Load orders'}
        </button>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={unfulfilledOnly}
            onChange={(e) => setUnfulfilledOnly(e.target.checked)}
          />
          <span>Unfulfilled only</span>
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {orders === null && !error && (
        <p className="empty">
          Add your store credentials under <strong>Credentials</strong>, then click{' '}
          <strong>Load orders</strong>.
        </p>
      )}

      {orders !== null && orders.length === 0 && (
        <p className="empty">No {unfulfilledOnly ? 'unfulfilled ' : ''}orders found.</p>
      )}

      {orders?.length > 0 && (
        <>
          <p className="count">
            {orders.length} {unfulfilledOnly ? 'unfulfilled ' : ''}order
            {orders.length === 1 ? '' : 's'}, most recent first
          </p>
          <div className="orders">
            {orders.map((order) => (
              <OrderCard key={order.id} order={order} creds={creds} details={details} />
            ))}
          </div>

          <div className="more">
            {pageInfo ? (
              <button className="load-btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : `Show ${ORDER_PAGE_SIZE} more`}
              </button>
            ) : (
              <p className="empty">That's every order.</p>
            )}
          </div>
        </>
      )}
    </>
  )
}
