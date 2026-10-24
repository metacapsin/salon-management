const crypto = require('crypto')
const rateLimit = require('express-rate-limit')
const { ZodError } = require('zod')
const env = require('../config/env')
const ApiError = require('../utils/apiError')
const { sendError } = require('../utils/response')

// Har request ko ek id; jawab me wapas jaati hai aur logs/audit me use hoti hai (correlation id).
function requestContext(req, res, next) {
  req.id = crypto.randomUUID()
  res.setHeader('X-Request-Id', req.id)
  next()
}

function zodToFieldErrors(error) {
  const fieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_'
    if (!fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fieldErrors
}

// validate({ body, query, params }) -> zod schemas. Galat/extra fields par 400.
// Parsed values req.valid me milti hain (Express 5 me req.query ko badla nahi ja sakta).
function validate(schemas) {
  return (req, res, next) => {
    req.valid = {}
    for (const part of ['params', 'query', 'body']) {
      if (!schemas[part]) continue
      const result = schemas[part].safeParse(req[part] ?? {})
      if (!result.success) {
        return next(new ApiError(400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', { fieldErrors: zodToFieldErrors(result.error) }))
      }
      req.valid[part] = result.data
    }
    next()
  }
}

// Rate limit (SRS FR-AUTH-03 / SEC-02). Tests me band, taaki tests rukein nahi.
function limiter({ windowMs, limit }) {
  if (env.isTest) return (req, res, next) => next()
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => sendError(req, res, 429, 'RATE_LIMITED', 'Too many requests. Please wait a few minutes and try again.'),
  })
}

// Browser se aane wali cookie-based requests ke liye CSRF bachav: Origin hamare frontend ka hi hona chahiye (SEC-01).
function requireAllowedOrigin(req, res, next) {
  const origin = req.get('origin')
  if (origin && origin !== env.CLIENT_ORIGIN) {
    return next(new ApiError(403, 'PERMISSION_DENIED', 'Request origin is not allowed.'))
  }
  next()
}

function notFound(req, res) {
  sendError(req, res, 404, 'NOT_FOUND', 'Route not found.')
}

// Sab errors yahin se ek jaisi shape me nikalte hain. Stack trace ya database ki andar ki baat kabhi bahar nahi jaati (API-02).
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return sendError(req, res, err.status, err.code, err.message, { fieldErrors: err.fieldErrors, details: err.details })
  }
  if (err instanceof ZodError) {
    return sendError(req, res, 400, 'VALIDATION_ERROR', 'Please check the highlighted fields.', { fieldErrors: zodToFieldErrors(err) })
  }
  if (err?.type === 'entity.parse.failed') {
    return sendError(req, res, 400, 'VALIDATION_ERROR', 'Request body is not valid JSON.')
  }
  if (err?.type === 'entity.too.large') {
    return sendError(req, res, 413, 'VALIDATION_ERROR', 'Request body is too large.')
  }
  if (err?.code === 11000) {
    return sendError(req, res, 409, 'CONFLICT', 'This record already exists.')
  }
  if (err?.name === 'CastError') {
    return sendError(req, res, 404, 'NOT_FOUND', 'Record not found.')
  }
  console.error(`[${req.id}] Unhandled error:`, err)
  return sendError(req, res, 500, 'SERVER_ERROR', 'Something went wrong.')
}

module.exports = { requestContext, validate, limiter, requireAllowedOrigin, notFound, errorHandler }
