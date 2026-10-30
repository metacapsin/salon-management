// "Helpful" button: ek customer ek review par ek hi baar, apne review par nahi, sirf dikhne wale salon ke review par.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (p) => `/api/v1${p}`
const request = h.request
const { Booking, Customer, Review, ReviewHelpful, Salon } = h.models

before(h.connect)
after(h.disconnect)

let counter = 0
async function reviewed(salonId, phone, name, rating = 5) {
  counter += 1
  const agent = await h.customerAgent(phone, name)
  const customer = await Customer.findOne({ phone })
  const b = await Booking.create({ salonId, customerId: customer._id, customerName: name, customerPhone: phone, date: '2026-01-10', startTime: `1${counter % 10}:30`, durationMin: 30, services: [{ name: 'Haircut', price: 300, durationMin: 30 }], subtotal: 300, total: 300, status: 'completed' })
  const made = await agent.post(api(`/public/my-bookings/${b.id}/review`)).send({ rating, comment: 'Nice' })
  return { agent, id: made.body.data.review.id }
}

test('helpful: one vote per customer, count comes from real rows, not on own review', async () => {
  const o = await h.ownerWithSalon('hp1@x.com', 'hp-one')
  await Salon.updateOne({ _id: o.salonId }, { $set: { publicBookingEnabled: true } })
  const author = await reviewed(o.salonId, '9810088801', 'Asha')
  const fan = await h.customerAgent('9810088802', 'Bela')
  const other = await h.customerAgent('9810088803', 'Chitra')
  const url = api(`/public/reviews/${author.id}/helpful`)

  assert.equal((await request(h.app).put(url)).status, 401)
  // apne review ko helpful nahi maan sakte
  const own = await author.agent.put(url)
  assert.equal(own.status, 403)
  assert.equal(own.body.error.code, 'OWN_REVIEW')
  // owner ka token customer API me nahi chalta
  assert.equal((await request(h.app).put(url).set(h.bearer(o.token, o.salonId))).status, 401)

  const first = await fan.put(url)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.deepEqual(first.body.data, { helpfulCount: 1, isHelpful: true })
  // dobara dabane par ginti nahi badhti
  assert.equal((await fan.put(url)).body.data.helpfulCount, 1)
  assert.equal((await other.put(url)).body.data.helpfulCount, 2)
  assert.equal(await ReviewHelpful.countDocuments({ reviewId: author.id }), 2)
  assert.equal((await Review.findById(author.id)).helpfulCount, 2)

  // list me count aur "mene helpful maana" dikhta he
  const list = await fan.get(api(`/public/salons/${o.salonId}/reviews`))
  const row = list.body.data.reviews.find((r) => r.id === author.id)
  assert.equal(row.helpfulCount, 2)
  assert.equal(row.isHelpful, true)
  const noVote = await h.customerAgent('9810088804', 'Dipa')
  assert.equal((await noVote.get(api(`/public/salons/${o.salonId}/reviews`))).body.data.reviews[0].isHelpful, false)
  // owner ko bhi ginti dikhti he
  const ownerList = await request(h.app).get(api('/reviews')).set(h.bearer(o.token, o.salonId))
  assert.equal(ownerList.body.data.reviews[0].helpfulCount, 2)

  // hatana
  const del = await fan.delete(url)
  assert.deepEqual(del.body.data, { helpfulCount: 1, isHelpful: false })
  assert.equal((await fan.delete(url)).body.data.helpfulCount, 1) // dobara hatane par kuch nahi bigadta
  assert.equal((await Review.findById(author.id)).helpfulCount, 1)
})

test('helpful: many requests at the same moment still count each customer once', async () => {
  const o = await h.ownerWithSalon('hp2@x.com', 'hp-two')
  await Salon.updateOne({ _id: o.salonId }, { $set: { publicBookingEnabled: true } })
  const author = await reviewed(o.salonId, '9810088811', 'Esha')
  const fan = await h.customerAgent('9810088812', 'Farah')
  const url = api(`/public/reviews/${author.id}/helpful`)
  const results = await Promise.all([fan.put(url), fan.put(url), fan.put(url), fan.put(url)])
  assert.ok(results.every((r) => r.status === 200), JSON.stringify(results.map((r) => r.status)))
  assert.equal(await ReviewHelpful.countDocuments({ reviewId: author.id }), 1)
  assert.equal((await Review.findById(author.id)).helpfulCount, 1)
})

test('helpful: unknown reviews and reviews of hidden salons give 404', async () => {
  const o = await h.ownerWithSalon('hp3@x.com', 'hp-three')
  await Salon.updateOne({ _id: o.salonId }, { $set: { publicBookingEnabled: true } })
  const author = await reviewed(o.salonId, '9810088821', 'Gita')
  const fan = await h.customerAgent('9810088822', 'Hema')
  assert.equal((await fan.put(api('/public/reviews/6ae4296436d5782573c7be9e/helpful'))).status, 404)
  assert.equal((await fan.put(api('/public/reviews/not-an-id/helpful'))).status, 400)
  await Salon.updateOne({ _id: o.salonId }, { $set: { publicBookingEnabled: false } })
  assert.equal((await fan.put(api(`/public/reviews/${author.id}/helpful`))).status, 404)
  assert.equal(await ReviewHelpful.countDocuments({ reviewId: author.id }), 0)
})
