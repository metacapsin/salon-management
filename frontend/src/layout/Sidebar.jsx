import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import Icon from '../components/Icon'
import { MAIN_NAV } from './navItems'

// Left side ka menu. Props: isOpen (mobile par khula hai?), onNavigate (link dabane par menu band karne ke liye).
export default function Sidebar({ isOpen, onNavigate, onToggle, collapsed }) {
  const { role } = useAuth()

  // Sirf wahi links jo is role ko allowed hain
  const visible = (items) => items.filter((item) => !item.capability || roleCan(role, item.capability))

  function renderLink(item) {
    return (
      <li key={item.to}>
        {/* NavLink apne aap "active" class laga deta hai jis page par hum hain */}
        <NavLink to={item.to} className="gl-nav__link" onClick={onNavigate} title={item.label}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </NavLink>
      </li>
    )
  }

  return (
    <aside id="gl-sidebar" className={isOpen ? 'gl-sidebar gl-sidebar--open' : 'gl-sidebar'} aria-label="Sidebar">
      <div className="gl-brand">
        <span className="gl-brand__mark" aria-hidden="true">
          G
        </span>
        <span className="gl-brand__name">Glamora</span>
        <span className="gl-brand__sub">SALON &amp; BEAUTY PARLOUR</span>
        {/* Desktop par sidebar hide/show ka button (mobile par header wala hamburger chalta hai) */}
        <button type="button" className="gl-sidebar__toggle" onClick={onToggle} aria-label={collapsed ? 'Show menu' : 'Hide menu'} aria-expanded={!collapsed} title={collapsed ? 'Show menu' : 'Hide menu'}>
          <Icon name="menu" size={20} />
        </button>
      </div>

      <nav className="gl-nav" aria-label="Main">
        <ul>{visible(MAIN_NAV).map(renderLink)}</ul>
      </nav>
    </aside>
  )
}
