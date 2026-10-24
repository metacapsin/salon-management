// Bill (invoice) banana. Saari keemat, discount, package-cover aur GST server nikalta hai;
// frontend sirf "kaun si service, kitni quantity, kaun sa offer" batata hai. Paisa integer paise me.
const express = require('express')
const mongoose = require('mongoose')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { Invoice, InvoiceCounter, Payment, Booking, Service, Offer, Customer, CustomerPackage, PackageLedger, CustomerMembership, MembershipLedger } = require('../../models')
const { withTransaction } = require('../../utils/transaction')
const { recordAudit } = require('../audit/audit.service')
const { todayIn } = require('../packages/util')
const { givesBenefit } = require('../memberships/util')
const { toPaise } = require('./money')
const { computeInvoice, discountOn } = require('./calc')

const router = express.Router()
router.use(authenticate, requireSalon)

const idParams = z.object({ id: objectId })
const fieldError = (field, message, code = 'VALIDATION_ERROR') => new ApiError(400, code, message, { fieldErrors: { [field]: message } })
const phoneOf = (v) => String(v).replace(/\D/g, '').slice(-10)

const bodyShape = {
  bookingId: objectId.optional(),
  customerPhone: z.string().trim().regex(/^(91)?[6-9]\d{9}$/, 'Enter a 10 digit mobile number.').optional(),
  customerName: z.string().trim().min(1, 'Enter the customer name.').max(100).optional(),
  // Khaali ho aur booking di ho to booking ki services hi lagti hain
  lines: z.array(z.strictObject({ serviceId: objectId, quantity: z.number().int().min(1).max(20) })).max(30).optional(),
  offerId: objectId.optional(),
  applyMembership: z.boolean().default(true), // sirf "mat lagao" bol sakte ho; kaun sa lagega, server tay karta hai
  packageRedemptions: z.array(z.strictObject({ customerPackageId: objectId, serviceId: objectId })).max(10).default([]),
}
const needCustomer = [(b) => b.bookingId || (b.customerPhone && b.customerName), { message: 'Choose an appointment or enter the customer.', path: ['customerPhone'] }]
const needLines = [(b) => b.bookingId || b.lines?.length, { message: 'Add at least one service.', path: ['lines'] }]
// requestKey: frontend har "Create bill" screen khulne par naya banata hai
const createBody = z.strictObject({ requestKey: z.string().trim().min(8).max(80), ...bodyShape }).refine(...needCustomer).refine(...needLines)
const previewBody = z.strictObject(bodyShape).refine(...needCustomer).refine(...needLines)

function present(inv) {
  return {
    id: inv._id,
    invoiceNumber: inv.invoiceNumber,
    bookingId: inv.bookingId,
    customerPhone: inv.customerPhone,
    customerName: inv.customerName,
    lines: inv.lines.map((l) => ({ serviceId: l.serviceId, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity, lineTotal: l.lineTotal, package: l.package })),
    subtotal: inv.subtotal,
    offer: inv.offer,
    membership: inv.membership,
    discountTotal: inv.discountTotal,
    taxableAmount: inv.taxableAmount,
    tax: inv.tax,
    total: inv.total,
    amountPaid: inv.amountPaid,
    amountRefunded: inv.amountRefunded,
    amountDue: inv.status === 'void' ? 0 : inv.total - (inv.amountPaid - inv.amountRefunded),
    voidReason: inv.voidReason,
    paymentStatus: inv.paymentStatus,
    status: inv.status,
    createdAt: inv.createdAt,
  }
}

// ---------- list + dashboard ----------
// Salon ke timezone me 'YYYY-MM-DD' ka din shuru hone ka waqt (UTC Date). Din ke andar DST nahi maanta, India ke liye theek.
function dayStart(day, tz) {
  const utc = new Date(`${day}T00:00:00Z`)
  const local = new Date(utc.toLocaleString('en-US', { timeZone: tz }))
  const offsetMs = local.getTime() - new Date(utc.toLocaleString('en-US', { timeZone: 'UTC' })).getTime()
  return new Date(utc.getTime() - offsetMs)
}
const dayEnd = (day, tz) => new Date(dayStart(day, tz).getTime() + 86400000) // exclusive

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
const rangeQuery = { from: dateStr.optional(), to: dateStr.optional() }
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function createdAtFilter(salon, { from, to }) {
  if (!from && !to) return {}
  return { createdAt: { ...(from ? { $gte: dayStart(from, salon.timezone) } : {}), ...(to ? { $lt: dayEnd(to, salon.timezone) } : {}) } }
}

