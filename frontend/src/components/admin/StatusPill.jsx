// Poore admin panel ka ek hi status label: rang + chhota dot + likha hua text (sirf rang par bharosa nahi).
// tone: success | warning | danger | info | neutral. MUI wale color naam (success/error/...) bhi chalte hain.
const FROM_MUI = { success: 'success', warning: 'warning', error: 'danger', info: 'info', default: 'neutral' }

export default function StatusPill({ label, tone = 'neutral' }) {
  const key = FROM_MUI[tone] ?? tone
  return (
    <span className={`ad-pill ad-pill--${key}`}>
      <span className="ad-pill__dot" aria-hidden="true" />
      {label}
    </span>
  )
}
