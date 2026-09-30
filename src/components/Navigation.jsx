const LINKS = [
  { id: 'training', label: 'Training Center' },
  { id: 'learning', label: 'AI Learning' },
  { id: 'explainable', label: 'Explainable AI' },
  { id: 'race', label: 'Race Arena' },
  { id: 'analytics', label: 'Analytics' },
]

export default function Navigation({ active, onChange }) {
  return (
    <nav className="nav">
      <div className="nav-logo">NEURALDRIVE F1</div>
      <ul className="nav-links">
        {LINKS.map(l => (
          <li key={l.id}>
            <button
              className={`nav-link ${active === l.id ? 'active' : ''}`}
              onClick={() => onChange(l.id)}
            >
              {l.label}
            </button>
          </li>
        ))}
      </ul>
      <div className="nav-status">
        <div className="nav-status-dot" />
        SYSTEM ONLINE
      </div>
    </nav>
  )
}
