// Packages ke chhote helpers: salon ke timezone ki aaj ki date, date jodna, status nikalna.
const todayIn = (tz) => new Date().toLocaleDateString('en-CA', { timeZone: tz || 'Asia/Kolkata' })

function addDays(day, n) {
  return new Date(Date.parse(`${day}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
}

// cancelled > exhausted (sab sessions khatam) > expired (aaj expiry ke baad) > upcoming > active
function packageStatus(cp, today) {
  if (cp.cancelled) return 'cancelled'
  if (cp.items.every((i) => i.remaining === 0)) return 'exhausted'
  if (today > cp.expiresOn) return 'expired'
  if (today < cp.startsOn) return 'upcoming'
  return 'active'
}

function presentPackage(p) {
  return {
    id: p._id,
    name: p.name,
    description: p.description,
    items: p.items.map((i) => ({ serviceId: i.serviceId, serviceName: i.serviceName, unitPrice: i.unitPrice, sessions: i.sessions })),
    originalPrice: p.originalPrice,
    packagePrice: p.packagePrice,
    savings: p.originalPrice - p.packagePrice,
    savingsPercent: p.originalPrice > 0 ? Math.round(((p.originalPrice - p.packagePrice) / p.originalPrice) * 100) : 0,
    validityDays: p.validityDays,
    saleStartsOn: p.saleStartsOn,
    saleEndsOn: p.saleEndsOn,
    active: p.active,
  }
}

function presentCustomerPackage(cp, today) {
  const total = cp.items.reduce((s, i) => s + i.total, 0)
  const remaining = cp.items.reduce((s, i) => s + i.remaining, 0)
  return {
    id: cp._id,
    packageId: cp.packageId,
    packageName: cp.packageName,
    customerPhone: cp.customerPhone,
    customerName: cp.customerName,
    items: cp.items.map((i) => ({ serviceId: i.serviceId, serviceName: i.serviceName, total: i.total, remaining: i.remaining, used: i.total - i.remaining })),
    totalSessions: total,
    remainingSessions: remaining,
    usedSessions: total - remaining,
    originalPrice: cp.originalPrice,
    pricePaid: cp.pricePaid,
    paymentStatus: cp.paymentStatus,
    paymentMethod: cp.paymentMethod,
    purchasedOn: cp.purchasedOn,
    startsOn: cp.startsOn,
    expiresOn: cp.expiresOn,
    status: packageStatus(cp, today),
  }
}

module.exports = { todayIn, addDays, packageStatus, presentPackage, presentCustomerPackage }