const listQuery = z.object({
  search: z.string().trim().max(50).optional(), // bill number, customer ka naam ya phone
  ...rangeQuery,
  customerPhone: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit mobile number.').optional(),
  method: z.enum(['cash', 'upi', 'card']).optional(),
  paymentStatus: z.enum(['unpaid', 'partial', 'paid']).optional(),
  status: z.enum(['final', 'void']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

router.get('/', can('billing.read'), validate({ query: listQuery }), async (req, res) => {
  const q = req.valid.query
  const salonId = req.salon._id
  const filter = { salonId, ...createdAtFilter(req.salon, q) }
  if (q.customerPhone) filter.customerPhone = q.customerPhone
  if (q.paymentStatus) filter.paymentStatus = q.paymentStatus
  if (q.status) filter.status = q.status
  if (q.method) filter._id = { $in: await Payment.distinct('invoiceId', { salonId, type: 'payment', method: q.method }) }
  if (q.search) {
    const rx = new RegExp(escapeRegex(q.search), 'i')
    filter.$or = [{ invoiceNumber: rx }, { customerName: rx }, { customerPhone: rx }]
  }
  const [rows, total] = await Promise.all([
    Invoice.find(filter).sort({ createdAt: -1, _id: -1 }).skip((q.page - 1) * q.pageSize).limit(q.pageSize).lean(),
    Invoice.countDocuments(filter),
  ])
  sendSuccess(req, res, { invoices: rows.map(present) }, { meta: { page: q.page, pageSize: q.pageSize, total } })
})

// Dashboard: kitna bill hua, kitna mila, kitna baaki (void bills ginti me nahi). Sab paise me, server par jod kar.
router.get('/summary', can('billing.read'), validate({ query: z.object(rangeQuery) }), async (req, res) => {
  const salonId = req.salon._id
  const match = { salonId, status: 'final', ...createdAtFilter(req.salon, req.valid.query) }
  const [agg] = await Invoice.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        invoices: { $sum: 1 },
        billed: { $sum: '$total' },
        received: { $sum: { $subtract: ['$amountPaid', '$amountRefunded'] } },
        refunded: { $sum: '$amountRefunded' },
        tax: { $sum: '$tax.total' },
        pendingCount: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 0, 1] } },
      },
    },
  ])
  const t = agg ?? { invoices: 0, billed: 0, received: 0, refunded: 0, tax: 0, pendingCount: 0 }
  const recent = await Invoice.find({ salonId }).sort({ createdAt: -1, _id: -1 }).limit(5).lean()
  sendSuccess(req, res, {
    summary: { invoices: t.invoices, billed: t.billed, received: t.received, pending: t.billed - t.received, refunded: t.refunded, tax: t.tax, pendingCount: t.pendingCount },
    recent: recent.map(present),
  })
})

// Is customer ke aise appointments jinka bill abhi nahi bana (cancelled nahi), taaki bill ke saath jod sakein
router.get('/billable-appointments', can('billing.write'), validate({ query: z.object({ customerPhone: z.string().trim().regex(/^\d{10}$/, 'Enter a 10-digit mobile number.') }) }), async (req, res) => {
  const salonId = req.salon._id
  const rows = await Booking.find({ salonId, customerPhone: req.valid.query.customerPhone, status: { $ne: 'cancelled' } }).sort({ date: -1, startTime: -1 }).limit(30).lean()
  const billed = new Set((await Invoice.find({ salonId, bookingId: { $in: rows.map((r) => r._id) }, status: 'final' }).select('bookingId').lean()).map((i) => String(i.bookingId)))
  sendSuccess(req, res, {
    appointments: rows
      .filter((r) => !billed.has(String(r._id)))
      .map((r) => ({ id: r._id, date: r.date, startTime: r.startTime, status: r.status, customerName: r.customerName, services: r.services.map((x) => ({ serviceId: x.serviceId, name: x.name, price: x.price })) })),
  })
})

