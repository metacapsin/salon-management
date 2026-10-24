import Icon from '../../components/Icon'
import { aboutFacts, images } from '../../data/landingContent'
import Reveal from './Reveal'

// "About" section: ek taraf photo, doosri taraf Glamora ke baare me.
export default function AboutSection() {
  return (
    <section id="about" className="lp-section" aria-labelledby="lp-about-title">
      <div className="lp-container lp-about">
        <Reveal>
          <div className="lp-about__photo">
            <img src={images.about} alt="A stylist smiling while styling a client's hair" loading="lazy" />
          </div>
        </Reveal>

        <Reveal delay={120}>
          <div className="lp-about__copy">
            <p className="lp-eyebrow lp-eyebrow--dark">About Glamora</p>
            <h2 id="lp-about-title">Built for the people who make others feel beautiful</h2>
            <p>
              Glamora is salon management software designed for independent salons and beauty parlours. We believe a salon owner should not need a big team or a long training course to stay organised.
            </p>
            <p>So everything is clear, calm and quick: book a client, serve them well, bill them in a few taps, and see how your day went.</p>
            <ul className="lp-about__facts">
              {aboutFacts.map((fact) => (
                <li key={fact}>
                  <Icon name="check" size={18} />
                  {fact}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
