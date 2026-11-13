// Shared validation rules (zod). Every route should reuse these so that names, passwords,
// mobile numbers and emails are validated in exactly one way. The frontend mirrors these
// rules in frontend/src/utils/validators.js and mobile/src/utils/validators.js.
const mongoose = require('mongoose')
const { z } = require('zod')

// ---- Messages (professional English, one wording per rule) ----
const MESSAGES = {
  emailRequired: 'Email is required.',
  emailInvalid: 'Please enter a valid email address.',
  passwordLength: 'Password must be between 12 and 20 characters.',
  passwordRequired: 'Password is required.',
  nameRequired: 'Name is required.',
  nameInvalid: 'Please enter a valid name.',
  mobileInvalid: 'Please enter a valid 10-digit mobile number.',
  dateInvalid: 'Please enter a valid date.',
  addressInvalid: 'Please enter a valid address.',
  pincodeInvalid: 'Please enter a valid 6-digit PIN code.',
}

const PASSWORD_MIN = 12
const PASSWORD_MAX = 20
const NAME_MIN = 2
const NAME_MAX = 35

// "  Aarti    Sharma " -> "Aarti Sharma" (trim and collapse repeated spaces)
const cleanSpaces = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : v)

const email = z
  .string({ error: MESSAGES.emailRequired })
  .trim()
  .toLowerCase()
  .min(1, MESSAGES.emailRequired)
  .max(254, MESSAGES.emailInvalid)
  .email(MESSAGES.emailInvalid)

// Used when a password is CREATED or CHANGED (register, reset, change password, admin-created owner).
// Never trimmed or modified.
const newPassword = z
  .string({ error: MESSAGES.passwordRequired })
  .min(PASSWORD_MIN, MESSAGES.passwordLength)
  .max(PASSWORD_MAX, MESSAGES.passwordLength)

// Login only checks "not empty" so that people who registered earlier with a longer password can still sign in.
// The generous upper limit only protects the server from huge payloads.
const loginPassword = newPassword

// Person name: letters (any language), spaces, hyphen, apostrophe, dot. No digits or other symbols.
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u
const personName = z.preprocess(
  cleanSpaces,
  z
    .string({ error: MESSAGES.nameRequired })
    .min(1, MESSAGES.nameRequired)
    .min(NAME_MIN, MESSAGES.nameInvalid)
    .max(NAME_MAX, `Name can be at most ${NAME_MAX} characters.`)
    .regex(NAME_PATTERN, MESSAGES.nameInvalid),
)

// Business names (salon, service, package...) may contain digits and symbols, but are trimmed and cannot be empty.
const businessName = (max = 100, label = 'Name') =>
  z.preprocess(
    cleanSpaces,
    z
      .string({ error: `${label} is required.` })
      .min(1, `${label} is required.`)
      .min(2, `${label} must be at least 2 characters.`)
      .max(max, `${label} can be at most ${max} characters.`),
  )

// Indian mobile number: exactly 10 digits, first digit 6-9. No +91, spaces or other characters.
const MOBILE_PATTERN = /^[6-9]\d{9}$/
const mobile = z.string({ error: MESSAGES.mobileInvalid }).trim().regex(MOBILE_PATTERN, MESSAGES.mobileInvalid)
// Same rule, but an empty string is allowed (optional phone fields).
const optionalMobile = z
  .string({ error: MESSAGES.mobileInvalid })
  .trim()
  .refine((v) => v === '' || MOBILE_PATTERN.test(v), MESSAGES.mobileInvalid)

// Calendar date as YYYY-MM-DD. Must be a REAL date ("2026-02-31" and "9999-99-99" are refused).
const isRealDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v
const isoDate = z.string({ error: MESSAGES.dateInvalid }).trim().refine((v) => {
  try {
    return isRealDate(v)
  } catch {
    return false
  }
}, MESSAGES.dateInvalid)

// Address text: letters, numbers, spaces and common punctuation. Trimmed; repeated spaces collapse. Empty is allowed
// (use requiredAddress where it is mandatory).
const ADDRESS_PATTERN = /^[\p{L}\p{M}\p{N} ,.\-/#()&'’:]*$/u
const addressText = (max = 200) =>
  z.preprocess(
    cleanSpaces,
    z.string({ error: MESSAGES.addressInvalid }).max(max, `Address can be at most ${max} characters.`).regex(ADDRESS_PATTERN, MESSAGES.addressInvalid),
  )
const requiredAddress = (min = 8, max = 300) =>
  z.preprocess(
    cleanSpaces,
    z
      .string({ error: 'Address is required.' })
      .min(1, 'Address is required.')
      .min(min, `Please enter your full address (at least ${min} characters).`)
      .max(max, `Address can be at most ${max} characters.`)
      .regex(ADDRESS_PATTERN, MESSAGES.addressInvalid),
  )
// India PIN code: 6 digits, not starting with 0. Empty is allowed.
const pincode = z.string({ error: MESSAGES.pincodeInvalid }).trim().refine((v) => v === '' || /^[1-9]\d{5}$/.test(v), MESSAGES.pincodeInvalid)

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), 'Invalid id.')

const token = z.string().min(20).max(200)

const pagination = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

module.exports = {
  z,
  MESSAGES,
  PASSWORD_MIN,
  PASSWORD_MAX,
  NAME_PATTERN,
  MOBILE_PATTERN,
  email,
  newPassword,
  loginPassword,
  personName,
  businessName,
  mobile,
  optionalMobile,
  isoDate,
  isRealDate,
  addressText,
  requiredAddress,
  pincode,
  ADDRESS_PATTERN,
  objectId,
  token,
  pagination,
}