// ---------- ek bill ----------
router.get('/:id', can('billing.read'), validate({ params: idParams }), async (req, res) => {
  const inv = await Invoice.findOne({ _id: req.valid.params.id, salonId: req.salon._id }).lean()
  if (!inv) throw new ApiError(404, 'NOT_FOUND', 'Invoice not found.')
  const payments = await Payment.find({ salonId: req.salon._id, invoiceId: inv._id }).sort({ createdAt: 1 }).lean()
  // Bill par chhapne ke liye salon ki details (settings.read har role ke paas nahi, isliye yahin se)
  const a = req.salon.address ?? {}
  const salon = { name: req.salon.name, address: [a.line1, a.area, a.city, a.state, a.pincode].filter(Boolean).join(', '), phone: req.salon.ownerContact?.phone ?? '', email: req.salon.ownerContact?.email ?? '' }
  sendSuccess(req, res, { invoice: present(inv), payments: payments.map(presentPayment), salon })
})

// Bill ka poora hisaab (kuch likhta nahi): customer, lines, offer, membership, package-cover aur total.
// Preview aur asli bill dono yahi chalate hain, isliye screen par dikha total aur bana hua total hamesha ek jaise hote hain.
async function buildQuote(req, b) {
  const salon = req.salon
  const salonId = salon._id
  const today = todayIn(salon.timezone)

  // ---- customer + booking ----
  let booking = null
  if (b.bookingId) {
    booking = await Booking.findOne({ _id: b.bookingId, salonId }).lean()
    if (!booking) throw fieldError('bookingId', 'Appointment not found.')
    if (booking.status === 'cancelled') throw new ApiError(409, 'BOOKING_CANCELLED', 'This appointment is cancelled.')
    if (await Invoice.exists({ salonId, bookingId: booking._id, status: 'final' })) {
      throw new ApiError(409, 'BOOKING_ALREADY_BILLED', 'This appointment already has a bill.')
    }
  }
  const customerPhone = phoneOf(booking ? booking.customerPhone : b.customerPhone)
  const customerName = booking ? booking.customerName : b.customerName
  const customer = await Customer.findOne({ phone: customerPhone }).select('_id').lean()

  // ---- lines: price hamesha server se (booking ki copy ya service ka abhi ka price) ----
  const requested = b.lines ?? booking.services.map((s) => ({ serviceId: String(s.serviceId), quantity: 1 }))
  const ids = requested.map((l) => l.serviceId)
  if (new Set(ids).size !== ids.length) throw fieldError('lines', 'Each service can appear only once. Change the quantity instead.')
  const services = await Service.find({ _id: { $in: ids }, salonId }).lean()
  const byId = new Map(services.map((s) => [String(s._id), s]))
  const bookingPrice = new Map((booking?.services ?? []).map((s) => [String(s.serviceId), s]))
  const baseLines = requested.map((l) => {
    const inBooking = bookingPrice.get(l.serviceId)
    const svc = byId.get(l.serviceId)
    if (!svc && !inBooking) throw fieldError('lines', 'One of the services was not found.')
    if (!inBooking && !svc.active) throw fieldError('lines', `${svc.name} is switched off.`)
    return { serviceId: l.serviceId, name: inBooking?.name ?? svc.name, unitPrice: toPaise(inBooking?.price ?? svc.price), quantity: l.quantity }
  })

  // ---- package: pehle se kata hua session (BenefitsDialog se) dobara nahi katega, bas charge se hatega ----
  const covered = new Map() // serviceId -> { customerPackageId, packageName, fresh: bool }
  if (booking) {
    const done = await PackageLedger.find({ salonId, bookingId: booking._id, type: 'redemption' }).lean()
    const cps = await CustomerPackage.find({ _id: { $in: done.map((d) => d.customerPackageId) }, salonId }).select('packageName').lean()
    const names = new Map(cps.map((c) => [String(c._id), c.packageName]))
    for (const d of done) covered.set(String(d.serviceId), { customerPackageId: d.customerPackageId, packageName: names.get(String(d.customerPackageId)) ?? '', fresh: false })
    for (const id of covered.keys()) {
      if (!ids.includes(id)) throw fieldError('lines', 'A service already paid through a package must stay on the bill.')
    }
  }
  const newRedemptions = []
  if (b.packageRedemptions.length) {
    if (!booking) throw fieldError('packageRedemptions', 'Link an appointment to use a package session.')
    if (booking.status !== 'completed') throw new ApiError(409, 'BOOKING_NOT_COMPLETED', 'A session can be used only after the appointment is completed.')
    for (const r of b.packageRedemptions) {
      if (!ids.includes(r.serviceId)) throw fieldError('packageRedemptions', 'That service is not on this bill.')
      if (covered.has(r.serviceId)) throw new ApiError(409, 'ALREADY_REDEEMED', 'A session was already used for this service in this appointment.')
      const cp = await CustomerPackage.findOne({ _id: r.customerPackageId, salonId, customerPhone }).lean()
      if (!cp) throw fieldError('packageRedemptions', 'Package not found for this customer.')
      const item = cp.items.find((i) => String(i.serviceId) === r.serviceId)
      if (!item) throw new ApiError(409, 'SERVICE_NOT_IN_PACKAGE', 'This service is not included in the package.')
      covered.set(r.serviceId, { customerPackageId: cp._id, packageName: cp.packageName, fresh: true })
      newRedemptions.push({ cp, item, serviceId: r.serviceId })
    }
  }
  const chargeLines = baseLines.map((l) => ({ ...l, coveredUnits: covered.has(l.serviceId) ? 1 : 0 }))

  // ---- offer (sirf chuna hua; khud validate hota hai) ----
  const probe = computeInvoice({ lines: chargeLines })
  let offer = null
  const offerId = b.offerId ?? booking?.offer?.offerId
  if (offerId) {
    const rule = await Offer.findOne({ _id: offerId, salonId, active: true, startsOn: { $lte: today }, endsOn: { $gte: today } }).lean()
    const bad = (m) => fieldError('offerId', m, 'OFFER_INVALID')
    if (!rule) {
      // Booking par pehle se laga offer ab expire ho gaya ho to bhi usi bill par maana jaata hai (booking ke waqt valid tha)
      if (!(booking?.offer && String(booking.offer.offerId) === String(offerId))) throw bad('This offer is no longer available.')
    }
    if (rule) {
      if (discountOn(rule, probe.lines) <= 0) throw bad('This offer does not apply to these services.')
      if (rule.oncePerCustomer) {
        const usedBill = await Invoice.exists({ salonId, customerPhone, 'offer.offerId': rule._id, status: 'final' })
        const usedBooking = await Booking.exists({ salonId, customerPhone, 'offer.offerId': rule._id, status: { $ne: 'cancelled' }, ...(booking ? { _id: { $ne: booking._id } } : {}) })
        if (usedBill || usedBooking) throw bad('This customer has already used this offer.')
      }
      offer = { rule, meta: { offerId: rule._id, title: rule.title } }
    } else {
      const o = await Offer.findOne({ _id: offerId, salonId }).lean()
      if (!o) throw bad('This offer is no longer available.')
      offer = { rule: o, meta: { offerId: o._id, title: o.title } }
    }
  }

  // ---- membership: booking par laga ho to wahi, warna sabse achha chalu + paid ----
  let membership = null
  if (b.applyMembership) {
    const wanted = booking?.membership?.customerMembershipId
    const pool = await CustomerMembership.find({ salonId, customerPhone, cancelled: false, paymentStatus: 'paid', ...(wanted ? { _id: wanted } : {}) })
    let best = null
    for (const cm of pool) {
      if (!givesBenefit(cm, today)) continue
      const d = discountOn(cm, probe.lines)
      if (d > 0 && (!best || d > best.d)) best = { cm, d }
    }
    if (best) membership = { rule: best.cm, meta: { customerMembershipId: best.cm._id, planName: best.cm.planName }, alreadyOnBooking: Boolean(booking?.membership) }
  }

  const calc = computeInvoice({ lines: chargeLines, offer: offer?.rule, membership: membership?.rule })
  return { salonId, today, booking, customerPhone, customerName, customer, covered, newRedemptions, offer, membership, calc }
}

