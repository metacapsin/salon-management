const express = require('express')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { z, email, newPassword, personName, objectId, pagination } = require('../../utils/schemas')
const { createSalonBody, createSalonWithOwner } = require('../salons/salons.routes')
const { validate } = require('../../middleware/common')
const { authenticate, requirePlatformAdmin } = require('../../middleware/auth')
const { Salon, Membership, User, AuditEvent } = require('../../models')
const { recordAudit } = require('../audit/audit.service')
const env = require('../../config/env')
const { MAX_BYTES, addSalonImage } = require('../../utils/uploads')
const svc = require('../auth/auth.service')
const { adminRouter: contactInquiryRoutes } = require('../contact/contact.routes')

// Super Admin ke APIs. Yahan requireSalon nahi lagta (admin ek salon ke andar nahi hota), isliye har route par
// authenticate + requirePlatformAdmin dono zaroori hain. Sirf platform-level jaankari milti hai:
// billing, customers, bookings jaisa salon ka private data yahan se kabhi nahi nikalta.
const router = express.Router()
router.use(authenticate, requirePlatformAdmin)

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function row(salon, memberCount) {
  return {
    id: salon._id,
    name: salon.name,
    slug: salon.slug,
    status: salon.status,
    city: salon.address?.city ?? '',
    state: salon.address?.state ?? '',
    ownerName: salon.ownerContact?.name ?? '',
    ownerEmail: salon.ownerContact?.email ?? '',
    publicBookingEnabled: salon.publicBookingEnabled,
    memberCount,
    createdAt: salon.createdAt,
  }
}

// Platform ka overview: sab asli DB se gine jaate hain (koi nakli ginti nahi).
router.get('/overview', async (req, res) => {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const [total, active, suspended, published, newLast30Days, recent] = await Promise.all([
    Salon.countDocuments({}),
    Salon.countDocuments({ status: 'active' }),
    Salon.countDocuments({ status: 'suspended' }),
    Salon.countDocuments({ publicBookingEnabled: true }),
    Salon.countDocuments({ createdAt: { $gte: since } }),
    Salon.find({}).sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
  ])
  sendSuccess(req, res, {
    stats: { total, active, suspended, published, newLast30Days },
    recentSalons: recent.map((s) => ({ id: s._id, name: s.name, city: s.address?.city ?? '', status: s.status, createdAt: s.createdAt })),
  })
})

// Sab registered salons ki list (search + status filter + pages).
router.get(
  '/salons',
  validate({
    query: pagination.extend({
      q: z.string().trim().max(100).optional(),
      status: z.enum(['active', 'suspended']).optional(),
    }),
  }),
  async (req, res) => {
    const { page, pageSize, q, status } = req.valid.query
    const filter = {}
    if (status) filter.status = status
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i')
      filter.$or = [{ name: rx }, { slug: rx }, { 'address.city': rx }, { 'ownerContact.email': rx }, { 'ownerContact.name': rx }]
    }
    const [salons, total] = await Promise.all([
      Salon.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      Salon.countDocuments(filter),
    ])
    const counts = await Membership.aggregate([
      { $match: { salonId: { $in: salons.map((s) => s._id) }, active: true } },
      { $group: { _id: '$salonId', n: { $sum: 1 } } },
    ])
    const byId = new Map(counts.map((c) => [String(c._id), c.n]))
    sendSuccess(req, res, { salons: salons.map((s) => row(s, byId.get(String(s._id)) ?? 0)) }, { meta: { page, pageSize, total } })
  },
)

// Admin naya owner account (naam, email, password) aur uska salon ek saath banata he. Account seedha approved + verified hota he.
router.post(
  '/salons',
  validate({ body: createSalonBody.extend({ ownerName: personName, ownerEmail: email, password: newPassword }) }),
  async (req, res) => {
    const { ownerEmail, password, ...body } = req.valid.body
    if (await User.exists({ normalizedEmail: ownerEmail })) {
      throw new ApiError(409, 'EMAIL_TAKEN', 'An account with this email already exists.', { fieldErrors: { ownerEmail: 'This email is already registered.' } })
    }
    if (await Salon.exists({ slug: body.slug })) {
      throw new ApiError(409, 'SLUG_TAKEN', 'This salon address is already taken.', { fieldErrors: { slug: 'This address is already taken.' } })
    }
    const now = new Date()
    const owner = await User.create({
      name: body.ownerName,
      email: ownerEmail,
      normalizedEmail: ownerEmail,
      passwordHash: await svc.hashPassword(password),
      approvalStatus: 'approved',
      approvedAt: now,
      verifiedAt: now,
    })
    let salon
    try {
      salon = await createSalonWithOwner(req, owner, body)
    } catch (error) {
      await User.deleteOne({ _id: owner._id }) // salon na bane to akela account na bache
      throw error
    }
    await recordAudit(req, { action: 'platform.owner_created', entityType: 'user', entityId: owner._id })
    // Email fail ho to bhi account ban chuka he; admin ko batate hain taaki wo owner ko khud bata sake.
    let emailSent = true
    try {
      await svc.sendApprovalEmail(owner, { adminCreated: true, salonName: salon.name })
    } catch (error) {
      emailSent = false
      console.error('Owner welcome email failed:', error.message)
    }
    sendSuccess(req, res, { salon: row(salon, 1), emailSent }, { status: 201 })
  },
)

