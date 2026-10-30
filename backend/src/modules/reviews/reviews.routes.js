// Customer ke review APIs (mount: /api/v1/public). Har route par customer login zaroori; booking/review hamesha
// "customer ki apni" hi milti he, dusre ki id par 404 (taaki pata na chale ki wo exist karti he).
const express = require('express')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const ApiError = require('../../utils/apiError')
const { validate, limiter } = require('../../middleware/common')
const { authenticateCustomer } = require('../../middleware/customerAuth')
const { Booking, Review, ReviewHelpful, Salon, CustomerNotification } = require('../../models')
const { ownsBooking, ensureReviewRequests, ratingSummary, recalcSalonRating, presentReview, notifyReviewSubmitted, isDuplicate } = require('./reviews.service')

const router = express.Router()
const writeLimit = limiter({ windowMs: 10 * 60_000, limit: 30 })

const rating = z.number().int('Rating must be a whole number.').min(1, 'Choose 1 to 5 stars.').max(5, 'Choose 1 to 5 stars.')
const comment = z.string().trim().max(1000, 'Review can be at most 1000 characters.')
// strictObject: salonId, customerName jaisi koi extra cheez body se nahi li jati
const createBody = z.strictObject({ rating, comment: comment.default('') })
const editBody = z.strictObject({ rating: rating.optional(), comment: comment.optional() }).refine((b) => b.rating !== undefined || b.comment !== undefined, 'Nothing to change.')
const idParams = z.object({ id: objectId })

const present = presentReview

// Apna review dhundho (dusre ka ho ya na ho, dono me 404)
async function ownReview(req) {
  const review = await Review.findOne({ _id: req.valid.params.id, customerId: req.customer._id })
  if (!review) throw new ApiError(404, 'NOT_FOUND', 'Review not found.')
  return review
}

const pageQuery = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(50).default(10) })

// GET /public/salons/:id/reviews -> salon ki public profile ke liye: asli rating summary (average, total, 5..1 breakdown) + reviews.
// Sirf wahi salon jo customer ko dikhta he (active + public booking). Customer ka phone/id kabhi nahi jata.
router.get('/salons/:id/reviews', authenticateCustomer, validate({ params: idParams, query: pageQuery }), async (req, res) => {
  const salon = await Salon.findOne({ _id: req.valid.params.id, status: 'active', publicBookingEnabled: true }).select('_id').lean()
  if (!salon) throw new ApiError(404, 'NOT_FOUND', 'Salon not found.')
  const { page, pageSize } = req.valid.query
  const [summary, rows] = await Promise.all([ratingSummary(salon._id), Review.find({ salonId: salon._id }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize)])
  const mine = rows.filter((r) => String(r.customerId) === String(req.customer._id)).map((r) => String(r._id))
  const helped = new Set((await ReviewHelpful.find({ reviewId: { $in: rows.map((r) => r._id) }, customerId: req.customer._id }).select('reviewId').lean()).map((h) => String(h.reviewId)))
  sendSuccess(req, res, { summary, reviews: rows.map((r) => ({ ...present(req, r), isMine: mine.includes(String(r._id)), isHelpful: helped.has(String(r._id)) })), page, pageSize, total: summary.count })
})

// "Helpful" dabana / hatana. Sirf customer ko dikhne wale salon ke review par, aur apne review par nahi.
// Ek customer ek review par ek hi baar (database ka unique index), dobara dabane par ginti nahi badhti.
async function setHelpful(req, res, on) {
  const review = await Review.findById(req.valid.params.id)
  const visible = review && (await Salon.exists({ _id: review.salonId, status: 'active', publicBookingEnabled: true }))
  if (!visible) throw new ApiError(404, 'NOT_FOUND', 'Review not found.')
  if (String(review.customerId) === String(req.customer._id)) throw new ApiError(403, 'OWN_REVIEW', 'You cannot mark your own review as helpful.')
  const key = { reviewId: review._id, customerId: req.customer._id }
  if (on) {
    try {
      await ReviewHelpful.create({ salonId: review.salonId, ...key })
    } catch (error) {
      if (!isDuplicate(error)) throw error
    }
  } else {
    await ReviewHelpful.deleteOne(key)
  }
  // Ginti hamesha asli rows se dobara nikalte hain, taaki do request ek saath aayein to bhi sahi rahe
  const helpfulCount = await ReviewHelpful.countDocuments({ reviewId: review._id })
  await Review.updateOne({ _id: review._id }, { $set: { helpfulCount } })
  sendSuccess(req, res, { helpfulCount, isHelpful: on })
}
router.put('/reviews/:id/helpful', authenticateCustomer, writeLimit, validate({ params: idParams }), (req, res) => setHelpful(req, res, true))
router.delete('/reviews/:id/helpful', authenticateCustomer, writeLimit, validate({ params: idParams }), (req, res) => setHelpful(req, res, false))

