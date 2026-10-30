// Reviews ka saara common logic: kaun review de sakta hai, review request, salon ki rating dobara nikalna.
const { Booking, Customer, Review, CustomerNotification, Notification, Salon } = require('../../models')

const REVIEW_REQUEST_TEXT = 'How was your experience? Share your feedback and help others discover great salons.'

// Booking customer ke account se bani ho to customerId hota he; salon staff ki banayi booking me sirf phone (10 digit).
// Customer OTP se usi phone par login karta he, isliye phone match bhi pakka saboot he.
const ownsBooking = (booking, customer) => (booking.customerId ? String(booking.customerId) === String(customer._id) : booking.customerPhone === customer.phone)

// Is customer ki wo completed bookings jinka review ho sakta he (customerId se ya, customerId khali ho to phone se)
const reviewableFilter = (customer) => ({
  status: 'completed',
  $or: [{ customerId: customer._id }, { customerId: null, customerPhone: customer.phone }],
})

const isDuplicate = (error) => error?.code === 11000

// Khabar bana do; wahi khabar pehle se ho to chupchap chhod do (unique index bookingId + type)
async function notifyCustomerOnce(data) {
  try {
    return await CustomerNotification.create(data)
  } catch (error) {
    if (isDuplicate(error)) return null
    throw error
  }
}

// Booking Completed hote hi customer ko review request. Sirf completed booking ke liye, aur review pehle se ho to nahi.
async function requestReview(booking) {
  if (booking.status !== 'completed') return null
  const customer = booking.customerId ? await Customer.findById(booking.customerId) : await Customer.findOne({ phone: booking.customerPhone })
  if (!customer) return null // customer ne abhi tak login hi nahi kiya; login par ensureReviewRequests se mil jayegi
  if (await Review.exists({ bookingId: booking._id })) return null
  const salon = await Salon.findById(booking.salonId).select('name').lean()
  return notifyCustomerOnce({
    customerId: customer._id,
    salonId: booking.salonId,
    bookingId: booking._id,
    type: 'review_request',
    title: `Rate your visit to ${salon?.name ?? 'the salon'}`,
    body: REVIEW_REQUEST_TEXT,
  })
}

// Jis customer ki completed booking salon staff ne banayi thi (customer tab tak registered nahi tha), uski request
// customer ke aane par yahan se ban jati he. Review ya request wali booking dobara nahi aati.
async function ensureReviewRequests(customer) {
  const bookings = await Booking.find(reviewableFilter(customer)).sort({ date: -1 }).limit(50)
  if (bookings.length === 0) return 0
  const ids = bookings.map((b) => b._id)
  const [reviewed, requested] = await Promise.all([Review.distinct('bookingId', { bookingId: { $in: ids } }), CustomerNotification.distinct('bookingId', { bookingId: { $in: ids }, type: 'review_request' })])
  const skip = new Set([...reviewed, ...requested].map(String))
  let made = 0
  for (const booking of bookings.filter((b) => !skip.has(String(b._id)))) {
    if (await requestReview(booking)) made += 1
  }
  return made
}

// Salon ki rating hamesha asli reviews se: average (1 decimal), total aur 5..1 star ki ginti. salonId ObjectId hona chahiye.
async function ratingSummary(salonId) {
  const rows = await Review.aggregate([{ $match: { salonId } }, { $group: { _id: '$rating', n: { $sum: 1 } } }])
  const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 }
  let count = 0
  let sum = 0
  for (const row of rows) {
    breakdown[row._id] = row.n
    count += row.n
    sum += row._id * row.n
  }
  return { average: count ? Math.round((sum / count) * 10) / 10 : 0, count, breakdown }
}

// Salon par dikhne wali rating (cards, filters) ko asli reviews ke saath sync rakhta he
async function recalcSalonRating(salonId) {
  const { average, count } = await ratingSummary(salonId)
  await Salon.updateOne({ _id: salonId }, { $set: { 'rating.average': average, 'rating.count': count } })
}

const presentReview = (req, review) => ({
  id: review._id,
  salonId: review.salonId,
  bookingId: review.bookingId,
  customerName: review.customerName,
  rating: review.rating,
  comment: review.comment,
  createdAt: review.createdAt,
  editedAt: review.editedAt,
  helpfulCount: review.helpfulCount ?? 0,
  reply: review.reply ? { text: review.reply.text, repliedAt: review.reply.repliedAt } : null,
})

// Review submit hone par: customer ko confirmation, owner/manager ko nayi review ki khabar
async function notifyReviewSubmitted(review, salonName) {
  await notifyCustomerOnce({
    customerId: review.customerId,
    salonId: review.salonId,
    bookingId: review.bookingId,
    type: 'review_submitted',
    title: 'Thanks for your review',
    body: `Your ${review.rating}-star review for ${salonName} is now live and helps others discover great salons.`,
  })
  const snippet = review.comment ? `: "${review.comment.slice(0, 120)}"` : '.'
  await Notification.create({
    salonId: review.salonId,
    type: 'review_received',
    title: `New ${review.rating}-star review`,
    body: `${review.customerName} reviewed your salon${snippet}`,
  })
}

module.exports = { REVIEW_REQUEST_TEXT, ownsBooking, reviewableFilter, requestReview, ensureReviewRequests, ratingSummary, recalcSalonRating, presentReview, notifyReviewSubmitted, isDuplicate }
