const crypto = require('crypto')
const express = require('express')
const ApiError = require('../../utils/apiError')
const { sendSuccess } = require('../../utils/response')
const { z, email, objectId, pagination } = require('../../utils/schemas')
const { validate, limiter, requireAllowedOrigin } = require('../../middleware/common')
const { INQUIRY_STATUSES } = require('../../config/inquiry')
const { ContactInquiry } = require('../../models')
const { recordAudit } = require('../audit/audit.service')

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// ---------- 1. Public: koi bhi visitor (login ho ya na ho) form bhej sakta hai. Sirf likhna, kabhi padhna nahi ----------
const publicRouter = express.Router()

// Ek IP se 10 minute me 5 sawaal. Spam rokne ke liye (tests me limiter band hota hai).
const submitLimit = limiter({ windowMs: 10 * 60_000, limit: 5 })

const phone = z
  .string()
  .trim()
  .max(20, 'Phone number can be at most 20 characters.')
  .refine((v) => /^\+?[0-9\s()-]+$/.test(v) && v.replace(/\D/g, '').length >= 7 && v.replace(/\D/g, '').length <= 15, 'Enter a valid phone number.')

const submitSchema = z.strictObject({
  name: z.string().trim().min(2, 'Enter your full name.').max(100, 'Name can be at most 100 characters.'),
  email,
  phone,
  message: z.string().trim().min(10, 'Please write a short message (at least 10 characters).').max(2000, 'Message can be at most 2000 characters.'),
  // Honeypot: insaan ko ye khaana dikhta nahi. Bot bhar de to hum chupchap "ho gaya" bolkar kuch save nahi karte.
  website: z.string().max(200).optional(),
})

const DUPLICATE_WINDOW_MS = 24 * 60 * 60 * 1000

publicRouter.post('/', requireAllowedOrigin, submitLimit, validate({ body: submitSchema }), async (req, res) => {
  const { website, ...data } = req.valid.body

  if (!website) {
    // Same email + message 24 ghante me dobara aaye (double-click / refresh) to naya record nahi banta.
    const contentHash = crypto.createHash('sha256').update(`${data.email}|${data.message.toLowerCase()}`).digest('hex')
    const duplicate = await ContactInquiry.exists({ contentHash, createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) } })
    if (!duplicate) await ContactInquiry.create({ ...data, contentHash })
  }

  // Sab case me ek jaisa jawab: bot ko ya duplicate bhejne wale ko andar ki baat pata nahi chalti. Id bhi wapas nahi jaati.
  sendSuccess(req, res, { received: true }, { status: 201 })
})

// ---------- 2. Admin: sirf Super Admin. platform.routes.js isse /contact-inquiries par jodta hai, jahan authenticate + requirePlatformAdmin pehle se laga hai ----------
const adminRouter = express.Router()

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date format YYYY-MM-DD.')

// Din ki seema India ke samay (IST) me: "2026-10-24" = us din 00:00 se 23:59 IST
const startOfDay = (d) => new Date(`${d}T00:00:00.000+05:30`)
const endOfDay = (d) => new Date(`${d}T23:59:59.999+05:30`)

function listRow(i) {
  return {
    id: i._id,
    name: i.name,
    email: i.email,
    phone: i.phone,
    messagePreview: i.message.length > 140 ? `${i.message.slice(0, 140)}…` : i.message,
    status: i.status,
    createdAt: i.createdAt,
  }
}

function detail(i) {
  return {
    ...listRow(i),
    message: i.message,
    updatedAt: i.updatedAt,
    notes: (i.adminNotes ?? []).map((n) => ({ id: n._id, text: n.text, authorName: n.authorName, createdAt: n.createdAt })),
  }
}

async function loadInquiry(id) {
  const inquiry = await ContactInquiry.findById(id)
  if (!inquiry) throw new ApiError(404, 'NOT_FOUND', 'Inquiry not found.')
  return inquiry
}

adminRouter.get(
  '/',
  validate({
    query: pagination.extend({
      q: z.string().trim().max(100).optional(),
      status: z.enum(INQUIRY_STATUSES).optional(),
      from: day.optional(),
      to: day.optional(),
    }),
  }),
  async (req, res) => {
    const { page, pageSize, q, status, from, to } = req.valid.query
    const filter = {}
    if (status) filter.status = status
    if (from || to) {
      filter.createdAt = {}
      if (from) filter.createdAt.$gte = startOfDay(from)
      if (to) filter.createdAt.$lte = endOfDay(to)
    }
    if (q) {
      const rx = new RegExp(escapeRegex(q), 'i')
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { message: rx }]
    }

    const [rows, total, grouped] = await Promise.all([
      ContactInquiry.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      ContactInquiry.countDocuments(filter),
      ContactInquiry.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
    ])
    // Upar ke cards: filter se alag, poore database ki ginti
    const counts = { total: 0, new: 0, in_progress: 0, resolved: 0, closed: 0 }
    for (const g of grouped) {
      counts[g._id] = g.n
      counts.total += g.n
    }
    sendSuccess(req, res, { inquiries: rows.map(listRow), counts }, { meta: { page, pageSize, total } })
  },
)

adminRouter.get('/:id', validate({ params: z.object({ id: objectId }) }), async (req, res) => {
  sendSuccess(req, res, { inquiry: detail(await loadInquiry(req.valid.params.id)) })
})

adminRouter.patch(
  '/:id',
  validate({ params: z.object({ id: objectId }), body: z.strictObject({ status: z.enum(INQUIRY_STATUSES) }) }),
  async (req, res) => {
    const inquiry = await loadInquiry(req.valid.params.id)
    const { status } = req.valid.body
    const before = inquiry.status
    if (before !== status) {
      inquiry.status = status
      inquiry.handledBy = req.user._id
      await inquiry.save()
      await recordAudit(req, { action: 'platform.inquiry_status_changed', entityType: 'contact_inquiry', entityId: inquiry._id, changes: { before, after: status } })
    }
    sendSuccess(req, res, { inquiry: detail(inquiry) })
  },
)

const MAX_NOTES = 100

adminRouter.post(
  '/:id/notes',
  validate({ params: z.object({ id: objectId }), body: z.strictObject({ text: z.string().trim().min(1, 'Write a note first.').max(1000, 'A note can be at most 1000 characters.') }) }),
  async (req, res) => {
    const inquiry = await loadInquiry(req.valid.params.id)
    if (inquiry.adminNotes.length >= MAX_NOTES) throw new ApiError(409, 'CONFLICT', 'This inquiry already has the maximum number of notes.')
    inquiry.adminNotes.push({ text: req.valid.body.text, authorId: req.user._id, authorName: req.user.name })
    await inquiry.save()
    await recordAudit(req, { action: 'platform.inquiry_note_added', entityType: 'contact_inquiry', entityId: inquiry._id })
    sendSuccess(req, res, { inquiry: detail(inquiry) }, { status: 201 })
  },
)

module.exports = { publicRouter, adminRouter }
