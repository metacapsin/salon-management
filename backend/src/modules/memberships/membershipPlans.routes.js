// Membership plans (Silver, Gold...): owner banata/edit/band karta hai.
const express = require('express')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { MembershipPlan, Service } = require('../../models')
const { recordAudit } = require('../audit/audit.service')
const { presentPlan } = require('./util')

const router = express.Router()
router.use(authenticate, requireSalon)

const fields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(80),
  description: z.string().trim().max(300),
  price: z.number({ error: 'Enter the price.' }).int('Use whole rupees.').min(0, 'Price cannot be negative.').max(10_000_000),
  durationDays: z.number({ error: 'Enter the duration in days.' }).int().min(1, 'Duration must be at least 1 day.').max(1095, 'Duration can be at most 3 years.'),
  discountType: z.enum(['percent', 'flat']),
  discountValue: z.number({ error: 'Enter the discount.' }).int('Use whole numbers.').min(1, 'Discount must be at least 1.').max(10_000_000),
  serviceIds: z.array(objectId).max(100),
  benefits: z.array(z.string().trim().min(1).max(100)).max(10),
  active: z.boolean(),
}

const createBody = z
  .strictObject({
    ...fields,
    description: fields.description.default(''),
    serviceIds: fields.serviceIds.default([]),
    benefits: fields.benefits.default([]),
  })
  .omit({ active: true })
const updateBody = z.strictObject(fields).partial().refine((b) => Object.keys(b).length > 0, 'Nothing to update.')
const idParams = z.object({ id: objectId })
const listQuery = z.object({ search: z.string().trim().max(50).optional(), status: z.enum(['active', 'inactive']).optional() })

const fieldError = (field, message) => new ApiError(400, 'VALIDATION_ERROR', message, { fieldErrors: { [field]: message } })
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function checkRules({ discountType, discountValue }) {
  if (discountType === 'percent' && discountValue > 100) throw fieldError('discountValue', 'Percentage cannot be more than 100.')
}

// Sirf isi salon ki active services
async function checkServices(req, serviceIds) {
  if (!serviceIds?.length) return
  const unique = [...new Set(serviceIds)]
  const found = await Service.countDocuments({ _id: { $in: unique }, salonId: req.salon._id, active: true })
  if (found !== unique.length) throw fieldError('serviceIds', 'One of the chosen services was not found or is switched off.')
}

router.get('/', can('memberships.read'), validate({ query: listQuery }), async (req, res) => {
  const { search, status } = req.valid.query
  const filter = { salonId: req.salon._id }
  if (status) filter.active = status === 'active'
  if (search) filter.name = new RegExp(escapeRegex(search), 'i')
  const plans = await MembershipPlan.find(filter).sort({ active: -1, price: 1 }).lean()
  sendSuccess(req, res, { plans: plans.map(presentPlan) })
})

router.post('/', can('memberships.write'), validate({ body: createBody }), async (req, res) => {
  const b = req.valid.body
  checkRules(b)
  await checkServices(req, b.serviceIds)
  let plan
  try {
    plan = await MembershipPlan.create({ ...b, salonId: req.salon._id, createdBy: req.user._id })
  } catch (e) {
    if (e?.code === 11000) throw fieldError('name', 'A plan with this name already exists.')
    throw e
  }
  await recordAudit(req, { action: 'membership_plan.created', entityType: 'membershipPlan', entityId: plan._id, changes: { name: plan.name, price: plan.price } })
  sendSuccess(req, res, { plan: presentPlan(plan) }, { status: 201 })
})

// Edit sirf aage ki bikri par: pehle bik chuke memberships apni shartein copy rakhte hain.
router.patch('/:id', can('memberships.write'), validate({ params: idParams, body: updateBody }), async (req, res) => {
  const plan = await MembershipPlan.findOne({ _id: req.valid.params.id, salonId: req.salon._id })
  if (!plan) throw new ApiError(404, 'NOT_FOUND', 'Plan not found.')
  const b = req.valid.body
  checkRules({ discountType: b.discountType ?? plan.discountType, discountValue: b.discountValue ?? plan.discountValue })
  await checkServices(req, b.serviceIds)
  const before = presentPlan(plan)
  plan.set(b)
  try {
    await plan.save()
  } catch (e) {
    if (e?.code === 11000) throw fieldError('name', 'A plan with this name already exists.')
    throw e
  }
  await recordAudit(req, { action: 'membership_plan.updated', entityType: 'membershipPlan', entityId: plan._id, changes: { before, after: b } })
  sendSuccess(req, res, { plan: presentPlan(plan) })
})

module.exports = router
