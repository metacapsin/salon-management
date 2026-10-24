// Booking/staff ki haalat ka chhota label. Rang class se aata hai, par likha hua text bhi hai (sirf rang par bharosa nahi).
// "In service" -> class "gl-badge--in-service"
export default function StatusBadge({ status }) {
  const key = status.toLowerCase().replace(/\s+/g, '-')
  return (
    <span className={`gl-badge gl-badge--${key}`}>
      <span className="gl-badge__dot" aria-hidden="true" />
      {status}
    </span>
  )
}
