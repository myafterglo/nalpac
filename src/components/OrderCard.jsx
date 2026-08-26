import { useState } from 'react'
import NalpacOrderDrawer from './NalpacOrderDrawer'
import RawJsonModal from './RawJsonModal'
import { METAFIELD_KEY } from '../metafields'
import { hasNalpacLines, lineSku } from '../nalpacOrder'
import {
  addressLines,
  channelName,
  countryFlag,
  countryName,
  flagAddress,
  fulfillmentLabel,
  isCancelled,
  isCounterSale,
  isUsOrder,
  lineTotal,
  money,
  paymentLabel,
  shippingAddress,
} from '../orders'

const FULFILLMENT_TONE = {
  fulfilled: 'good',
  partial: 'warn',
  unfulfilled: 'warn',
  restocked: 'muted',
}

const PAYMENT_TONE = {
  paid: 'good',
  partially_paid: 'warn',
  pending: 'warn',
  authorized: 'warn',
  refunded: 'muted',
  partially_refunded: 'muted',
  voided: 'muted',
}

export default function OrderCard({ order, creds, details = {}, collapsed = false }) {
  const [orderDrawerOpen, setOrderDrawerOpen] = useState(false)
  const [showRaw, setShowRaw] = useState(false)
  // Nothing ships from a cancelled order, so it never needs its details on show.
  const cancelled = isCancelled(order)
  const collapse = collapsed || cancelled
  const canOrder = hasNalpacLines(order, details)
  const fulfillment = fulfillmentLabel(order)
  const payment = paymentLabel(order)
  const currency = order.currency
  const address = shippingAddress(order)
  const counterSale = isCounterSale(order)
  const origin = flagAddress(order)
  const flag = countryFlag(origin)
  const country = countryName(origin)
  const domestic = isUsOrder(order)
  const lines = addressLines(address)
  const recipient =
    address?.name || [address?.first_name, address?.last_name].filter(Boolean).join(' ')

  return (
    <article
      className={[
        'order',
        domestic && 'order-us',
        collapse && 'order-collapsed',
        cancelled && 'order-cancelled',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="order-head">
        <div className="order-headings">
          <h3>{order.name || `#${order.order_number}`}</h3>
          <span className="order-date">{new Date(order.created_at).toLocaleString()}</span>
          {cancelled && <span className="tag tag-cancelled">cancelled</span>}
        </div>
        <span className="order-total">
          {money(order.total_price, currency)}
          {flag && (
            <span className="order-flag" title={country} aria-label={country}>
              {flag}
            </span>
          )}
        </span>
      </header>

      {collapse ? null : (
        <>
        <div className="order-tags">
          <span className={`tag tag-${FULFILLMENT_TONE[fulfillment] || 'muted'}`}>
            {fulfillment.replace(/_/g, ' ')}
          </span>
          <span className={`tag tag-${PAYMENT_TONE[payment] || 'muted'}`}>
            {payment.replace(/_/g, ' ')}
          </span>
          <span className="tag tag-plain">{channelName(order)}</span>
        </div>

        <div className="order-body">
          <table className="line-items">
            <thead>
              <tr>
                <th className="line-image-col" />
                <th>Item</th>
                <th className="num">Price</th>
                <th className="num">Qty</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {(order.line_items || []).map((item) => {
                const detail = details[item.product_id]
                const sku = lineSku(item, detail)
                return (
                  <tr key={item.id}>
                    <td className="line-image-col">
                      {detail?.image ? (
                        <img
                          className="line-image"
                          src={detail.image.url}
                          alt={detail.image.alt || ''}
                          loading="lazy"
                        />
                      ) : (
                        <span className="line-image line-image-empty" />
                      )}
                    </td>
                    <td>
                      <span className="line-name">
                        {item.title || item.name}
                        {sku && (
                          <span
                            className="tag tag-nalpac line-tag"
                            title={`${METAFIELD_KEY}: ${sku}`}
                          >
                            nalpac
                          </span>
                        )}
                      </span>
                      {item.variant_title && <span className="line-variant">{item.variant_title}</span>}
                      {item.sku && <span className="line-sku">{item.sku}</span>}
                    </td>
                    <td className="num">{money(item.price, currency)}</td>
                    <td className="num">{item.quantity}</td>
                    <td className="num">{money(lineTotal(item), currency)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <aside className="order-address">
            {counterSale ? (
              <span className="address-name">Point of sale</span>
            ) : (
              <>
                <h4>Ship to</h4>
                {recipient && <span className="address-name">{recipient}</span>}
                {lines.length ? (
                  lines.map((line) => <span key={line}>{line}</span>)
                ) : (
                  <span>No shipping address</span>
                )}
              </>
            )}
          </aside>
        </div>

        <div className="order-actions">
          <button className="ghost-btn" onClick={() => setShowRaw(true)}>
            Raw JSON
          </button>
          {canOrder && (
            <button className="nalpac-order-btn" onClick={() => setOrderDrawerOpen(true)}>
              Create Nalpac order
            </button>
          )}
        </div>

        {orderDrawerOpen && (
          <NalpacOrderDrawer
            creds={creds}
            order={order}
            details={details}
            onClose={() => setOrderDrawerOpen(false)}
          />
        )}

        {showRaw && (
          <RawJsonModal
            title={order.name || `#${order.order_number}`}
            data={order}
            onClose={() => setShowRaw(false)}
          />
        )}
        </>
      )}
    </article>
  )
}
