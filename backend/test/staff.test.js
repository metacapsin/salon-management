const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`

before(h.connect)
after(h.disconnect)

const hours = { mon: [{ start: '10:00', end: '19:00' }], tue: [{ start: '10:00', end: '14:00' }, { start: '15:00', end: '19:00' }] }
const asha = { name: 'Asha', title: 'Senior Stylist', skills: ['Hair', 'Color'], weeklyHours: hours }

test('owner adds staff with skills, hours and services; it shows in the list', async () => {
  const o = await h.ownerWithSalon('stf1@x.com', 'stf-one')
  const auth = h.bearer(o.token, o.salonId)
  const svc = await h.request(h.app).post(api('/services')).set(auth).send({ name: 'Haircut', category: 'Hair', price: 300, durationMin: 30 })

  const created = await h.request(h.app).post(api('/staff')).set(auth).send({ ...asha, serviceIds: [svc.body.data.service.id] })
  assert.equal(created.status, 201, JSON.stringify(created.body))
  assert.deepEqual(created.body.data.staff.weeklyHours.tue.length, 2)
  assert.deepEqual(created.body.data.staff.weeklyHours.sun, [])

  const list = await h.request(h.app).get(api('/staff')).set(auth)
  assert.equal(list.body.data.staff.length, 1)
  assert.equal(list.body.data.staff[0].serviceIds.length, 1)
})

test('validation: bad time, end before start, overlapping hours, unknown service', async () => {
  const o = await h.ownerWithSalon('stf2@x.com', 'stf-two')
  const auth = h.bearer(o.token, o.salonId)
  const post = (body) => h.request(h.app).post(api('/staff')).set(auth).send(body)

  assert.equal((await post({ name: 'A' })).status, 400)
  assert.equal((await post({ ...asha, weeklyHours: { mon: [{ start: '25:00', end: '26:00' }] } })).status, 400)
  assert.equal((await post({ ...asha, weeklyHours: { mon: [{ start: '18:00', end: '10:00' }] } })).status, 400)
  assert.equal((await post({ ...asha, weeklyHours: { mon: [{ start: '10:00', end: '14:00' }, { start: '13:00', end: '18:00' }] } })).status, 400)
  assert.equal((await post({ ...asha, serviceIds: ['64b000000000000000000001'] })).status, 400)
})

test('deactivating hides staff; delete removes it for good', async () => {
  const o = await h.ownerWithSalon('stf3@x.com', 'stf-three')
  const auth = h.bearer(o.token, o.salonId)
  const { body } = await h.request(h.app).post(api('/staff')).set(auth).send(asha)
  const id = body.data.staff.id

  assert.equal((await h.request(h.app).patch(api(`/staff/${id}`)).set(auth).send({ active: false })).status, 200)
  assert.equal((await h.request(h.app).get(api('/staff')).set(auth)).body.data.staff.length, 0)
  assert.equal((await h.request(h.app).get(api('/staff?includeInactive=true')).set(auth)).body.data.staff.length, 1)

  assert.equal((await h.request(h.app).delete(api(`/staff/${id}`)).set(auth)).status, 200)
  assert.equal((await h.request(h.app).get(api('/staff?includeInactive=true')).set(auth)).body.data.staff.length, 0)
  assert.equal((await h.request(h.app).delete(api(`/staff/${id}`)).set(auth)).status, 404)
})

test('AT-02: staff of another salon is not reachable (404) and services of another salon cannot be linked', async () => {
  const a = await h.ownerWithSalon('stf4a@x.com', 'stf-four-a')
  const b = await h.ownerWithSalon('stf4b@x.com', 'stf-four-b')
  const { body } = await h.request(h.app).post(api('/staff')).set(h.bearer(a.token, a.salonId)).send(asha)

  const patch = await h.request(h.app).patch(api(`/staff/${body.data.staff.id}`)).set(h.bearer(b.token, b.salonId)).send({ title: 'x' })
  assert.equal(patch.status, 404)
  assert.equal((await h.request(h.app).get(api('/staff')).set(h.bearer(a.token, b.salonId))).status, 404)

  const svc = await h.request(h.app).post(api('/services')).set(h.bearer(a.token, a.salonId)).send({ name: 'Facial', category: 'Skin', price: 500, durationMin: 45 })
  const link = await h.request(h.app).post(api('/staff')).set(h.bearer(b.token, b.salonId)).send({ ...asha, serviceIds: [svc.body.data.service.id] })
  assert.equal(link.status, 400)
})
