// Salon owner/manager ke liye (mount: /api/v1/reviews): apne salon ke reviews dekhna aur jawab dena.
// Har query salonId se bandhi he, salon login se aata he (X-Salon-Id ko server membership se jaanchta he).
const express = require('express')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const ApiError = require('../../utils/apiError')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { Review, Booking } = require('../../models')
const { recordAudit } = require('../audit/audit.service')
const { ratingSummary, presentReview } = require('./reviews.service')

const router = express.Router()
router.use(authenticate, requireSalon)

const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
  rating: z.coerce.number().int().min(1).max(5).optional(),
})
const idParams = z.object({ id: objectId })
const replyBody = z.strictObject({ text: z.string().trim().min(1, 'Write a reply.').max(500, 'Reply can be at most 500 characters.') })

// GET /reviews -> summary (total, average, 5..1 breakdown) + latest reviews (optional ?rating=N filter)
router.get('/', can('reviews.read'), validate({ query: listQuery }), async (req, res) => {
  const { page, pageSize, rating } = req.valid.query
  const filter = { salonId: req.salon._id, ...(rating ? { rating } : {}) }
  const [summary, total, rows] = await Promise.all([
    ratingSummary(req.salon._id),
    Review.countDocuments(filter),
    Review.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize),
  ])
  // Kaunsi service/din ka review tha, ye booking se (usi salon ki)
  const bookings = await Booking.find({ _id: { $in: rows.map((r) => r.bookingId) }, salonId: req.salon._id }).select('date services').lean()
  const byId = new Map(bookings.map((b) => [String(b._id), b]))
  sendSuccess(req, res, {
    summary,
    reviews: rows.map((r) => {
      const b = byId.get(String(r.bookingId))
      return { ...presentReview(req, r), visitDate: b?.date ?? null, services: b?.services.map((s) => s.name) ?? [] }
    }),
    page,
    pageSize,
    total,
  })
})

async function salonReview(req) {
  const review = await Review.findOne({ _id: req.valid.params.id, salonId: req.salon._id })
  if (!review) throw new ApiError(404, 'NOT_FOUND', 'Review not found.')
  return review
}

// PUT /reviews/:id/reply -> jawab likhna (pehle se he to badal jata he)
router.put('/:id/reply', can('reviews.reply'), validate({ params: idParams, body: replyBody }), async (req, res) => {
  const review = await salonReview(req)
  review.reply = { text: req.valid.body.text, repliedAt: new Date(), repliedBy: req.user._id }
  await review.save()
  await recordAudit(req, { action: 'review.replied', entityType: 'review', entityId: review._id })
  sendSuccess(req, res, { review: presentReview(req, review) })
})

router.delete('/:id/reply', can('reviews.reply'), validate({ params: idParams }), async (req, res) => {
  const review = await salonReview(req)
  review.reply = null
  await review.save()
  await recordAudit(req, { action: 'review.reply_removed', entityType: 'review', entityId: review._id })
  sendSuccess(req, res, { review: presentReview(req, review) })
})

module.exports = router
