// Har API jawab ek hi shape me jaata hai (frontend isi shape ko padhta hai):
//   success: { data, meta?, requestId }
//   error:   { error: { code, message, fieldErrors?, details? }, requestId }
// requestId middleware/requestContext.js har request par laga deta hai.

function sendSuccess(req, res, data, { status = 200, meta } = {}) {
  const body = { data, requestId: req.id }
  if (meta) body.meta = meta
  return res.status(status).json(body)
}

function sendError(req, res, status, code, message, extra = {}) {
  const error = { code, message }
  if (extra.fieldErrors) error.fieldErrors = extra.fieldErrors
  if (extra.details) error.details = extra.details
  return res.status(status).json({ error, requestId: req.id })
}

module.exports = { sendSuccess, sendError }
