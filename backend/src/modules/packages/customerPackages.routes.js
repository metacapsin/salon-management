// Customer ko diye gaye packages: bikri, session use (redeem), adjustment, payment, cancel, itihaas.
// Price, expiry aur balance hamesha server nikalta hai; frontend sirf "kaun sa package, kis customer ko" batata hai.
const express = require('express')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { Package, CustomerPackage, PackageLedger, Customer, Booking } = require('../../models')
const { withTransaction } = require('../../utils/transaction')
const { recordAudit } = require('../audit/audit.service')
const { todayIn, addDays, presentCustomerPackage } = require('./util')

const router = express.Router()
router.use(authenticate, requireSalon)

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-01.')
const phone = z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit mobile number.')
const method = z.enum(['cash', 'upi', 'card', 'other'])
const idParams = z.object({ id: objectId })

const assignBody = z.strictObject({
  packageId: objectId,
  customerPhone: phone,
  customerName: z.string().trim().min(1, 'Enter the customer name.').max(100),
  requestKey: z.string().trim().min(8).max(80), // frontend har "Assign" dialog khulne par naya banata hai
  paymentStatus: z.enum(['paid', 'pending']).default('paid'),
  paymentMethod: method.default('cash'),
  startsOn: day.optional(), // default aaj
  confirmDuplicate: z.boolean().default(false),
})

