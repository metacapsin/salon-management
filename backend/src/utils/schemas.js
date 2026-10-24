// Zod ke chhote reusable rules (SRS section 19). Frontend ke validators.js se milte-julte hain,
// par asli check hamesha yahan (server par) hota hai.
const mongoose = require('mongoose')
const { z } = require('zod')

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'Email can be at most 254 characters.')
  .email('Enter a valid email address.')

// Password banate waqt: 12 se 128 characters (paste/password manager allowed). Login par sirf khaali na ho.
const newPassword = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(128, 'Password can be at most 128 characters.')

const loginPassword = z.string().min(1, 'Enter your password.').max(128)

const personName = z.string().trim().min(1, 'Enter a name.').max(100, 'Name can be at most 100 characters.')

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id.')

const token = z.string().min(20).max(200)

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

module.exports = { z, email, newPassword, loginPassword, personName, objectId, token, pagination }
