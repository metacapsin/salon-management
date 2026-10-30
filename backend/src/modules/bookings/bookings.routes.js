// Owner/manager/receptionist ke liye: apne salon ki appointments dekhna aur unka status badalna.
const express = require('express')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { Booking, Branch, Service, Staff } = require('../../models')
const { recordAudit } = require('../audit/audit.service')
const { withTransaction } = require('../../utils/transaction')
const { requestReview } = require('../reviews/reviews.service')
const { bookingBenefits } = require('./benefits')
const { buildSlots, dateInRange, isRealDate } = require('./slots')

const router = express.Router()
router.use(authenticate, requireSalon)

// Status kahan se kahan ja sakta hai
const NEXT = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
}

function present(b) {
  return {
    id: b._id,
    customerName: b.customerName,
    customerPhone: b.customerPhone,
    staffId: b.staffId ?? null,
    staffName: b.staffName || '',
    mode: b.mode,
    address: b.address,
    note: b.note,
    date: b.date,
    startTime: b.startTime,
    durationMin: b.durationMin,
    services: b.services.map((s) => ({ name: s.name, price: s.price })),
    total: b.total,
    offer: b.offer ? { title: b.offer.title, discount: b.offer.discount } : null,
    membership: b.membership ? { planName: b.membership.planName, discount: b.membership.discount } : null,
    status: b.status,
    createdAt: b.createdAt,
  }
}

const listQuery = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

