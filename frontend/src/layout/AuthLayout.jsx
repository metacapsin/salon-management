import '../styles/login.css'

// Sab bina-login wale pages ka common dhancha: left me brand, right me form card.
// Peeche salon ki photo CSS (login.css) se lagti hai.
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <main className="login">
      <div className="login__inner">
        <section className="login__brand">
          <p className="login__brand-name">Galora</p>
          <p className="login__brand-sub">Salon &amp; Beauty Parlour Management</p>
          <p className="login__brand-tagline">Glow up with Galora.</p>
        </section>

        <section className="login__card" aria-labelledby="auth-title">
          <h1 id="auth-title">{title}</h1>
          {subtitle && <p className="login__card-sub">{subtitle}</p>}
          {children}
          {footer && <div className="auth-links">{footer}</div>}
        </section>
      </div>
    </main>
  )
}
