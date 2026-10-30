const crypto = require('crypto')
const express = require('express')
const env = require('../../config/env')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { sendMail } = require('../../utils/mailer')
const { hashToken, randomToken } = require('../../utils/crypto')
const { withTransaction } = require('../../utils/transaction')
const { z, email, newPassword, loginPassword, personName, token } = require('../../utils/schemas')
const { validate, limiter, requireAllowedOrigin } = require('../../middleware/common')
const { authenticate } = require('../../middleware/auth')
const { User, Session, Membership, Salon, VerificationToken } = require('../../models')
const { recordAudit } = require('../audit/audit.service')
const svc = require('./auth.service')

const router = express.Router()
const me = express.Router()

const authLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 100 })
const loginLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 30 })
router.use(authLimiter)

const INVALID_LINK = () => new ApiError(400, 'INVALID_TOKEN', 'This link is invalid or has expired.')
const INVALID_LOGIN = () => new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.')

// ---------- register (owner) ----------
// Email pehle se ho tab bhi wahi jawab (taaki koi andaza na laga sake ki kaun registered hai).
router.post(
  '/register',
  validate({ body: z.strictObject({ name: personName, email, password: newPassword }) }),
  async (req, res) => {
    const { name, email: addr, password } = req.valid.body
    const existing = await User.findOne({ normalizedEmail: addr })

    if (!existing) {
      // Email yahan nahi jaati: pehle Super Admin approve karega (platform.routes.js /owner-requests).
      const user = await User.create({
        name,
        email: addr,
        normalizedEmail: addr,
        passwordHash: await svc.hashPassword(password),
        approvalStatus: 'pending',
      })
      await recordAudit(req, { actorId: user._id, action: 'auth.register', entityType: 'user', entityId: user._id })
    } else if (!existing.verifiedAt && existing.active && existing.approvalStatus === 'approved') {
      const verifyToken = await svc.issueToken({ purpose: 'verify_email', userId: existing._id, ttlMs: env.EMAIL_VERIFY_TTL_MS })
      await svc.sendVerificationEmail(existing, verifyToken)
    } else {
      await sendMail({
        to: existing.email,
        subject: 'You already have a Galora account',
        text: `Someone tried to register with this email. If it was you, just sign in or reset your password at ${env.PUBLIC_APP_URL}/forgot-password.`,
      })
    }

    sendSuccess(req, res, { message: 'Request received. Our team will review it, and we will email you once it is approved.' }, { status: 201 })
  },
)

// ---------- verify email ----------
router.post('/verify-email', validate({ body: z.strictObject({ token }) }), async (req, res) => {
  const record = await svc.consumeToken('verify_email', req.valid.body.token)
  if (!record) throw INVALID_LINK()
  const user = await User.findByIdAndUpdate(record.userId, { verifiedAt: new Date() }, { returnDocument: 'after' })
  if (user) await recordAudit(req, { actorId: user._id, action: 'auth.email_verified', entityType: 'user', entityId: user._id })
  sendSuccess(req, res, { verified: true })
})

router.post('/resend-verification', validate({ body: z.strictObject({ email }) }), async (req, res) => {
  const user = await User.findOne({ normalizedEmail: req.valid.body.email })
  if (user && user.active && !user.verifiedAt && user.approvalStatus === 'approved') {
    const verifyToken = await svc.issueToken({ purpose: 'verify_email', userId: user._id, ttlMs: env.EMAIL_VERIFY_TTL_MS })
    await svc.sendVerificationEmail(user, verifyToken)
  }
  sendSuccess(req, res, { message: 'If the account needs verification, we have sent a new email.' })
})

