// Customer ka login: mobile number -> OTP (SMS) -> andar. Password nahi hota.
// Rules: OTP 6 digit, 5 minute me khatam, galat 5 baar likhne par band, naya OTP 30 second baad hi, ek ghante me 5 se zyada nahi.
const crypto = require('crypto')
const express = require('express')
const env = require('../../config/env')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { hashToken } = require('../../utils/crypto')
const { sendSms } = require('../../utils/sms')
const { z } = require('../../utils/schemas')
const { validate, limiter, requireAllowedOrigin } = require('../../middleware/common')
const { authenticateCustomer, setCustomerCookie, clearCustomerCookie } = require('../../middleware/customerAuth')
const { Customer, CustomerOtp } = require('../../models')

const router = express.Router()

const OTP_TTL_MS = 5 * 60 * 1000
const OTP_RESEND_MS = 30 * 1000
const OTP_MAX_ATTEMPTS = 5
const OTP_MAX_PER_HOUR = 5

// 10 digit (6-9 se shuru) ya 12 digit (91 ke saath). Andar hamesha 10 digit rakhte hain.
const phone = z
  .string()
  .trim()
  .regex(/^(91)?[6-9]\d{9}$/, 'Enter a 10 digit mobile number (or 12 digits with 91).')
  .transform((v) => v.slice(-10))
const customerName = z
  .string()
  .trim()
  .min(2, 'Enter your name.')
  .max(100)
  .regex(/^\p{L}[\p{L} .'-]*$/u, 'Use letters only in the name.')

const presentCustomer = (c) => ({ id: c._id, name: c.name, phone: c.phone })
const codeHash = (mobile, code) => hashToken(`${mobile}:${code}`)

const requestLimit = limiter({ windowMs: 10 * 60_000, limit: 15 })
const verifyLimit = limiter({ windowMs: 10 * 60_000, limit: 30 })

// POST /customer/auth/request-otp
router.post('/auth/request-otp', requireAllowedOrigin, requestLimit, validate({ body: z.strictObject({ phone }) }), async (req, res) => {
  const { phone: mobile } = req.valid.body
  const now = Date.now()

  const latest = await CustomerOtp.findOne({ phone: mobile }).sort({ createdAt: -1 }).lean()
  if (latest && now - new Date(latest.createdAt).getTime() < OTP_RESEND_MS) {
    const wait = Math.ceil((OTP_RESEND_MS - (now - new Date(latest.createdAt).getTime())) / 1000)
    throw new ApiError(429, 'OTP_COOLDOWN', `Please wait ${wait} seconds before asking for a new code.`, { details: { retryAfterSec: wait } })
  }
  const lastHour = await CustomerOtp.countDocuments({ phone: mobile, createdAt: { $gt: new Date(now - 60 * 60 * 1000) } })
  if (lastHour >= OTP_MAX_PER_HOUR) {
    throw new ApiError(429, 'OTP_LIMIT', 'Too many codes requested. Please try again after an hour.')
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0')
  // Purane codes bekaar, sirf naya chalega
  await CustomerOtp.updateMany({ phone: mobile, usedAt: null }, { usedAt: new Date() })
  await CustomerOtp.create({ phone: mobile, codeHash: codeHash(mobile, code), expiresAt: new Date(now + OTP_TTL_MS) })
  await sendSms({ to: `+91${mobile}`, text: `${code} is your Glamora login code. It is valid for 5 minutes. Do not share it with anyone.` })

  // devOtp sirf development/test me: SMS provider jodne se pehle bina SMS ke login try karne ke liye. Production me kabhi nahi.
  const body = { sent: true, resendAfterSec: OTP_RESEND_MS / 1000, expiresInSec: OTP_TTL_MS / 1000 }
  if (!env.isProduction) body.devOtp = code
  sendSuccess(req, res, body)
})

// POST /customer/auth/verify-otp  { phone, otp, name? }
// Naya customer ho aur naam na diya ho to { needsName: true } milta hai (code sahi hone par hi, aur code kharch nahi hota).
router.post(
  '/auth/verify-otp',
  requireAllowedOrigin,
  verifyLimit,
  validate({ body: z.strictObject({ phone, otp: z.string().regex(/^\d{6}$/, 'Enter the 6 digit code.'), name: customerName.optional() }) }),
  async (req, res) => {
    const { phone: mobile, otp, name } = req.valid.body

    const record = await CustomerOtp.findOne({ phone: mobile, usedAt: null, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 })
    if (!record) throw new ApiError(400, 'OTP_EXPIRED', 'This code has expired. Please ask for a new one.')
    if (record.attempts >= OTP_MAX_ATTEMPTS) throw new ApiError(429, 'OTP_LOCKED', 'Too many wrong attempts. Please ask for a new code.')

    const given = Buffer.from(codeHash(mobile, otp))
    const real = Buffer.from(record.codeHash)
    if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) {
      const updated = await CustomerOtp.findOneAndUpdate({ _id: record._id }, { $inc: { attempts: 1 } }, { returnDocument: 'after' })
      const left = Math.max(0, OTP_MAX_ATTEMPTS - updated.attempts)
      throw new ApiError(400, 'OTP_INVALID', left > 0 ? `Wrong code. ${left} ${left === 1 ? 'try' : 'tries'} left.` : 'Wrong code. Please ask for a new one.', {
        fieldErrors: { otp: 'Wrong code.' },
      })
    }

    let customer = await Customer.findOne({ phone: mobile })
    if (!customer && !name) return sendSuccess(req, res, { needsName: true })

    // Code sirf ek baar chalta hai: do request ek saath aayein to ek hi jeet-ti hai
    const claimed = await CustomerOtp.updateOne({ _id: record._id, usedAt: null }, { usedAt: new Date() })
    if (claimed.modifiedCount !== 1) throw new ApiError(400, 'OTP_EXPIRED', 'This code has already been used. Please ask for a new one.')

    if (!customer) customer = await Customer.create({ phone: mobile, name })
    customer.lastLoginAt = new Date()
    await customer.save()

    setCustomerCookie(res, customer)
    sendSuccess(req, res, { customer: presentCustomer(customer) })
  },
)

// GET /customer/me -> login hai to uski jaankari, nahi to 401
router.get('/me', authenticateCustomer, (req, res) => sendSuccess(req, res, { customer: presentCustomer(req.customer) }))

// POST /customer/auth/logout
router.post('/auth/logout', requireAllowedOrigin, (req, res) => {
  clearCustomerCookie(res)
  sendSuccess(req, res, { ok: true })
})

module.exports = router