// Screen ke liye: bina bill banaye dikhata hai ki total kitna banega (server ka hisaab)
router.post('/preview', can('billing.write'), validate({ body: previewBody }), async (req, res) => {
  const q = await buildQuote(req, req.valid.body)
  const c = q.calc
  sendSuccess(req, res, {
    customer: { phone: q.customerPhone, name: q.customerName },
    bookingId: q.booking?._id ?? null,
    lines: c.lines.map((l) => ({ serviceId: l.serviceId, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity, coveredUnits: l.coveredUnits, lineTotal: l.lineTotal, packageName: q.covered.get(String(l.serviceId))?.packageName ?? null })),
    subtotal: c.subtotal,
    offer: q.offer ? { ...q.offer.meta, discount: c.offerDiscount } : null,
    membership: q.membership ? { ...q.membership.meta, discount: c.membershipDiscount } : null,
    discountTotal: c.discountTotal,
    taxableAmount: c.taxableAmount,
    tax: c.tax,
    total: c.total,
  })
})

// ---------- naya bill ----------
router.post('/', can('billing.write'), validate({ body: createBody }), async (req, res) => {
  const b = req.valid.body
  const salonId = req.salon._id

  // Wahi request dobara aaye (double click / retry) to naya bill nahi, purana hi wapas
  const existing = await Invoice.findOne({ salonId, requestKey: b.requestKey }).lean()
  if (existing) return sendSuccess(req, res, { invoice: present(existing), duplicate: true })

  const { today, booking, customerPhone, customerName, customer, covered, newRedemptions, offer, membership, calc } = await buildQuote(req, b)
  const year = Number(today.slice(0, 4))

  let invoice
  try {
    invoice = await withTransaction(async (session) => {
      const counter = await InvoiceCounter.findOneAndUpdate({ salonId, year }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after', session })
      const invoiceNumber = `GLM-${year}-${String(counter.seq).padStart(6, '0')}`
      const invoiceId = new mongoose.Types.ObjectId()

      // Naye package sessions: ek atomic update (balance > 0 tabhi ghate) + ledger
      for (const r of newRedemptions) {
        const upd = await CustomerPackage.updateOne(
          { _id: r.cp._id, salonId, cancelled: false, startsOn: { $lte: today }, expiresOn: { $gte: today }, items: { $elemMatch: { serviceId: r.serviceId, remaining: { $gt: 0 } } } },
          { $inc: { 'items.$.remaining': -1 } },
          { session },
        )
        if (upd.modifiedCount !== 1) throw new ApiError(409, 'PACKAGE_NOT_USABLE', `${r.cp.packageName} has no usable session left for this service (expired, cancelled or finished).`)
        await PackageLedger.create([{ salonId, customerPackageId: r.cp._id, type: 'redemption', serviceId: r.serviceId, serviceName: r.item.serviceName, sessions: -1, bookingId: booking._id, invoiceId, actorId: req.user._id }], { session })
      }

      if (membership && calc.membershipDiscount > 0 && !membership.alreadyOnBooking) {
        await MembershipLedger.create(
          [{ salonId, customerMembershipId: membership.rule._id, type: booking ? 'discount' : 'invoice_discount', amount: calc.membershipDiscount, bookingId: booking?._id ?? null, invoiceId, actorId: req.user._id }],
          { session },
        )
      }

      const paid = calc.total === 0 // poora package/discount se cover => kuch dena nahi
      const [created] = await Invoice.create(
        [
          {
            _id: invoiceId,
            salonId,
            invoiceNumber,
            bookingId: booking?._id ?? null,
            customerId: customer?._id ?? null,
            customerPhone,
            customerName,
            lines: calc.lines.map((l) => ({
              serviceId: l.serviceId,
              name: l.name,
              unitPrice: l.unitPrice,
              quantity: l.quantity,
              lineTotal: l.lineTotal,
              package: l.coveredUnits ? { ...pick(covered.get(String(l.serviceId))), sessions: l.coveredUnits } : null,
            })),
            subtotal: calc.subtotal,
            offer: offer ? { ...offer.meta, discount: calc.offerDiscount } : null,
            membership: membership ? { ...membership.meta, discount: calc.membershipDiscount } : null,
            discountTotal: calc.discountTotal,
            taxableAmount: calc.taxableAmount,
            tax: calc.tax,
            total: calc.total,
            paymentStatus: paid ? 'paid' : 'unpaid',
            requestKey: b.requestKey,
            createdBy: req.user._id,
          },
        ],
        { session },
      )
      await recordAudit(
        req,
        { action: 'invoice.created', entityType: 'invoice', entityId: created._id, changes: { invoiceNumber, bookingId: booking?._id ?? null, total: calc.total, discountTotal: calc.discountTotal, packageSessions: newRedemptions.length } },
        { session },
      )
      return created
    })
  } catch (e) {
    if (e?.code === 11000) {
      const k = e.keyPattern ?? {}
      if (k.requestKey) {
        const again = await Invoice.findOne({ salonId, requestKey: b.requestKey }).lean()
        if (again) return sendSuccess(req, res, { invoice: present(again), duplicate: true })
      }
      if (k.bookingId && k.customerPackageId) throw new ApiError(409, 'ALREADY_REDEEMED', 'A session was already used for this service in this appointment.')
      if (k.bookingId && k.customerMembershipId) throw new ApiError(409, 'ALREADY_APPLIED', 'A membership discount is already applied to this appointment.')
      if (k.bookingId) throw new ApiError(409, 'BOOKING_ALREADY_BILLED', 'This appointment already has a bill.')
    }
    throw e
  }
  sendSuccess(req, res, { invoice: present(invoice) }, { status: 201 })
})

// ---------- payments / refunds / void ----------
// Paisa sirf Payment records se badalta hai (append-only). Invoice ke amountPaid/amountRefunded/paymentStatus ek hi atomic update me
// badalte hain, filter ke saath: do log ek saath bharein to bhi total se zyada ya refund se zyada kabhi nahi ho sakta.
const methodEnum = z.enum(['cash', 'upi', 'card'])
const paise = z.number().int('Amount must be in whole paise.').min(1, 'Amount must be more than 0.').max(100000000)
const reason = z.string().trim().min(3, 'Please give a reason (at least 3 characters).').max(300)
const payBody = z.strictObject({ requestKey: z.string().trim().min(8).max(80), method: methodEnum, amount: paise, reference: z.string().trim().max(80).default(''), note: z.string().trim().max(300).default('') })
const refundBody = z.strictObject({ requestKey: z.string().trim().min(8).max(80), method: methodEnum, amount: paise, reference: z.string().trim().max(80).default(''), note: reason })
const voidBody = z.strictObject({ note: reason })

const presentPayment = (p) => ({ id: p._id, type: p.type, method: p.method, amount: p.amount, reference: p.reference, note: p.note, createdAt: p.createdAt })

// net = amountPaid - amountRefunded; paid agar net >= total, partial agar net > 0, warna unpaid
const statusExpr = {
  $switch: {
    branches: [
      { case: { $gte: [{ $subtract: ['$amountPaid', '$amountRefunded'] }, '$total'] }, then: 'paid' },
      { case: { $gt: [{ $subtract: ['$amountPaid', '$amountRefunded'] }, 0] }, then: 'partial' },
    ],
    default: 'unpaid',
  },
}

async function moveMoney(req, res, { type }) {
  const b = req.valid.body
  const salonId = req.salon._id
  const invoiceId = req.valid.params.id

  const dup = await Payment.findOne({ salonId, requestKey: b.requestKey }).lean()
  const replay = async (p) => {
    if (String(p.invoiceId) !== String(invoiceId) || p.type !== type) throw new ApiError(409, 'REQUEST_KEY_REUSED', 'This request key was already used for something else.')
    const inv = await Invoice.findById(invoiceId).lean()
    return sendSuccess(req, res, { invoice: present(inv), payment: presentPayment(p), duplicate: true })
  }
  if (dup) return replay(dup)

  const inv = await Invoice.findOne({ _id: invoiceId, salonId }).lean()
  if (!inv) throw new ApiError(404, 'NOT_FOUND', 'Invoice not found.')

  // payment: net + amount <= total. refund: amount <= net paid
  const guard =
    type === 'payment'
      ? { $expr: { $lte: [{ $add: [{ $subtract: ['$amountPaid', '$amountRefunded'] }, b.amount] }, '$total'] } }
      : { $expr: { $lte: [b.amount, { $subtract: ['$amountPaid', '$amountRefunded'] }] } }
  const field = type === 'payment' ? 'amountPaid' : 'amountRefunded'

  let payment
  try {
    payment = await withTransaction(async (session) => {
      const upd = await Invoice.updateOne(
        { _id: invoiceId, salonId, status: 'final', ...guard },
        [{ $set: { [field]: { $add: [`$${field}`, b.amount] } } }, { $set: { paymentStatus: statusExpr } }],
        { session, updatePipeline: true },
      )
      if (upd.modifiedCount !== 1) return null
      const [p] = await Payment.create([{ salonId, invoiceId, type, method: b.method, amount: b.amount, reference: b.reference, note: b.note, requestKey: b.requestKey, actorId: req.user._id }], { session })
      await recordAudit(req, { action: type === 'payment' ? 'invoice.payment_recorded' : 'invoice.refunded', entityType: 'invoice', entityId: invoiceId, changes: { invoiceNumber: inv.invoiceNumber, method: b.method, amount: b.amount, ...(type === 'refund' ? { note: b.note } : {}) } }, { session })
      return p
    })
  } catch (e) {
    if (e?.code === 11000 && e.keyPattern?.requestKey) return replay(await Payment.findOne({ salonId, requestKey: b.requestKey }).lean())
    throw e
  }
  if (!payment) {
    const fresh = await Invoice.findById(invoiceId).lean()
    if (fresh.status === 'void') throw new ApiError(409, 'INVOICE_VOID', 'This invoice is void.')
    const net = fresh.amountPaid - fresh.amountRefunded
    if (type === 'payment') throw new ApiError(409, 'OVERPAYMENT', `Amount is more than the amount due (${fresh.total - net} paise).`, { fieldErrors: { amount: 'Amount is more than the amount due.' } })
    throw new ApiError(409, 'REFUND_TOO_LARGE', `Refund is more than the amount received (${net} paise).`, { fieldErrors: { amount: 'Refund is more than the amount received.' } })
  }
  sendSuccess(req, res, { invoice: present(await Invoice.findById(invoiceId).lean()), payment: presentPayment(payment) }, { status: 201 })
}

router.post('/:id/payments', can('billing.write'), validate({ params: idParams, body: payBody }), (req, res) => moveMoney(req, res, { type: 'payment' }))
router.post('/:id/refunds', can('billing.refund'), validate({ params: idParams, body: refundBody }), (req, res) => moveMoney(req, res, { type: 'refund' }))

// Galat bill radd karna: pehle poora paisa refund hona chahiye. Bill delete nahi hota, 'void' ho jaata hai (aur appointment dobara bill ho sakta hai).
// Package ka kata hua session wapas nahi aata; dobara bill banane par wahi session cover karta rahega.
router.post('/:id/void', can('billing.void'), validate({ params: idParams, body: voidBody }), async (req, res) => {
  const salonId = req.salon._id
  const inv = await Invoice.findOne({ _id: req.valid.params.id, salonId }).lean()
  if (!inv) throw new ApiError(404, 'NOT_FOUND', 'Invoice not found.')
  const ok = await withTransaction(async (session) => {
    const upd = await Invoice.updateOne(
      { _id: inv._id, salonId, status: 'final', $expr: { $eq: ['$amountPaid', '$amountRefunded'] } },
      { $set: { status: 'void', voidReason: req.valid.body.note } },
      { session },
    )
    if (upd.modifiedCount !== 1) return false
    await recordAudit(req, { action: 'invoice.voided', entityType: 'invoice', entityId: inv._id, changes: { invoiceNumber: inv.invoiceNumber, note: req.valid.body.note } }, { session })
    return true
  })
  if (!ok) {
    const fresh = await Invoice.findById(inv._id).lean()
    if (fresh.status === 'void') throw new ApiError(409, 'INVOICE_VOID', 'This invoice is already void.')
    throw new ApiError(409, 'REFUND_FIRST', 'Refund the received payment before voiding this invoice.')
  }
  sendSuccess(req, res, { invoice: present(await Invoice.findById(inv._id).lean()) })
})

const pick = (c) => ({ customerPackageId: c.customerPackageId, packageName: c.packageName })

module.exports = router
