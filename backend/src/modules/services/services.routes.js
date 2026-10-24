const express = require('express')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { Service, Salon } = require('../../models')
const { SERVICE_CATEGORIES } = require('../../config/serviceCategories')
const { recordAudit } = require('../audit/audit.service')

const router = express.Router()
router.use(authenticate, requireSalon)

// ---------- rules ----------
const serviceFields = {
  name: z.string().trim().min(2, 'Service name must be at least 2 characters.').max(100),
  category: z.enum(SERVICE_CATEGORIES),
  description: z.string().trim().max(500),
  price: z.number({ error: 'Enter a price.' }).int('Use whole rupees.').min(0).max(1_000_000),
  durationMin: z
    .number({ error: 'Enter the duration in minutes.' })
    .int()
    .min(5, 'At least 5 minutes.')
    .max(480, 'At most 8 hours.')
    .refine((v) => v % 5 === 0, 'Use 5 minute steps.'),
  atSalon: z.boolean(),
  atHome: z.boolean(),
  active: z.boolean(),
}
const mustHaveAPlace = (b) => b.atSalon !== false || b.atHome === true
const placeMessage = 'Choose at least one place: at the salon or at home.'

const createBody = z
  .strictObject({
    ...serviceFields,
    category: serviceFields.category.default('Other'),
    description: serviceFields.description.default(''),
    atSalon: serviceFields.atSalon.default(true),
    atHome: serviceFields.atHome.default(false),
  })
  .omit({ active: true })
  .refine(mustHaveAPlace, { message: placeMessage, path: ['atSalon'] })

const updateBody = z
  .strictObject(serviceFields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update.')

const listQuery = z.object({
  includeInactive: z.enum(['true', 'false']).default('false'),
})
const idParams = z.object({ id: objectId })

// ---------- helpers ----------
function present(s) {
  return {
    id: s._id,
    name: s.name,
    category: s.category,
    description: s.description,
    price: s.price,
    durationMin: s.durationMin,
    atSalon: s.atSalon,
    atHome: s.atHome,
    active: s.active,
  }
}

// Customer ko dikhne wali salon-card ki baatein (From ₹..., At salon / Home service) services se bharti hain.
async function syncListing(salonId) {
  const active = await Service.find({ salonId, active: true }).select('price atSalon atHome category').lean()
  const prices = active.map((s) => s.price)
  await Salon.updateOne(
    { _id: salonId },
    {
      $set: {
        startingPrice: prices.length ? Math.min(...prices) : null,
        'serviceModes.salonVisit': active.length === 0 || active.some((s) => s.atSalon),
        'serviceModes.homeService': active.some((s) => s.atHome),
        tags: [...new Set(active.map((s) => s.category))].slice(0, 6),
      },
    },
  )
}

async function findOwn(req) {
  const service = await Service.findOne({ _id: req.valid.params.id, salonId: req.salon._id })
  if (!service) throw new ApiError(404, 'NOT_FOUND', 'Service not found.')
  return service
}

function duplicateNameError(error) {
  if (error?.code === 11000) {
    return new ApiError(409, 'SERVICE_EXISTS', 'You already have a service with this name.', { fieldErrors: { name: 'You already have a service with this name.' } })
  }
  return error
}

// ---------- routes ----------
// Sab roles padh sakte hain (booking ke waqt chahiye); likhna sirf Owner/Manager.
router.get('/', can('services.read'), validate({ query: listQuery }), async (req, res) => {
  const filter = { salonId: req.salon._id }
  if (req.valid.query.includeInactive !== 'true') filter.active = true
  const services = await Service.find(filter).sort({ category: 1, name: 1 }).lean()
  sendSuccess(req, res, { services: services.map(present) })
})

router.post('/', can('services.write'), validate({ body: createBody }), async (req, res) => {
  let service
  try {
    service = await Service.create({ ...req.valid.body, salonId: req.salon._id, createdBy: req.user._id })
  } catch (error) {
    throw duplicateNameError(error)
  }
  await syncListing(req.salon._id)
  await recordAudit(req, { action: 'service.created', entityType: 'service', entityId: service._id, changes: { name: service.name, price: service.price } })
  sendSuccess(req, res, { service: present(service) }, { status: 201 })
})

router.patch('/:id', can('services.write'), validate({ params: idParams, body: updateBody }), async (req, res) => {
  const service = await findOwn(req)
  const b = req.valid.body
  const merged = { atSalon: b.atSalon ?? service.atSalon, atHome: b.atHome ?? service.atHome }
  if (!mustHaveAPlace(merged)) {
    throw new ApiError(400, 'VALIDATION_ERROR', placeMessage, { fieldErrors: { atSalon: placeMessage } })
  }
  const before = present(service)
  service.set(b)
  try {
    await service.save()
  } catch (error) {
    throw duplicateNameError(error)
  }
  await syncListing(req.salon._id)
  await recordAudit(req, { action: 'service.updated', entityType: 'service', entityId: service._id, changes: { before, after: b } })
  sendSuccess(req, res, { service: present(service) })
})

// Delete nahi, sirf band (active=false): purani bookings/bills me naam aur price bana rehta hai.
router.delete('/:id', can('services.write'), validate({ params: idParams }), async (req, res) => {
  const service = await findOwn(req)
  service.active = false
  await service.save()
  await syncListing(req.salon._id)
  await recordAudit(req, { action: 'service.deactivated', entityType: 'service', entityId: service._id, changes: { name: service.name } })
  sendSuccess(req, res, { service: present(service) })
})

module.exports = router
module.exports.syncListing = syncListing
