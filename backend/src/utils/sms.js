// SMS bhejne ka adapter (mailer.js jaisa). Abhi sirf development ke liye "SMS sink" hai: SMS bheja nahi jaata,
// console me chhapta hai aur .data/sms.log me likha jaata hai. Asli SMS provider (MSG91, Twilio...) baad me yahin judega.
// Production me ye sink band hai, taaki galti se "bheja gaya" jaisa na dikhe.
const fs = require('fs')
const path = require('path')
const env = require('../config/env')
const ApiError = require('./apiError')

const outbox = [] // sirf tests ke liye

async function sendSms({ to, text }) {
  if (env.isProduction) {
    throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED', 'SMS provider is not configured.')
  }
  if (env.isTest) {
    outbox.push({ to, text })
    return
  }
  console.log(`[sms sink] To: ${to} | ${text}`)
  const dir = path.join(__dirname, '..', '..', '.data')
  fs.mkdirSync(dir, { recursive: true })
  fs.appendFileSync(path.join(dir, 'sms.log'), `${new Date().toISOString()} | To: ${to} | ${text}\n`)
}

module.exports = { sendSms, outbox }
