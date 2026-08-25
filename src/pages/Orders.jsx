import { useState } from 'react'
import OrderCard from '../components/OrderCard'
import {
  ORDER_PAGE_SIZE,
  fetchLineItemDetails,
  fetchOrders,
  isUsOrder,
  oldestCreatedAt,
} from '../orders'
import { findDefinition } from '../metafields'
import { isExpired, matchesCredentials } from '../token'

export default function Orders({ creds, token, newToken, hasCredentials }) {
  const [unfulfilledOnly, setUnfulfilledOnly] = useState(false)
  // A view toggle, not a filter: non-US orders stay in the list, collapsed to a line.
  const [usOnly, setUsOnly] = useState(true)
  const [orders, setOrders] = useState(null) // null = nothing loaded yet
  const [pageInfo, setPageInfo] = useState(null) // cursor for the next page
  const [more, setMore] = useState(false) // false only once a page comes back empty
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
      setMore(page.orders.length > 0)
      setDetails({})
      await mergeDetails(page.orders, active)
    } catch (err) {
      setError(err.message)
      setOrders(null)
      setPageInfo(null)
      setMore(false)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    setLoadingMore(true)
    setError(null)
    try {
      const active = await activeToken()
      const current = orders || []

      // Prefer Shopify's cursor; when it stops sending one, keep walking back
      // by date instead of assuming the end.
      const page = pageInfo
        ? await fetchOrders(creds, active, { unfulfilledOnly, pageInfo })
        : await fetchOrders(creds, active, {
            unfulfilledOnly,
            createdBefore: oldestCreatedAt(current),
          })

      // created_at_max is inclusive and a cursor can overlap, so drop anything
      // already on screen. No new orders means we really have reached the end.
      const seen = new Set(current.map((order) => order.id))
      const fresh = page.orders.filter((order) => !seen.has(order.id))

      setOrders([...current, ...fresh])
      setPageInfo(page.pageInfo)
      setMore(fresh.length > 0)
      await mergeDetails(fresh, active)
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

        <label className="checkbox">
          <input type="checkbox" checked={usOnly} onChange={(e) => setUsOnly(e.target.checked)} />
          <span>Show only US orders</span>
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
              <OrderCard
                key={order.id}
                order={order}
                creds={creds}
                details={details}
                collapsed={usOnly && !isUsOrder(order)}
              />
            ))}
          </div>

          <div className="more">
            {more ? (
              <button className="load-btn" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : `Show ${ORDER_PAGE_SIZE} more`}
              </button>
            ) : (
              <p className="empty">No more orders.</p>
            )}
          </div>
        </>
      )}
    </>
  )
}
