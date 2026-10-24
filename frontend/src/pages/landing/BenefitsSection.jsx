import Icon from '../../components/Icon'
import { benefits } from '../../data/landingContent'
import Reveal from './Reveal'

// Salon software se kya fayda hota hai. Gehre brown background par 6 chhote cards.
export default function BenefitsSection() {
  return (
    <section id="benefits" className="lp-section lp-section--dark" aria-labelledby="lp-benefits-title">
      <div className="lp-container">
        <Reveal>
          <div className="lp-section-head lp-section-head--center">
            <p className="lp-eyebrow">Why Glamora</p>
            <h2 id="lp-benefits-title">Software that gives you your time back</h2>
            <p>Spend your energy on clients and craft. Let Glamora handle the rest.</p>
          </div>
        </Reveal>

        <div className="lp-benefits">
          {benefits.map((benefit, index) => (
            <Reveal key={benefit.title} delay={(index % 3) * 90}>
              <article className="lp-benefit">
                <span className="lp-benefit__icon">
                  <Icon name={benefit.icon} size={22} />
                </span>
                <h3>{benefit.title}</h3>
                <p>{benefit.text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