async function loadSalon(id) {
  const salon = await Salon.findById(id)
  if (!salon) throw new ApiError(404, 'NOT_FOUND', 'Salon not found.')
  return salon
}

// Salon ki ek photo upload (body = seedhi image file, JSON nahi). Max 5; pehli photo cover banti he.
router.post(
  '/salons/:id/images',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: MAX_BYTES }),
  validate({ params: z.object({ id: objectId }) }),
  async (req, res) => {
    const salon = await loadSalon(req.valid.params.id)
    addSalonImage(salon, req.body)
    await salon.save()
    await recordAudit(req, { action: 'platform.salon_image_added', entityType: 'salon', entityId: salon._id })
    sendSuccess(req, res, { images: salon.images, coverUrl: salon.coverUrl }, { status: 201 })
  },
)

// Ek salon ki detail: business jaankari aur team ka role-wise ginti. Customers/billing nahi.
router.get('/salons/:id', validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const salon = await loadSalon(req.valid.params.id)
  const roles = await Membership.aggregate([
    { $match: { salonId: salon._id, active: true } },
    { $group: { _id: '$role', n: { $sum: 1 } } },
  ])
  const memberCount = roles.reduce((sum, r) => sum + r.n, 0)
  sendSuccess(req, res, {
    salon: {
      ...row(salon, memberCount),
      ownerPhone: salon.ownerContact?.phone ?? '',
      timezone: salon.timezone,
      address: {
        line1: salon.address?.line1 ?? '',
        area: salon.address?.area ?? '',
        city: salon.address?.city ?? '',
        state: salon.address?.state ?? '',
        pincode: salon.address?.pincode ?? '',
      },
      audience: salon.audience,
      about: salon.about,
      updatedAt: salon.updatedAt,
      teamByRole: Object.fromEntries(roles.map((r) => [r._id, r.n])),
    },
  })
})

// Salon ko suspend ya wapas active karna. Suspended salon me sirf padhna chalta he (requireSalon me pehle se).
router.patch(
  '/salons/:id/status',
  validate({ params: z.object({ id: objectId }), body: z.strictObject({ status: z.enum(['active', 'suspended']), reason: z.string().trim().max(300).optional() }) }),
  async (req, res) => {
    const salon = await loadSalon(req.valid.params.id)
    const { status, reason } = req.valid.body
    const before = salon.status
    if (before !== status) {
      salon.status = status
      salon.version += 1
      await salon.save()
      await recordAudit(req, {
        salonId: salon._id,
        action: status === 'suspended' ? 'platform.salon_suspended' : 'platform.salon_activated',
        entityType: 'salon',
        entityId: salon._id,
        changes: { before, after: status, ...(reason ? { reason } : {}) },
      })
    }
    sendSuccess(req, res, { salon: row(salon, await Membership.countDocuments({ salonId: salon._id, active: true })) })
  },
)

// Saare salons ki audit history ek jagah (sirf padhna). Salon ke andar ki alag history owner ko /audit-events se milti he.
router.get(
  '/audit-events',
  validate({ query: pagination.extend({ action: z.string().trim().max(60).optional(), salonId: objectId.optional() }) }),
  async (req, res) => {
    const { page, pageSize, action, salonId } = req.valid.query
    const filter = {}
    if (action) filter.action = action
    if (salonId) filter.salonId = salonId
    const [rows, total] = await Promise.all([
      AuditEvent.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      AuditEvent.countDocuments(filter),
    ])
    const [actors, salons] = await Promise.all([
      User.find({ _id: { $in: rows.map((r) => r.actorId).filter(Boolean) } }).select('name').lean(),
      Salon.find({ _id: { $in: rows.map((r) => r.salonId).filter(Boolean) } }).select('name').lean(),
    ])
    const actorName = new Map(actors.map((a) => [String(a._id), a.name]))
    const salonName = new Map(salons.map((s) => [String(s._id), s.name]))
    const events = rows.map((r) => ({
      id: r._id,
      action: r.action,
      entityType: r.entityType,
      salonId: r.salonId,
      salonName: salonName.get(String(r.salonId)) ?? null,
      actorName: actorName.get(String(r.actorId)) ?? null,
      changes: r.redactedChanges,
      createdAt: r.createdAt,
    }))
    sendSuccess(req, res, { events }, { meta: { page, pageSize, total } })
  },
)

