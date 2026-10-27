const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
const request = h.request

before(h.connect)
after(h.disconnect)

const weeklyHours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [{ start: '10:00', end: '20:00' }]]))
const dayFromNow = (n) => new Date(Date.now() + n * 86400000 + 5.5 * 3600000).toISOString().slice(0, 10)

test('customer sees only own appointments and can cancel an upcoming one (once)', async () => {
  const o = await h.ownerWithSalon('mb1@x.com', 'mb-one')
  await h.models.Salon.updateOne({ _id: o.salonId }, { $set: { publicBookingEnabled: true } })
  await h.models.Branch.updateOne({ salonId: o.salonId }, { $set: { weeklyHours } })
  const cut = (await request(h.app).post(api('/services')).set(h.bearer(o.token, o.salonId)).send({ name: 'Haircut', category: 'Hair', price: 300, durationMin: 30, atSalon: true, atHome: false })).body.data.service

  const date = dayFromNow(3)
  const path = `/public/salons/${o.salonId}`
  const c = await h.customerAgent('9810055501', 'Riya')
  const other = await h.customerAgent('9810055502', 'Other')
  const time = (await c.get(api(`${path}/slots?date=${date}&duration=30`))).body.data.slots.find((s) => s.available).time
  const made = await c.post(api(`${path}/bookings`)).send({ date, startTime: time, serviceIds: [cut.id] })
  assert.equal(made.status, 201, JSON.stringify(made.body))

  assert.equal((await request(h.app).get(api('/public/my-bookings'))).status, 401)
  const mine = await c.get(api('/public/my-bookings'))
  assert.equal(mine.body.data.bookings.length, 1)
  assert.equal(mine.body.data.bookings[0].canCancel, true)
  assert.equal((await other.get(api('/public/my-bookings'))).body.data.bookings.length, 0)

  const id = mine.body.data.bookings[0].id
  assert.equal((await other.post(api(`/public/my-bookings/${id}/cancel`))).status, 404)
  const done = await c.post(api(`/public/my-bookings/${id}/cancel`))
  assert.equal(done.status, 200, JSON.stringify(done.body))
  assert.equal((await c.post(api(`/public/my-bookings/${id}/cancel`))).status, 409)

  const ownerList = await request(h.app).get(api('/bookings')).set(h.bearer(o.token, o.salonId))
  assert.equal(ownerList.body.data.bookings[0].status, 'cancelled')
})

test('customer cannot cancel within 2 hours of the start', async () => {
  const o = await h.ownerWithSalon('mb2@x.com', 'mb-two')
  const c = await h.customerAgent('9810055503', 'Late')
  const customer = await h.models.Customer.findOne({ phone: '9810055503' })
  const today = dayFromNow(0)
  const hhmm = new Date(Date.now() + 5.5 * 3600000 + 30 * 60000).toISOString().slice(11, 16) // ab se 30 min baad (IST)
  const b = await h.models.Booking.create({
    salonId: o.salonId, customerId: customer._id, customerName: 'Late', customerPhone: '9810055503',
    date: today, startTime: hhmm, durationMin: 30, services: [{ name: 'Haircut', price: 300, durationMin: 30 }], total: 300,
  })
  const res = await c.post(api(`/public/my-bookings/${b._id}/cancel`))
  assert.equal(res.status, 409)
  assert.equal(res.body.error.code, 'TOO_LATE_TO_CANCEL')
})
