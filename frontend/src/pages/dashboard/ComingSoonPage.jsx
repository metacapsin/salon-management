import EmptyState from '../../components/EmptyState'

// Jo pages abhi bane nahi, unka khaali ghar. Menu ke link kaam karein, par saaf likha ho ki page baad me banega.
// Props: title = page ka naam, text = ek line ka vivaran, icon = EmptyState ka icon.
export default function ComingSoonPage({ title, text, icon = 'sparkle' }) {
  return (
    <section className="gl-card gl-soon gl-fade-up">
      <EmptyState icon={icon} title={`${title} is coming soon`} text={`${text} This page is not built yet. We will build it in a later step.`} />
    </section>
  )
}
