export default function TopBar({ shop, onOpenCredentials }) {
  return (
    <header className="topbar">
      <div className="topbar-brand">Shopify-Nalpac</div>
      <div className="topbar-shop">{shop.trim() || 'No store set'}</div>
      <button className="credentials-btn" onClick={onOpenCredentials}>
        Credentials
      </button>
    </header>
  )
}