// ---------- login ----------
router.post(
  '/login',
  loginLimiter,
  validate({ body: z.strictObject({ email, password: loginPassword }) }),
  async (req, res) => {
    const { email: addr, password } = req.valid.body
    const now = new Date()
    const user = await User.findOne({ normalizedEmail: addr })

    // Account lock (5 galtiyan / 15 min -> 15 min ka backoff). User na ho to bhi same timing/jawab.
    if (user && user.lockUntil && user.lockUntil > now) {
      throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed attempts. Please wait a few minutes and try again.')
    }

    const passwordOk = await svc.verifyPasswordAgainst(user, password)
    if (!user || !user.active || !passwordOk) {
      if (user) {
        const windowStart = new Date(now.getTime() - env.LOGIN_WINDOW_MS)
        const lockDate = new Date(now.getTime() + env.LOGIN_LOCK_MS)
        // Atomic update, taaki ek saath kai galat attempts me gintee na bigde.
        await User.updateOne({ _id: user._id }, [
          {
            $set: {
              failedLoginCount: { $cond: [{ $gt: ['$firstFailedAt', windowStart] }, { $add: [{ $ifNull: ['$failedLoginCount', 0] }, 1] }, 1] },
              firstFailedAt: { $cond: [{ $gt: ['$firstFailedAt', windowStart] }, '$firstFailedAt', now] },
            },
          },
          { $set: { lockUntil: { $cond: [{ $gte: ['$failedLoginCount', env.LOGIN_MAX_FAILURES] }, lockDate, '$lockUntil'] } } },
        ], { updatePipeline: true })
        await recordAudit(req, { actorId: user._id, action: 'auth.login_failed', entityType: 'user', entityId: user._id })
      }
      throw INVALID_LOGIN()
    }

    // Password sahi hone ke baad hi approval/verification ki baat batate hain (email ka wajood nahi khulta).
    svc.assertApproved(user)
    if (!user.verifiedAt) {
      throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email first. Check your inbox for the link.')
    }

    await User.updateOne({ _id: user._id }, { failedLoginCount: 0, firstFailedAt: null, lockUntil: null })

    const { accessToken, refreshToken, session } = await svc.createSession(user, { userAgent: req.get('user-agent') })
    svc.setRefreshCookie(res, refreshToken, session.expiresAt)
    await recordAudit(req, { actorId: user._id, action: 'auth.login', entityType: 'user', entityId: user._id })

    sendSuccess(req, res, { accessToken, user: svc.publicUser(user), memberships: await svc.listMemberships(user._id) })
  },
)

// ---------- refresh (rotating) ----------
router.post('/refresh', requireAllowedOrigin, async (req, res) => {
  const raw = req.cookies?.[svc.REFRESH_COOKIE]
  const fail = (code = 'TOKEN_INVALID') => {
    svc.clearRefreshCookie(res)
    return new ApiError(401, code, 'Your session has expired. Please sign in again.')
  }
  if (!raw) throw fail('TOKEN_REQUIRED')

  const row = await Session.findOne({ tokenHash: hashToken(raw) })
  if (!row) throw fail()

  // Purana (pehle se use ho chuka) token dobara aaya = chori ka shak -> poori family revoke (FR-AUTH-02).
  if (row.revokedAt) {
    await svc.revokeFamily(row.familyId)
    await recordAudit(req, { actorId: row.userId, action: 'auth.refresh_reuse_detected', entityType: 'session', entityId: row._id })
    throw fail()
  }
  if (row.expiresAt <= new Date()) throw fail()

  const user = await User.findById(row.userId)
  if (!user || !user.active) {
    await svc.revokeFamily(row.familyId)
    throw fail()
  }

  const claimed = await Session.updateOne({ _id: row._id, revokedAt: null }, { revokedAt: new Date() })
  if (claimed.modifiedCount !== 1) {
    await svc.revokeFamily(row.familyId)
    throw fail()
  }

  const next = await svc.createSession(user, { familyId: row.familyId, expiresAt: row.expiresAt, userAgent: req.get('user-agent') })
  svc.setRefreshCookie(res, next.refreshToken, next.session.expiresAt)
  sendSuccess(req, res, { accessToken: next.accessToken, user: svc.publicUser(user), memberships: await svc.listMemberships(user._id) })
})

