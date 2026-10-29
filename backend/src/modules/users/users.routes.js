const express = require('express')
const env = require('../../config/env')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { sendMail } = require('../../utils/mailer')
const { withTransaction } = require('../../utils/transaction')
const { z, email, objectId, pagination } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { User, Salon, Membership, VerificationToken } = require('../../models')
const { ROLES } = require('../../config/permissions')
const { recordAudit } = require('../audit/audit.service')
const { issueToken } = require('../auth/auth.service')

const router = express.Router()
router.use(authenticate, requireSalon)

const INVITABLE_ROLES = ['manager', 'receptionist', 'staff']

// Team list: Owner aur Manager dekh sakte hain.
router.get('/', can('users.read'), validate({ query: pagination }), async (req, res) => {
  const { page, pageSize } = req.valid.query
  const filter = { salonId: req.salon._id }
  const [rows, total] = await Promise.all([
    Membership.find(filter).sort({ createdAt: 1, _id: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    Membership.countDocuments(filter),
  ])
  const users = await User.find({ _id: { $in: rows.map((r) => r.userId) } }).select('name email verifiedAt').lean()
  const byId = new Map(users.map((u) => [String(u._id), u]))
  const members = rows.map((r) => {
    const u = byId.get(String(r.userId))
    return { userId: r.userId, name: u?.name, email: u?.email, role: r.role, active: r.active, staffId: r.staffId }
  })
  sendSuccess(req, res, { members }, { meta: { page, pageSize, total } })
})

router.get('/invitations', can('users.manage'), validate({ query: pagination }), async (req, res) => {
  const { page, pageSize } = req.valid.query
  const filter = { purpose: 'invitation', salonId: req.salon._id, usedAt: null, expiresAt: { $gt: new Date() } }
  const [rows, total] = await Promise.all([
    VerificationToken.find(filter).sort({ createdAt: -1, _id: 1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
    VerificationToken.countDocuments(filter),
  ])
  const invitations = rows.map((r) => ({ id: r._id, email: r.payload.email, role: r.payload.role, expiresAt: r.expiresAt }))
  sendSuccess(req, res, { invitations }, { meta: { page, pageSize, total } })
})

// Owner invitation bhejta hai (48 ghante, ek baar chalne wala link) (FR-AUTH-01/04).
router.post(
  '/invitations',
  can('users.manage'),
  validate({ body: z.strictObject({ email, role: z.enum(INVITABLE_ROLES) }) }),
  async (req, res) => {
    const { email: addr, role } = req.valid.body

    // Staff role ek staff profile se judna chahiye (FR-AUTH-04); staff profiles TASK-02 me banenge.
    if (role === 'staff') {
      throw new ApiError(400, 'VALIDATION_ERROR', 'A staff login must be linked to a staff profile. Staff profiles are added in the next module.', {
        fieldErrors: { role: 'Not available yet.' },
      })
    }

    const existingUser = await User.findOne({ normalizedEmail: addr })
    if (existingUser) {
      const member = await Membership.findOne({ salonId: req.salon._id, userId: existingUser._id, active: true })
      if (member) throw new ApiError(409, 'CONFLICT', 'This person is already on your team.', { fieldErrors: { email: 'Already a member.' } })
    }

    // Isi email ke purane pending invitations band, ek hi chalu rahe.
    await VerificationToken.updateMany(
      { purpose: 'invitation', salonId: req.salon._id, 'payload.email': addr, usedAt: null },
      { usedAt: new Date() },
    )
    const inviteToken = await issueToken({
      purpose: 'invitation',
      salonId: req.salon._id,
      payload: { email: addr, role },
      createdBy: req.user._id,
      ttlMs: env.INVITATION_TTL_MS,
    })
    await sendMail({
      to: addr,
      subject: `You are invited to ${req.salon.name} on Galora`,
      text: `${req.user.name} invited you to join ${req.salon.name} as ${role}.\nAccept here: ${env.PUBLIC_APP_URL}/accept-invitation?token=${inviteToken}\n\nThe link works once and expires in 48 hours.`,
    })
    await recordAudit(req, { action: 'invitation.created', entityType: 'invitation', changes: { email: addr, role } })
    sendSuccess(req, res, { invited: true, email: addr, role }, { status: 201 })
  },
)

router.delete('/invitations/:id', can('users.manage'), validate({ params: z.strictObject({ id: objectId }) }), async (req, res) => {
  const result = await VerificationToken.updateOne(
    { _id: req.valid.params.id, purpose: 'invitation', salonId: req.salon._id, usedAt: null },
    { usedAt: new Date() },
  )
  if (result.matchedCount === 0) throw new ApiError(404, 'NOT_FOUND', 'Invitation not found.')
  await recordAudit(req, { action: 'invitation.revoked', entityType: 'invitation', entityId: req.valid.params.id })
  sendSuccess(req, res, { revoked: true })
})

// Role badalna / deactivate-activate. Sirf Owner. Aakhri active owner ko hatana ya girana mana hai (FR-ACC-04).
router.patch(
  '/:id',
  can('users.manage'),
  validate({
    params: z.strictObject({ id: objectId }),
    body: z.strictObject({ role: z.enum(ROLES), active: z.boolean() }).partial().refine((b) => Object.keys(b).length > 0, 'Nothing to update.'),
  }),
  async (req, res) => {
    const { role, active } = req.valid.body
    const updated = await withTransaction(async (session) => {
      // Salon row ko chhoona = dusre ek saath chal rahe owner-badlav ke saath write-conflict, taaki do owner
      // ek-dusre ko ek saath girakar salon ko owner-less na kar dein.
      await Salon.updateOne({ _id: req.salon._id }, { $inc: { version: 1 } }, { session })

      const membership = await Membership.findOne({ salonId: req.salon._id, userId: req.valid.params.id }).session(session)
      if (!membership) throw new ApiError(404, 'NOT_FOUND', 'Team member not found.')

      const demoting = role !== undefined && role !== 'owner'
      const deactivating = active === false
      if (membership.role === 'owner' && membership.active && (demoting || deactivating)) {
        const otherOwners = await Membership.countDocuments({
          salonId: req.salon._id, role: 'owner', active: true, _id: { $ne: membership._id },
        }).session(session)
        if (otherOwners === 0) {
          throw new ApiError(409, 'LAST_OWNER', 'A salon must keep at least one active owner.')
        }
      }

      const before = { role: membership.role, active: membership.active }
      if (role !== undefined) membership.role = role
      if (active !== undefined) membership.active = active
      await membership.save({ session })
      // Owner list salon par bhi sync rakho.
      const owners = await Membership.find({ salonId: req.salon._id, role: 'owner', active: true }).select('userId').session(session)
      await Salon.updateOne({ _id: req.salon._id }, { ownerIds: owners.map((o) => o.userId) }, { session })
      await recordAudit(
        req,
        { action: 'membership.updated', entityType: 'membership', entityId: membership._id, changes: { before, after: { role: membership.role, active: membership.active } } },
        { session },
      )
      return membership
    })
    sendSuccess(req, res, { member: { userId: updated.userId, role: updated.role, active: updated.active } })
  },
)

module.exports = router
