const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
const request = h.request

before(h.connect)
after(h.disconnect)

function dayFromNow(n) {
  const d = new Date(Date.now() + n * 86400000 + 5.5 * 3600000)
  return d.toISOString().slice(0, 10)
}
const weeklyHours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [{ start: '10:00', end: '20:00' }]]))

async function setup(email, slug) {
  const o = await h.ownerWithSalon(email, slug)
  const auth = h.bearer(o.token, o.salonId)
  await h.models.Branch.updateOne({ salonId: o.salonId }, { $set: { weeklyHours } })
  const cut = (await request(h.app).post(api('/services')).set(auth).send({ name: 'Haircut', category: 'Hair', price: 300, durationMin: 30 })).body.data.service
  const asha = (await request(h.app).post(api('/staff')).set(auth).send({ name: 'Asha', serviceIds: [cut.id] })).body.data.staff
  return { ...o, auth, cut, asha }
}
const body = (o, extra = {}) => ({ customerName: 'Priya Sharma', customerPhone: '9810000001', serviceId: o.cut.id, staffId: o.asha.id, date: dayFromNow(2), startTime: '11:00', note: 'No perfume', ...extra })
const post = (o, b) => request(h.app).post(api('/bookings')).set(o.auth).send(b)

test('salon staff books an appointment: saved as pending with staff and shows in the list', async () => {
  const o = await setup('sb1@x.com', 'sb-one')
  const res = await post(o, body(o))
  assert.equal(res.status, 201, JSON.stringify(res.body))
  assert.equal(res.body.data.booking.status, 'pending')
  assert.equal(res.body.data.booking.staffName, 'Asha')
  assert.equal(res.body.data.booking.total, 300)
  const list = await request(h.app).get(api('/bookings')).set(o.auth)
  assert.equal(list.body.data.bookings.length, 1)
  assert.equal(list.body.data.bookings[0].customerName, 'Priya Sharma')
})

test('same staff cannot be double booked, even for an overlapping time; another staff / time is fine', async () => {
  const o = await setup('sb2@x.com', 'sb-two')
  assert.equal((await post(o, body(o))).status, 201)
  const clash = await post(o, body(o, { customerName: 'Other Person' }))
  assert.equal(clash.status, 409)
  assert.equal(clash.body.error.code, 'SLOT_UNAVAILABLE')
  assert.equal((await post(o, body(o, { startTime: '11:30' }))).status, 201)

  const slots = await request(h.app).get(api(`/bookings/slots?date=${dayFromNow(2)}&serviceId=${o.cut.id}&staffId=${o.asha.id}`)).set(o.auth)
  assert.equal(slots.body.data.slots.find((s) => s.time === '11:00').available, false)
  assert.equal(slots.body.data.slots.find((s) => s.time === '12:00').available, true)
})

test('two simultaneous requests for the same staff and time: only one is saved', async () => {
  const o = await setup('sb3@x.com', 'sb-three')
  const results = await Promise.all([post(o, body(o)), post(o, body(o, { customerName: 'Second One' }))])
  const statuses = results.map((r) => r.status).sort()
  assert.equal(statuses[0], 201)
  assert.notEqual(statuses[1], 201)
  assert.equal(await h.models.Booking.countDocuments({ salonId: o.salonId }), 1)
})

test('validation: missing name, bad phone, past date, bad slot, unknown service', async () => {
  const o = await setup('sb4@x.com', 'sb-four')
  assert.equal((await post(o, body(o, { customerName: '' }))).status, 400)
  assert.equal((await post(o, body(o, { customerPhone: '123' }))).status, 400)
  assert.equal((await post(o, body(o, { date: dayFromNow(-1) }))).status, 400)
  assert.equal((await post(o, body(o, { startTime: '03:00' }))).status, 409)
  assert.equal((await post(o, body(o, { serviceId: '64b000000000000000000001' }))).status, 400)
  assert.equal((await post(o, { ...body(o), salonId: '64b000000000000000000001' })).status, 400) // body se salon nahi chalega
})

test('AT-02: another salon cannot use this salon staff/service and cannot see its bookings', async () => {
  const a = await setup('sb5a@x.com', 'sb-five-a')
  const b = await setup('sb5b@x.com', 'sb-five-b')
  assert.equal((await post(b, body(b, { serviceId: a.cut.id }))).status, 400)
  assert.equal((await post(b, body(b, { staffId: a.asha.id }))).status, 400)
  assert.equal((await post(a, body(a))).status, 201)
  const list = await request(h.app).get(api('/bookings')).set(b.auth)
  assert.equal(list.body.data.bookings.length, 0)
  // b apna token + a ki salon id: 404
  const sneaky = await request(h.app).post(api('/bookings')).set(h.bearer(b.token, a.salonId)).send(body(a))
  assert.equal(sneaky.status, 404)
})
