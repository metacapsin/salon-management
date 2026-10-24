// Ek khaas error jisme HTTP status, code (jaise SLOT_UNAVAILABLE) aur insaan ke padhne layak message hota hai.
// Routes me `throw new ApiError(...)` karo, errorHandler use sahi JSON me badal dega (SRS API-01/02).
class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = extra.fieldErrors
    this.details = extra.details
  }
}

module.exports = ApiError
