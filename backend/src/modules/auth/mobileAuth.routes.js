const express = require('express')
const env = require('../../config/env')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { hashToken } = require('../../utils/crypto')
const { z, email, loginPassword } = require('../../utils/schemas')
const { validate, limiter } = require('../../middleware/common')
const { User, Session } = require('../../models')
const { recordAudit } = require('../audit/audit.service')
const svc = require('./auth.service')

// Mobile app ke liye alag auth endpoints (/api/v1/auth/mobile/*). Website ke cookie wale /auth/login, /refresh, /logout
// bilkul alag hain aur unme kuch nahi badla. Yahan refresh token JSON me aata/jaata hai (mobile me cookie nahi hoti).
const router = express.Router()

const authLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 100 })
const loginLimiter = limiter({ windowMs: 15 * 60 * 1000, limit: 30 })

const INVALID_LOGIN = () => new ApiError(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.')
const sessionLost = (code = 'TOKEN_INVALID') => new ApiError(401, code, 'Your session has expired. Please sign in again.')

// Browser ye token kabhi na pa sake: browser hamesha Origin header bhejta hai, native app nahi bhejta.
// Isliye Origin wali koi bhi request (hamare apne website ki bhi) yahan se wapas. Cookie yahan kabhi padhi nahi jaati.
function rejectBrowsers(req, res, next) {
  if (req.get('origin')) return next(new ApiError(403, 'PERMISSION_DENIED', 'Request origin is not allowed.'))
  next()
}

router.use(rejectBrowsers, authLimiter)

const refreshBody = z.strictObject({ refreshToken: z.string().min(20).max(200) })

// ---------- login ----------
router.post('/login', loginLimiter, validate({ body: z.strictObject({ email, password: loginPassword }) }), async (req, res) => {
  const { email: addr, password } = req.valid.body
  const now = new Date()
  const user = await User.findOne({ normalizedEmail: addr })

  // Website jaisa hi lockout: 5 galtiyan / 15 min -> 15 min ka backoff.
  if (user && user.lockUntil && user.lockUntil > now) {
    throw new ApiError(429, 'TOO_MANY_ATTEMPTS', 'Too many failed attempts. Please wait a few minutes and try again.')
  }

  const passwordOk = await svc.verifyPasswordAgainst(user, password)
  if (!user || !user.active || !passwordOk) {
    if (user) {
      const windowStart = new Date(now.getTime() - env.LOGIN_WINDOW_MS)
      const lockDate = new Date(now.getTime() + env.LOGIN_LOCK_MS)
      await User.updateOne({ _id: user._id }, [
        {
          $set: {
            failedLoginCount: { $cond: [{ $gt: ['$firstFailedAt', windowStart] }, { $add: [{ $ifNull: ['$failedLoginCount', 0] }, 1] }, 1] },
            firstFailedAt: { $cond: [{ $gt: ['$firstFailedAt', windowStart] }, '$firstFailedAt', now] },
          },
        },
        { $set: { lockUntil: { $cond: [{ $gte: ['$failedLoginCount', env.LOGIN_MAX_FAILURES] }, lockDate, '$lockUntil'] } } },
      ], { updatePipeline: true })
      await recordAudit(req, { actorId: user._id, action: 'auth.mobile_login_failed', entityType: 'user', entityId: user._id })
    }
    throw INVALID_LOGIN()
  }

  svc.assertApproved(user)
  if (!user.verifiedAt) {
    throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email first. Check your inbox for the link.')
  }

  await User.updateOne({ _id: user._id }, { failedLoginCount: 0, firstFailedAt: null, lockUntil: null })

  const { accessToken, refreshToken } = await svc.createSession(user, { userAgent: req.get('user-agent') })
  await recordAudit(req, { actorId: user._id, action: 'auth.mobile_login', entityType: 'user', entityId: user._id })

  sendSuccess(req, res, { accessToken, refreshToken, user: svc.publicUser(user), memberships: await svc.listMemberships(user._id) })
})

// ---------- refresh (rotating) ----------
router.post('/refresh', validate({ body: refreshBody }), async (req, res) => {
  const row = await Session.findOne({ tokenHash: hashToken(req.valid.body.refreshToken) })
  if (!row) throw sessionLost()

  // Purana (pehle se use ho chuka) token dobara aaya = chori ka shak -> poori family revoke.
  if (row.revokedAt) {
    await svc.revokeFamily(row.familyId)
    await recordAudit(req, { actorId: row.userId, action: 'auth.refresh_reuse_detected', entityType: 'session', entityId: row._id })
    throw sessionLost()
  }
  if (row.expiresAt <= new Date()) throw sessionLost()

  const user = await User.findById(row.userId)
  if (!user || !user.active) {
    await svc.revokeFamily(row.familyId)
    throw sessionLost()
  }

  // Do jagah se ek saath aaye to sirf ek jeetega.
  const claimed = await Session.updateOne({ _id: row._id, revokedAt: null }, { revokedAt: new Date() })
  if (claimed.modifiedCount !== 1) {
    await svc.revokeFamily(row.familyId)
    throw sessionLost()
  }

  const next = await svc.createSession(user, { familyId: row.familyId, expiresAt: row.expiresAt, userAgent: req.get('user-agent') })
  sendSuccess(req, res, {
    accessToken: next.accessToken,
    refreshToken: next.refreshToken,
    user: svc.publicUser(user),
    memberships: await svc.listMemberships(user._id),
  })
})

// ---------- logout ----------
// Token galat ya purana ho tab bhi 200: app ko local login hata dena chahiye, aur kuch batana nahi.
router.post('/logout', validate({ body: refreshBody }), async (req, res) => {
  const row = await Session.findOne({ tokenHash: hashToken(req.valid.body.refreshToken) })
  if (row) {
    await svc.revokeFamily(row.familyId)
    await recordAudit(req, { actorId: row.userId, action: 'auth.mobile_logout', entityType: 'session', entityId: row._id })
  }
  sendSuccess(req, res, { loggedOut: true })
})

module.exports = router
