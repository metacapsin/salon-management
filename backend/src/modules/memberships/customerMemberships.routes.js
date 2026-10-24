// Customer ko diye gaye memberships: bikri, payment, cancel, checkout par discount (quote + apply), itihaas.
const express = require('express')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { MembershipPlan, CustomerMembership, MembershipLedger, Customer, Booking, Service } = require('../../models')
const { withTransaction } = require('../../utils/transaction')
const { recordAudit } = require('../audit/audit.service')
const { todayIn, addDays } = require('../packages/util')
const { givesBenefit, discountForLines, presentCustomerMembership } = require('./util')

const router = express.Router()
router.use(authenticate, requireSalon)

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-01.')
const phone = z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit mobile number.')
const method = z.enum(['cash', 'upi', 'card', 'other'])
const idParams = z.object({ id: objectId })

const assignBody = z.strictObject({
  planId: objectId,
  customerPhone: phone,
  customerName: z.string().trim().min(1, 'Enter the customer name.').max(100),
  requestKey: z.string().trim().min(8).max(80),
  paymentStatus: z.enum(['paid', 'pending']).default('paid'),
  paymentMethod: method.default('cash'),
  startsOn: day.optional(),
})
const listQuery = z.object({
  search: z.string().trim().max(50).optional(),
  phone: phone.optional(),
  status: z.enum(['active', 'upcoming', 'expired', 'cancelled']).optional(),
  paymentStatus: z.enum(['paid', 'pending']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})
const quoteBody = z.strictObject({ customerPhone: phone, serviceIds: z.array(objectId).min(1).max(30) })
const applyBody = z.strictObject({ bookingId: objectId })
const paymentBody = z.strictObject({ paymentMethod: method })
const cancelBody = z.strictObject({ note: z.string().trim().min(3, 'Please give a reason (at least 3 characters).').max(300) })

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const fieldError = (field, message) => new ApiError(400, 'VALIDATION_ERROR', message, { fieldErrors: { [field]: message } })

function statusFilter(status, today) {
  switch (status) {
    case 'cancelled': return { cancelled: true }
    case 'expired': return { cancelled: false, expiresOn: { $lt: today } }
    case 'upcoming': return { cancelled: false, startsOn: { $gt: today } }
    default: return { cancelled: false, startsOn: { $lte: today }, expiresOn: { $gte: today } }
  }
}

async function findOwn(req) {
  const cm = await CustomerMembership.findOne({ _id: req.valid.params.id, salonId: req.salon._id })
  if (!cm) throw new ApiError(404, 'NOT_FOUND', 'Membership not found.')
  return cm
}
const sendOne = (req, res, cm, extra = {}, opts) =>
  sendSuccess(req, res, { customerMembership: presentCustomerMembership(cm, todayIn(req.salon.timezone)), ...extra }, opts)

// Is customer ka koi chalu + paid membership (ek se zyada ho to sabse zyada discount wala)
async function bestMembership(req, customerPhone, lines) {
  const today = todayIn(req.salon.timezone)
  const candidates = await CustomerMembership.find({ salonId: req.salon._id, customerPhone, ...statusFilter('active', today), paymentStatus: 'paid' })
  let best = null
  for (const cm of candidates) {
    if (!givesBenefit(cm, today)) continue
    const discount = discountForLines(cm, lines)
    if (!best || discount > best.discount) best = { cm, discount }
  }
  return best
}

// ---------- list ----------
router.get('/', can('memberships.read'), validate({ query: listQuery }), async (req, res) => {
  const { search, phone: ph, status, paymentStatus, page, pageSize } = req.valid.query
  const today = todayIn(req.salon.timezone)
  const filter = { salonId: req.salon._id }
  if (ph) filter.customerPhone = ph
  if (paymentStatus) filter.paymentStatus = paymentStatus
  if (status) Object.assign(filter, statusFilter(status, today))
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ customerName: rx }, { customerPhone: rx }, { planName: rx }]
  }
  const [rows, total] = await Promise.all([
    CustomerMembership.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    CustomerMembership.countDocuments(filter),
  ])
  sendSuccess(req, res, { customerMemberships: rows.map((r) => presentCustomerMembership(r, today)) }, { meta: { page, pageSize, total } })
})

