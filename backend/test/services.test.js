const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`

before(h.connect)
after(h.disconnect)

const haircut = { name: 'Haircut', category: 'Hair', price: 300, durationMin: 30, atSalon: true, atHome: false }

test('owner creates a service; it shows in the list and updates the salon card price', async () => {
  const o = await h.ownerWithSalon('svc1@x.com', 'svc-one')
  const auth = h.bearer(o.token, o.salonId)

  const created = await h.request(h.app).post(api('/services')).set(auth).send(haircut)
  assert.equal(created.status, 201, JSON.stringify(created.body))
  await h.request(h.app).post(api('/services')).set(auth).send({ ...haircut, name: 'Facial', category: 'Skin', price: 150, atHome: true })

  const list = await h.request(h.app).get(api('/services')).set(auth)
  assert.equal(list.body.data.services.length, 2)

  const salon = await h.models.Salon.findById(o.salonId)
  assert.equal(salon.startingPrice, 150)
  assert.equal(salon.serviceModes.homeService, true)
})

test('validation: bad duration, negative price, no place, duplicate name', async () => {
  const o = await h.ownerWithSalon('svc2@x.com', 'svc-two')
  const auth = h.bearer(o.token, o.salonId)
  const post = (body) => h.request(h.app).post(api('/services')).set(auth).send(body)

  assert.equal((await post({ ...haircut, durationMin: 33 })).status, 400)
  assert.equal((await post({ ...haircut, price: -5 })).status, 400)
  assert.equal((await post({ ...haircut, atSalon: false, atHome: false })).status, 400)
  assert.equal((await post(haircut)).status, 201)
  const dup = await post({ ...haircut, name: 'HAIRCUT' })
  assert.equal(dup.status, 409)
  assert.equal(dup.body.error.code, 'SERVICE_EXISTS')
})

test('deactivating hides the service and a deactivated name can be reused', async () => {
  const o = await h.ownerWithSalon('svc3@x.com', 'svc-three')
  const auth = h.bearer(o.token, o.salonId)
  const { body } = await h.request(h.app).post(api('/services')).set(auth).send(haircut)
  const id = body.data.service.id

  assert.equal((await h.request(h.app).delete(api(`/services/${id}`)).set(auth)).status, 200)
  assert.equal((await h.request(h.app).get(api('/services')).set(auth)).body.data.services.length, 0)
  assert.equal((await h.request(h.app).get(api('/services?includeInactive=true')).set(auth)).body.data.services.length, 1)
  assert.equal((await h.request(h.app).post(api('/services')).set(auth).send(haircut)).status, 201)
})

test('AT-02: a service of another salon is not reachable (404)', async () => {
  const a = await h.ownerWithSalon('svc4a@x.com', 'svc-four-a')
  const b = await h.ownerWithSalon('svc4b@x.com', 'svc-four-b')
  const { body } = await h.request(h.app).post(api('/services')).set(h.bearer(a.token, a.salonId)).send(haircut)

  const patch = await h.request(h.app).patch(api(`/services/${body.data.service.id}`)).set(h.bearer(b.token, b.salonId)).send({ price: 1 })
  assert.equal(patch.status, 404)
  assert.equal((await h.request(h.app).get(api('/services')).set(h.bearer(a.token, b.salonId))).status, 404)
})

test('a service lets the salon pass the "add a service" publish check', async () => {
  const o = await h.ownerWithSalon('svc5@x.com', 'svc-five')
  const auth = h.bearer(o.token, o.salonId)
  const before = await h.request(h.app).get(api('/salons/current')).set(auth)
  assert.ok(before.body.data.publishBlockers.some((b) => /service/i.test(b)))

  await h.request(h.app).post(api('/services')).set(auth).send(haircut)
  const after = await h.request(h.app).get(api('/salons/current')).set(auth)
  assert.ok(!after.body.data.publishBlockers.some((b) => /service/i.test(b)))
})

// ---------- customer popup + owner notification ----------
const request = h.request

async function publishedSalon(email, slug) {
  const o = await h.ownerWithSalon(email, slug)
  await h.models.Salon.updateOne(
    { _id: o.salonId },
    { $set: { publicBookingEnabled: true, 'ownerContact.phone': '+91 98100 11111', 'address.city': 'Delhi', 'address.area': 'Rohini' } },
  )
  await request(h.app).post(api('/services')).set(h.bearer(o.token, o.salonId)).send(haircut)
  return o
}

test('public salon detail needs a customer login; it shows owner name, phone and services; unpublished salon is 404', async () => {
  const o = await publishedSalon('pub1@x.com', 'pub-one')
  assert.equal((await request(h.app).get(api(`/public/salons/${o.salonId}`))).status, 401) // login ke bina nahi

  const c = await h.customerAgent('9810000101')
  const res = await c.get(api(`/public/salons/${o.salonId}`))
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.equal(res.body.data.salon.owner.phone, '+91 98100 11111')
  assert.ok(res.body.data.salon.owner.name)
  assert.equal(res.body.data.salon.services[0].name, 'Haircut')
  assert.equal(res.body.data.salon.owner.email, undefined)

  const hidden = await h.ownerWithSalon('pub2@x.com', 'pub-two')
  assert.equal((await c.get(api(`/public/salons/${hidden.salonId}`))).status, 404)
})

test('a customer view notifies the owner once per hour per customer, and the owner can read and clear it', async () => {
  const o = await publishedSalon('pub3@x.com', 'pub-three')
  const auth = h.bearer(o.token, o.salonId)
  const one = await h.customerAgent('9810000102', 'Asha')
  const two = await h.customerAgent('9810000103', 'Bina')
  const view = (c) => c.post(api(`/public/salons/${o.salonId}/view`))

  assert.equal((await view(one)).body.data.counted, true)
  assert.equal((await view(one)).body.data.counted, false)
  assert.equal((await view(two)).body.data.counted, true)

  const list = await request(h.app).get(api('/notifications')).set(auth)
  assert.equal(list.body.data.unreadCount, 2)

  await request(h.app).post(api('/notifications/read-all')).set(auth)
  assert.equal((await request(h.app).get(api('/notifications')).set(auth)).body.data.unreadCount, 0)

  // dusre salon ka owner ye khabrein nahi dekh sakta
  const other = await h.ownerWithSalon('pub4@x.com', 'pub-four')
  const crossed = await request(h.app).get(api('/notifications')).set(h.bearer(other.token, o.salonId))
  assert.equal(crossed.status, 404)
})
