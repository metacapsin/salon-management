import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import { adminTheme } from '../adminTheme'
import { listOwnerRequests } from '../api/platformApi'
import { useAuth } from '../auth/AuthContext'
import Avatar from '../components/Avatar'
import Icon from '../components/Icon'
import '../styles/dashboard.css'
import '../styles/admin.css'

// Super Admin ka alag dhancha: salon owner wale sidebar se bilkul alag, sirf platform ke links.
// Links teen hisson me bante hain taaki menu padhne me aasaan rahe.
const NAV_GROUPS = [
  { items: [{ to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true }] },
  {
    heading: 'Manage',
    items: [
      { to: '/admin/owner-requests', label: 'Owner requests', icon: 'userCheck', badge: true },
      { to: '/admin/salons', label: 'Salons', icon: 'store' },
      { to: '/admin/inquiries', label: 'Contact inquiries', icon: 'mail' },
      { to: '/admin/users', label: 'Team & roles', icon: 'users' },
    ],
  },
  { heading: 'Records', items: [{ to: '/admin/audit', label: 'Audit history', icon: 'history' }] },
]

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items)

// Upar ki patti me "Platform admin > Salons" jaisa raasta. Page ka asli title page ke andar (h1) hota he.
function crumbsFor(pathname) {
  if (pathname === '/admin') return ['Dashboard']
  const hit = ALL_ITEMS.filter((i) => !i.end).find((i) => pathname === i.to || pathname.startsWith(`${i.to}/`))
  if (!hit) return []
  return pathname === hit.to ? [hit.label] : [hit.label, 'Details']
}

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

  // Naye owner requests ki ginti (sidebar me chhota badge). Asli server se aati he; na aaye to badge nahi dikhta.
  const pending = useQuery({ queryKey: ['platform', 'owner-requests', 'pending-count'], queryFn: () => listOwnerRequests({ page: 1, status: 'pending' }), staleTime: 30_000 })
  const pendingCount = pending.data?.meta?.total ?? 0

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

  const crumbs = crumbsFor(pathname)
  const displayName = user?.name || user?.email || 'Admin'

  return (
    <ThemeProvider theme={adminTheme}>
      <div className={collapsed ? 'gl-app gl-admin gl-app--collapsed' : 'gl-app gl-admin'}>
        <aside id="gl-sidebar" className={menuOpen ? 'gl-sidebar gl-sidebar--open' : 'gl-sidebar'} aria-label="Sidebar">
          <div className="gl-brand">
            <span className="gl-brand__mark" aria-hidden="true">
              G
            </span>
            <span className="gl-brand__name">Galora</span>
            <span className="gl-brand__sub">PLATFORM ADMIN</span>
            <button type="button" className="gl-sidebar__toggle" onClick={toggleMenu} aria-label={collapsed ? 'Show menu' : 'Hide menu'} aria-expanded={!collapsed} title={collapsed ? 'Show menu' : 'Hide menu'}>
              <Icon name="menu" size={18} />
            </button>
          </div>
          <nav className="gl-nav" aria-label="Main">
            {NAV_GROUPS.map((group, gi) => (
              <div key={group.heading ?? gi}>
                {group.heading && <p className="gl-nav__heading">{group.heading}</p>}
                <ul>
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink to={item.to} end={item.end} className="gl-nav__link" title={item.label}>
                        <Icon name={item.icon} size={20} />
                        <span>{item.label}</span>
                        {item.badge && pendingCount > 0 ? (
                          <span className="ad-nav__count" aria-label={`${pendingCount} pending`}>
                            {pendingCount > 99 ? '99+' : pendingCount}
                          </span>
                        ) : null}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <div className="ad-sidebar-user">
            <Avatar name={displayName} size="md" tone="gold" />
            <div className="ad-sidebar-user__text">
              <strong>{displayName}</strong>
              <span>Super Admin</span>
            </div>
            <button type="button" className="ad-sidebar-user__out" onClick={logout} aria-label="Sign out" title="Sign out">
              <Icon name="logout" size={18} />
            </button>
          </div>
        </aside>
        {menuOpen && <button type="button" className="gl-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

        <div className="gl-main">
          <header className="gl-header">
            <button type="button" className="gl-iconbtn gl-header__menu" onClick={toggleMenu} aria-label="Toggle menu" aria-expanded={menuOpen} aria-controls="gl-sidebar">
              <Icon name="menu" />
            </button>
            <nav className="ad-crumbs" aria-label="Breadcrumb">
              <span>Platform admin</span>
              {crumbs.map((c, i) => (
                <span key={c} style={{ display: 'contents' }}>
                  <Icon name="chevron" size={14} />
                  {i === crumbs.length - 1 ? <strong aria-current="page">{c}</strong> : <span>{c}</span>}
                </span>
              ))}
            </nav>
            <div className="ad-header__who">
              <div className="ad-header__who-text">
                <strong>{displayName}</strong>
                <span>{user?.email}</span>
              </div>
              <Avatar name={displayName} size="md" tone="gold" />
            </div>
            <div className="gl-header__actions">
              <button type="button" className="gl-iconbtn" onClick={logout} aria-label="Sign out" title="Sign out">
                <Icon name="logout" />
              </button>
            </div>
          </header>
          <main className="gl-content">
            <div className="ad-page">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ThemeProvider>
  )
}
