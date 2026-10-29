import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { images } from '../../data/landingContent'

// Sabse upar ka bada hissa: salon ki photo, badi heading, do buttons.
// Photo CSS ki jagah <img> se lagayi hai (alt="" kyunki sirf sajawat hai) aur upar gehra parda hai, taaki text saaf padhe.
export default function Hero() {
  return (
    <section id="home" className="lp-hero">
      <img className="lp-hero__image" src={images.hero} alt="" fetchPriority="high" />
      <div className="lp-hero__shade" />

      <div className="lp-container lp-hero__inner">
        <div className="lp-hero__copy">
          <p className="lp-eyebrow">Salon software for independent salons</p>
          <h1>
            Run your salon <em>beautifully.</em>
          </h1>
          <p className="lp-hero__text">
            Galora brings bookings, customers, staff, billing and memberships into one calm workspace, so you spend less time on paperwork and more time with your clients.
          </p>
          <div className="lp-hero__buttons">
            <Link to="/register" className="lp-btn lp-btn--gold lp-btn--lg">
              Get Started
            </Link>
            <Link to="/#find-salon" className="lp-btn lp-btn--glass lp-btn--lg">
              Find a salon near you
            </Link>
          </div>
          <ul className="lp-hero__ticks">
            <li>
              <Icon name="check" size={16} /> Works on any phone
            </li>
            <li>
              <Icon name="check" size={16} /> Prices in ₹
            </li>
            <li>
              <Icon name="check" size={16} /> No app to install
            </li>
          </ul>
        </div>

        {/* Sajawati card: product ka ek jhalak. Sample data hai, isliye screen reader se chhupa hai. */}
        <aside className="lp-hero__card" aria-hidden="true">
          <p className="lp-hero__card-title">
            <Icon name="calendar" size={16} /> Today at your salon
          </p>
          <ul>
            <li>
              <span>11:30</span>
              <div>
                <strong>Hair spa</strong>
                <small>Priya · with Meera</small>
              </div>
              <em>In service</em>
            </li>
            <li>
              <span>12:15</span>
              <div>
                <strong>Party makeup</strong>
                <small>Anjali · with Kavita</small>
              </div>
              <em>Confirmed</em>
            </li>
            <li>
              <span>01:00</span>
              <div>
                <strong>Gold facial</strong>
                <small>Neha · with Riya</small>
              </div>
              <em>Waiting</em>
            </li>
          </ul>
          <p className="lp-hero__card-note">Sample preview</p>
        </aside>
      </div>
    </section>
  )
}
