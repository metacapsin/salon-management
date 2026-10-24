// Memberships ke helpers: status, discount ka hisaab, API ke liye shape.
const { discountFor } = require('../offers/pricing')

// cancelled > expired > upcoming > active
function membershipStatus(cm, today) {
  if (cm.cancelled) return 'cancelled'
  if (today > cm.expiresOn) return 'expired'
  if (today < cm.startsOn) return 'upcoming'
  return 'active'
}

// Benefit tabhi milta hai jab membership chalu ho AUR payment ho chuka ho
const givesBenefit = (cm, today) => membershipStatus(cm, today) === 'active' && cm.paymentStatus === 'paid'

// lines = [{ serviceId, price }]. Offers wala hi hisaab (percent/flat, khaali serviceIds = saari services)
function discountForLines(cm, lines) {
  return discountFor(cm, lines.map((l) => ({ _id: l.serviceId, price: l.price })))
}

function presentPlan(p) {
  return {
    id: p._id,
    name: p.name,
    description: p.description,
    price: p.price,
    durationDays: p.durationDays,
    discountType: p.discountType,
    discountValue: p.discountValue,
    serviceIds: p.serviceIds,
    benefits: p.benefits,
    active: p.active,
  }
}

function presentCustomerMembership(cm, today) {
  return {
    id: cm._id,
    planId: cm.planId,
    planName: cm.planName,
    customerPhone: cm.customerPhone,
    customerName: cm.customerName,
    discountType: cm.discountType,
    discountValue: cm.discountValue,
    serviceIds: cm.serviceIds,
    benefits: cm.benefits,
    pricePaid: cm.pricePaid,
    paymentStatus: cm.paymentStatus,
    paymentMethod: cm.paymentMethod,
    purchasedOn: cm.purchasedOn,
    startsOn: cm.startsOn,
    expiresOn: cm.expiresOn,
    status: membershipStatus(cm, today),
    benefitsActive: givesBenefit(cm, today),
  }
}

module.exports = { membershipStatus, givesBenefit, discountForLines, presentPlan, presentCustomerMembership }
