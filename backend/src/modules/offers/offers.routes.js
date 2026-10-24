const express = require('express')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { Offer, Service } = require('../../models')
const { recordAudit } = require('../audit/audit.service')

const router = express.Router()
router.use(authenticate, requireSalon)

// ---------- rules ----------
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-01.')

const offerFields = {
  title: z.string().trim().min(2, 'Title must be at least 2 characters.').max(80),
  description: z.string().trim().max(300),
  discountType: z.enum(['percent', 'flat']),
  discountValue: z.number({ error: 'Enter the discount.' }).int('Use whole numbers.').min(1, 'Discount must be at least 1.').max(1_000_000),
  serviceIds: z.array(objectId).max(100),
  startsOn: day,
  endsOn: day,
  oncePerCustomer: z.boolean(),
  active: z.boolean(),
}

// percent 100 se zyada nahi, aur end date start se pehle nahi
function checkRules(o) {
  if (o.discountType === 'percent' && o.discountValue > 100) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Percentage cannot be more than 100.', { fieldErrors: { discountValue: 'Percentage cannot be more than 100.' } })
  }
  if (o.endsOn < o.startsOn) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'End date cannot be before the start date.', { fieldErrors: { endsOn: 'End date cannot be before the start date.' } })
  }
}

const createBody = z
  .strictObject({
    ...offerFields,
    description: offerFields.description.default(''),
    serviceIds: offerFields.serviceIds.default([]),
    oncePerCustomer: offerFields.oncePerCustomer.default(false),
  })
  .omit({ active: true })

const updateBody = z
  .strictObject(offerFields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update.')

const idParams = z.object({ id: objectId })

// ---------- helpers ----------
function present(o) {
  return {
    id: o._id,
    title: o.title,
    description: o.description,
    discountType: o.discountType,
    discountValue: o.discountValue,
    serviceIds: o.serviceIds,
    startsOn: o.startsOn,
    endsOn: o.endsOn,
    oncePerCustomer: o.oncePerCustomer,
    active: o.active,
  }
}

// Sirf isi salon ki services chalengi
async function checkServices(req, serviceIds) {
  if (!serviceIds?.length) return
  const unique = [...new Set(serviceIds.map(String))]
  const found = await Service.countDocuments({ _id: { $in: unique }, salonId: req.salon._id })
  if (found !== unique.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'One of the chosen services was not found.', { fieldErrors: { serviceIds: 'One of the chosen services was not found.' } })
  }
}

async function findOwn(req) {
  const offer = await Offer.findOne({ _id: req.valid.params.id, salonId: req.salon._id })
  if (!offer) throw new ApiError(404, 'NOT_FOUND', 'Offer not found.')
  return offer
}

// ---------- routes ----------
router.get('/', can('offers.read'), async (req, res) => {
  const offers = await Offer.find({ salonId: req.salon._id }).sort({ active: -1, endsOn: -1 }).lean()
  sendSuccess(req, res, { offers: offers.map(present) })
})

router.post('/', can('offers.write'), validate({ body: createBody }), async (req, res) => {
  checkRules(req.valid.body)
  await checkServices(req, req.valid.body.serviceIds)
  const offer = await Offer.create({ ...req.valid.body, salonId: req.salon._id, createdBy: req.user._id })
  await recordAudit(req, { action: 'offer.created', entityType: 'offer', entityId: offer._id, changes: { title: offer.title } })
  sendSuccess(req, res, { offer: present(offer) }, { status: 201 })
})

router.patch('/:id', can('offers.write'), validate({ params: idParams, body: updateBody }), async (req, res) => {
  const offer = await findOwn(req)
  const b = req.valid.body
  checkRules({
    discountType: b.discountType ?? offer.discountType,
    discountValue: b.discountValue ?? offer.discountValue,
    startsOn: b.startsOn ?? offer.startsOn,
    endsOn: b.endsOn ?? offer.endsOn,
  })
  await checkServices(req, b.serviceIds)
  const before = present(offer)
  offer.set(b)
  await offer.save()
  await recordAudit(req, { action: 'offer.updated', entityType: 'offer', entityId: offer._id, changes: { before, after: b } })
  sendSuccess(req, res, { offer: present(offer) })
})

module.exports = router
