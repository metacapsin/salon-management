const { AuditEvent } = require('../../models')

// In naamo wali fields audit me kabhi nahi jaati (SRS FR-AUD-02).
const SENSITIVE = /password|token|secret|otp|hash/i

function redact(value, depth = 0) {
  if (value == null || typeof value !== 'object' || depth > 4) return value
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1))
  const out = {}
  for (const [key, val] of Object.entries(value)) {
    out[key] = SENSITIVE.test(key) ? '[redacted]' : redact(val, depth + 1)
  }
  return out
}

// Audit entry likho. Application sirf likhta hai, edit/delete ka koi API nahi hai.
// transaction ke andar likhna ho to { session } do, taaki business change ke saath hi commit ho.
async function recordAudit(req, { salonId = null, actorId, action, entityType = '', entityId = '', changes = {} }, { session } = {}) {
  await AuditEvent.create(
    [
      {
        salonId: salonId ?? req.salon?._id ?? null,
        actorId: actorId ?? req.user?._id ?? null,
        action,
        entityType,
        entityId: String(entityId ?? ''),
        redactedChanges: redact(changes),
        correlationId: req.id,
      },
    ],
    { session },
  )
}

module.exports = { recordAudit, redact }
