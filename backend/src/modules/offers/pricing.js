// Offer se kitna discount milega. Customer ke bheje price par bharosa nahi: server yahi hisaab lagata hai.
// serviceIds khaali ho to offer saari services par lagta hai, warna sirf chuni hui services ke price par.
function discountFor(offer, services) {
  const ids = new Set((offer.serviceIds ?? []).map(String))
  const eligible = services.filter((s) => ids.size === 0 || ids.has(String(s._id ?? s.id)))
  const base = eligible.reduce((sum, s) => sum + s.price, 0)
  if (base === 0) return 0
  const raw = offer.discountType === 'percent' ? Math.floor((base * offer.discountValue) / 100) : offer.discountValue
  return Math.min(raw, base) // discount kabhi bhi price se zyada nahi
}

module.exports = { discountFor }
