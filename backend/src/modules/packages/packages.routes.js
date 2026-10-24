// Package templates: salon ke bundle banana, dekhna, edit karna, band karna.
const express = require('express')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { Package, Service } = require('../../models')
const { recordAudit } = require('../audit/audit.service')
const { presentPackage, todayIn } = require('./util')

const router = express.Router()
router.use(authenticate, requireSalon)

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-01.')
const money = z.number({ error: 'Enter an amount.' }).int('Use whole rupees.').min(0, 'Amount cannot be negative.').max(10_000_000)

// Frontend se sirf serviceId + sessions aate hain. Service ka price server khud dekhta hai.
const itemInput = z.strictObject({
  serviceId: objectId,
  sessions: z.number({ error: 'Enter sessions.' }).int('Use whole numbers.').min(1, 'At least 1 session.').max(100),
})

const fields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(100),
  description: z.string().trim().max(500),
  items: z.array(itemInput).min(1, 'Add at least one service.').max(20),
  packagePrice: money,
  validityDays: z.number({ error: 'Enter validity in days.' }).int().min(1, 'Validity must be at least 1 day.').max(1095, 'Validity can be at most 3 years.'),
  saleStartsOn: day.nullable(),
  saleEndsOn: day.nullable(),
  active: z.boolean(),
}

const createBody = z
  .strictObject({
    ...fields,
    description: fields.description.default(''),
    saleStartsOn: fields.saleStartsOn.default(null),
    saleEndsOn: fields.saleEndsOn.default(null),
  })
  .omit({ active: true })

const updateBody = z
  .strictObject(fields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update.')
const idParams = z.object({ id: objectId })
const listQuery = z.object({
  search: z.string().trim().max(50).optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

const fieldError = (field, message) => new ApiError(400, 'VALIDATION_ERROR', message, { fieldErrors: { [field]: message } })

// Services isi salon ki aur active honi chahiye; ek service do baar nahi. Naam/price server se.
async function resolveItems(req, items) {
  const ids = items.map((i) => i.serviceId)
  if (new Set(ids).size !== ids.length) throw fieldError('items', 'Each service can be added only once.')
  const services = await Service.find({ _id: { $in: ids }, salonId: req.salon._id, active: true }).lean()
  if (services.length !== ids.length) throw fieldError('items', 'One of the chosen services was not found or is switched off.')
  const byId = new Map(services.map((s) => [String(s._id), s]))
  return items.map((i) => {
    const s = byId.get(i.serviceId)
    return { serviceId: s._id, serviceName: s.name, unitPrice: s.price, sessions: i.sessions }
  })
}

function checkRules({ items, packagePrice, saleStartsOn, saleEndsOn }) {
  const originalPrice = items.reduce((sum, i) => sum + i.unitPrice * i.sessions, 0)
  if (packagePrice > originalPrice) throw fieldError('packagePrice', `Package price cannot be more than the total of its services (Rs ${originalPrice}).`)
  if (saleStartsOn && saleEndsOn && saleEndsOn < saleStartsOn) throw fieldError('saleEndsOn', 'End date cannot be before the start date.')
  return originalPrice
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

router.get('/', can('packages.read'), validate({ query: listQuery }), async (req, res) => {
  const { search, status } = req.valid.query
  const filter = { salonId: req.salon._id }
  if (status) filter.active = status === 'active'
  if (search) filter.name = new RegExp(escapeRegex(search), 'i')
  const packages = await Package.find(filter).sort({ active: -1, name: 1 }).lean()
  sendSuccess(req, res, { packages: packages.map(presentPackage), today: todayIn(req.salon.timezone) })
})

router.post('/', can('packages.write'), validate({ body: createBody }), async (req, res) => {
  const b = req.valid.body
  const items = await resolveItems(req, b.items)
  const originalPrice = checkRules({ ...b, items })
  let pkg
  try {
    pkg = await Package.create({ ...b, items, originalPrice, salonId: req.salon._id, createdBy: req.user._id })
  } catch (e) {
    if (e?.code === 11000) throw fieldError('name', 'A package with this name already exists.')
    throw e
  }
  await recordAudit(req, { action: 'package.created', entityType: 'package', entityId: pkg._id, changes: { name: pkg.name, packagePrice: pkg.packagePrice, originalPrice } })
  sendSuccess(req, res, { package: presentPackage(pkg) }, { status: 201 })
})

// Edit sirf aage ki bikri par asar karta hai: pehle bik chuke packages apni copy rakhte hain.
router.patch('/:id', can('packages.write'), validate({ params: idParams, body: updateBody }), async (req, res) => {
  const pkg = await Package.findOne({ _id: req.valid.params.id, salonId: req.salon._id })
  if (!pkg) throw new ApiError(404, 'NOT_FOUND', 'Package not found.')
  const b = req.valid.body
  const items = b.items ? await resolveItems(req, b.items) : pkg.items.toObject()
  const originalPrice = checkRules({
    items,
    packagePrice: b.packagePrice ?? pkg.packagePrice,
    saleStartsOn: b.saleStartsOn !== undefined ? b.saleStartsOn : pkg.saleStartsOn,
    saleEndsOn: b.saleEndsOn !== undefined ? b.saleEndsOn : pkg.saleEndsOn,
  })
  const before = presentPackage(pkg)
  pkg.set({ ...b, items, originalPrice })
  try {
    await pkg.save()
  } catch (e) {
    if (e?.code === 11000) throw fieldError('name', 'A package with this name already exists.')
    throw e
  }
  await recordAudit(req, { action: 'package.updated', entityType: 'package', entityId: pkg._id, changes: { before, after: b } })
  sendSuccess(req, res, { package: presentPackage(pkg) })
})

module.exports = router
