const express = require('express')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { withTransaction } = require('../../utils/transaction')
const { z, personName } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { Salon, Branch, Membership, Service } = require('../../models')
const { roleCan } = require('../../config/permissions')
const { recordAudit } = require('../audit/audit.service')
const { MAX_BYTES, addSalonImage, removeSalonImage, makeCoverImage } = require('../../utils/uploads')

const router = express.Router()

// ---------- rules ----------
const RESERVED_SLUGS = new Set([
  'api', 'admin', 'app', 'login', 'register', 'logout', 'public', 'settings', 'www', 'static', 'assets',
  'health', 'ready', 'salons', 'book', 'dashboard', 'verify-email', 'forgot-password', 'reset-password',
  'accept-invitation', 'onboarding', 'me',
])
// 3-50 chhote letters, digits ya hyphen (SRS FR-ORG-01)
const slug = z
  .string()
  .regex(/^[a-z0-9-]{3,50}$/, 'Use 3 to 50 lowercase letters, digits or hyphens.')
  .refine((v) => !RESERVED_SLUGS.has(v), 'This address is reserved. Please choose another.')

const timezone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat('en-IN', { timeZone: tz })
    return true
  } catch {
    return false
  }
}, 'Choose a valid timezone.')

const phone = z.string().trim().regex(/^\+?[0-9 -]{7,20}$/, 'Enter a valid phone number.')
const address = z.strictObject({
  line1: z.string().trim().max(200).default(''),
  city: z.string().trim().max(100).default(''),
  area: z.string().trim().max(100).default(''),
  state: z.string().trim().max(100).default(''),
  pincode: z.string().trim().max(10).default(''),
})

const FACILITIES = ['ac', 'parking', 'wifi', 'wheelchair', 'card-payment', 'waiting-area', 'tea-coffee', 'bridal-room']
const profileFields = {
  ownerName: personName,
  about: z.string().trim().max(500, 'At most 500 characters.'),
  audience: z.enum(['women', 'men', 'unisex']),
  facilities: z.array(z.enum(FACILITIES)).max(FACILITIES.length).refine((l) => new Set(l).size === l.length, 'Each facility can appear once.'),
  location: z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).nullable(),
}

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm, like 09:30.')
const toMinutes = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))
const interval = z
  .strictObject({ start: hhmm, end: hhmm })
  .refine((i) => toMinutes(i.start) % 5 === 0 && toMinutes(i.end) % 5 === 0, 'Times must be in 5 minute steps.')
  .refine((i) => toMinutes(i.start) < toMinutes(i.end), 'Closing time must be after opening time.')

const dayIntervals = z.array(interval).max(6).superRefine((list, ctx) => {
  const sorted = [...list].sort((a, b) => toMinutes(a.start) - toMinutes(b.start))
  for (let i = 1; i < sorted.length; i++) {
    if (toMinutes(sorted[i].start) < toMinutes(sorted[i - 1].end)) {
      ctx.addIssue({ code: 'custom', message: 'Opening intervals on a day cannot overlap.' })
      return
    }
  }
})

const createSalonBody = z.strictObject({
  name: personName.min(2, 'Salon name must be at least 2 characters.'),
  slug,
  timezone: timezone.default('Asia/Kolkata'),
  phone: phone.optional(),
  address: address.optional(),
  ownerName: profileFields.ownerName.optional(),
  about: profileFields.about.optional(),
  audience: profileFields.audience.optional(),
  facilities: profileFields.facilities.optional(),
  location: profileFields.location.optional(),
})

const updateSalonBody = z
  .strictObject({
    name: personName.min(2),
    slug,
    timezone,
    phone: phone.or(z.literal('')),
    address,
    publicBookingEnabled: z.boolean(),
    ...profileFields,
    settings: z.strictObject({ receptionDiscountLimitPercent: z.number().min(0).max(100) }).partial(),
  })
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update.')

const hoursBody = z.strictObject({
  weeklyHours: z.strictObject(Object.fromEntries(DAYS.map((d) => [d, dayIntervals.default([])]))).partial(),
  holidays: z
    .array(
      z.strictObject({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').refine((d) => !Number.isNaN(Date.parse(d)), 'Invalid date.'),
        name: z.string().trim().max(100).default(''),
      }),
    )
    .max(200)
    .refine((list) => new Set(list.map((h) => h.date)).size === list.length, 'Each holiday date can appear only once.'),
})

