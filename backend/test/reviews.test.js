const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')
const { ensureReviewRequests } = require('../src/modules/reviews/reviews.service')

const api = (p) => `/api/v1${p}`
const request = h.request
const { Booking, Review, CustomerNotification, Notification, Customer, Salon } = h.models

before(h.connect)
after(h.disconnect)

const REQUEST_TEXT = 'How was your experience? Share your feedback and help others discover great salons.'
const jpeg = (n) => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, n)])

let counter = 0
// Booking seedhi DB me (status turant), taaki har test ko slots/services ka setup na karna pade
async function booking(salonId, phone, { status = 'confirmed', customerId = null } = {}) {
  counter += 1
  return Booking.create({
    salonId,
    customerId,
    customerName: 'Guest',
    customerPhone: phone,
    date: '2026-01-10',
    startTime: `1${counter % 10}:00`,
    durationMin: 30,
    services: [{ name: 'Haircut', price: 300, durationMin: 30 }],
    subtotal: 300,
    total: 300,
    status,
  })
}
const setStatus = (o, id, status) => request(h.app).patch(api(`/bookings/${id}/status`)).set(h.bearer(o.token, o.salonId)).send({ status })
const review = (agent, id, body) => agent.post(api(`/public/my-bookings/${id}/review`)).send(body)

test('review request goes out only when a real appointment is marked Completed, and only once', async () => {
  const o = await h.ownerWithSalon('rv1@x.com', 'rv-one')
  const agent = await h.customerAgent('9810066601', 'Riya')
  const riya = await Customer.findOne({ phone: '9810066601' })

  // customer ki apni booking (customerId) aur salon staff ki booking (sirf phone): dono ko request milti he
  const own = await booking(o.salonId, '9810066601', { customerId: riya._id })
  const walkIn = await booking(o.salonId, '9810066601')
  const cancelled = await booking(o.salonId, '9810066601')
  const pending = await booking(o.salonId, '9810066601', { status: 'pending' })

  assert.equal((await setStatus(o, own.id, 'completed')).status, 200)
  assert.equal((await setStatus(o, walkIn.id, 'completed')).status, 200)
  assert.equal((await setStatus(o, cancelled.id, 'cancelled')).status, 200)
  // pending se seedha completed nahi ho sakta, to koi request nahi
  assert.equal((await setStatus(o, pending.id, 'completed')).status, 409)

  const rows = await CustomerNotification.find({ customerId: riya._id, type: 'review_request' }).lean()
  assert.deepEqual(rows.map((r) => String(r.bookingId)).sort(), [String(own._id), String(walkIn._id)].sort())
  assert.equal(rows[0].body, REQUEST_TEXT)
  assert.equal(rows[0].readAt, null)
  assert.equal(String(rows[0].salonId), String(o.salonId))

  // dobara completed karna mumkin nahi, aur dobara chalane par bhi duplicate nahi banta
  assert.equal((await setStatus(o, own.id, 'completed')).status, 409)
  assert.equal(await ensureReviewRequests(riya), 0)
  assert.equal(await CustomerNotification.countDocuments({ customerId: riya._id, type: 'review_request' }), 2)
  void agent
})

test('a request is not sent if the review already exists; unregistered phone gets it after first login', async () => {
  const o = await h.ownerWithSalon('rv2@x.com', 'rv-two')
  // is phone ka abhi koi customer account nahi: request nahi ban sakti
  const b = await booking(o.salonId, '9810066602')
  assert.equal((await setStatus(o, b.id, 'completed')).status, 200)
  assert.equal(await CustomerNotification.countDocuments({ bookingId: b._id }), 0)

  const agent = await h.customerAgent('9810066602', 'Neha')
  const neha = await Customer.findOne({ phone: '9810066602' })
  assert.equal(await ensureReviewRequests(neha), 1)
  assert.equal(await ensureReviewRequests(neha), 0)

  // review de diya to us booking ki request kabhi nahi banti
  const done = await booking(o.salonId, '9810066602', { status: 'completed' })
  assert.equal((await review(agent, done.id, { rating: 5 })).status, 201)
  await CustomerNotification.deleteMany({ bookingId: done._id })
  assert.equal(await ensureReviewRequests(neha), 0)
  assert.equal(await CustomerNotification.countDocuments({ bookingId: done._id, type: 'review_request' }), 0)
})