// ---------- quote: checkout se pehle "kitna discount milega" (kuch badalta nahi) ----------
// Price frontend se nahi aata: server services ka price khud padhta hai.
router.post('/quote', can('memberships.read'), validate({ body: quoteBody }), async (req, res) => {
  const { customerPhone, serviceIds } = req.valid.body
  const unique = [...new Set(serviceIds)]
  const services = await Service.find({ _id: { $in: unique }, salonId: req.salon._id }).lean()
  if (services.length !== unique.length) throw fieldError('serviceIds', 'One of the chosen services was not found.')
  const lines = services.map((s) => ({ serviceId: s._id, price: s.price }))
  const subtotal = lines.reduce((sum, l) => sum + l.price, 0)
  const best = await bestMembership(req, customerPhone, lines)
  const discount = best?.discount ?? 0
  sendSuccess(req, res, {
    subtotal,
    discount,
    total: subtotal - discount,
    membership: discount > 0 ? { id: best.cm._id, planName: best.cm.planName, expiresOn: best.cm.expiresOn } : null,
  })
})

// ---------- one + history ----------
router.get('/:id', can('memberships.read'), validate({ params: idParams }), async (req, res) => {
  const cm = await findOwn(req)
  const history = await MembershipLedger.find({ salonId: req.salon._id, customerMembershipId: cm._id }).sort({ createdAt: 1 }).lean()
  sendOne(req, res, cm, { history: history.map((h) => ({ id: h._id, type: h.type, amount: h.amount, bookingId: h.bookingId, note: h.note, at: h.createdAt })) })
})

// ---------- assign (bikri) ----------
router.post('/', can('memberships.sell'), validate({ body: assignBody }), async (req, res) => {
  const b = req.valid.body
  const salonId = req.salon._id
  const today = todayIn(req.salon.timezone)

  const existing = await CustomerMembership.findOne({ salonId, requestKey: b.requestKey })
  if (existing) return sendOne(req, res, existing, { duplicate: true })

  const plan = await MembershipPlan.findOne({ _id: b.planId, salonId })
  if (!plan) throw fieldError('planId', 'Plan not found.')
  if (!plan.active) throw fieldError('planId', 'This plan is switched off.')
  const startsOn = b.startsOn ?? today
  if (startsOn < today) throw fieldError('startsOn', 'Start date cannot be in the past.')
  if (startsOn > addDays(today, 90)) throw fieldError('startsOn', 'Start date can be at most 90 days from today.')
  const expiresOn = addDays(startsOn, plan.durationDays)

  // Do memberships ki avadhi aapas me takraye to nahi (renewal expiry ke baad shuru ho sakta hai)
  const overlap = await CustomerMembership.findOne({ salonId, customerPhone: b.customerPhone, cancelled: false, startsOn: { $lte: expiresOn }, expiresOn: { $gte: startsOn } })
  if (overlap) {
    throw new ApiError(409, 'DUPLICATE_MEMBERSHIP', `This customer already has a membership until ${overlap.expiresOn}. Start the new one after that date.`)
  }

  const customer = await Customer.findOne({ phone: b.customerPhone }).select('_id').lean()
  let created
  try {
    created = await withTransaction(async (session) => {
      const [cm] = await CustomerMembership.create(
        [
          {
            salonId,
            planId: plan._id,
            planName: plan.name,
            customerId: customer?._id ?? null,
            customerPhone: b.customerPhone,
            customerName: b.customerName,
            discountType: plan.discountType,
            discountValue: plan.discountValue,
            serviceIds: plan.serviceIds,
            benefits: plan.benefits,
            pricePaid: plan.price, // hamesha plan ka price, frontend ka nahi
            paymentStatus: b.paymentStatus,
            paymentMethod: b.paymentMethod,
            purchasedOn: today,
            startsOn,
            expiresOn,
            requestKey: b.requestKey,
            createdBy: req.user._id,
          },
        ],
        { session },
      )
      await MembershipLedger.create([{ salonId, customerMembershipId: cm._id, type: 'purchase', amount: plan.price, note: `Payment ${b.paymentStatus}`, actorId: req.user._id }], { session })
      await recordAudit(req, { action: 'membership.sold', entityType: 'customerMembership', entityId: cm._id, changes: { planId: plan._id, customerPhone: b.customerPhone, pricePaid: plan.price, paymentStatus: b.paymentStatus } }, { session })
      return cm
    })
  } catch (e) {
    if (e?.code === 11000) {
      const again = await CustomerMembership.findOne({ salonId, requestKey: b.requestKey })
      if (again) return sendOne(req, res, again, { duplicate: true })
    }
    throw e
  }
  sendOne(req, res, created, {}, { status: 201 })
})