// ---------- helpers ----------
function summary(salon) {
  return { id: salon._id, name: salon.name, slug: salon.slug, status: salon.status, timezone: salon.timezone, currency: salon.currency }
}

async function fullSalon(salon) {
  const branch = await Branch.findOne({ salonId: salon._id }).lean()
  const weeklyHours = {}
  for (const d of DAYS) weeklyHours[d] = branch?.weeklyHours?.[d] ?? []
  return {
    ...summary(salon),
    ownerContact: salon.ownerContact,
    about: salon.about,
    audience: salon.audience,
    facilities: salon.facilities,
    address: salon.address,
    logoUrl: salon.logoUrl,
    coverUrl: salon.coverUrl,
    images: salon.images ?? [],
    publicBookingEnabled: salon.publicBookingEnabled,
    settings: salon.settings,
    version: salon.version,
    weeklyHours,
    holidays: branch?.holidays ?? [],
  }
}

// Publish karne se pehle kya-kya zaroori hai (SRS section 4.1, AT-01).
// TODO(TASK-02): staff module ban jaane par "qualified staff with a valid shift" ka check bhi judega.
async function publishReadiness(salon) {
  const blockers = []
  const branch = await Branch.findOne({ salonId: salon._id }).lean()
  const hasHours = DAYS.some((d) => (branch?.weeklyHours?.[d] ?? []).length > 0)
  if (!hasHours) blockers.push('Set the salon opening hours.')
  if (!(await Service.exists({ salonId: salon._id, active: true }))) blockers.push('Add at least one active service.')
  return blockers
}

// ---------- routes ----------
// Naya salon: salon + branch + owner membership + defaults ek saath, ya kuch nahi (FR-ORG-02).
// `owner` salon ka owner banta he; `req.user` (jo kar raha he) createdBy me jaata he. Platform admin bhi isi ko use karta he.
async function createSalonWithOwner(req, owner, b) {
  try {
    return await withTransaction(async (session) => {
      const [created] = await Salon.create(
        [
          {
            name: b.name,
            slug: b.slug,
            timezone: b.timezone,
            ownerContact: { name: b.ownerName ?? owner.name, email: owner.email, phone: b.phone ?? '' },
            address: { ...(b.address ?? {}), ...(b.location ? { location: b.location } : {}) },
            ...(b.about !== undefined ? { about: b.about } : {}),
            ...(b.audience ? { audience: b.audience } : {}),
            ...(b.facilities ? { facilities: b.facilities } : {}),
            ownerIds: [owner._id],
            createdBy: req.user._id,
          },
        ],
        { session },
      )
      await Branch.create([{ salonId: created._id }], { session })
      await Membership.create([{ salonId: created._id, userId: owner._id, role: 'owner', createdBy: req.user._id }], { session })
      await recordAudit(
        req,
        { salonId: created._id, action: 'salon.created', entityType: 'salon', entityId: created._id, changes: { name: b.name, slug: b.slug } },
        { session },
      )
      return created
    })
  } catch (error) {
    if (error?.code === 11000 && /slug/.test(JSON.stringify(error.keyPattern ?? error.message))) {
      throw new ApiError(409, 'SLUG_TAKEN', 'This salon address is already taken.', { fieldErrors: { slug: 'This address is already taken.' } })
    }
    throw error
  }
}

router.post('/', authenticate, validate({ body: createSalonBody }), async (req, res) => {
  if (!req.user.verifiedAt) throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before creating a salon.')
  const salon = await createSalonWithOwner(req, req.user, req.valid.body)
  sendSuccess(req, res, { salon: summary(salon), role: 'owner' }, { status: 201 })
})

// Sab roles ko salon ka basic summary; settings ki poori detail sirf Owner/Manager ko (matrix: settings = O Yes, M Read).
router.get('/current', authenticate, requireSalon, async (req, res) => {
  if (!roleCan(req.role, 'settings.read')) return sendSuccess(req, res, { salon: summary(req.salon), role: req.role })
  sendSuccess(req, res, { salon: await fullSalon(req.salon), role: req.role, publishBlockers: await publishReadiness(req.salon) })
})

