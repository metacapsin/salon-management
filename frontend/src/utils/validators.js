// Form ke rules ek jagah. SRS ke hisaab se:
// - Email: shuru/ant ke space hatao, chhote akshar karo, valid dikhna chahiye, max 254 characters.
// - Password: login par sirf "khaali na ho" aur "128 se zyada na ho".
//   (12-128 wali shart password BANATE waqt lagti hai, login par nahi. Warna galat password
//    par hum bata dete ki policy kya hai, jo security ke liye theek nahi.)

export const EMAIL_MAX_LENGTH = 254
export const PASSWORD_MAX_LENGTH = 128

// Simple check: kuch@kuch.kuch. Asli check hamesha backend karega, ye sirf jaldi feedback ke liye hai.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// "  Priya@Gmail.com " -> "priya@gmail.com"
export function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

// Galtiyan ek object me lauta deta hai, jaise { email: 'Enter your email.' }.
// Khaali object ka matlab: sab theek hai.
export function validateLogin({ email, password }) {
  const errors = {}
  const cleanEmail = normalizeEmail(email)

  if (!cleanEmail) {
    errors.email = 'Enter your email.'
  } else if (cleanEmail.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(cleanEmail)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!password) {
    errors.password = 'Enter your password.'
  } else if (password.length > PASSWORD_MAX_LENGTH) {
    errors.password = `Password can be at most ${PASSWORD_MAX_LENGTH} characters.`
  }

  return errors
}

// ---- Shared field rules (naam, phone, address, PIN) ----
// Har form yahi use kare, taaki rules ek jagah rahein.

// Naam: letters (accented bhi), space, hyphen, apostrophe, dot. Numbers aur @#$ jaise symbols nahi.
export const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*$/u
export const NAME_ERROR = 'Name me sirf letters aur spaces hon (numbers ya symbols nahi).'

// Phone: optional +91 / 91 / 0, phir 10 digit jo 6-9 se shuru ho. Beech me space ya hyphen chalega.
const PHONE_CHARS = /^\+?[0-9 -]+$/
export const PHONE_ERROR = 'Enter a valid 10-digit mobile number (+91 optional).'

export function isValidPhone(value) {
  const text = String(value).trim()
  if (!PHONE_CHARS.test(text)) return false
  const digits = text.replace(/\D/g, '')
  const national = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : digits.length === 11 && digits.startsWith('0') ? digits.slice(1) : digits
  if (text.startsWith('+') && !digits.startsWith('91')) return false
  return /^[6-9]\d{9}$/.test(national)
}

// Address: letters, numbers, space , . - / # ( ) & ' . Number zaroori nahi.
export const ADDRESS_PATTERN = /^[\p{L}\p{M}\p{N} ,.\-/#()&'’:]*$/u
export const ADDRESS_ERROR = 'Address me sirf letters, numbers aur , . - / # ( ) allowed hain.'

// India PIN: 6 digit, 0 se shuru nahi
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/
export const PINCODE_ERROR = 'Enter a valid 6-digit PIN code.'
