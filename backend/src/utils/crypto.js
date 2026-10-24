const crypto = require('crypto')

// Lamba random token (email link, refresh cookie). Ye user ko bheja jaata hai.
function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url')
}

// Database me token kabhi seedha nahi rakhte, sirf uska hash (SRS FR-AUTH-01).
// Isse DB leak ho to bhi koi token reuse nahi kar sakta.
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex')
}

module.exports = { randomToken, hashToken }