// Salon ki photos (owner): body = seedhi image file. Max 5, pehli photo cover.
const photoUrlBody = z.strictObject({ url: z.string().min(1).max(300) })
router.post('/current/images', authenticate, requireSalon, can('settings.write'), express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_BYTES }), async (req, res) => {
  addSalonImage(req.salon, req.body)
  await req.salon.save()
  await recordAudit(req, { action: 'salon.image_added', entityType: 'salon', entityId: req.salon._id })
  sendSuccess(req, res, { images: req.salon.images, coverUrl: req.salon.coverUrl }, { status: 201 })
})
router.delete('/current/images', authenticate, requireSalon, can('settings.write'), validate({ body: photoUrlBody }), async (req, res) => {
  removeSalonImage(req.salon, req.valid.body.url)
  await req.salon.save()
  await recordAudit(req, { action: 'salon.image_removed', entityType: 'salon', entityId: req.salon._id })
  sendSuccess(req, res, { images: req.salon.images, coverUrl: req.salon.coverUrl })
})
router.patch('/current/images/cover', authenticate, requireSalon, can('settings.write'), validate({ body: photoUrlBody }), async (req, res) => {
  makeCoverImage(req.salon, req.valid.body.url)
  await req.salon.save()
  await recordAudit(req, { action: 'salon.cover_changed', entityType: 'salon', entityId: req.salon._id })
  sendSuccess(req, res, { images: req.salon.images, coverUrl: req.salon.coverUrl })
})

router.patch('/current', authenticate, requireSalon, can('settings.write'), validate({ body: updateSalonBody }), async (req, res) => {
  const b = req.valid.body
  const salon = req.salon
  const before = { name: salon.name, slug: salon.slug, timezone: salon.timezone, publicBookingEnabled: salon.publicBookingEnabled }

  if (b.publicBookingEnabled === true && !salon.publicBookingEnabled) {
    const blockers = await publishReadiness(salon)
    if (blockers.length > 0) {
      throw new ApiError(409, 'PUBLISH_BLOCKED', 'Finish the setup checklist before publishing your booking page.', { details: { blockers } })
    }
  }

  if (b.name !== undefined) salon.name = b.name
  if (b.slug !== undefined) salon.slug = b.slug
  if (b.timezone !== undefined) salon.timezone = b.timezone
  if (b.phone !== undefined) salon.ownerContact.phone = b.phone
  // Field-by-field: purana lat/lng wagairah na mite
  if (b.address !== undefined) Object.assign(salon.address, b.address)
  if (b.ownerName !== undefined) salon.ownerContact.name = b.ownerName
  if (b.about !== undefined) salon.about = b.about
  if (b.audience !== undefined) salon.audience = b.audience
  if (b.facilities !== undefined) salon.facilities = b.facilities
  if (b.location !== undefined) salon.address.location = b.location ?? { lat: null, lng: null }
  if (b.publicBookingEnabled !== undefined) salon.publicBookingEnabled = b.publicBookingEnabled
  if (b.settings?.receptionDiscountLimitPercent !== undefined) salon.settings.receptionDiscountLimitPercent = b.settings.receptionDiscountLimitPercent
  salon.version += 1

  try {
    await salon.save()
  } catch (error) {
    if (error?.code === 11000) {
      throw new ApiError(409, 'SLUG_TAKEN', 'This salon address is already taken.', { fieldErrors: { slug: 'This address is already taken.' } })
    }
    throw error
  }
  await recordAudit(req, { action: 'salon.updated', entityType: 'salon', entityId: salon._id, changes: { before, after: b } })
  sendSuccess(req, res, { salon: await fullSalon(salon) })
})

router.put('/current/hours', authenticate, requireSalon, can('settings.write'), validate({ body: hoursBody }), async (req, res) => {
  const { weeklyHours, holidays } = req.valid.body
  const branch = await Branch.findOne({ salonId: req.salon._id })
  const map = {}
  for (const d of DAYS) map[d] = weeklyHours[d] ?? []
  branch.weeklyHours = map
  branch.holidays = holidays
  await branch.save()
  await recordAudit(req, { action: 'salon.hours_updated', entityType: 'branch', entityId: branch._id, changes: { holidays: holidays.length } })
  sendSuccess(req, res, { salon: await fullSalon(req.salon) })
})

module.exports = router
module.exports.createSalonBody = createSalonBody
module.exports.createSalonWithOwner = createSalonWithOwner
