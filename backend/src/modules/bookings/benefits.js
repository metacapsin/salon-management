// Ek appointment par is customer ko kaun-kaun se benefits mil sakte hain: package sessions aur membership discount.
// Sirf dikhata hai (kuch badalta nahi). Asli deduct/apply `customer-packages/:id/redeem` aur `customer-memberships/:id/apply` karte hain.
const { CustomerPackage, CustomerMembership, PackageLedger } = require('../../models')
const { todayIn } = require('../packages/util')
const { givesBenefit, discountForLines } = require('../memberships/util')

async function bookingBenefits(req, booking) {
  const salonId = req.salon._id
  const today = todayIn(req.salon.timezone)
  const phone = booking.customerPhone.replace(/\D/g, '').slice(-10)
  const inBooking = new Set(booking.services.map((s) => String(s.serviceId)))
  const usable = booking.status !== 'cancelled'

  // ---- packages: chalu, expire nahi, aur jinme is booking ki koi service bachi ho ----
  const packages = []
  if (usable) {
    const cps = await CustomerPackage.find({
      salonId, customerPhone: phone, cancelled: false, startsOn: { $lte: today }, expiresOn: { $gte: today },
    }).sort({ expiresOn: 1 }).lean()
    const redeemed = await PackageLedger.find({ salonId, bookingId: booking._id, type: 'redemption' }).select('customerPackageId serviceId').lean()
    const done = new Set(redeemed.map((r) => `${r.customerPackageId}:${r.serviceId}`))
    for (const cp of cps) {
      const services = cp.items
        .filter((i) => inBooking.has(String(i.serviceId)))
        .map((i) => ({ serviceId: i.serviceId, serviceName: i.serviceName, remaining: i.remaining, redeemed: done.has(`${cp._id}:${i.serviceId}`) }))
        .filter((s) => s.remaining > 0 || s.redeemed)
      if (services.length) packages.push({ customerPackageId: cp._id, packageName: cp.packageName, expiresOn: cp.expiresOn, services })
    }
  }

  // ---- membership: pehle se laga ho to wahi, warna sabse achha chalu + paid membership ----
  let membership = null
  if (booking.membership) {
    membership = { applied: true, planName: booking.membership.planName, discount: booking.membership.discount }
  } else if (usable) {
    const cms = await CustomerMembership.find({ salonId, customerPhone: phone, cancelled: false, startsOn: { $lte: today }, expiresOn: { $gte: today }, paymentStatus: 'paid' })
    let best = null
    for (const cm of cms) {
      if (!givesBenefit(cm, today)) continue
      const discount = Math.min(discountForLines(cm, booking.services), booking.total)
      if (discount > 0 && (!best || discount > best.discount)) best = { customerMembershipId: cm._id, planName: cm.planName, discount }
    }
    if (best) membership = { applied: false, ...best }
  }

  return { status: booking.status, total: booking.total, packages, membership }
}

module.exports = { bookingBenefits }
