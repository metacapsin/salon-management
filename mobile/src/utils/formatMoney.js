// Appointment totals and customer "spent" are whole rupees (18450 -> "₹18,450").
// Billing amounts are in paise: use formatPaise for those.
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function formatMoney(amount) {
  return rupees.format(amount ?? 0)
}

// "2026-10-21" -> "Wed, 21 Oct". A date in another year also shows the year ("Fri, 22 Oct 2027"),
// because memberships and packages can run for a year or more.
export function formatDate(date) {
  if (!date) return '-'
  const d = new Date(`${date}T00:00:00`)
  const otherYear = d.getFullYear() !== new Date().getFullYear()
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', ...(otherYear ? { year: 'numeric' } : {}) })
}
