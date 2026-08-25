import { useState } from 'react'
import NalpacOrderDrawer from './NalpacOrderDrawer'
import { METAFIELD_KEY } from '../metafields'
import { hasNalpacLines } from '../nalpacOrder'
import {
  addressLines,
  channelName,
  countryFlag,
  countryName,
  flagAddress,
  fulfillmentLabel,
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
      className={['order', domestic && 'order-us', collapsed && 'order-collapsed']
        .filter(Boolean)
        .join(' ')}
    >
      <header className="order-head">
        <div className="order-headings">
          <h3>{order.name || `#${order.order_number}`}</h3>
          <span className="order-date">{new Date(order.created_at).toLocaleString()}</span>
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

      {collapsed ? null : (
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
                        {detail?.sku && (
                          <span
                            className="tag tag-nalpac line-tag"
                            title={`${METAFIELD_KEY}: ${detail.sku}`}
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

        {canOrder && (
          <div className="order-actions">
            <button className="nalpac-order-btn" onClick={() => setOrderDrawerOpen(true)}>
              Create Nalpac order
            </button>
          </div>
        )}

        {orderDrawerOpen && (
          <NalpacOrderDrawer
            creds={creds}
            order={order}
            details={details}
            onClose={() => setOrderDrawerOpen(false)}
          />
        )}
        </>
      )}
    </article>
  )
}