router.get('/', can('appointments.read'), validate({ query: listQuery }), async (req, res) => {
  const { status, page, pageSize } = req.valid.query
  const filter = { salonId: req.salon._id, ...(status ? { status } : {}) }
  const [rows, total] = await Promise.all([
    // Nayi date pehle; same din me samay se
    Booking.find(filter).sort({ date: -1, startTime: 1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Booking.countDocuments(filter),
  ])
  sendSuccess(req, res, { bookings: rows.map(present) }, { meta: { page, pageSize, total } })
})

// ---------- salon-side: naya appointment ----------
const OPEN_STATUSES = ['pending', 'confirmed']
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
const OUT_OF_RANGE = 'Choose a date within the next 30 days.'
const fieldError = (status, code, field, message) => new ApiError(status, code, message, { fieldErrors: { [field]: message } })

const hasOwnHours = (staff) => Object.values(staff.weeklyHours ?? {}).some((day) => day?.length)

// Us din ke slots. Staff chuna ho to uski apni shift (na ho to salon ke ghante) aur ek waqt me ek hi booking;
// staff na chuna ho to customer-side jaisa salon-capacity wala hisaab.
async function slotsFor(salon, { date, durationMin, staff }) {
  const filter = { salonId: salon._id, date, status: { $in: OPEN_STATUSES } }
  if (staff) filter.staffId = staff._id
  const [branch, bookings] = await Promise.all([Branch.findOne({ salonId: salon._id }).lean(), Booking.find(filter).select('startTime durationMin').lean()])
  const hours = staff && hasOwnHours(staff) ? { ...branch, weeklyHours: staff.weeklyHours } : branch
  return buildSlots({ date, durationMin, branch: hours, bookings, timeZone: salon.timezone, ...(staff ? { capacity: 1 } : {}) })
}

// Sirf isi salon ka, active staff. Dusre salon ki id par 404-jaisa error.
async function findStaff(salon, staffId, serviceIds = []) {
  const staff = await Staff.findOne({ _id: staffId, salonId: salon._id, active: true }).lean()
  if (!staff) throw fieldError(400, 'VALIDATION_ERROR', 'staffId', 'This staff member was not found.')
  // Staff ne services chuni hon to sirf unhi me se (khaali list = sab kar sakta hai)
  if (staff.serviceIds?.length && !serviceIds.every((id) => staff.serviceIds.some((sid) => String(sid) === String(id)))) {
    throw fieldError(400, 'VALIDATION_ERROR', 'staffId', `${staff.name} does not do the chosen service.`)
  }
  return staff
}

async function chosenServices(salon, serviceIds) {
  const ids = [...new Set(serviceIds)]
  const services = await Service.find({ _id: { $in: ids }, salonId: salon._id, active: true }).lean()
  if (services.length !== ids.length) throw fieldError(400, 'VALIDATION_ERROR', 'serviceId', 'This service was not found.')
  return services
}

const slotsQuery = z.object({ date: dateStr, serviceId: objectId, staffId: objectId.optional() })

// GET /bookings/slots?date=2026-10-20&serviceId=..&staffId=.. -> us din ke time slots
// Is appointment par customer ke package sessions / membership discount (sirf dikhata hai)
router.get('/:id/benefits', can('appointments.read'), validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const booking = await Booking.findOne({ _id: req.valid.params.id, salonId: req.salon._id }).lean()
  if (!booking) throw new ApiError(404, 'NOT_FOUND', 'Appointment not found.')
  sendSuccess(req, res, await bookingBenefits(req, booking))
})

router.get('/slots', can('appointments.write'), validate({ query: slotsQuery }), async (req, res) => {
  const { date, serviceId, staffId } = req.valid.query
  if (!dateInRange(date, req.salon.timezone)) throw fieldError(400, 'VALIDATION_ERROR', 'date', OUT_OF_RANGE)
  const services = await chosenServices(req.salon, [serviceId])
  const staff = staffId ? await findStaff(req.salon, staffId, [serviceId]) : null
  const durationMin = services.reduce((sum, s) => sum + s.durationMin, 0)
  sendSuccess(req, res, { slots: await slotsFor(req.salon, { date, durationMin, staff }) })
})

const createBody = z.strictObject({
  customerName: z.string().trim().min(2, 'Enter the customer name.').max(100),
  customerPhone: z
    .string()
    .trim()
    .regex(/^(91)?[6-9]\d{9}$/, 'Enter a 10 digit mobile number.')
    .transform((v) => v.slice(-10)),
  serviceId: objectId,
  staffId: objectId.optional(),
  date: dateStr.refine(isRealDate, 'Choose a real date.'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a time slot.'),
  note: z.string().trim().max(300).default(''),
})

// POST /bookings -> salon ka staff (owner/manager/receptionist) appointment banata hai.
// Salon hamesha login se aata hai (X-Salon-Id ko server membership se jaanchta hai), body se kabhi nahi.
// Status hamesha 'pending' se shuru: confirm karna alag step hai (PATCH /:id/status), jaise customer ki booking me.
router.post('/', can('appointments.write'), validate({ body: createBody }), async (req, res) => {
  const b = req.valid.body
  const salon = req.salon
  if (!dateInRange(b.date, salon.timezone)) throw fieldError(400, 'VALIDATION_ERROR', 'date', OUT_OF_RANGE)

  const services = await chosenServices(salon, [b.serviceId])
  const staff = b.staffId ? await findStaff(salon, b.staffId, [b.serviceId]) : null
  const durationMin = services.reduce((sum, s) => sum + s.durationMin, 0)
  const taken = () => fieldError(409, 'SLOT_UNAVAILABLE', 'startTime', 'This time is not available. Please choose another slot.')

  const booking = await withTransaction(async (session) => {
    // Staff ki row par likhna: do log ek hi waqt par ek hi staff ko book karein to ek transaction conflict me hat jaata hai
    if (staff) await Staff.updateOne({ _id: staff._id }, { $inc: { bookingSeq: 1 } }, { session })
    const open = await Booking.find({ salonId: salon._id, date: b.date, status: { $in: OPEN_STATUSES }, ...(staff ? { staffId: staff._id } : {}) }, null, { session })
      .select('startTime durationMin')
      .lean()
    const hours = staff && hasOwnHours(staff) ? { ...(await Branch.findOne({ salonId: salon._id }).lean()), weeklyHours: staff.weeklyHours } : await Branch.findOne({ salonId: salon._id }).lean()
    const slot = buildSlots({ date: b.date, durationMin, branch: hours, bookings: open, timeZone: salon.timezone, ...(staff ? { capacity: 1 } : {}) }).find((s) => s.time === b.startTime)
    if (!slot?.available) throw taken()
    const subtotal = services.reduce((sum, s) => sum + s.price, 0)
    const [created] = await Booking.create(
      [
        {
          salonId: salon._id,
          customerName: b.customerName,
          customerPhone: b.customerPhone,
          staffId: staff?._id ?? null,
          staffName: staff?.name ?? '',
          note: b.note,
          date: b.date,
          startTime: b.startTime,
          durationMin,
          services: services.map((s) => ({ serviceId: s._id, name: s.name, price: s.price, durationMin: s.durationMin })),
          subtotal,
          total: subtotal,
          status: 'pending',
        },
      ],
      { session },
    )
    await recordAudit(req, { action: 'booking.created', entityType: 'booking', entityId: created._id, changes: { date: b.date, startTime: b.startTime, staffId: staff?._id ?? null } }, { session })
    return created
  })
  sendSuccess(req, res, { booking: present(booking) }, { status: 201 })
})

router.patch(
  '/:id/status',
  can('appointments.write'),
  validate({ params: z.object({ id: objectId }), body: z.strictObject({ status: z.enum(['confirmed', 'completed', 'cancelled']) }) }),
  async (req, res) => {
    const booking = await Booking.findOne({ _id: req.valid.params.id, salonId: req.salon._id })
    if (!booking) throw new ApiError(404, 'NOT_FOUND', 'Appointment not found.')
    const { status } = req.valid.body
    if (!NEXT[booking.status].includes(status)) {
      throw new ApiError(409, 'INVALID_STATUS', `A ${booking.status} appointment cannot be marked ${status}.`)
    }
    const before = booking.status
    booking.status = status
    await booking.save()
    await recordAudit(req, { action: 'booking.status_changed', entityType: 'booking', entityId: booking._id, changes: { before, after: status } })
    if (status === 'completed') {
      // Review request customer ko jati he; ye fail ho to bhi appointment ka status badal chuka he, isliye sirf log karte hain
      await requestReview(booking).catch((error) => console.error('Review request failed:', error.message))
    }
    sendSuccess(req, res, { booking: present(booking) })
  },
)

module.exports = router
