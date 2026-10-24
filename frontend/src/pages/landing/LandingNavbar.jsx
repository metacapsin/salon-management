import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import Icon from '../../components/Icon'
import { navLinks } from '../../data/landingContent'
import Logo from './Logo'

// Upar ki patti. Hero ke upar saaf (transparent) dikhti hai, scroll karte hi gehre brown me badal jaati hai.
// Chhote screen par links hamburger ke peeche chhup jaate hain.
export default function LandingNavbar() {
  const { status } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Escape dabane par khula menu band
  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (event) => event.key === 'Escape' && setMenuOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)
  const signedIn = status === 'authenticated'

  return (
    <header className={scrolled || menuOpen ? 'lp-nav lp-nav--solid' : 'lp-nav'}>
      <div className="lp-container lp-nav__inner">
        <a href="#home" className="lp-nav__brand" aria-label="Glamora home" onClick={closeMenu}>
          <Logo />
        </a>

        <nav id="lp-menu" className={menuOpen ? 'lp-nav__links lp-nav__links--open' : 'lp-nav__links'} aria-label="Main">
          {navLinks.map((link) => (
            <a key={link.href} href={link.href} onClick={closeMenu}>
              {link.label}
            </a>
          ))}
          <Link to="/#find-salon" onClick={closeMenu}>
            Find a salon
          </Link>
          {/* Chhote screen par menu ke andar hi Login/Get Started */}
          <div className="lp-nav__mobile-actions">
            <Link to={signedIn ? '/dashboard' : '/login'} className="lp-btn lp-btn--outline" onClick={closeMenu}>
              {signedIn ? 'Open dashboard' : 'Login'}
            </Link>
            {!signedIn && (
              <Link to="/register" className="lp-btn lp-btn--gold" onClick={closeMenu}>
                Get Started
              </Link>
            )}
          </div>
        </nav>

        <div className="lp-nav__actions">
          <Link to={signedIn ? '/dashboard' : '/login'} className="lp-nav__login">
            {signedIn ? 'Open dashboard' : 'Login'}
          </Link>
          {!signedIn && (
            <Link to="/register" className="lp-btn lp-btn--gold lp-btn--sm">
              Get Started
            </Link>
          )}
        </div>

        <button type="button" className="lp-nav__toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="lp-menu">
          <Icon name={menuOpen ? 'close' : 'menu'} size={24} />
        </button>
      </div>
    </header>
  )
}
