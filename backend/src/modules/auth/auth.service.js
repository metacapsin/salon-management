const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const crypto = require('crypto')
const env = require('../../config/env')
const ApiError = require('../../utils/apiError')
const { User, Session, Membership, Salon, VerificationToken } = require('../../models')
const { randomToken, hashToken } = require('../../utils/crypto')
const { sendMail } = require('../../utils/mailer')

const BCRYPT_COST = 12
// User na milne par bhi bcrypt chalate hain, taaki jawab ka time dekhkar koi email ka andaza na laga sake.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_COST)

const REFRESH_COOKIE = 'galora_rt'
const COOKIE_PATH = '/api/v1/auth'

function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_COST)
}

function verifyPasswordAgainst(user, password) {
  return bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH)
}

function signAccessToken(user, familyId) {
  return jwt.sign({ sub: String(user._id), fam: familyId }, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  })
}

// Nayi login chain (family) shuru karo, ya rotation me usi family ki nayi session banao.
async function createSession(user, { familyId, expiresAt, userAgent } = {}, mongoSession) {
  const refreshToken = randomToken(48)
  const fam = familyId || crypto.randomUUID()
  const [row] = await Session.create(
    [
      {
        userId: user._id,
        tokenHash: hashToken(refreshToken),
        familyId: fam,
        expiresAt: expiresAt || new Date(Date.now() + env.REFRESH_TOKEN_TTL_MS),
        userAgent: (userAgent || '').slice(0, 200),
      },
    ],
    { session: mongoSession },
  )
  return { refreshToken, session: row, accessToken: signAccessToken(user, fam) }
}

function setRefreshCookie(res, refreshToken, expiresAt) {
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'strict',
    path: COOKIE_PATH,
    expires: expiresAt,
  })
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { httpOnly: true, secure: env.cookieSecure, sameSite: 'strict', path: COOKIE_PATH })
}

function revokeFamily(familyId) {
  return Session.updateMany({ familyId, revokedAt: null }, { revokedAt: new Date() })
}

function revokeAllForUser(userId) {
  return Session.updateMany({ userId, revokedAt: null }, { revokedAt: new Date() })
}

// Email/reset/invitation tokens: DB me sirf hash, user ko asli token (email me).
async function issueToken({ purpose, userId = null, salonId = null, payload = {}, createdBy = null, ttlMs }, mongoSession) {
  const token = randomToken(32)
  await VerificationToken.create(
    [{ purpose, tokenHash: hashToken(token), userId, salonId, payload, createdBy, expiresAt: new Date(Date.now() + ttlMs) }],
    { session: mongoSession },
  )
  return token
}

// Single-use: ek hi baar kaam karta hai, expire ho chuka ho to null.
function consumeToken(purpose, token, mongoSession) {
  return VerificationToken.findOneAndUpdate(
    { purpose, tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } },
    { usedAt: new Date() },
    { returnDocument: 'after', session: mongoSession },
  )
}

function peekToken(purpose, token) {
  return VerificationToken.findOne({ purpose, tokenHash: hashToken(token), usedAt: null, expiresAt: { $gt: new Date() } })
}

function publicUser(user) {
  return { id: user._id, name: user.name, email: user.email, verifiedAt: user.verifiedAt, platformRole: user.platformRole ?? null }
}

async function listMemberships(userId) {
  const rows = await Membership.find({ userId, active: true }).lean()
  const salons = await Salon.find({ _id: { $in: rows.map((r) => r.salonId) } }).lean()
  const byId = new Map(salons.map((s) => [String(s._id), s]))
  return rows
    .filter((r) => byId.has(String(r.salonId)))
    .map((r) => {
      const s = byId.get(String(r.salonId))
      return { salonId: r.salonId, salonName: s.name, slug: s.slug, salonStatus: s.status, role: r.role }
    })
}

// Super Admin ne approve nahi kiya to login nahi (password sahi hone ke baad hi check hota he).
function assertApproved(user) {
  if (user.approvalStatus === 'pending') {
    throw new ApiError(403, 'ACCOUNT_PENDING_APPROVAL', 'Your account is waiting for approval. We will email you once it is approved.')
  }
  if (user.approvalStatus === 'rejected') {
    throw new ApiError(403, 'ACCOUNT_REJECTED', 'Your account request was not approved. Please contact support.')
  }
}

