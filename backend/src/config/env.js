// Saari settings ek hi jagah, .env se padhi aur check ki hui.
// Agar koi zaroori cheez galat/missing ho to server start hi nahi hota (jaldi pata chal jaata hai).
require('dotenv').config()
const { z } = require('zod')

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().min(1).default('mongodb://127.0.0.1:27018/glamora?replicaSet=rs0&directConnection=true'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  PUBLIC_APP_URL: z.string().url().default('http://localhost:5173'),
  COOKIE_SECURE: z.enum(['true', 'false']).default('false'),
  // Asli email (SMTP). Khaali chhodo to email sirf .data/emails.log me likhi jaati he (development).
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_USER: z.string().optional(),
  // Google App Password aksar "abcd efgh ijkl mnop" dikhta he; spaces hata dete hain.
  SMTP_PASS: z.string().transform((v) => v.replace(/\s+/g, '')).optional(),
  MAIL_FROM: z.string().optional(),
})

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment configuration:')
  for (const issue of parsed.error.issues) console.error(` - ${issue.path.join('.')}: ${issue.message}`)
  process.exit(1)
}

const env = parsed.data

module.exports = {
  ...env,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  smtpConfigured: Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
  cookieSecure: env.COOKIE_SECURE === 'true',
  // Token timings (SRS FR-AUTH-01/02)
  ACCESS_TOKEN_TTL_SECONDS: 15 * 60,
  REFRESH_TOKEN_TTL_MS: 7 * 24 * 60 * 60 * 1000,
  INVITATION_TTL_MS: 48 * 60 * 60 * 1000,
  PASSWORD_RESET_TTL_MS: 30 * 60 * 1000,
  EMAIL_VERIFY_TTL_MS: 24 * 60 * 60 * 1000,
  // Login lockout (SRS FR-AUTH-03): 5 failures in 15 minutes -> 15 minute backoff
  LOGIN_MAX_FAILURES: 5,
  LOGIN_WINDOW_MS: 15 * 60 * 1000,
  LOGIN_LOCK_MS: 15 * 60 * 1000,
}