test('only the customer of a completed appointment can review it, once, with a valid rating', async () => {
  const o = await h.ownerWithSalon('rv3@x.com', 'rv-three')
  const agent = await h.customerAgent('9810066603', 'Anjali')
  const stranger = await h.customerAgent('9810066604', 'Stranger')
  const anjali = await Customer.findOne({ phone: '9810066603' })

  const done = await booking(o.salonId, '9810066603', { status: 'completed', customerId: anjali._id })
  const pending = await booking(o.salonId, '9810066603', { status: 'pending', customerId: anjali._id })
  const confirmed = await booking(o.salonId, '9810066603', { status: 'confirmed', customerId: anjali._id })
  const cancelled = await booking(o.salonId, '9810066603', { status: 'cancelled', customerId: anjali._id })

  assert.equal((await request(h.app).post(api(`/public/my-bookings/${done.id}/review`)).send({ rating: 5 })).status, 401)
  for (const b of [pending, confirmed, cancelled]) {
    const r = await review(agent, b.id, { rating: 5 })
    assert.equal(r.status, 409)
    assert.equal(r.body.error.code, 'NOT_COMPLETED')
  }
  // dusre customer ke liye wo appointment hi exist nahi karti
  assert.equal((await review(stranger, done.id, { rating: 5 })).status, 404)
  assert.equal((await review(agent, '6ae4296436d5782573c7be9e', { rating: 5 })).status, 404)

  for (const bad of [{ rating: 0 }, { rating: 6 }, { rating: 2.5 }, { rating: '5' }, {}, { rating: 5, comment: 'x'.repeat(1001) }]) {
    assert.equal((await review(agent, done.id, bad)).status, 400, JSON.stringify(bad).slice(0, 40))
  }
  // fake data body se nahi ghus sakta
  const forged = await review(agent, done.id, { rating: 5, salonId: '6ae4296436d5782573c7be9e', customerName: 'Hacker' })
  assert.equal(forged.status, 400)
  assert.equal(await Review.countDocuments({ salonId: o.salonId }), 0)

  const ok = await review(agent, done.id, { rating: 4, comment: '  Lovely haircut  ' })
  assert.equal(ok.status, 201, JSON.stringify(ok.body))
  assert.equal(ok.body.data.review.comment, 'Lovely haircut')
  assert.equal(ok.body.data.review.customerName, 'Anjali')
  const saved = await Review.findOne({ bookingId: done._id })
  assert.equal(String(saved.salonId), String(o.salonId))
  assert.equal(String(saved.customerId), String(anjali._id))

  const again = await review(agent, done.id, { rating: 1 })
  assert.equal(again.status, 409)
  assert.equal(again.body.error.code, 'ALREADY_REVIEWED')
  assert.equal(await Review.countDocuments({ bookingId: done._id }), 1)
})

test('two review requests at the same moment still save exactly one review', async () => {
  const o = await h.ownerWithSalon('rv4@x.com', 'rv-four')
  const agent = await h.customerAgent('9810066605', 'Kavita')
  const kavita = await Customer.findOne({ phone: '9810066605' })
  const done = await booking(o.salonId, '9810066605', { status: 'completed', customerId: kavita._id })
  const results = await Promise.all([review(agent, done.id, { rating: 5 }), review(agent, done.id, { rating: 3 }), review(agent, done.id, { rating: 1 })])
  assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409])
  assert.equal(await Review.countDocuments({ bookingId: done._id }), 1)
  assert.equal((await Salon.findById(o.salonId)).rating.count, 1)
})

