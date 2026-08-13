const PAGES = [
  { id: 'home', label: 'Home' },
  { id: 'products', label: 'Products' },
  { id: 'orders', label: 'Orders' },
]

export default function Sidebar({ page, onNavigate }) {
  return (
    <nav className="sidebar">
      {PAGES.map(({ id, label }) => (
        <button
          key={id}
          className={`nav-item${page === id ? ' nav-item-active' : ''}`}
          onClick={() => onNavigate(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  )
}
