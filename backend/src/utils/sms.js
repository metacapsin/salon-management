// SMS bhejne ka adapter (mailer.js jaisa). Abhi sirf development ke liye "SMS sink" hai: SMS bheja nahi jaata,
// console me chhapta hai aur .data/sms.log me likha jaata hai. Asli SMS provider (MSG91, Twilio...) baad me yahin judega.
// Production me ye sink band hai, taaki galti se "bheja gaya" jaisa na dikhe.
const fs = require('fs')
const path = require('path')
const env = require('../config/env')
const ApiError = require('./apiError')

const outbox = [] // sirf tests ke liye

// Twilio REST API (alag package ki zaroorat nahi, Node ka fetch kaafi he)
async function sendViaTwilio({ to, text }) {
  const body = new URLSearchParams({ To: to, Body: text })
  body.set(env.TWILIO_FROM.startsWith('MG') ? 'MessagingServiceSid' : 'From', env.TWILIO_FROM)
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    console.error('[sms] Twilio error:', res.status, err.code, err.message)
    throw new ApiError(502, 'SMS_FAILED', 'Could not send the SMS right now. Please try again.')
  }
}

async function sendSms({ to, text }) {
  if (env.isTest) {
    outbox.push({ to, text })
    return
  }
  if (env.smsConfigured) return sendViaTwilio({ to, text })
  if (env.isProduction) {
    throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED', 'SMS provider is not configured.')
  }
  console.log(`[sms sink] To: ${to} | ${text}`)
  const dir = path.join(__dirname, '..', '..', '.data')
  fs.mkdirSync(dir, { recursive: true })
  fs.appendFileSync(path.join(dir, 'sms.log'), `${new Date().toISOString()} | To: ${to} | ${text}\n`)
}

// Twilio Verify: OTP Twilio khud banata, bhejta aur check karta he (trial account me bhi chalta he)
async function verifyRequest(path, params) {
  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64')
  const res = await fetch(`https://verify.twilio.com/v2/Services/${env.TWILIO_VERIFY_SID}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function startVerification(to) {
  const r = await verifyRequest('Verifications', { To: to, Channel: 'sms' })
  if (!r.ok) {
    console.error('[sms] Twilio Verify error:', r.status, r.data.code, r.data.message)
    throw new ApiError(502, 'SMS_FAILED', 'Could not send the SMS right now. Please try again.')
  }
}

// true = code sahi. Galat/expire code par false (Twilio 404 deta he).
async function checkVerification(to, code) {
  const r = await verifyRequest('VerificationCheck', { To: to, Code: code })
  if (r.ok) return r.data.status === 'approved'
  if (r.status === 404 || r.status === 400) return false
  console.error('[sms] Twilio Verify check error:', r.status, r.data.code, r.data.message)
  throw new ApiError(502, 'SMS_FAILED', 'Could not check the code right now. Please try again.')
}

module.exports = { sendSms, startVerification, checkVerification, outbox }
