// Reviews ka "dekhna" wala hissa: public profile, owner dashboard + reply, customer notifications.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (p) => `/api/v1${p}`
const request = h.request
const { Booking, Customer, Salon } = h.models

before(h.connect)
after(h.disconnect)

const REQUEST_TEXT = 'How was your experience? Share your feedback and help others discover great salons.'

let counter = 0
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

test('public reviews: real summary and breakdown, no private data, only for visible salons', async () => {
  const o = await h.ownerWithSalon('rvv1@x.com', 'rvv-one')
  const hidden = await h.ownerWithSalon('rvv1b@x.com', 'rvv-one-b')
  await Salon.updateOne({ _id: o.salonId }, { $set: { publicBookingEnabled: true } })
  const viewer = await h.customerAgent('9810077720', 'Viewer')
  const ratings = [5, 5, 4, 2]
  const ids = []
  const agents = []
  for (const [i, rating] of ratings.entries()) {
    const phone = `98100777${30 + i}`
    const agent = await h.customerAgent(phone, ['Asha', 'Bela', 'Chitra', 'Dipa'][i])
    agents.push(agent)
    const c = await Customer.findOne({ phone })
    const b = await booking(o.salonId, phone, { status: 'completed', customerId: c._id })
    const made = await review(agent, b.id, { rating, comment: `comment ${i}` })
    ids.push(made.body.data.review.id)
  }
  // seed jaisi nakli rating DB me ho to bhi public summary sirf asli reviews se banti he
  await Salon.updateOne({ _id: o.salonId }, { $set: { 'rating.average': 4.9, 'rating.count': 500 } })

  const url = api(`/public/salons/${o.salonId}/reviews`)
  assert.equal((await request(h.app).get(url)).status, 401)
  assert.equal((await viewer.get(api(`/public/salons/${hidden.salonId}/reviews`))).status, 404) // publish nahi hua

  const res = await viewer.get(url)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.deepEqual(res.body.data.summary, { average: 4, count: 4, breakdown: { 5: 2, 4: 1, 3: 0, 2: 1, 1: 0 } })
  assert.equal(res.body.data.total, 4)
  assert.equal(res.body.data.reviews[0].comment, 'comment 3') // nayi pehle
  assert.equal(res.body.data.reviews[0].isMine, false)
  const text = JSON.stringify(res.body)
  assert.ok(!text.includes('customerPhone') && !text.includes('customerId') && !text.includes('9810077730'))
  assert.equal((await viewer.get(`${url}?page=2&pageSize=3`)).body.data.reviews.length, 1)
  assert.equal((await viewer.get(`${url}?pageSize=500`)).status, 400)

  // jis customer ne review likha, uski apni list me isMine true
  const mine = agents[0]
  assert.equal((await mine.get(url)).body.data.reviews.find((r) => r.id === ids[0]).isMine, true)
})

test('owner sees and replies to only their own salon reviews', async () => {
  const o = await h.ownerWithSalon('rvv2@x.com', 'rvv-two')
  const rival = await h.ownerWithSalon('rvv2b@x.com', 'rvv-two-b')
  const a = await h.customerAgent('9810077740', 'Hema')
  const hema = await Customer.findOne({ phone: '9810077740' })
  const b1 = await booking(o.salonId, '9810077740', { status: 'completed', customerId: hema._id })
  const b2 = await booking(o.salonId, '9810077740', { status: 'completed', customerId: hema._id })
  const mk = async (b, rating) => (await review(a, b.id, { rating, comment: `c${rating}` })).body.data.review.id
  const id1 = await mk(b1, 5)
  await mk(b2, 3)
  const auth = h.bearer(o.token, o.salonId)

  assert.equal((await request(h.app).get(api('/reviews'))).status, 401)
  const list = await request(h.app).get(api('/reviews')).set(auth)
  assert.equal(list.status, 200, JSON.stringify(list.body))
  assert.equal(list.body.data.summary.count, 2)
  assert.deepEqual(list.body.data.reviews.map((r) => r.services), [['Haircut'], ['Haircut']])
  assert.equal((await request(h.app).get(api('/reviews?rating=3')).set(auth)).body.data.reviews.length, 1)

  // dusre salon ka owner: apni list khali, doosre ke review par reply nahi
  const other = h.bearer(rival.token, rival.salonId)
  assert.equal((await request(h.app).get(api('/reviews')).set(other)).body.data.summary.count, 0)
  assert.equal((await request(h.app).put(api(`/reviews/${id1}/reply`)).set(other).send({ text: 'hi' })).status, 404)
  // customer ka token owner API me nahi chalta
  assert.equal((await a.get(api('/reviews'))).status, 401)

  const put = (text) => request(h.app).put(api(`/reviews/${id1}/reply`)).set(auth).send({ text })
  assert.equal((await put('')).status, 400)
  assert.equal((await put('x'.repeat(501))).status, 400)
  assert.equal((await put('Thank you, see you again!')).status, 200)
  assert.equal((await put('Thanks a lot!')).body.data.review.reply.text, 'Thanks a lot!')
  // owner ka jawab public list me review ke neeche dikhta he
  await Salon.updateOne({ _id: o.salonId }, { $set: { publicBookingEnabled: true } })
  const pub = await a.get(api(`/public/salons/${o.salonId}/reviews`))
  assert.equal(pub.body.data.reviews.find((r) => r.id === id1).reply.text, 'Thanks a lot!')

  const del = await request(h.app).delete(api(`/reviews/${id1}/reply`)).set(auth)
  assert.equal(del.status, 200)
  assert.equal(del.body.data.review.reply, null)
})

