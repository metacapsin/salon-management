// Shared form rules. These mirror backend/src/utils/schemas.js exactly; the server always re-checks.
// Every form should reuse these helpers so messages and rules are the same everywhere.

export const EMAIL_MAX_LENGTH = 254
export const PASSWORD_MIN_LENGTH = 12
export const PASSWORD_MAX_LENGTH = 20
export const NAME_MIN_LENGTH = 2
export const NAME_MAX_LENGTH = 35

// ---- Messages ----
export const EMAIL_REQUIRED = 'Email is required.'
export const EMAIL_ERROR = 'Please enter a valid email address.'
export const PASSWORD_REQUIRED = 'Password is required.'
export const PASSWORD_ERROR = 'Password must be between 12 and 20 characters.'
export const NAME_REQUIRED = 'Name is required.'
export const NAME_ERROR = 'Please enter a valid name.'
export const PHONE_REQUIRED = 'Mobile number is required.'
export const PHONE_ERROR = 'Please enter a valid 10-digit mobile number.'
export const REQUIRED_ERROR = 'This field is required.'

// ---- Email ----
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// "  Priya@Gmail.com " -> "priya@gmail.com"
export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase()
}

// Returns an error message, or '' when the email is fine.
export function emailError(value) {
  const email = normalizeEmail(value)
  if (!email) return EMAIL_REQUIRED
  if (email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) return EMAIL_ERROR
  return ''
}

// ---- Password (create / change / reset). Never trimmed or modified. ----
export function newPasswordError(value) {
  const password = String(value ?? '')
  if (!password) return PASSWORD_REQUIRED
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) return PASSWORD_ERROR
  return ''
}

// ---- Name: letters (any language), spaces, hyphen, apostrophe, dot. No digits or other symbols. ----
export const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u

// "  Aarti    Sharma " -> "Aarti Sharma"
export function cleanName(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

export function nameError(value, max = NAME_MAX_LENGTH) {
  const name = cleanName(value)
  if (!name) return NAME_REQUIRED
  if (name.length > max) return `Name can be at most ${max} characters.`
  if (name.length < NAME_MIN_LENGTH || !NAME_PATTERN.test(name)) return NAME_ERROR
  return ''
}

// ---- Indian mobile number: exactly 10 digits, first digit 6-9. No +91, spaces or symbols. ----
export const PHONE_PATTERN = /^[6-9]\d{9}$/

export function isValidPhone(value) {
  return PHONE_PATTERN.test(String(value ?? '').trim())
}

export function phoneError(value, { required = true } = {}) {
  const text = String(value ?? '').trim()
  if (!text) return required ? PHONE_REQUIRED : ''
  return PHONE_PATTERN.test(text) ? '' : PHONE_ERROR
}

// ---- Login ----
// Returns the errors in an object, e.g. { email: 'Email is required.' }. An empty object means all good.
export function validateLogin({ email, password }) {
  const errors = {}
  const emailMessage = emailError(email)
  if (emailMessage) errors.email = emailMessage

  const passwordMessage = newPasswordError(password)
  if (passwordMessage) errors.password = passwordMessage

  return errors
}

// ---- Address: letters, numbers, space , . - / # ( ) & ' : ----
export const ADDRESS_PATTERN = /^[\p{L}\p{M}\p{N} ,.\-/#()&'’:]*$/u
export const ADDRESS_ERROR = 'Please enter a valid address.'

// India PIN code: 6 digits, not starting with 0
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/
export const PINCODE_ERROR = 'Please enter a valid 6-digit PIN code.'

// ---- Dates (YYYY-MM-DD). Must be a REAL calendar date. ----
export const DATE_ERROR = 'Please enter a valid date.'
export const DATE_REQUIRED = 'Date is required.'

export function isRealDate(value) {
  const text = String(value ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false
  const date = new Date(text + 'T00:00:00Z')
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text
}

export function dateError(value, { required = true } = {}) {
  const text = String(value ?? '').trim()
  if (!text) return required ? DATE_REQUIRED : ''
  return isRealDate(text) ? '' : DATE_ERROR
}

// ---- Address (free text). Letters, numbers, spaces and common punctuation. ----
export const ADDRESS_REQUIRED = 'Address is required.'

export function addressError(value, { required = true, min = 0, max = 300 } = {}) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return required ? ADDRESS_REQUIRED : ''
  if (text.length > max) return 'Address can be at most ' + max + ' characters.'
  if (min && text.length < min) return 'Please enter your full address (at least ' + min + ' characters).'
  return ADDRESS_PATTERN.test(text) ? '' : ADDRESS_ERROR
}

export function pincodeError(value) {
  const text = String(value ?? '').trim()
  return !text || PINCODE_PATTERN.test(text) ? '' : PINCODE_ERROR
}
