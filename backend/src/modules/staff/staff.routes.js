const express = require('express')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { Staff, Service } = require('../../models')
const { recordAudit } = require('../audit/audit.service')

const router = express.Router()
router.use(authenticate, requireSalon)

// ---------- rules ----------
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm, like 09:30.')
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

const interval = z
  .strictObject({ start: time, end: time })
  .refine((i) => toMin(i.start) < toMin(i.end), 'End time must be after start time.')

// Ek din ke andar ek se zyada interval ho sakte hain (jaise lunch break), par aapas me takrane nahi chahiye.
const day = z.array(interval).max(4).refine((list) => {
  const sorted = [...list].sort((a, b) => toMin(a.start) - toMin(b.start))
  return sorted.every((i, n) => n === 0 || toMin(sorted[n - 1].end) <= toMin(i.start))
}, 'Working hours of one day must not overlap.')

const weeklyHours = z.strictObject(Object.fromEntries(DAYS.map((d) => [d, day.optional()])))

const staffFields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(100),
  phone: z.string().trim().max(20),
  title: z.string().trim().max(60),
  skills: z.array(z.string().trim().min(1).max(40)).max(20),
  serviceIds: z.array(objectId).max(100),
  weeklyHours,
  active: z.boolean(),
}

const createBody = z.strictObject({
  ...staffFields,
  phone: staffFields.phone.default(''),
  title: staffFields.title.default(''),
  skills: staffFields.skills.default([]),
  serviceIds: staffFields.serviceIds.default([]),
  weeklyHours: staffFields.weeklyHours.default({}),
}).omit({ active: true })

const updateBody = z
  .strictObject(staffFields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update.')

const listQuery = z.object({ includeInactive: z.enum(['true', 'false']).default('false') })
const idParams = z.object({ id: objectId })

// ---------- helpers ----------
function present(s) {
  const hours = s.weeklyHours instanceof Map ? Object.fromEntries(s.weeklyHours) : (s.weeklyHours ?? {})
  return {
    id: s._id,
    name: s.name,
    phone: s.phone,
    title: s.title,
    skills: s.skills,
    serviceIds: s.serviceIds,
    weeklyHours: Object.fromEntries(DAYS.map((d) => [d, (hours[d] ?? []).map(({ start, end }) => ({ start, end }))])),
    active: s.active,
  }
}

async function findOwn(req) {
  const staff = await Staff.findOne({ _id: req.valid.params.id, salonId: req.salon._id })
  if (!staff) throw new ApiError(404, 'NOT_FOUND', 'Staff member not found.')
  return staff
}

// Sirf isi salon ki services chuni ja sakti hain (dusre salon ki id se chori nahi)
async function checkServices(req, serviceIds) {
  if (!serviceIds?.length) return
  const unique = [...new Set(serviceIds)]
  const found = await Service.countDocuments({ _id: { $in: unique }, salonId: req.salon._id })
  if (found !== unique.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'One of the chosen services was not found.', { fieldErrors: { serviceIds: 'One of the chosen services was not found.' } })
  }
}

// ---------- routes ----------
router.get('/', can('staff.read'), validate({ query: listQuery }), async (req, res) => {
  const filter = { salonId: req.salon._id }
  if (req.valid.query.includeInactive !== 'true') filter.active = true
  const staff = await Staff.find(filter).sort({ name: 1 })
  sendSuccess(req, res, { staff: staff.map(present) })
})

router.post('/', can('staff.write'), validate({ body: createBody }), async (req, res) => {
  await checkServices(req, req.valid.body.serviceIds)
  const staff = await Staff.create({ ...req.valid.body, salonId: req.salon._id, createdBy: req.user._id })
  await recordAudit(req, { action: 'staff.created', entityType: 'staff', entityId: staff._id, changes: { name: staff.name } })
  sendSuccess(req, res, { staff: present(staff) }, { status: 201 })
})

router.patch('/:id', can('staff.write'), validate({ params: idParams, body: updateBody }), async (req, res) => {
  const staff = await findOwn(req)
  await checkServices(req, req.valid.body.serviceIds)
  const before = present(staff)
  staff.set(req.valid.body)
  await staff.save()
  await recordAudit(req, { action: 'staff.updated', entityType: 'staff', entityId: staff._id, changes: { before, after: req.valid.body } })
  sendSuccess(req, res, { staff: present(staff) })
})

// Poori tarah hata deta hai. Sirf band karna ho to PATCH { active: false } (Active switch) use hota hai.
// Bookings me staff ki id abhi nahi rakhi jaati, isliye purani bookings par asar nahi padta.
router.delete('/:id', can('staff.write'), validate({ params: idParams }), async (req, res) => {
  const staff = await findOwn(req)
  await staff.deleteOne()
  await recordAudit(req, { action: 'staff.deleted', entityType: 'staff', entityId: staff._id, changes: { name: staff.name } })
  sendSuccess(req, res, { deleted: true })
})

module.exports = router
