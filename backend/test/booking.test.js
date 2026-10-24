const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')
const { buildSlots } = require('../src/modules/bookings/slots')

const api = (path) => `/api/v1${path}`
const request = h.request

before(h.connect)
after(h.disconnect)

// Aaj se n din baad ki date (YYYY-MM-DD, India time)
function dayFromNow(n) {
  const d = new Date(Date.now() + n * 86400000 + 5.5 * 3600000)
  return d.toISOString().slice(0, 10)
}

const weeklyHours = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [{ start: '10:00', end: '20:00' }]]))

async function openSalon(email, slug) {
  const o = await h.ownerWithSalon(email, slug)
  await h.models.Salon.updateOne({ _id: o.salonId }, { $set: { publicBookingEnabled: true } })
  await h.models.Branch.updateOne({ salonId: o.salonId }, { $set: { weeklyHours } })
  const svc = (body) => request(h.app).post(api('/services')).set(h.bearer(o.token, o.salonId)).send(body)
  const cut = (await svc({ name: 'Haircut', category: 'Hair', price: 300, durationMin: 30, atSalon: true, atHome: false })).body.data.service
  const mehendi = (await svc({ name: 'Mehendi', category: 'Bridal', price: 900, durationMin: 60, atSalon: true, atHome: true })).body.data.service
  return { ...o, cut, mehendi }
}

test('slots: opening hours, 30 minute steps, a fully booked time is unavailable, past times today are closed', () => {
  const branch = { weeklyHours: { mon: [{ start: '10:00', end: '12:00' }] }, holidays: [] }
  // 2026-10-19 Monday
  const base = { date: '2026-10-19', durationMin: 60, branch, timeZone: 'Asia/Kolkata', now: new Date('2026-10-01T00:00:00Z') }
  assert.deepEqual(buildSlots({ ...base, bookings: [] }).map((s) => s.time), ['10:00', '10:30', '11:00'])

  const full = Array.from({ length: 3 }, () => ({ startTime: '10:00', durationMin: 60 }))
  const slots = buildSlots({ ...base, bookings: full })
  assert.equal(slots.find((s) => s.time === '10:00').available, false)
  assert.equal(slots.find((s) => s.time === '10:30').available, false) // overlap
  assert.equal(slots.find((s) => s.time === '11:00').available, true)

  const today = buildSlots({ ...base, bookings: [], now: new Date('2026-10-19T04:45:00Z') }) // 10:15 IST
  assert.equal(today.find((s) => s.time === '10:00').available, false)
  assert.equal(today.find((s) => s.time === '10:30').available, true)

  assert.deepEqual(buildSlots({ ...base, bookings: [], branch: { ...branch, holidays: [{ date: '2026-10-19' }] } }), [])
})

test('booking needs a customer login; price comes from the server; name and phone come from the verified account', async () => {
  const o = await openSalon('bk1@x.com', 'bk-one')
  const auth = h.bearer(o.token, o.salonId)
  const date = dayFromNow(3)
  const path = `/public/salons/${o.salonId}`

  assert.equal((await request(h.app).get(api(`${path}/slots?date=${date}&duration=90`))).status, 401)
  assert.equal((await request(h.app).post(api(`${path}/bookings`)).send({ date, startTime: '11:00', serviceIds: [o.cut.id] })).status, 401)

  const c = await h.customerAgent('9810012345', 'Priya Sharma')
  const slots = await c.get(api(`${path}/slots?date=${date}&duration=90`))
  assert.equal(slots.status, 200, JSON.stringify(slots.body))
  const time = slots.body.data.slots.find((s) => s.available).time

  // customer total, naam ya phone khud nahi bhej sakta (strict)
  const tampered = await c.post(api(`${path}/bookings`)).send({ date, startTime: time, serviceIds: [o.cut.id, o.mehendi.id], total: 1 })
  assert.equal(tampered.status, 400)
  const fakeName = await c.post(api(`${path}/bookings`)).send({ date, startTime: time, serviceIds: [o.cut.id], customerPhone: '9999999999' })
  assert.equal(fakeName.status, 400)

  const ok = await c.post(api(`${path}/bookings`)).send({ date, startTime: time, serviceIds: [o.cut.id, o.mehendi.id] })
  assert.equal(ok.status, 201, JSON.stringify(ok.body))
  assert.equal(ok.body.data.booking.total, 1200)

  const list = await request(h.app).get(api('/bookings')).set(auth)
  const booking = list.body.data.bookings[0]
  assert.equal(list.body.data.bookings.length, 1)
  assert.equal(booking.durationMin, 90)
  assert.equal(booking.status, 'pending')
  assert.equal(booking.customerName, 'Priya Sharma')
  assert.equal(booking.customerPhone, '9810012345')

  const notes = await request(h.app).get(api('/notifications')).set(auth)
  assert.ok(notes.body.data.notifications.some((n) => n.title === 'New appointment request' && n.body.startsWith('Priya Sharma')))
})

test('booking rules: past/far date, home needs address and home-capable services, unavailable slot', async () => {
  const o = await openSalon('bk2@x.com', 'bk-two')
  const c = await h.customerAgent('9810012346', 'Anjali Rao')
  const post = (body) => c.post(api(`/public/salons/${o.salonId}/bookings`)).send({ serviceIds: [o.cut.id], date: dayFromNow(2), startTime: '11:00', ...body })

  assert.equal((await post({ date: dayFromNow(-1) })).status, 400)
  assert.equal((await post({ date: dayFromNow(45) })).status, 400)
  assert.equal((await post({ mode: 'home', address: 'Rohini' })).status, 400) // address chhota
  const notHome = await post({ mode: 'home', address: 'B-12, Sector 7, Rohini, Delhi' })
  assert.equal(notHome.status, 400) // haircut ghar par nahi
  assert.equal((await post({ mode: 'home', address: 'B-12, Sector 7, Rohini, Delhi', serviceIds: [o.mehendi.id] })).status, 201)
  assert.equal((await post({ startTime: '23:00' })).status, 409) // band samay

  // 3 booking ke baad wahi slot full
  await post({ startTime: '15:00' })
  await post({ startTime: '15:00' })
  await post({ startTime: '15:00' })
  const full = await post({ startTime: '15:00' })
  assert.equal(full.status, 409)
  assert.equal(full.body.error.code, 'SLOT_UNAVAILABLE')
})

test('owner can confirm then complete; invalid jumps are refused; other salons cannot touch it', async () => {
  const o = await openSalon('bk3@x.com', 'bk-three')
  const auth = h.bearer(o.token, o.salonId)
  const c = await h.customerAgent('9810012347', 'Neha Arora')
  const created = await c.post(api(`/public/salons/${o.salonId}/bookings`)).send({ serviceIds: [o.cut.id], date: dayFromNow(2), startTime: '12:00' })
  const id = created.body.data.booking.id
  const set = (status, a = auth) => request(h.app).patch(api(`/bookings/${id}/status`)).set(a).send({ status })

  assert.equal((await set('completed')).status, 409) // pehle confirm
  assert.equal((await set('confirmed')).status, 200)
  assert.equal((await set('completed')).status, 200)
  assert.equal((await set('cancelled')).status, 409)

  const other = await h.ownerWithSalon('bk4@x.com', 'bk-four')
  assert.equal((await set('confirmed', h.bearer(other.token, other.salonId))).status, 404)
})
