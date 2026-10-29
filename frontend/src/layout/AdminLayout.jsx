import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Icon from '../components/Icon'
import '../styles/dashboard.css'

// Super Admin ka alag dhancha: salon owner wale sidebar se bilkul alag, sirf platform ke links.
const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/owner-requests', label: 'Owner requests', icon: 'userCheck' },
  { to: '/admin/salons', label: 'Salons', icon: 'store' },
  { to: '/admin/inquiries', label: 'Contact inquiries', icon: 'mail' },
  { to: '/admin/users', label: 'Team & roles', icon: 'users' },
  { to: '/admin/audit', label: 'Audit history', icon: 'history' },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { pathname } = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  // Desktop par sidebar patti banana (owner dashboard jaisa), yaad rakhne ke liye same localStorage key
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('gl-sidebar-collapsed') === '1'
    } catch {
      return false
    }
  })

  // Desktop par hide/show, mobile par drawer khule/band
  function toggleMenu() {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setCollapsed((prev) => {
        const next = !prev
        try {
          localStorage.setItem('gl-sidebar-collapsed', next ? '1' : '0')
        } catch {
          // storage band ho to bhi chalega
        }
        return next
      })
    } else {
      setMenuOpen((v) => !v)
    }
  }

  // Page badalte hi mobile menu band
  useEffect(() => setMenuOpen(false), [pathname])

  // Escape ya screen bada hone par drawer band (dashboard layout jaisa)
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event) => event.key === 'Escape' && setMenuOpen(false)
    const desktop = window.matchMedia('(min-width: 1024px)')
    const onResize = (event) => event.matches && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    desktop.addEventListener('change', onResize)
    return () => {
      document.removeEventListener('keydown', onKey)
      desktop.removeEventListener('change', onResize)
    }
  }, [menuOpen])

  return (
    <div className={collapsed ? 'gl-app gl-app--collapsed' : 'gl-app'}>
      <aside id="gl-sidebar" className={menuOpen ? 'gl-sidebar gl-sidebar--open' : 'gl-sidebar'} aria-label="Sidebar">
        <div className="gl-brand">
          <span className="gl-brand__mark" aria-hidden="true">
            G
          </span>
          <span className="gl-brand__name">Galora</span>
          <span className="gl-brand__sub">PLATFORM ADMIN</span>
          <button type="button" className="gl-sidebar__toggle" onClick={toggleMenu} aria-label={collapsed ? 'Show menu' : 'Hide menu'} aria-expanded={!collapsed} title={collapsed ? 'Show menu' : 'Hide menu'}>
            <Icon name="menu" size={20} />
          </button>
        </div>
        <nav className="gl-nav" aria-label="Main">
          <ul>
            {ADMIN_NAV.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} className="gl-nav__link" title={item.label}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      {menuOpen && <button type="button" className="gl-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <div className="gl-main">
        <header className="gl-header">
          <button type="button" className="gl-iconbtn gl-header__menu" onClick={toggleMenu} aria-label="Toggle menu" aria-expanded={menuOpen} aria-controls="gl-sidebar">
            <Icon name="menu" />
          </button>
          <div className="gl-header__title">
            <h1>Platform admin</h1>
            <p>{user?.email}</p>
          </div>
          <div className="gl-header__actions">
            <button type="button" className="gl-iconbtn" onClick={logout} aria-label="Sign out" title="Sign out">
              <Icon name="logout" />
            </button>
          </div>
        </header>
        <main className="gl-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
