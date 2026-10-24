import { Link } from 'react-router-dom'
import Reveal from './Reveal'

// Aakhri bada "call to action": visitor ko register ya login ki taraf bhejta hai.
export default function CtaSection() {
  return (
    <section className="lp-cta" aria-labelledby="lp-cta-title">
      <div className="lp-container">
        <Reveal>
          <div className="lp-cta__box">
            <h2 id="lp-cta-title">Ready to bring calm to your salon?</h2>
            <p>Create your account and set up your salon in a few minutes.</p>
            <div className="lp-cta__buttons">
              <Link to="/register" className="lp-btn lp-btn--gold lp-btn--lg">
                Get Started
              </Link>
              <Link to="/login" className="lp-btn lp-btn--glass lp-btn--lg">
                Login
              </Link>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
