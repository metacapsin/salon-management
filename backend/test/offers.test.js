const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`

before(h.connect)
after(h.disconnect)

const offer = { title: 'Diwali special', discountType: 'percent', discountValue: 20, startsOn: '2026-11-01', endsOn: '2026-11-15' }

test('owner creates, lists, edits and switches off an offer', async () => {
  const o = await h.ownerWithSalon('off1@x.com', 'off-one')
  const auth = h.bearer(o.token, o.salonId)

  const created = await h.request(h.app).post(api('/offers')).set(auth).send(offer)
  assert.equal(created.status, 201, JSON.stringify(created.body))
  assert.equal(created.body.data.offer.active, true)
  const id = created.body.data.offer.id

  const patched = await h.request(h.app).patch(api(`/offers/${id}`)).set(auth).send({ discountValue: 30 })
  assert.equal(patched.status, 200)
  assert.equal(patched.body.data.offer.discountValue, 30)

  const off = await h.request(h.app).patch(api(`/offers/${id}`)).set(auth).send({ active: false })
  assert.equal(off.body.data.offer.active, false)

  const list = await h.request(h.app).get(api('/offers')).set(auth)
  assert.equal(list.body.data.offers.length, 1)
})

test('validation: percent over 100, end before start, unknown service', async () => {
  const o = await h.ownerWithSalon('off2@x.com', 'off-two')
  const auth = h.bearer(o.token, o.salonId)
  const post = (body) => h.request(h.app).post(api('/offers')).set(auth).send(body)

  assert.equal((await post({ ...offer, discountValue: 150 })).status, 400)
  assert.equal((await post({ ...offer, endsOn: '2026-10-01' })).status, 400)
  assert.equal((await post({ ...offer, serviceIds: ['64b000000000000000000000'] })).status, 400)
  assert.equal((await post({ ...offer, discountType: 'flat', discountValue: 150 })).status, 201)
})

test('customer sees only offers that are on and running today', async () => {
  const o = await h.ownerWithSalon('off4@x.com', 'off-four')
  await h.models.Salon.updateOne({ _id: o.salonId }, { $set: { publicBookingEnabled: true } })
  const auth = h.bearer(o.token, o.salonId)
  const post = (body) => h.request(h.app).post(api('/offers')).set(auth).send({ ...offer, ...body })
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const shift = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

  await post({ title: 'Running', startsOn: shift(-1), endsOn: shift(5) })
  await post({ title: 'Expired', startsOn: shift(-10), endsOn: shift(-2) })
  await post({ title: 'Upcoming', startsOn: shift(3), endsOn: shift(9) })
  const off = (await post({ title: 'Switched off', startsOn: shift(-1), endsOn: shift(5) })).body.data.offer
  await h.request(h.app).patch(api(`/offers/${off.id}`)).set(auth).send({ active: false })

  const c = await h.customerAgent('9810099999', 'Offer Viewer')
  const res = await c.get(api(`/public/salons/${o.salonId}`))
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.deepEqual(res.body.data.salon.offers.map((x) => x.title), ['Running'])
})

test("one salon cannot touch another salon's offer", async () => {
  const a = await h.ownerWithSalon('off3a@x.com', 'off-three-a')
  const b = await h.ownerWithSalon('off3b@x.com', 'off-three-b')
  const { body } = await h.request(h.app).post(api('/offers')).set(h.bearer(a.token, a.salonId)).send(offer)

  const res = await h.request(h.app).patch(api(`/offers/${body.data.offer.id}`)).set(h.bearer(b.token, b.salonId)).send({ active: false })
  assert.equal(res.status, 404)
  assert.equal((await h.request(h.app).get(api('/offers')).set(h.bearer(b.token, b.salonId))).body.data.offers.length, 0)
})

test('booking with an offer: server works out the discount, once-per-customer is enforced', async () => {
  const o = await h.ownerWithSalon('off5@x.com', 'off-five')
  await h.models.Salon.updateOne({ _id: o.salonId }, { $set: { publicBookingEnabled: true } })
  const hours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [{ start: '10:00', end: '20:00' }]]))
  await h.models.Branch.updateOne({ salonId: o.salonId }, { $set: { weeklyHours: hours } })
  const auth = h.bearer(o.token, o.salonId)
  const svc = (b) => h.request(h.app).post(api('/services')).set(auth).send(b)
  const cut = (await svc({ name: 'Haircut', category: 'Hair', price: 300, durationMin: 30, atSalon: true, atHome: false })).body.data.service
  const facial = (await svc({ name: 'Facial', category: 'Skin', price: 700, durationMin: 30, atSalon: true, atHome: false })).body.data.service

  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const shift = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
  const mk = (b) => h.request(h.app).post(api('/offers')).set(auth).send({ ...offer, startsOn: shift(-1), endsOn: shift(10), ...b })
  const pct = (await mk({ title: '20 off haircut', serviceIds: [cut.id], oncePerCustomer: true })).body.data.offer
  const flat = (await mk({ title: 'Huge flat', discountType: 'flat', discountValue: 5000 })).body.data.offer

  const c = await h.customerAgent('9810088888', 'Deal Hunter')
  const date = shift(3)
  const book = (time, body) => c.post(api(`/public/salons/${o.salonId}/bookings`)).send({ date, startTime: time, ...body })

  const first = await book('10:00', { serviceIds: [cut.id, facial.id], offerId: pct.id })
  assert.equal(first.status, 201, JSON.stringify(first.body))
  assert.equal(first.body.data.booking.total, 940) // 1000 - 20% of haircut only (60)

  const again = await book('12:00', { serviceIds: [cut.id], offerId: pct.id })
  assert.equal(again.status, 400)
  assert.equal(again.body.error.code, 'OFFER_INVALID')

  const capped = await book('14:00', { serviceIds: [cut.id], offerId: flat.id })
  assert.equal(capped.body.data.booking.total, 0) // flat discount never goes below zero

  const notApplicable = await book('16:00', { serviceIds: [facial.id], offerId: pct.id })
  assert.equal(notApplicable.status, 400)

  const list = await h.request(h.app).get(api('/bookings')).set(auth)
  const withOffer = list.body.data.bookings.find((x) => x.total === 940)
  assert.equal(withOffer.offer.discount, 60)
})

test('explore list carries an offer badge for salons that have a running offer', async () => {
  const o = await h.ownerWithSalon('off6@x.com', 'off-six')
  await h.models.Salon.updateOne({ _id: o.salonId }, { $set: { publicBookingEnabled: true, 'address.city': 'Delhi', 'address.cityKey': require('../src/utils/placeKey').placeKey('Delhi') } })
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  await h.request(h.app).post(api('/offers')).set(h.bearer(o.token, o.salonId)).send({ ...offer, title: 'Badge offer', startsOn: today, endsOn: today })

  const c = await h.customerAgent('9810077777', 'Browser')
  const res = await c.get(api('/public/salons?city=Delhi'))
  const mine = res.body.data.salons.find((s) => String(s.id) === String(o.salonId))
  assert.equal(mine.offer.text, '20% OFF')
  assert.equal(mine.offer.title, 'Badge offer')
})