function sendVerificationEmail(user, token) {
  const link = `${env.PUBLIC_APP_URL}/verify-email?token=${token}`
  return sendMail({
    to: user.email,
    subject: 'Verify your Galora email',
    text: `Hi ${user.name},\n\nPlease confirm your email address to finish creating your Galora account:\n${link}\n\nThis link works once and expires in 24 hours.`,
  })
}

// Admin ne approve kiya: owner ko batate hain ki account approve ho gaya, verify karke login kare.
const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

// adminCreated: Super Admin ne account banaya (owner ne register nahi kiya), isliye password wali line aur subject alag.
function sendApprovalEmail(user, { adminCreated = false, salonName = '' } = {}) {
  const loginLink = `${env.PUBLIC_APP_URL}/login`
  const forgotLink = `${env.PUBLIC_APP_URL}/forgot-password`
  const name = user.name
  const passwordLine = adminCreated ? 'the one our team set for you (they will share it with you separately)' : 'the one you chose when you registered'
  const lead = adminCreated
    ? `Your Galora owner account${salonName ? ` and your salon "${salonName}"` : ''} ${salonName ? 'have' : 'has'} been created by our team. You can sign in now.`
    : 'Good news! Your Galora owner account has been approved. You can sign in now.'

  const text = [
    `Hi ${name},`,
    '',
    lead,
    '',
    'Your sign-in details:',
    `Email: ${user.email}`,
    `Password: ${passwordLine} (we never email passwords)`,
    '',
    'Sign in here:',
    loginLink,
    '',
    `Forgot your password? Reset it here: ${forgotLink}`,
    '',
    'Once you are in, you can set up your salon, add services and staff, and start taking bookings.',
    '',
    'If you did not request a Galora account, you can safely ignore this email.',
    '',
    'Warm regards,',
    'Team Galora',
  ].join('\n')

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#faf6f1;font-family:Arial,Helvetica,sans-serif;color:#3b2a1f;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr><td style="background:#8a5a3b;padding:20px 28px;color:#ffffff;font-size:22px;font-weight:bold;">Galora</td></tr>
      <tr><td style="padding:28px;">
        <p style="margin:0 0 12px;font-size:18px;font-weight:bold;">Hi ${escapeHtml(name)}, ${adminCreated ? 'your account is ready' : 'your account is approved'} 🎉</p>
        <p style="margin:0 0 20px;line-height:1.6;">${escapeHtml(lead)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#faf6f1;border-radius:8px;width:100%;"><tr><td style="padding:14px 18px;line-height:1.8;font-size:14px;">
          <strong>Email:</strong> ${escapeHtml(user.email)}<br>
          <strong>Password:</strong> ${escapeHtml(passwordLine)}<br>
          <span style="font-size:12px;color:#8b7767;">(For your safety, we never send passwords by email.)</span>
        </td></tr></table>
        <p style="margin:0 0 24px;"><a href="${loginLink}" style="display:inline-block;background:#8a5a3b;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:bold;">Sign in to Galora</a></p>
        <p style="margin:0 0 6px;line-height:1.6;font-size:14px;color:#6b5646;">If the button does not work, copy this link into your browser:</p>
        <p style="margin:0 0 16px;font-size:13px;word-break:break-all;"><a href="${loginLink}" style="color:#8a5a3b;">${loginLink}</a></p>
        <p style="margin:0 0 24px;font-size:14px;">Forgot your password? <a href="${forgotLink}" style="color:#8a5a3b;font-weight:bold;">Reset it here</a>.</p>
        <p style="margin:0;line-height:1.6;">Then you can set up your salon, add services and staff, and start taking bookings.</p>
      </td></tr>
      <tr><td style="padding:16px 28px;background:#faf6f1;font-size:12px;color:#8b7767;">If you did not request a Galora account, you can safely ignore this email.</td></tr>
    </table>
  </td></tr></table>
</body></html>`

  return sendMail({ to: user.email, subject: adminCreated ? 'Your Galora account is ready' : 'Your Galora account is approved', text, html })
}

module.exports = {
  REFRESH_COOKIE,
  hashPassword,
  verifyPasswordAgainst,
  createSession,
  setRefreshCookie,
  clearRefreshCookie,
  revokeFamily,
  revokeAllForUser,
  issueToken,
  consumeToken,
  peekToken,
  publicUser,
  listMemberships,
  sendVerificationEmail,
  sendApprovalEmail,
  assertApproved,
}