// ---------- apply: booking par membership discount lagana (ek booking par sirf ek baar) ----------
router.post('/:id/apply', can('memberships.sell'), validate({ params: idParams, body: applyBody }), async (req, res) => {
  const cm = await findOwn(req)
  const salonId = req.salon._id
  const today = todayIn(req.salon.timezone)
  const booking = await Booking.findOne({ _id: req.valid.body.bookingId, salonId }).lean()
  if (!booking) throw fieldError('bookingId', 'Appointment not found.')
  if (booking.status === 'cancelled') throw new ApiError(409, 'BOOKING_CANCELLED', 'This appointment is cancelled.')
  if (booking.membership) throw new ApiError(409, 'ALREADY_APPLIED', 'A membership discount is already applied to this appointment.')
  if (booking.customerPhone.replace(/\D/g, '').slice(-10) !== cm.customerPhone) throw new ApiError(409, 'CUSTOMER_MISMATCH', 'This appointment belongs to a different customer.')
  if (cm.cancelled) throw new ApiError(409, 'MEMBERSHIP_CANCELLED', 'This membership was cancelled.')
  if (today > cm.expiresOn) throw new ApiError(409, 'MEMBERSHIP_EXPIRED', 'This membership has expired.')
  if (today < cm.startsOn) throw new ApiError(409, 'MEMBERSHIP_NOT_STARTED', 'This membership has not started yet.')
  if (cm.paymentStatus !== 'paid') throw new ApiError(409, 'MEMBERSHIP_UNPAID', 'Benefits start after the membership payment is received.')

  // Discount booking me copy hui service prices par; offer ke baad bache total se zyada kabhi nahi
  const discount = Math.min(discountForLines(cm, booking.services), booking.total)
  if (discount <= 0) throw new ApiError(409, 'NO_DISCOUNT', 'None of this appointment\'s services is eligible for this membership.')

  try {
    await withTransaction(async (session) => {
      const upd = await Booking.updateOne(
        { _id: booking._id, salonId, membership: null, status: { $ne: 'cancelled' } },
        { $set: { membership: { customerMembershipId: cm._id, planName: cm.planName, discount } }, $inc: { total: -discount } },
        { session },
      )
      if (upd.modifiedCount !== 1) throw new ApiError(409, 'ALREADY_APPLIED', 'A membership discount is already applied to this appointment.')
      await MembershipLedger.create([{ salonId, customerMembershipId: cm._id, type: 'discount', amount: discount, bookingId: booking._id, actorId: req.user._id }], { session })
      await recordAudit(req, { action: 'membership.discount_applied', entityType: 'customerMembership', entityId: cm._id, changes: { bookingId: booking._id, discount } }, { session })
    })
  } catch (e) {
    if (e?.code === 11000) throw new ApiError(409, 'ALREADY_APPLIED', 'A membership discount is already applied to this appointment.')
    throw e
  }
  const fresh = await Booking.findById(booking._id).lean()
  sendOne(req, res, cm, { booking: { id: fresh._id, subtotal: fresh.subtotal ?? null, total: fresh.total, membership: fresh.membership } })
})

// ---------- payment: pending ko paid karna (sirf ek baar) ----------
router.post('/:id/payment', can('memberships.sell'), validate({ params: idParams, body: paymentBody }), async (req, res) => {
  const cm = await findOwn(req)
  const ok = await withTransaction(async (session) => {
    const upd = await CustomerMembership.updateOne(
      { _id: cm._id, salonId: req.salon._id, paymentStatus: 'pending', cancelled: false },
      { $set: { paymentStatus: 'paid', paymentMethod: req.valid.body.paymentMethod } },
      { session },
    )
    if (upd.modifiedCount !== 1) return false
    await MembershipLedger.create([{ salonId: req.salon._id, customerMembershipId: cm._id, type: 'payment', amount: cm.pricePaid, note: `Paid by ${req.valid.body.paymentMethod}`, actorId: req.user._id }], { session })
    await recordAudit(req, { action: 'membership.paid', entityType: 'customerMembership', entityId: cm._id, changes: { amount: cm.pricePaid } }, { session })
    return true
  })
  if (!ok) throw new ApiError(409, 'ALREADY_PAID', 'This membership has no pending payment.')
  sendOne(req, res, await CustomerMembership.findById(cm._id))
})

// ---------- cancel ----------
router.post('/:id/cancel', can('memberships.adjust'), validate({ params: idParams, body: cancelBody }), async (req, res) => {
  const cm = await findOwn(req)
  const ok = await withTransaction(async (session) => {
    const upd = await CustomerMembership.updateOne({ _id: cm._id, salonId: req.salon._id, cancelled: false }, { $set: { cancelled: true } }, { session })
    if (upd.modifiedCount !== 1) return false
    await MembershipLedger.create([{ salonId: req.salon._id, customerMembershipId: cm._id, type: 'cancel', note: req.valid.body.note, actorId: req.user._id }], { session })
    await recordAudit(req, { action: 'membership.cancelled', entityType: 'customerMembership', entityId: cm._id, changes: { note: req.valid.body.note } }, { session })
    return true
  })
  if (!ok) throw new ApiError(409, 'ALREADY_CANCELLED', 'This membership is already cancelled.')
  sendOne(req, res, await CustomerMembership.findById(cm._id))
})

module.exports = router
