// Owner/manager/receptionist ke liye: salon ke apne customers ki list. Alag table nahi hai,
// bookings se hi nikalte hain (phone number se group karke).
const express = require('express')
const { sendSuccess } = require('../../utils/response')
const { z } = require('../../utils/schemas')
const { validate } = require('../../middleware/common')
const { authenticate, requireSalon, can } = require('../../middleware/auth')
const { Booking } = require('../../models')

const router = express.Router()
router.use(authenticate, requireSalon)

const INACTIVE_AFTER_DAYS = 30

// India time me aaj se n din pehle ki date (YYYY-MM-DD)
function daysAgo(n) {
  return new Date(Date.now() - n * 86400000 + 5.5 * 3600000).toISOString().slice(0, 10)
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const listQuery = z.object({
  search: z.string().trim().max(50).optional(),
  segment: z.enum(['new', 'regular', 'inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

// Cancelled booking se koi customer nahi banta aur na hi uska visit gina jaata hai.
// new = 1 booking, regular = 2+ bookings, inactive = last booking 30+ din purani (inactive sabse pehle dekha jaata hai)
function groupStages(cutoff) {
  return [
    { $match: { status: { $ne: 'cancelled' } } },
    { $sort: { date: 1, startTime: 1 } },
    {
      $group: {
        _id: '$customerPhone',
        name: { $last: '$customerName' },
        bookings: { $sum: 1 },
        visits: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        spent: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, '$total', 0] } },
        lastBookingDate: { $max: '$date' },
        lastVisit: { $max: { $cond: [{ $eq: ['$status', 'completed'] }, '$date', null] } },
      },
    },
    {
      $addFields: {
        segment: {
          $cond: [
            { $lt: ['$lastBookingDate', cutoff] },
            'inactive',
            { $cond: [{ $gte: ['$bookings', 2] }, 'regular', 'new'] },
          ],
        },
      },
    },
  ]
}

router.get('/', can('customers.read'), validate({ query: listQuery }), async (req, res) => {
  const { search, segment, page, pageSize } = req.valid.query
  const salonId = req.salon._id
  const cutoff = daysAgo(INACTIVE_AFTER_DAYS)
  const base = [{ $match: { salonId } }, ...groupStages(cutoff)]

  const filters = []
  if (segment) filters.push({ segment })
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i')
    filters.push({ $or: [{ name: rx }, { _id: rx }] })
  }
  const match = filters.length ? [{ $match: { $and: filters } }] : []

  const [result, summary] = await Promise.all([
    Booking.aggregate([
      ...base,
      ...match,
      {
        $facet: {
          rows: [{ $sort: { lastBookingDate: -1, _id: 1 } }, { $skip: (page - 1) * pageSize }, { $limit: pageSize }],
          count: [{ $count: 'n' }],
        },
      },
    ]),
    // Upar ke cards: search/filter se alag, poore salon ka hisaab
    Booking.aggregate([
      ...base,
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          regular: { $sum: { $cond: [{ $eq: ['$segment', 'regular'] }, 1, 0] } },
          inactive: { $sum: { $cond: [{ $eq: ['$segment', 'inactive'] }, 1, 0] } },
        },
      },
    ]),
  ])

  // "Is mahine ke naye customers": jinki pehli booking is mahine mein hui
  const monthStart = `${daysAgo(0).slice(0, 7)}-01`
  const firstSeen = await Booking.aggregate([
    { $match: { salonId, status: { $ne: 'cancelled' } } },
    { $group: { _id: '$customerPhone', first: { $min: '$date' } } },
    { $match: { first: { $gte: monthStart } } },
    { $count: 'n' },
  ])

  const rows = result[0].rows.map((r) => ({
    phone: r._id,
    name: r.name,
    bookings: r.bookings,
    visits: r.visits,
    spent: r.spent,
    lastVisit: r.lastVisit,
    lastBookingDate: r.lastBookingDate,
    segment: r.segment,
  }))
  const s = summary[0] ?? { total: 0, regular: 0, inactive: 0 }
  sendSuccess(
    req,
    res,
    {
      customers: rows,
      summary: { total: s.total, newThisMonth: firstSeen[0]?.n ?? 0, regular: s.regular, inactive: s.inactive },
    },
    { meta: { page, pageSize, total: result[0].count[0]?.n ?? 0 } },
  )
})

module.exports = router
