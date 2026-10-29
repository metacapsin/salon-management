import { useLocation } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import Icon from '../components/Icon'
import { ALL_NAV } from './navItems'
import NotificationMenu from './NotificationMenu'
import ProfileMenu from './ProfileMenu'

// Upar ki patti: hamburger (mobile), page ka naam, ghanti aur profile menu.
// Props: onMenuClick (mobile par sidebar kholne ke liye), menuOpen.
export default function Header({ onMenuClick, menuOpen, collapsed }) {
  const { activeSalon } = useAuth()
  const { pathname } = useLocation()
  // Jis page par hain uska naam heading me
  const title = ALL_NAV.find((item) => item.to === pathname)?.label ?? 'Galora'

  return (
    <header className="gl-header">
      <button type="button" className="gl-iconbtn gl-header__menu" onClick={onMenuClick} aria-label="Toggle menu" aria-expanded={menuOpen || !collapsed} aria-controls="gl-sidebar">
        <Icon name="menu" />
      </button>

      <div className="gl-header__title">
        <h1>{title}</h1>
        <p>{activeSalon?.salonName}</p>
      </div>


      <div className="gl-header__actions">
        <NotificationMenu />
        <ProfileMenu />
      </div>
    </header>
  )
}