// Platform ke saare users aur kis salon me kis role me hain (sirf padhna). Password/hash kabhi nahi bheje jaate.
router.get('/users', validate({ query: pagination.extend({ q: z.string().trim().max(100).optional() }) }), async (req, res) => {
  const { page, pageSize, q } = req.valid.query
  const filter = {}
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ name: rx }, { email: rx }]
  }
  const [users, total] = await Promise.all([
    User.find(filter).select('name email verifiedAt active platformRole createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    User.countDocuments(filter),
  ])
  const memberships = await Membership.find({ userId: { $in: users.map((u) => u._id) }, active: true }).select('userId salonId role').lean()
  const salons = await Salon.find({ _id: { $in: memberships.map((m) => m.salonId) } }).select('name').lean()
  const salonName = new Map(salons.map((s) => [String(s._id), s.name]))
  const byUser = new Map()
  for (const m of memberships) {
    const list = byUser.get(String(m.userId)) ?? []
    list.push({ salonId: m.salonId, salonName: salonName.get(String(m.salonId)) ?? '', role: m.role })
    byUser.set(String(m.userId), list)
  }
  sendSuccess(
    req,
    res,
    {
      users: users.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        verified: Boolean(u.verifiedAt),
        active: u.active,
        platformRole: u.platformRole ?? null,
        salons: byUser.get(String(u._id)) ?? [],
        createdAt: u.createdAt,
      })),
    },
    { meta: { page, pageSize, total } },
  )
})

// ---------- Owner account requests ----------
// Register karne wala owner 'pending' rehta he. Yahan approve karte hi wo verified ho jaata he aur use "approved, sign in" email jaati he.
const requestParams = z.object({ id: objectId })

router.get('/owner-requests', validate({ query: pagination.extend({ status: z.enum(['pending', 'approved', 'rejected']).default('pending') }) }), async (req, res) => {
  const { page, pageSize, status } = req.valid.query
  const filter = { approvalStatus: status, platformRole: null }
  const [users, total] = await Promise.all([
    User.find(filter).select('name email approvalStatus approvedAt verifiedAt createdAt').sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    User.countDocuments(filter),
  ])
  sendSuccess(
    req,
    res,
    { requests: users.map((u) => ({ id: u._id, name: u.name, email: u.email, status: u.approvalStatus, verified: Boolean(u.verifiedAt), requestedAt: u.createdAt, approvedAt: u.approvedAt })) },
    { meta: { page, pageSize, total } },
  )
})

async function loadRequest(id) {
  const user = await User.findOne({ _id: id, platformRole: null })
  if (!user) throw new ApiError(404, 'NOT_FOUND', 'Request not found.')
  return user
}

router.post('/owner-requests/:id/approve', validate({ params: requestParams }), async (req, res) => {
  const user = await loadRequest(req.valid.params.id)
  if (user.approvalStatus !== 'approved' || !user.verifiedAt) {
    // Admin ka approve hi verification maana jaata he: owner ko alag se email verify nahi karna padta.
    user.approvalStatus = 'approved'
    user.approvedAt = user.approvedAt ?? new Date()
    user.verifiedAt = user.verifiedAt ?? new Date()
    await user.save()
    await recordAudit(req, { action: 'platform.owner_approved', entityType: 'user', entityId: user._id })
  }
  // Dobara dabane par ("Resend email") wahi email dobara jaati he.
  await svc.sendApprovalEmail(user)
  sendSuccess(req, res, { request: { id: user._id, status: user.approvalStatus } })
})

router.post('/owner-requests/:id/reject', validate({ params: requestParams }), async (req, res) => {
  const user = await loadRequest(req.valid.params.id)
  if (user.verifiedAt) throw new ApiError(409, 'ALREADY_VERIFIED', 'This account is already verified and in use.')
  if (user.approvalStatus !== 'rejected') {
    user.approvalStatus = 'rejected'
    user.approvedAt = null
    await user.save()
    await recordAudit(req, { action: 'platform.owner_rejected', entityType: 'user', entityId: user._id })
  }
  sendSuccess(req, res, { request: { id: user._id, status: user.approvalStatus } })
})

// Website ke Contact Us form se aaye sawaal (Super Admin hi dekh sakta hai; upar router.use me guard laga hai)
router.use('/contact-inquiries', contactInquiryRoutes)

module.exports = router