test('customer notifications: list, backfill, unread/read, review context', async () => {
  const o = await h.ownerWithSalon('rvv3@x.com', 'rvv-three')
  // customer account banne se pehle appointment complete ho chuki
  const b = await booking(o.salonId, '9810077750')
  await setStatus(o, b.id, 'completed')
  const a = await h.customerAgent('9810077750', 'Isha')
  const stranger = await h.customerAgent('9810077751', 'Jaya')

  assert.equal((await request(h.app).get(api('/public/notifications'))).status, 401)
  const first = await a.get(api('/public/notifications'))
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.equal(first.body.data.unreadCount, 1)
  const n = first.body.data.notifications[0]
  assert.equal(n.type, 'review_request')
  assert.equal(n.body, REQUEST_TEXT)
  assert.equal(n.unread, true)
  assert.equal(n.canReview, true)
  assert.equal(n.salonName, 'Salon rvv-three')
  assert.equal(n.bookingId, String(b._id))
  // dobara kholne par duplicate nahi
  assert.equal((await a.get(api('/public/notifications'))).body.data.notifications.length, 1)
  assert.equal((await stranger.get(api('/public/notifications'))).body.data.notifications.length, 0)

  const ctx = await a.get(api(`/public/my-bookings/${b.id}/review`))
  assert.equal(ctx.body.data.canReview, true)
  assert.equal(ctx.body.data.booking.salonName, 'Salon rvv-three')
  assert.deepEqual(ctx.body.data.booking.services, ['Haircut'])
  assert.equal(ctx.body.data.review, null)
  assert.equal((await stranger.get(api(`/public/my-bookings/${b.id}/review`))).status, 404)

  // padhi hui: dusra customer mark nahi kar sakta, apna kar sakta he
  assert.equal((await stranger.post(api(`/public/notifications/${n.id}/read`))).status, 404)
  assert.equal((await a.post(api(`/public/notifications/${n.id}/read`))).status, 200)
  assert.equal((await a.get(api('/public/notifications'))).body.data.unreadCount, 0)

  // review dene ke baad: "Write a review" nahi, thanks wali khabar aati he
  assert.equal((await review(a, b.id, { rating: 5, comment: 'Lovely' })).status, 201)
  const after2 = (await a.get(api('/public/notifications'))).body.data
  assert.equal(after2.unreadCount, 1)
  assert.equal(after2.notifications.find((x) => x.type === 'review_request').canReview, false)
  assert.equal(after2.notifications.find((x) => x.type === 'review_submitted').unread, true)
  const ctxAfter = await a.get(api(`/public/my-bookings/${b.id}/review`))
  assert.equal(ctxAfter.body.data.canReview, false)
  assert.equal(ctxAfter.body.data.review.rating, 5)
  assert.equal((await a.post(api('/public/notifications/read-all'))).status, 200)
  assert.equal((await a.get(api('/public/notifications'))).body.data.unreadCount, 0)
})

test('my-bookings shows canReview only for completed, unreviewed appointments', async () => {
  const o = await h.ownerWithSalon('rvv4@x.com', 'rvv-four')
  const a = await h.customerAgent('9810077760', 'Kiran')
  const kiran = await Customer.findOne({ phone: '9810077760' })
  const done = await booking(o.salonId, '9810077760', { status: 'completed', customerId: kiran._id })
  const open = await booking(o.salonId, '9810077760', { status: 'confirmed', customerId: kiran._id })
  const flags = async () => Object.fromEntries((await a.get(api('/public/my-bookings'))).body.data.bookings.map((x) => [x.id, x.canReview]))
  assert.deepEqual(await flags(), { [String(done._id)]: true, [String(open._id)]: false })
  await review(a, done.id, { rating: 4 })
  assert.deepEqual(await flags(), { [String(done._id)]: false, [String(open._id)]: false })
})