test('submitting updates the salon rating from real reviews and sends notifications', async () => {
  const o = await h.ownerWithSalon('rv5@x.com', 'rv-five')
  const other = await h.ownerWithSalon('rv5b@x.com', 'rv-five-b')
  const a = await h.customerAgent('9810066606', 'Aarti')
  const b = await h.customerAgent('9810066607', 'Bina')
  const aarti = await Customer.findOne({ phone: '9810066606' })
  const bina = await Customer.findOne({ phone: '9810066607' })

  assert.equal((await Salon.findById(o.salonId)).rating.count, 0)
  const b1 = await booking(o.salonId, '9810066606', { status: 'completed', customerId: aarti._id })
  const b2 = await booking(o.salonId, '9810066607', { status: 'completed', customerId: bina._id })
  const elsewhere = await booking(other.salonId, '9810066606', { status: 'completed', customerId: aarti._id })

  await review(a, b1.id, { rating: 5, comment: 'Great' })
  await review(b, b2.id, { rating: 2 })
  await review(a, elsewhere.id, { rating: 1 })

  const salon = await Salon.findById(o.salonId)
  assert.equal(salon.rating.count, 2)
  assert.equal(salon.rating.average, 3.5)
  // dusre salon ka review is salon ki rating nahi badalta (tenant isolation)
  const salonB = await Salon.findById(other.salonId)
  assert.equal(salonB.rating.count, 1)
  assert.equal(salonB.rating.average, 1)

  const thanks = await CustomerNotification.findOne({ customerId: aarti._id, bookingId: b1._id, type: 'review_submitted' })
  assert.match(thanks.title, /Thanks for your review/)
  assert.equal(thanks.readAt, null)
  const ownerNote = await Notification.find({ salonId: o.salonId, type: 'review_received' }).sort({ createdAt: 1 }).lean()
  assert.equal(ownerNote.length, 2)
  assert.match(ownerNote[0].body, /Aarti/)
  assert.match(ownerNote[0].title, /5-star/)
  assert.equal(await Notification.countDocuments({ salonId: other.salonId, type: 'review_received' }), 1)
})

test('customer can edit only their own review; rating is recalculated', async () => {
  const o = await h.ownerWithSalon('rv6@x.com', 'rv-six')
  const a = await h.customerAgent('9810066608', 'Disha')
  const stranger = await h.customerAgent('9810066609', 'Eve')
  const disha = await Customer.findOne({ phone: '9810066608' })
  const done = await booking(o.salonId, '9810066608', { status: 'completed', customerId: disha._id })
  const made = await review(a, done.id, { rating: 5, comment: 'Nice' })
  const id = made.body.data.review.id
  const patch = (agent, body) => agent.patch(api(`/public/reviews/${id}`)).send(body)

  assert.equal((await request(h.app).patch(api(`/public/reviews/${id}`)).send({ rating: 1 })).status, 401)
  assert.equal((await patch(stranger, { rating: 1 })).status, 404)
  assert.equal((await patch(a, {})).status, 400)
  assert.equal((await patch(a, { rating: 9 })).status, 400)
  assert.equal((await patch(a, { rating: 4, salonId: o.salonId })).status, 400)
  // salon ka owner bhi customer ke review ko is route se nahi badal sakta (customer token chahiye)
  assert.equal((await request(h.app).patch(api(`/public/reviews/${id}`)).set(h.bearer(o.token, o.salonId)).send({ rating: 1 })).status, 401)
  assert.equal((await Review.findById(id)).rating, 5)

  const edited = await patch(a, { rating: 3, comment: 'Okay, slightly rushed' })
  assert.equal(edited.status, 200)
  assert.equal(edited.body.data.review.rating, 3)
  assert.ok(edited.body.data.review.editedAt)
  assert.equal((await Salon.findById(o.salonId)).rating.average, 3)
  assert.equal(await Review.countDocuments({ bookingId: done._id }), 1)
})

test('review photos are gone: no upload route and no images in the response', async () => {
  const o = await h.ownerWithSalon('rv7@x.com', 'rv-seven')
  const a = await h.customerAgent('9810066610', 'Farah')
  const farah = await Customer.findOne({ phone: '9810066610' })
  const done = await booking(o.salonId, '9810066610', { status: 'completed', customerId: farah._id })
  const created = await review(a, done.id, { rating: 5, comment: 'Lovely' })
  assert.equal(created.status, 201)
  assert.equal('images' in created.body.data.review, false)

  const url = api(`/public/reviews/${created.body.data.review.id}/images`)
  assert.equal((await a.post(url).set('Content-Type', 'image/jpeg').send(jpeg(1))).status, 404)
  assert.equal((await a.delete(url).send({ url: '/uploads/reviews/x/nope.jpg' })).status, 404)
})