// ---------- logout ----------
router.post('/logout', requireAllowedOrigin, async (req, res) => {
  const raw = req.cookies?.[svc.REFRESH_COOKIE]
  if (raw) {
    const row = await Session.findOne({ tokenHash: hashToken(raw) })
    if (row) {
      await svc.revokeFamily(row.familyId)
      await recordAudit(req, { actorId: row.userId, action: 'auth.logout', entityType: 'session', entityId: row._id })
    }
  }
  svc.clearRefreshCookie(res)
  sendSuccess(req, res, { loggedOut: true })
})

// ---------- password reset ----------
// Email par 6 digit OTP jaata he (10 minute, galat 5 baar likhne par band, naya OTP 30 second baad).
// DB me sirf OTP ka hash rehta he. Email ho ya na ho, jawab hamesha same.
const RESET_OTP_RESEND_MS = 30 * 1000
const RESET_OTP_MAX_ATTEMPTS = 5
const INVALID_OTP = () => new ApiError(400, 'INVALID_OTP', 'This code is wrong or has expired. Ask for a new one.', { fieldErrors: { otp: 'Wrong or expired code.' } })
const otpHash = (userId, code) => hashToken(`password_reset:${userId}:${code}`)

router.post('/password-reset', validate({ body: z.strictObject({ email }) }), async (req, res) => {
  const user = await User.findOne({ normalizedEmail: req.valid.body.email })
  if (user && user.active) {
    const latest = await VerificationToken.findOne({ purpose: 'password_reset', userId: user._id }).sort({ createdAt: -1 }).lean()
    const coolingDown = latest && Date.now() - new Date(latest.createdAt).getTime() < RESET_OTP_RESEND_MS
    if (!coolingDown) {
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
      await VerificationToken.updateMany({ purpose: 'password_reset', userId: user._id, usedAt: null }, { usedAt: new Date() })
      await VerificationToken.create({
        purpose: 'password_reset',
        tokenHash: hashToken(randomToken(32)),
        userId: user._id,
        payload: { codeHash: otpHash(user._id, code), attempts: 0 },
        expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MS),
      })
      const minutes = Math.round(env.PASSWORD_RESET_TTL_MS / 60000)
      await svc.sendPasswordResetEmail(user, code, minutes)
    }
  }
  sendSuccess(req, res, { message: 'If that email is registered, we have sent a 6 digit code to it.' })
})

router.post(
  '/password-reset/confirm',
  validate({ body: z.strictObject({ email, otp: z.string().regex(/^\d{6}$/, 'Enter the 6 digit code.'), password: newPassword }) }),
  async (req, res) => {
    const { email: addr, otp, password } = req.valid.body
    const user = await User.findOne({ normalizedEmail: addr })
    if (!user || !user.active) throw INVALID_OTP()

    const record = await VerificationToken.findOne({ purpose: 'password_reset', userId: user._id, usedAt: null, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 })
    if (!record || (record.payload?.attempts ?? 0) >= RESET_OTP_MAX_ATTEMPTS) throw INVALID_OTP()

    const given = Buffer.from(otpHash(user._id, otp))
    const stored = Buffer.from(String(record.payload?.codeHash ?? ''))
    const matches = given.length === stored.length && crypto.timingSafeEqual(given, stored)
    if (!matches) {
      await VerificationToken.updateOne({ _id: record._id }, { $inc: { 'payload.attempts': 1 } })
      throw INVALID_OTP()
    }
    // Single-use: ek hi baar chalega
    const claimed = await VerificationToken.updateOne({ _id: record._id, usedAt: null }, { usedAt: new Date() })
    if (claimed.modifiedCount !== 1) throw INVALID_OTP()

    user.passwordHash = await svc.hashPassword(password)
    user.failedLoginCount = 0
    user.firstFailedAt = null
    user.lockUntil = null
    await user.save()
    await svc.revokeAllForUser(user._id) // purane saare login band
    await recordAudit(req, { actorId: user._id, action: 'auth.password_reset', entityType: 'user', entityId: user._id })
    sendSuccess(req, res, { reset: true })
  },
)