const listQuery = z.object({
  search: z.string().trim().max(50).optional(),
  phone: phone.optional(),
  status: z.enum(['active', 'upcoming', 'expired', 'exhausted', 'cancelled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

const redeemBody = z.strictObject({ bookingId: objectId, serviceId: objectId })
const adjustBody = z.strictObject({
  serviceId: objectId,
  sessions: z.number().int().min(-100).max(100).refine((n) => n !== 0, 'Adjustment cannot be 0.'),
  note: z.string().trim().min(3, 'Please give a reason (at least 3 characters).').max(300),
})
const paymentBody = z.strictObject({ paymentMethod: method })
const cancelBody = z.strictObject({ note: z.string().trim().min(3, 'Please give a reason (at least 3 characters).').max(300) })

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const fieldError = (field, message) => new ApiError(400, 'VALIDATION_ERROR', message, { fieldErrors: { [field]: message } })
const hasSessions = { items: { $elemMatch: { remaining: { $gt: 0 } } } }

function statusFilter(status, today) {
  switch (status) {
    case 'cancelled': return { cancelled: true }
    case 'exhausted': return { cancelled: false, items: { $not: { $elemMatch: { remaining: { $gt: 0 } } } } }
    case 'expired': return { cancelled: false, ...hasSessions, expiresOn: { $lt: today } }
    case 'upcoming': return { cancelled: false, ...hasSessions, startsOn: { $gt: today } }
    default: return { cancelled: false, ...hasSessions, startsOn: { $lte: today }, expiresOn: { $gte: today } }
  }
}

async function findOwn(req) {
  const cp = await CustomerPackage.findOne({ _id: req.valid.params.id, salonId: req.salon._id })
  if (!cp) throw new ApiError(404, 'NOT_FOUND', 'Customer package not found.')
  return cp
}

const sendOne = (req, res, cp, extra = {}, opts) => sendSuccess(req, res, { customerPackage: presentCustomerPackage(cp, todayIn(req.salon.timezone)), ...extra }, opts)

// ---------- list ----------
router.get('/', can('packages.read'), validate({ query: listQuery }), async (req, res) => {
  const { search, phone: ph, status, page, pageSize } = req.valid.query
  const today = todayIn(req.salon.timezone)
  const filter = { salonId: req.salon._id }
  if (ph) filter.customerPhone = ph
  if (status) Object.assign(filter, statusFilter(status, today))
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i')
    filter.$or = [{ customerName: rx }, { customerPhone: rx }, { packageName: rx }]
  }
  const [rows, total] = await Promise.all([
    CustomerPackage.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    CustomerPackage.countDocuments(filter),
  ])
  sendSuccess(req, res, { customerPackages: rows.map((r) => presentCustomerPackage(r, today)) }, { meta: { page, pageSize, total } })
})

// ---------- one + history ----------
router.get('/:id', can('packages.read'), validate({ params: idParams }), async (req, res) => {
  const cp = await findOwn(req)
  const history = await PackageLedger.find({ salonId: req.salon._id, customerPackageId: cp._id }).sort({ createdAt: 1 }).lean()
  sendOne(req, res, cp, {
    history: history.map((h) => ({ id: h._id, type: h.type, serviceName: h.serviceName, sessions: h.sessions, amount: h.amount, bookingId: h.bookingId, note: h.note, at: h.createdAt })),
  })
})

// ---------- assign (bikri) ----------
router.post('/', can('packages.sell'), validate({ body: assignBody }), async (req, res) => {
  const b = req.valid.body
  const salonId = req.salon._id
  const today = todayIn(req.salon.timezone)

  // Wahi request dobara aaye (double click / retry) to naya charge nahi, purana hi wapas
  const existing = await CustomerPackage.findOne({ salonId, requestKey: b.requestKey })
  if (existing) return sendOne(req, res, existing, { duplicate: true })

  const pkg = await Package.findOne({ _id: b.packageId, salonId })
  if (!pkg) throw fieldError('packageId', 'Package not found.')
  if (!pkg.active) throw fieldError('packageId', 'This package is switched off.')
  if ((pkg.saleStartsOn && today < pkg.saleStartsOn) || (pkg.saleEndsOn && today > pkg.saleEndsOn)) {
    throw fieldError('packageId', 'This package is not on sale today.')
  }
  const startsOn = b.startsOn ?? today
  if (startsOn < today) throw fieldError('startsOn', 'Start date cannot be in the past.')
  if (startsOn > addDays(today, 90)) throw fieldError('startsOn', 'Start date can be at most 90 days from today.')

  if (!b.confirmDuplicate) {
    const live = await CustomerPackage.findOne({ salonId, customerPhone: b.customerPhone, packageId: pkg._id, ...statusFilter('active', today), startsOn: { $lte: startsOn } })
    if (live) {
      throw new ApiError(409, 'DUPLICATE_PACKAGE', 'This customer already has this package with sessions left. Confirm to sell another.')
    }
  }

  const customer = await Customer.findOne({ phone: b.customerPhone }).select('_id').lean()
  let created
  try {
    created = await withTransaction(async (session) => {
      const [cp] = await CustomerPackage.create(
        [
          {
            salonId,
            packageId: pkg._id,
            packageName: pkg.name,
            customerId: customer?._id ?? null,
            customerPhone: b.customerPhone,
            customerName: b.customerName,
            items: pkg.items.map((i) => ({ serviceId: i.serviceId, serviceName: i.serviceName, total: i.sessions, remaining: i.sessions })),
            originalPrice: pkg.originalPrice,
            pricePaid: pkg.packagePrice, // hamesha package ka price, frontend ka nahi
            paymentStatus: b.paymentStatus,
            paymentMethod: b.paymentMethod,
            purchasedOn: today,
            startsOn,
            expiresOn: addDays(startsOn, pkg.validityDays),
            requestKey: b.requestKey,
            createdBy: req.user._id,
          },
        ],
        { session },
      )
      await PackageLedger.create(
        [{ salonId, customerPackageId: cp._id, type: 'purchase', amount: pkg.packagePrice, sessions: cp.items.reduce((s, i) => s + i.total, 0), note: `Payment ${b.paymentStatus}`, actorId: req.user._id }],
        { session },
      )
      await recordAudit(req, { action: 'package.sold', entityType: 'customerPackage', entityId: cp._id, changes: { packageId: pkg._id, customerPhone: b.customerPhone, pricePaid: pkg.packagePrice, paymentStatus: b.paymentStatus } }, { session })
      return cp
    })
  } catch (e) {
    // do request ek saath aayi aur dusri requestKey par ruki: pehli wali ko hi maano
    if (e?.code === 11000) {
      const again = await CustomerPackage.findOne({ salonId, requestKey: b.requestKey })
      if (again) return sendOne(req, res, again, { duplicate: true })
    }
    throw e
  }
  sendOne(req, res, created, {}, { status: 201 })
})

// ---------- redeem: completed appointment ki service ka ek session kaatna ----------
router.post('/:id/redeem', can('packages.sell'), validate({ params: idParams, body: redeemBody }), async (req, res) => {
  const cp = await findOwn(req)
  const { bookingId, serviceId } = req.valid.body
  const salonId = req.salon._id
  const today = todayIn(req.salon.timezone)

  const booking = await Booking.findOne({ _id: bookingId, salonId }).lean()
  if (!booking) throw fieldError('bookingId', 'Appointment not found.')
  if (booking.status !== 'completed') throw new ApiError(409, 'BOOKING_NOT_COMPLETED', 'A session can be used only after the appointment is completed.')
  if (booking.customerPhone.replace(/\D/g, '').slice(-10) !== cp.customerPhone) throw new ApiError(409, 'CUSTOMER_MISMATCH', 'This appointment belongs to a different customer.')
  const line = booking.services.find((s) => String(s.serviceId) === serviceId)
  if (!line) throw new ApiError(409, 'SERVICE_NOT_IN_BOOKING', 'This service was not part of the appointment.')
  const item = cp.items.find((i) => String(i.serviceId) === serviceId)
  if (!item) throw new ApiError(409, 'SERVICE_NOT_IN_PACKAGE', 'This service is not included in the package.')

  let result
  try {
    result = await withTransaction(async (session) => {
      // Ek hi atomic update: balance > 0, package chalu aur expire nahi => tabhi ghatao. Negative ho hi nahi sakta.
      const upd = await CustomerPackage.updateOne(
        { _id: cp._id, salonId, cancelled: false, startsOn: { $lte: today }, expiresOn: { $gte: today }, items: { $elemMatch: { serviceId, remaining: { $gt: 0 } } } },
        { $inc: { 'items.$.remaining': -1 } },
        { session },
      )
      if (upd.modifiedCount !== 1) return null
      await PackageLedger.create(
        [{ salonId, customerPackageId: cp._id, type: 'redemption', serviceId, serviceName: item.serviceName, sessions: -1, bookingId, actorId: req.user._id }],
        { session },
      )
      await recordAudit(req, { action: 'package.redeemed', entityType: 'customerPackage', entityId: cp._id, changes: { serviceId, bookingId } }, { session })
      return true
    })
  } catch (e) {
    if (e?.code === 11000) throw new ApiError(409, 'ALREADY_REDEEMED', 'A session was already used for this service in this appointment.')
    throw e
  }
  if (!result) {
    const fresh = await CustomerPackage.findById(cp._id)
    if (fresh.cancelled) throw new ApiError(409, 'PACKAGE_CANCELLED', 'This package was cancelled.')
    if (today > fresh.expiresOn) throw new ApiError(409, 'PACKAGE_EXPIRED', 'This package has expired.')
    if (today < fresh.startsOn) throw new ApiError(409, 'PACKAGE_NOT_STARTED', 'This package has not started yet.')
    throw new ApiError(409, 'NO_SESSIONS_LEFT', 'No sessions left for this service.')
  }
  sendOne(req, res, await CustomerPackage.findById(cp._id))
})

// ---------- adjust: galti sudharne ke liye, reason zaroori ----------
router.post('/:id/adjust', can('packages.adjust'), validate({ params: idParams, body: adjustBody }), async (req, res) => {
  const cp = await findOwn(req)
  const { serviceId, sessions, note } = req.valid.body
  const item = cp.items.find((i) => String(i.serviceId) === serviceId)
  if (!item) throw new ApiError(409, 'SERVICE_NOT_IN_PACKAGE', 'This service is not included in the package.')
  const ok = await withTransaction(async (session) => {
    const inc = sessions > 0 ? { 'items.$.remaining': sessions, 'items.$.total': sessions } : { 'items.$.remaining': sessions }
    const upd = await CustomerPackage.updateOne(
      { _id: cp._id, salonId: req.salon._id, cancelled: false, items: { $elemMatch: { serviceId, remaining: { $gte: sessions < 0 ? -sessions : 0 } } } },
      { $inc: inc },
      { session },
    )
    if (upd.modifiedCount !== 1) return false
    await PackageLedger.create([{ salonId: req.salon._id, customerPackageId: cp._id, type: 'adjustment', serviceId, serviceName: item.serviceName, sessions, note, actorId: req.user._id }], { session })
    await recordAudit(req, { action: 'package.adjusted', entityType: 'customerPackage', entityId: cp._id, changes: { serviceId, sessions, note } }, { session })
    return true
  })
  if (!ok) throw new ApiError(409, 'INVALID_ADJUSTMENT', 'Balance cannot go below zero, and a cancelled package cannot be adjusted.')
  sendOne(req, res, await CustomerPackage.findById(cp._id))
})

// ---------- payment: pending ko paid karna (sirf ek baar) ----------
router.post('/:id/payment', can('packages.sell'), validate({ params: idParams, body: paymentBody }), async (req, res) => {
  const cp = await findOwn(req)
  const ok = await withTransaction(async (session) => {
    const upd = await CustomerPackage.updateOne(
      { _id: cp._id, salonId: req.salon._id, paymentStatus: 'pending', cancelled: false },
      { $set: { paymentStatus: 'paid', paymentMethod: req.valid.body.paymentMethod } },
      { session },
    )
    if (upd.modifiedCount !== 1) return false
    await PackageLedger.create([{ salonId: req.salon._id, customerPackageId: cp._id, type: 'payment', amount: cp.pricePaid, note: `Paid by ${req.valid.body.paymentMethod}`, actorId: req.user._id }], { session })
    await recordAudit(req, { action: 'package.paid', entityType: 'customerPackage', entityId: cp._id, changes: { amount: cp.pricePaid } }, { session })
    return true
  })
  if (!ok) throw new ApiError(409, 'ALREADY_PAID', 'This package has no pending payment.')
  sendOne(req, res, await CustomerPackage.findById(cp._id))
})

// ---------- cancel ----------
router.post('/:id/cancel', can('packages.adjust'), validate({ params: idParams, body: cancelBody }), async (req, res) => {
  const cp = await findOwn(req)
  const ok = await withTransaction(async (session) => {
    const upd = await CustomerPackage.updateOne({ _id: cp._id, salonId: req.salon._id, cancelled: false }, { $set: { cancelled: true } }, { session })
    if (upd.modifiedCount !== 1) return false
    await PackageLedger.create([{ salonId: req.salon._id, customerPackageId: cp._id, type: 'cancel', note: req.valid.body.note, actorId: req.user._id }], { session })
    await recordAudit(req, { action: 'package.cancelled', entityType: 'customerPackage', entityId: cp._id, changes: { note: req.valid.body.note } }, { session })
    return true
  })
  if (!ok) throw new ApiError(409, 'ALREADY_CANCELLED', 'This package is already cancelled.')
  sendOne(req, res, await CustomerPackage.findById(cp._id))
})

module.exports = router
