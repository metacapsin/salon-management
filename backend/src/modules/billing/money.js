// Billing ka saara paisa INTEGER paise me (1 rupee = 100 paise). Float kabhi nahi, taaki 0.1+0.2 jaisi galti na ho.
// Baaki app (services, offers...) poore rupaye me hai; billing me aate hi toPaise() se badalte hain.
const GST_RATE_PERCENT = 18 // fixed (user ka faisla); CGST 9% + SGST 9%

const toPaise = (rupees) => Math.round(Number(rupees) * 100)

// Tax-exclusive price maan kar: taxable amount par GST. CGST/SGST barabar baante jaate hain (paisa bacha to SGST me).
function gstOn(taxablePaise) {
  const tax = Math.round((taxablePaise * GST_RATE_PERCENT) / 100)
  const cgst = Math.floor(tax / 2)
  return { taxRatePercent: GST_RATE_PERCENT, cgst, sgst: tax - cgst, tax }
}

const isPaise = (n) => Number.isSafeInteger(n) && n >= 0

module.exports = { GST_RATE_PERCENT, toPaise, gstOn, isPaise }
