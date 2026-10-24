import { lazy, Suspense } from 'react'
import { useLocation } from 'react-router-dom'
import '../../styles/landing.css'
import AboutSection from './AboutSection'
import BenefitsSection from './BenefitsSection'
import ContactSection from './ContactSection'
import CtaSection from './CtaSection'
import FeaturesSection from './FeaturesSection'
import Hero from './Hero'
import LandingFooter from './LandingFooter'
import LandingNavbar from './LandingNavbar'
import ProductPreview from './ProductPreview'
import ServicesSection from './ServicesSection'

// Website ka pehla page (http://localhost:5173/). Ye chhote hisson ko ek ke neeche ek rakhta hai; koi bhi bina login ke ise dekh sakta hai.
// "Find a salon near you" dabane par (URL me #find-salon) salon dhundhne wala hissa isi page ke andar khulta hai, alag page nahi.
// Login tab maangte hain jab customer kisi salon par click kare.
const ExploreSection = lazy(() => import('../../features/explore/ExploreSection'))

export default function LandingPage() {
  const showFind = useLocation().hash === '#find-salon'
  return (
    <div className="lp">
      {/* Keyboard use karne walon ke liye: Tab dabate hi "Skip" dikhta hai, navbar chhodkar seedha content par */}
      <a className="lp-skip" href="#main">
        Skip to content
      </a>
      <LandingNavbar />
      <main id="main">
        <Hero />
        {showFind && (
          <Suspense fallback={<div className="lp-container" style={{ padding: '48px 0' }}>Finding salons…</div>}>
            <ExploreSection />
          </Suspense>
        )}
        <ProductPreview />
        <FeaturesSection />
        <ServicesSection />
        <BenefitsSection />
        <AboutSection />
        <CtaSection />
        <ContactSection />
      </main>
      <LandingFooter />
    </div>
  )
}
