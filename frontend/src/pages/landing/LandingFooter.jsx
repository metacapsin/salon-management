import { Link } from 'react-router-dom'
import { navLinks } from '../../data/landingContent'
import Logo from './Logo'

// Sabse neeche ka hissa. Sirf wahi links jo sach me kaam karte hain.
export default function LandingFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="lp-footer">
      <div className="lp-container lp-footer__grid">
        <div className="lp-footer__brand">
          <Logo />
          <p>Calm, simple software for independent salons and beauty parlours.</p>
        </div>

        <nav aria-label="Explore">
          <h3>Explore</h3>
          <ul>
            {navLinks.map((link) => (
              <li key={link.href}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Account">
          <h3>Account</h3>
          <ul>
            <li>
              <Link to="/login">Login</Link>
            </li>
            <li>
              <Link to="/register">Create an account</Link>
            </li>
            <li>
              <Link to="/forgot-password">Forgot password</Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="lp-container lp-footer__bottom">
        <p>© {year} Galora. All rights reserved.</p>
        <a href="#home">Back to top ↑</a>
      </div>
    </footer>
  )
}