// ---------- accept invitation ----------
router.post(
  '/accept-invitation',
  validate({ body: z.strictObject({ token, name: personName.optional(), password: loginPassword }) }),
  async (req, res) => {
    const { token: raw, name, password } = req.valid.body
    const invite = await svc.peekToken('invitation', raw)
    if (!invite) throw INVALID_LINK()

    const salon = await Salon.findById(invite.salonId)
    if (!salon || salon.status !== 'active') throw INVALID_LINK()

    const addr = invite.payload.email
    let user = await User.findOne({ normalizedEmail: addr })

    if (user) {
      // Pehle se account hai: apna password dekar saabit karo.
      if (!user.active || !(await svc.verifyPasswordAgainst(user, password))) throw INVALID_LOGIN()
    } else {
      if (!name) throw new ApiError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', { fieldErrors: { name: 'Enter your name.' } })
      const parsed = newPassword.safeParse(password)
      if (!parsed.success) {
        throw new ApiError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', { fieldErrors: { password: parsed.error.issues[0].message } })
      }
    }
    const passwordHash = user ? null : await svc.hashPassword(password)

    await withTransaction(async (session) => {
      // Token yahin consume hota hai; do jagah se ek saath aaye to ek hi jeetega.
      const consumed = await svc.consumeToken('invitation', raw, session)
      if (!consumed) throw INVALID_LINK()

      // `member` local rakha hai: transaction retry ho to pichla adhura user dobara istemal na ho.
      let member = user
      if (!member) {
        ;[member] = await User.create(
          [{ name, email: addr, normalizedEmail: addr, passwordHash, verifiedAt: new Date() }],
          { session },
        )
      }

      const existing = await Membership.findOne({ salonId: salon._id, userId: member._id }).session(session)
      if (existing?.active) throw new ApiError(409, 'CONFLICT', 'You are already a member of this salon.')
      if (existing) {
        existing.active = true
        existing.role = invite.payload.role
        existing.staffId = invite.payload.staffId || null
        await existing.save({ session })
      } else {
        await Membership.create(
          [{ salonId: salon._id, userId: member._id, role: invite.payload.role, staffId: invite.payload.staffId || null, createdBy: invite.createdBy }],
          { session },
        )
      }
      await recordAudit(
        req,
        { salonId: salon._id, actorId: member._id, action: 'invitation.accepted', entityType: 'user', entityId: member._id, changes: { role: invite.payload.role } },
        { session },
      )
    })

    sendSuccess(req, res, { accepted: true, salonName: salon.name }, { status: 201 })
  },
)

// ---------- /me ----------
me.get('/me', authenticate, async (req, res) => {
  sendSuccess(req, res, { user: svc.publicUser(req.user), memberships: await svc.listMemberships(req.user._id) })
})
me.get('/me/memberships', authenticate, async (req, res) => {
  sendSuccess(req, res, { memberships: await svc.listMemberships(req.user._id) })
})

// Login ke baad password badalna: purana password dena zaroori; ye wala login chalta rahta he, baaki sab jagah ke login band ho jate hain.
const changePasswordBody = z.strictObject({ currentPassword: loginPassword, newPassword })
me.post('/me/password', limiter({ windowMs: 15 * 60 * 1000, limit: 10 }), authenticate, validate({ body: changePasswordBody }), async (req, res) => {
  const { currentPassword, newPassword: next } = req.valid.body
  if (!(await svc.verifyPasswordAgainst(req.user, currentPassword))) {
    throw new ApiError(400, 'WRONG_PASSWORD', 'Your current password is not correct.', { fieldErrors: { currentPassword: 'Incorrect password.' } })
  }
  if (currentPassword === next) {
    throw new ApiError(400, 'SAME_PASSWORD', 'Choose a password different from your current one.', { fieldErrors: { newPassword: 'Must be different from your current password.' } })
  }
  req.user.passwordHash = await svc.hashPassword(next)
  await req.user.save()
  await Session.updateMany({ userId: req.user._id, familyId: { $ne: req.familyId }, revokedAt: null }, { revokedAt: new Date() })
  await recordAudit(req, { actorId: req.user._id, action: 'auth.password_changed', entityType: 'user', entityId: req.user._id })
  sendSuccess(req, res, { changed: true })
})

module.exports = { authRouter: router, meRouter: me }
