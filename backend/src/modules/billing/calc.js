// Bill ka poora hisaab, ek hi jagah, sirf paise (integer) me. Route iske alawa kuch nahi jodta-ghatata.
// Order: line total -> (package-covered units hatao) -> offer -> membership -> GST -> final total.
const { toPaise, gstOn } = require('./money')

// rule = { discountType: 'percent'|'flat', discountValue (rupees ya %), serviceIds: [] }; khaali serviceIds = saari services
function discountOn(rule, lines) {
  const ids = new Set((rule.serviceIds ?? []).map(String))
  const base = lines.filter((l) => ids.size === 0 || ids.has(String(l.serviceId))).reduce((sum, l) => sum + l.lineTotal, 0)
  if (base === 0) return 0
  const raw = rule.discountType === 'percent' ? Math.floor((base * rule.discountValue) / 100) : toPaise(rule.discountValue)
  return Math.min(raw, base)
}

// lines: [{ serviceId, name, unitPrice (paise), quantity, coveredUnits }]
function computeInvoice({ lines, offer = null, membership = null }) {
  const priced = lines.map((l) => {
    const covered = Math.min(l.coveredUnits ?? 0, l.quantity)
    return { ...l, coveredUnits: covered, lineTotal: l.unitPrice * (l.quantity - covered) }
  })
  const subtotal = priced.reduce((sum, l) => sum + l.lineTotal, 0)
  const offerDiscount = offer ? discountOn(offer, priced) : 0
  // Membership offer ke baad bache paise se zyada kabhi nahi kaat sakta
  const membershipDiscount = membership ? Math.min(discountOn(membership, priced), subtotal - offerDiscount) : 0
  const discountTotal = offerDiscount + membershipDiscount
  const taxableAmount = subtotal - discountTotal
  const gst = gstOn(taxableAmount)
  return {
    lines: priced,
    subtotal,
    offerDiscount,
    membershipDiscount,
    discountTotal,
    taxableAmount,
    tax: { ratePercent: gst.taxRatePercent, cgst: gst.cgst, sgst: gst.sgst, total: gst.tax },
    total: taxableAmount + gst.tax,
  }
}

module.exports = { computeInvoice, discountOn }