// GET /public/my-bookings/:id/review -> review form ke liye: appointment ka saar, ho chuka review (agar he) aur review de sakte hain ya nahi.
// Salon staff ki banayi (phone se juddi) appointment bhi yahin se khulti he.
router.get('/my-bookings/:id/review', authenticateCustomer, validate({ params: idParams }), async (req, res) => {
  const booking = await Booking.findById(req.valid.params.id)
  if (!booking || !ownsBooking(booking, req.customer)) throw new ApiError(404, 'NOT_FOUND', 'Appointment not found.')
  const [salon, existing] = await Promise.all([Salon.findById(booking.salonId).select('name address.area address.city').lean(), Review.findOne({ bookingId: booking._id })])
  sendSuccess(req, res, {
    booking: { id: booking._id, salonId: booking.salonId, salonName: salon?.name ?? 'Salon', area: salon?.address?.area ?? '', city: salon?.address?.city ?? '', date: booking.date, startTime: booking.startTime, services: booking.services.map((s) => s.name), status: booking.status },
    canReview: booking.status === 'completed' && !existing,
    review: existing ? present(req, existing) : null,
  })
})

// ---------- Customer ki apni khabrein (review request, thanks) ----------
const notificationToJson = (n, salons, open) => ({
  id: n._id,
  type: n.type,
  title: n.title,
  body: n.body,
  unread: !n.readAt,
  createdAt: n.createdAt,
  bookingId: n.bookingId,
  salonId: n.salonId,
  salonName: salons.get(String(n.salonId)) ?? 'Salon',
  // review request par "Write a review" tabhi dikhe jab us appointment ka review baaki ho
  canReview: n.type === 'review_request' && open.has(String(n.bookingId)),
})

// GET /public/notifications -> latest 30 + unread ginti. Pehle chhooti hui review requests (salon-side bookings) bana deta he.
router.get('/notifications', authenticateCustomer, async (req, res) => {
  await ensureReviewRequests(req.customer).catch((error) => console.error('Review request backfill failed:', error.message))
  const filter = { customerId: req.customer._id }
  const [rows, unreadCount] = await Promise.all([CustomerNotification.find(filter).sort({ createdAt: -1, _id: -1 }).limit(30).lean(), CustomerNotification.countDocuments({ ...filter, readAt: null })])
  const bookingIds = rows.map((n) => n.bookingId)
  const [salons, reviewed] = await Promise.all([Salon.find({ _id: { $in: rows.map((n) => n.salonId) } }).select('name').lean(), Review.distinct('bookingId', { bookingId: { $in: bookingIds } })])
  const salonNames = new Map(salons.map((s) => [String(s._id), s.name]))
  const reviewedSet = new Set(reviewed.map(String))
  const open = new Set(bookingIds.map(String).filter((id) => !reviewedSet.has(id)))
  sendSuccess(req, res, { notifications: rows.map((n) => notificationToJson(n, salonNames, open)), unreadCount })
})

router.post('/notifications/read-all', authenticateCustomer, async (req, res) => {
  await CustomerNotification.updateMany({ customerId: req.customer._id, readAt: null }, { $set: { readAt: new Date() } })
  sendSuccess(req, res, { ok: true })
})

router.post('/notifications/:id/read', authenticateCustomer, validate({ params: idParams }), async (req, res) => {
  const result = await CustomerNotification.updateOne({ _id: req.valid.params.id, customerId: req.customer._id }, { $set: { readAt: new Date() } })
  if (result.matchedCount === 0) throw new ApiError(404, 'NOT_FOUND', 'Notification not found.')
  sendSuccess(req, res, { ok: true })
})

// POST /public/my-bookings/:id/review -> completed appointment par rating + comment (ek appointment = ek review)
router.post('/my-bookings/:id/review', authenticateCustomer, writeLimit, validate({ params: idParams, body: createBody }), async (req, res) => {
  const booking = await Booking.findById(req.valid.params.id)
  if (!booking || !ownsBooking(booking, req.customer)) throw new ApiError(404, 'NOT_FOUND', 'Appointment not found.')
  if (booking.status !== 'completed') throw new ApiError(409, 'NOT_COMPLETED', 'You can review an appointment only after it is completed.')
  const duplicate = () => new ApiError(409, 'ALREADY_REVIEWED', 'You have already reviewed this appointment. You can edit your review instead.')
  if (await Review.exists({ bookingId: booking._id })) throw duplicate()

  let review
  try {
    // salonId, customerId, naam: sab booking aur login se, body se kabhi nahi
    review = await Review.create({ salonId: booking.salonId, bookingId: booking._id, customerId: req.customer._id, customerName: req.customer.name, ...req.valid.body })
  } catch (error) {
    if (isDuplicate(error)) throw duplicate() // do request ek saath aayein to bhi database ek hi review rakhta he
    throw error
  }
  const salon = await Salon.findById(booking.salonId).select('name').lean()
  await recalcSalonRating(review.salonId)
  await notifyReviewSubmitted(review, salon?.name ?? 'the salon')
  sendSuccess(req, res, { review: present(req, review) }, { status: 201 })
})

// PATCH /public/reviews/:id -> customer sirf apna review edit kare
router.patch('/reviews/:id', authenticateCustomer, writeLimit, validate({ params: idParams, body: editBody }), async (req, res) => {
  const review = await ownReview(req)
  Object.assign(review, req.valid.body)
  review.editedAt = new Date()
  await review.save()
  await recalcSalonRating(review.salonId)
  sendSuccess(req, res, { review: present(req, review) })
})

module.exports = router
