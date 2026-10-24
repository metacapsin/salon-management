import { salonTypes } from '../../data/landingContent'
import Reveal from './Reveal'

// "Services" section: Glamora kis-kis tarah ke salon ke liye bana hai (photo cards).
export default function ServicesSection() {
  return (
    <section id="services" className="lp-section lp-section--beige" aria-labelledby="lp-services-title">
      <div className="lp-container">
        <Reveal>
          <div className="lp-section-head lp-section-head--center">
            <p className="lp-eyebrow lp-eyebrow--dark">Services</p>
            <h2 id="lp-services-title">Made for every kind of salon</h2>
            <p>Whether you style hair, paint faces or pamper skin, Glamora fits the way you work.</p>
          </div>
        </Reveal>

        <div className="lp-types">
          {salonTypes.map((type, index) => (
            <Reveal key={type.id} delay={index * 90}>
              <article className="lp-type">
                <img src={type.image} alt="" loading="lazy" />
                <div className="lp-type__shade" />
                <div className="lp-type__body">
                  <h3>{type.title}</h3>
                  <p>{type.text}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
