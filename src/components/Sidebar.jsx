// Grouped so the two "Orders" pages are distinguishable.
const SECTIONS = [
  { items: [{ id: 'home', label: 'Home' }] },
  {
    title: 'Shopify',
    items: [
      { id: 'products', label: 'Products' },
      { id: 'orders', label: 'Orders' },
    ],
  },
  {
    title: 'Nalpac',
    items: [
      { id: 'nalpac-orders', label: 'Orders' },
      { id: 'carriers', label: 'Carriers' },
    ],
  },
]

export default function Sidebar({ page, onNavigate }) {
  return (
    <nav className="sidebar">
      {SECTIONS.map((section, index) => (
        <div className="nav-section" key={section.title || index}>
          {section.title && <h2 className="nav-title">{section.title}</h2>}
          {section.items.map(({ id, label }) => (
            <button
              key={id}
              className={`nav-item${page === id ? ' nav-item-active' : ''}`}
              onClick={() => onNavigate(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ))}
    </nav>
  )
}
