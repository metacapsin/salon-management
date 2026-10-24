const express = require('express')
const { sendSuccess } = require('../../utils/response')
const { z, pagination } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { AuditEvent, User } = require('../../models')

const router = express.Router()

// Sirf apne salon ki audit history, Owner/Manager ke liye (SRS matrix: "Read audit history").
router.get(
  '/',
  authenticate,
  requireSalon,
  can('audit.read'),
  validate({ query: pagination.extend({ action: z.string().max(60).optional() }) }),
  async (req, res) => {
    const { page, pageSize, action } = req.valid.query
    const filter = { salonId: req.salon._id }
    if (action) filter.action = action
    const [rows, total] = await Promise.all([
      AuditEvent.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      AuditEvent.countDocuments(filter),
    ])
    const actors = await User.find({ _id: { $in: rows.map((r) => r.actorId).filter(Boolean) } }).select('name').lean()
    const names = new Map(actors.map((a) => [String(a._id), a.name]))
    const events = rows.map((r) => ({
      id: r._id,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      actorName: names.get(String(r.actorId)) ?? null,
      changes: r.redactedChanges,
      createdAt: r.createdAt,
    }))
    sendSuccess(req, res, { events }, { meta: { page, pageSize, total } })
  },
)

module.exports = router
