// Email bhejne ka adapter. Abhi sirf development ke liye "email sink" hai: email bheji nahi jaati,
// console me chhapti hai aur .data/emails.log me likhi jaati hai. Asli email provider baad me yahin judega.
// SMTP_* .env me set ho to asli email jaati he. Production me ye sink apne aap band hai, taaki galti se "bheji gayi" jaisa na dikhe (SRS section 24.1).
const fs = require('fs')
const path = require('path')
const env = require('../config/env')
const ApiError = require('./apiError')

const outbox = [] // sirf tests ke liye: bheji gayi emails yahan jama hoti hain

let transporter
function getTransporter() {
  if (!transporter) {
    const nodemailer = require('nodemailer')
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
    })
  }
  return transporter
}

async function sendMail({ to, subject, text, html }) {
  if (env.isTest) {
    outbox.push({ to, subject, text, html })
    return
  }
  // Asli SMTP set he to asli email jaati he (production me bhi yahi raasta).
  if (env.smtpConfigured) {
    try {
      await getTransporter().sendMail({ from: env.MAIL_FROM || env.SMTP_USER, to, subject, text, html })
    } catch (error) {
      console.error('[mail] send failed:', error.message)
      throw new ApiError(503, 'MAIL_SEND_FAILED', 'Could not send the email right now. Please try again later.')
    }
    return
  }
  if (env.isProduction) {
    throw new ApiError(503, 'PROVIDER_NOT_CONFIGURED', 'Email provider is not configured.')
  }
  const entry = `\n--- ${new Date().toISOString()} ---\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`
  console.log(`[email sink] To: ${to} | ${subject}\n${text}`)
  const dir = path.join(__dirname, '..', '..', '.data')
  fs.mkdirSync(dir, { recursive: true })
  fs.appendFileSync(path.join(dir, 'emails.log'), entry)
}

module.exports = { sendMail, outbox }
