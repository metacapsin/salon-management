const express = require('express')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { Notification } = require('../../models')

const router = express.Router()
router.use(authenticate, requireSalon, can('notifications.read'))

function present(n) {
  return { id: n._id, type: n.type, title: n.title, body: n.body, unread: !n.readAt, createdAt: n.createdAt }
}

// Latest 30 khabrein + kitni padhi nahi gayi
router.get('/', async (req, res) => {
  const filter = { salonId: req.salon._id }
  const [rows, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(30).lean(),
    Notification.countDocuments({ ...filter, readAt: null }),
  ])
  sendSuccess(req, res, { notifications: rows.map(present), unreadCount })
})

router.post('/read-all', async (req, res) => {
  await Notification.updateMany({ salonId: req.salon._id, readAt: null }, { $set: { readAt: new Date() } })
  sendSuccess(req, res, { ok: true })
})

router.post('/:id/read', validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  const result = await Notification.updateOne({ _id: req.valid.params.id, salonId: req.salon._id }, { $set: { readAt: new Date() } })
  if (result.matchedCount === 0) throw new ApiError(404, 'NOT_FOUND', 'Notification not found.')
  sendSuccess(req, res, { ok: true })
})

module.exports = router
