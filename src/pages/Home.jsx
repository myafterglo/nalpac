export default function Home({ onNavigate }) {
  return (
    <article className="prose">
      <h1>Shopify-Nalpac</h1>
      <p>
        Browse a Shopify store's products and edit each product's <code>nalpac_sku</code>{' '}
        metafield in place.
      </p>

      <h2>Before you start</h2>
      <p>
        You need a <strong>Nalpac account</strong> with API access, and a custom app created in the Shopify store
        you want to work with.
      </p>

      <h2>Creating the app</h2>
      <ol>
        <li>
          In the Shopify admin, go to <strong>Settings → Apps and sales channels → Develop apps</strong>{' '}
          and create an app.
        </li>
        <li>
          Under <strong>Configuration</strong>, grant these Admin API scopes:
          <ul>
            <li>
              <code>read_products</code> and <code>write_products</code> — listing products and
              saving the <code>nalpac_sku</code> metafield
            </li>
            <li>
              <code>read_orders</code> — the Orders page. Shopify limits this scope to the last 60
              days of orders; reading further back needs <code>read_all_orders</code>.
            </li>
          </ul>
        </li>
        <li>
          Install the app on the store, then copy its <strong>Client ID</strong> and{' '}
          <strong>Client secret</strong> from the API credentials tab.
        </li>
      </ol>

      <h2>Nalpac API access</h2>
      <p>
        Product search uses Nalpac's API, authenticated with the email address and password you
        registered for API access. Contact your Nalpac account representative or{' '}
        <code>support@nalpac.com</code> if you don't have them yet.
      </p>

      <h2>Connecting</h2>
      <ol>
        <li>
          Open <strong>Credentials</strong> in the top bar and enter the Shopify store domain,
          client ID, and client secret, plus your Nalpac username and password. They're saved in
          this browser.
        </li>
        <li>
          Go to <button className="link-btn" onClick={() => onNavigate('products')}>Products</button>{' '}
          and click <strong>Load products</strong>. An access token is requested automatically and
          reused for 24 hours; you can see and refresh it in the Credentials dialog.
        </li>
      </ol>
      <p className="note">
        The app exchanges your client ID and secret for a token using Shopify's client credentials
        grant, which requires the app and the store to belong to the same Shopify organization.
      </p>

      <h2>Orders</h2>
      <p>
        The Orders page lists the most recent orders with their customer, fulfillment and payment
        status, channel, total, and line items. Tick <strong>Unfulfilled only</strong> to narrow it
        to orders still awaiting fulfillment.
      </p>
      <p>
        Line items whose product carries a <code>nalpac_sku</code> are tagged, and any order with at
        least one gets a <strong>Create Nalpac order</strong> button. That opens a form pre-filled
        from the Shopify order — address, contact, and one line per tagged product — ready to submit
        to Nalpac. You supply the shipping option (carrier) ID.
      </p>

      <h2>Nalpac pages</h2>
      <p>
        Under <strong>Nalpac</strong> the sidebar has <strong>Orders</strong>, listing orders placed
        with Nalpac, and{' '}
        <strong>Carriers</strong>, which lists each carrier's ID — that's the shipping option ID the
        create-order form asks for.
      </p>

      <h2>Editing SKUs</h2>
      <p>
        Each product card carries its status and an input for <code>nalpac_sku</code>. Change the
        value and an <strong>Apply</strong> button appears; <strong>Remove</strong> deletes the
        metafield. Click a card for the full product details.
      </p>
      <p>
        The magnifier next to the input searches Nalpac's catalog in a side drawer, pre-filled with
        the Shopify product title. Choosing <strong>Select product</strong> on a result writes that
        SKU to Shopify immediately.
      </p>
    </article>
  )
}
