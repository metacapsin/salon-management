import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Header from './Header'
import Sidebar from './Sidebar'
import '../styles/dashboard.css'

// Login ke baad ka poora dhancha: left me Sidebar, upar Header, beech me jis page par hain wo (<Outlet />).
// <Outlet /> = "yahan current page aayega". App.jsx me jo page is layout ke andar likha hai, wahi yahan dikhta hai.
export default function DashboardLayout() {
  const { user, memberships, activeSalon } = useAuth()
  const location = useLocation()
  // Mobile par sidebar khula hai ya band: ye ek "state" hai. Badalte hi screen apne aap dobara banti hai.
  const [menuOpen, setMenuOpen] = useState(false)
  // Desktop par sidebar chhupa hai ya nahi. localStorage me yaad rakhte hain taaki refresh par bhi wahi rahe.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('gl-sidebar-collapsed') === '1'
    } catch {
      return false
    }
  })

  // Hamburger dabane par: bade screen (desktop) par sidebar hide/show, chhote screen par drawer khule/band.
  function toggleMenu() {
    if (window.matchMedia('(min-width: 1024px)').matches) {
      setCollapsed((prev) => {
        const next = !prev
        try {
          localStorage.setItem('gl-sidebar-collapsed', next ? '1' : '0')
        } catch {
          // storage band ho to bhi chalega, bas yaad nahi rahega
        }
        return next
      })
    } else {
      setMenuOpen((prev) => !prev)
    }
  }

  // Escape dabane par khula menu band ho jaye (keyboard use karne walon ke liye)
  // Screen bada ho jaye (rotate/resize) to bhi drawer band, warna parda atak jata hai.
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

  // Back button ya kisi bhi tarah page badle to drawer band
  useEffect(() => setMenuOpen(false), [location.pathname])

  // Super Admin ka koi salon nahi hota: use onboarding nahi, apna admin dashboard dikhao
  if (memberships.length === 0 && user?.platformRole === 'admin') return <Navigate to="/admin" replace />
  // Koi salon nahi hai to pehle salon banao
  if (memberships.length === 0) return <Navigate to="/onboarding" replace state={{ from: location }} />

  return (
    <div className={collapsed ? 'gl-app gl-app--collapsed' : 'gl-app'}>
      <Sidebar isOpen={menuOpen} onNavigate={() => setMenuOpen(false)} onToggle={toggleMenu} collapsed={collapsed} />
      {/* Mobile par menu khula ho to peeche halka parda; use dabane par menu band */}
      {menuOpen && <button type="button" className="gl-backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}

      <div className="gl-main">
        <Header onMenuClick={toggleMenu} menuOpen={menuOpen} collapsed={collapsed} />
        {activeSalon?.salonStatus === 'suspended' && (
          <div className="gl-banner" role="alert">
            This salon is suspended. You can read your data, but changes are not allowed.
          </div>
        )}
        <main className="gl-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
