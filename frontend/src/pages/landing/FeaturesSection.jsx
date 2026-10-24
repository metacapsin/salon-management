import Icon from '../../components/Icon'
import { features } from '../../data/landingContent'
import Reveal from './Reveal'

// 6 features ke cards. features array (landingContent.js) ke har item ke liye ek card banta hai (.map()).
export default function FeaturesSection() {
  return (
    <section id="features" className="lp-section" aria-labelledby="lp-features-title">
      <div className="lp-container">
        <Reveal>
          <div className="lp-section-head lp-section-head--center">
            <p className="lp-eyebrow lp-eyebrow--dark">Features</p>
            <h2 id="lp-features-title">Everything your salon needs, nothing it does not</h2>
            <p>From the first booking to the last bill of the day, Glamora keeps every part of your salon connected.</p>
          </div>
        </Reveal>

        <div className="lp-features">
          {features.map((feature, index) => (
            <Reveal key={feature.id} delay={(index % 3) * 90}>
              <article className="lp-feature">
                <span className="lp-feature__icon">
                  <Icon name={feature.icon} size={24} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.text}</p>
                <ul>
                  {feature.points.map((point) => (
                    <li key={point}>
                      <Icon name="check" size={16} />
                      {point}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
