const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
before(h.connect)
after(h.disconnect)

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const shift = (n) => new Date(Date.parse(`${today()}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)
const post = (auth, path, body) => h.request(h.app).post(api(path)).set(auth).send(body)
const get = (auth, path) => h.request(h.app).get(api(path)).set(auth)

async function setup(email, slug) {
  const o = await h.ownerWithSalon(email, slug)
  const auth = h.bearer(o.token, o.salonId)
  const mk = (name, price) => h.models.Service.create({ salonId: o.salonId, name, price, durationMin: 30 })
  return { o, auth, hair: await mk('Haircut', 500), spa: await mk('Hair Spa', 1000) }
}

const planBody = (extra = {}) => ({ name: 'Gold', price: 2000, durationDays: 365, discountType: 'percent', discountValue: 20, benefits: ['Free blow-dry once'], ...extra })
const sell = (s, planId, phone, key, extra = {}) => post(s.auth, '/customer-memberships', { planId, customerPhone: phone, customerName: 'Riya', requestKey: key, ...extra })
const booking = (s, phone, lines, extra = {}) =>
  h.models.Booking.create({
    salonId: s.o.salonId, customerName: 'Riya', customerPhone: phone, date: today(), startTime: '10:00', durationMin: 30,
    services: lines.map((l) => ({ serviceId: l._id, name: l.name, price: l.price, durationMin: 30 })),
    total: lines.reduce((t, l) => t + l.price, 0), status: 'confirmed', ...extra,
  })

test('owner creates, edits and switches off a plan; validation', async () => {
  const s = await setup('mp1@x.com', 'mp-one')
  const other = await setup('mp1b@x.com', 'mp-one-b')
  assert.equal((await post(s.auth, '/membership-plans', planBody({ discountValue: 150 }))).status, 400)
  assert.equal((await post(s.auth, '/membership-plans', planBody({ durationDays: 0 }))).status, 400)
  assert.equal((await post(s.auth, '/membership-plans', planBody({ serviceIds: [String(other.hair._id)] }))).status, 400) // foreign service
  assert.equal((await post(s.auth, '/membership-plans', planBody({ id: 'x' }))).status, 400) // unknown field
  const ok = await post(s.auth, '/membership-plans', planBody())
  assert.equal(ok.status, 201, JSON.stringify(ok.body))
  assert.equal((await post(s.auth, '/membership-plans', planBody())).status, 400) // same name
  const id = ok.body.data.plan.id
  const p = await h.request(h.app).patch(api(`/membership-plans/${id}`)).set(s.auth).send({ discountValue: 25 })
  assert.equal(p.body.data.plan.discountValue, 25)
  await h.request(h.app).patch(api(`/membership-plans/${id}`)).set(s.auth).send({ active: false })
  assert.equal((await get(s.auth, '/membership-plans?status=inactive&search=gol')).body.data.plans.length, 1)
  assert.equal((await get(other.auth, '/membership-plans')).body.data.plans.length, 0)
})

test('sell membership: server price, idempotent key, overlap blocked, renewal after expiry allowed', async () => {
  const s = await setup('mp2@x.com', 'mp-two')
  const plan = (await post(s.auth, '/membership-plans', planBody())).body.data.plan
  const first = await sell(s, plan.id, '9810000051', 'mkey-aaaaaaaa-1')
  assert.equal(first.status, 201, JSON.stringify(first.body))
  const cm = first.body.data.customerMembership
  assert.equal(cm.pricePaid, 2000)
  assert.equal(cm.startsOn, today())
  assert.equal(cm.expiresOn, shift(365))
  assert.equal(cm.status, 'active')
  assert.equal(cm.benefitsActive, true)

  assert.equal((await sell(s, plan.id, '9810000051', 'mkey-aaaaaaaa-1')).body.data.duplicate, true)
  assert.equal(await h.models.CustomerMembership.countDocuments({}), 1)
  const overlap = await sell(s, plan.id, '9810000051', 'mkey-aaaaaaaa-2')
  assert.equal(overlap.body.error.code, 'DUPLICATE_MEMBERSHIP')
  // naya plan shuru ho expiry ke baad -> start 90 din se zyada door: reject; isliye purane ko chhota karke jaanchte hain
  await h.models.CustomerMembership.updateOne({ _id: cm.id }, { $set: { expiresOn: shift(10) } })
  assert.equal((await sell(s, plan.id, '9810000051', 'mkey-aaaaaaaa-3', { startsOn: shift(11) })).status, 201)
  assert.equal((await sell(s, plan.id, '9810000052', 'mkey-aaaaaaaa-4', { startsOn: shift(-1) })).status, 400)
  const hist = (await get(s.auth, `/customer-memberships/${cm.id}`)).body.data.history
  assert.equal(hist[0].type, 'purchase')
})

test('quote: valid membership gives the right percent and flat discount, only on eligible services', async () => {
  const s = await setup('mp3@x.com', 'mp-three')
  const gold = (await post(s.auth, '/membership-plans', planBody())).body.data.plan
  const flat = (await post(s.auth, '/membership-plans', planBody({ name: 'Flat', discountType: 'flat', discountValue: 300, serviceIds: [String(s.spa._id)] }))).body.data.plan
  await sell(s, gold.id, '9810000061', 'mkey-bbbbbbbb-1')
  await sell(s, flat.id, '9810000062', 'mkey-bbbbbbbb-2')

  const both = [String(s.hair._id), String(s.spa._id)]
  const q1 = await post(s.auth, '/customer-memberships/quote', { customerPhone: '9810000061', serviceIds: both })
  assert.equal(q1.status, 200, JSON.stringify(q1.body))
  assert.deepEqual([q1.body.data.subtotal, q1.body.data.discount, q1.body.data.total], [1500, 300, 1200]) // 20% of 1500

  const q2 = await post(s.auth, '/customer-memberships/quote', { customerPhone: '9810000062', serviceIds: both })
  assert.equal(q2.body.data.discount, 300) // flat only on spa
  const q3 = await post(s.auth, '/customer-memberships/quote', { customerPhone: '9810000062', serviceIds: [String(s.hair._id)] })
  assert.equal(q3.body.data.discount, 0) // haircut not eligible
  assert.equal(q3.body.data.membership, null)
  const q4 = await post(s.auth, '/customer-memberships/quote', { customerPhone: '9810009999', serviceIds: both })
  assert.equal(q4.body.data.discount, 0) // no membership
  assert.equal((await post(s.auth, '/customer-memberships/quote', { customerPhone: '9810000061', serviceIds: both, price: 1 })).status, 400)
})

test('expired, cancelled, unpaid or not-started memberships get no benefit', async () => {
  const s = await setup('mp4@x.com', 'mp-four')
  const plan = (await post(s.auth, '/membership-plans', planBody())).body.data.plan
  const svc = [String(s.hair._id)]
  const quote = async (phone) => (await post(s.auth, '/customer-memberships/quote', { customerPhone: phone, serviceIds: svc })).body.data.discount

  const expired = (await sell(s, plan.id, '9810000071', 'mkey-cccccccc-1')).body.data.customerMembership
  await h.models.CustomerMembership.updateOne({ _id: expired.id }, { $set: { expiresOn: shift(-1) } })
  assert.equal(await quote('9810000071'), 0)

  const cancelled = (await sell(s, plan.id, '9810000072', 'mkey-cccccccc-2')).body.data.customerMembership
  assert.equal(await quote('9810000072'), 100)
  assert.equal((await post(s.auth, `/customer-memberships/${cancelled.id}/cancel`, { note: '' })).status, 400)
  assert.equal((await post(s.auth, `/customer-memberships/${cancelled.id}/cancel`, { note: 'refunded' })).status, 200)
  assert.equal((await post(s.auth, `/customer-memberships/${cancelled.id}/cancel`, { note: 'refunded' })).body.error.code, 'ALREADY_CANCELLED')
  assert.equal(await quote('9810000072'), 0)

  const unpaid = (await sell(s, plan.id, '9810000073', 'mkey-cccccccc-3', { paymentStatus: 'pending' })).body.data.customerMembership
  assert.equal(unpaid.benefitsActive, false)
  assert.equal(await quote('9810000073'), 0)
  assert.equal((await post(s.auth, `/customer-memberships/${unpaid.id}/payment`, { paymentMethod: 'upi' })).body.data.customerMembership.benefitsActive, true)
  assert.equal(await quote('9810000073'), 100)
  assert.equal((await post(s.auth, `/customer-memberships/${unpaid.id}/payment`, { paymentMethod: 'upi' })).body.error.code, 'ALREADY_PAID')

  const future = (await sell(s, plan.id, '9810000074', 'mkey-cccccccc-4', { startsOn: shift(5) })).body.data.customerMembership
  assert.equal(future.status, 'upcoming')
  assert.equal(await quote('9810000074'), 0)

  const count = async (st) => (await get(s.auth, `/customer-memberships?status=${st}`)).body.data.customerMemberships.length
  assert.deepEqual([await count('active'), await count('expired'), await count('cancelled'), await count('upcoming')], [1, 1, 1, 1])
  assert.equal((await get(s.auth, '/customer-memberships?paymentStatus=pending')).body.data.customerMemberships.length, 0)
})

test('apply to booking: reduces total once, never above the total, wrong customer/expired refused', async () => {
  const s = await setup('mp5@x.com', 'mp-five')
  const gold = (await post(s.auth, '/membership-plans', planBody())).body.data.plan
  const cm = (await sell(s, gold.id, '9810000081', 'mkey-dddddddd-1')).body.data.customerMembership

  const b = await booking(s, '9810000081', [s.hair, s.spa])
  const ok = await post(s.auth, `/customer-memberships/${cm.id}/apply`, { bookingId: String(b._id) })
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.equal(ok.body.data.booking.total, 1200)
  assert.equal(ok.body.data.booking.membership.discount, 300)

  const again = await post(s.auth, `/customer-memberships/${cm.id}/apply`, { bookingId: String(b._id) })
  assert.equal(again.body.error.code, 'ALREADY_APPLIED')
  assert.equal((await h.models.Booking.findById(b._id)).total, 1200)

  // do ek saath: sirf ek lagna chahiye
  const b2 = await booking(s, '9810000081', [s.hair])
  const race = await Promise.all([1, 2].map(() => post(s.auth, `/customer-memberships/${cm.id}/apply`, { bookingId: String(b2._id) })))
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409])
  assert.equal((await h.models.Booking.findById(b2._id)).total, 400)

  const stranger = await booking(s, '9899999999', [s.hair])
  assert.equal((await post(s.auth, `/customer-memberships/${cm.id}/apply`, { bookingId: String(stranger._id) })).body.error.code, 'CUSTOMER_MISMATCH')
  const cancelledB = await booking(s, '9810000081', [s.hair], { status: 'cancelled' })
  assert.equal((await post(s.auth, `/customer-memberships/${cm.id}/apply`, { bookingId: String(cancelledB._id) })).body.error.code, 'BOOKING_CANCELLED')

  const b3 = await booking(s, '9810000081', [s.hair])
  await h.models.CustomerMembership.updateOne({ _id: cm.id }, { $set: { expiresOn: shift(-1) } })
  assert.equal((await post(s.auth, `/customer-memberships/${cm.id}/apply`, { bookingId: String(b3._id) })).body.error.code, 'MEMBERSHIP_EXPIRED')

  const hist = (await get(s.auth, `/customer-memberships/${cm.id}`)).body.data.history
  assert.equal(hist.filter((x) => x.type === 'discount').length, 2)
})

test('ineligible services give no discount on apply; tenant isolation and roles', async () => {
  const s = await setup('mp6@x.com', 'mp-six')
  const other = await setup('mp6b@x.com', 'mp-six-b')
  const spaOnly = (await post(s.auth, '/membership-plans', planBody({ name: 'SpaOnly', serviceIds: [String(s.spa._id)] }))).body.data.plan
  const cm = (await sell(s, spaOnly.id, '9810000091', 'mkey-eeeeeeee-1')).body.data.customerMembership
  const b = await booking(s, '9810000091', [s.hair])
  assert.equal((await post(s.auth, `/customer-memberships/${cm.id}/apply`, { bookingId: String(b._id) })).body.error.code, 'NO_DISCOUNT')

  assert.equal((await get(other.auth, `/customer-memberships/${cm.id}`)).status, 404)
  assert.equal((await sell({ auth: other.auth }, spaOnly.id, '9810000092', 'mkey-eeeeeeee-2')).status, 400)

  await h.createVerifiedUser('recep-m@x.com')
  const rec = await h.loginAs('recep-m@x.com')
  await h.models.Membership.create({ salonId: s.o.salonId, userId: rec.user.id, role: 'receptionist' })
  const rauth = h.bearer(rec.token, s.o.salonId)
  assert.equal((await post(rauth, '/membership-plans', planBody({ name: 'Nope' }))).status, 403)
  assert.equal((await post(rauth, `/customer-memberships/${cm.id}/cancel`, { note: 'trying' })).status, 403)
  assert.equal((await sell({ auth: rauth }, spaOnly.id, '9810000093', 'mkey-eeeeeeee-3')).status, 201)
})

test('booking benefits: shows usable package sessions and membership discount, and flips after use', async () => {
  const s = await setup('mp7@x.com', 'mp-seven')
  const gold = (await post(s.auth, '/membership-plans', planBody())).body.data.plan
  const pkg = (await post(s.auth, '/packages', { name: 'Hair x3', items: [{ serviceId: String(s.hair._id), sessions: 3 }], packagePrice: 1200, validityDays: 30 })).body.data.package
  const phone = '9810000101'
  await sell(s, gold.id, phone, 'mkey-ffffffff-1')
  const cp = (await post(s.auth, '/customer-packages', { packageId: pkg.id, customerPhone: phone, customerName: 'Riya', requestKey: 'pkey-ffffffff-1' })).body.data.customerPackage
  const b = await booking(s, `+91${phone}`, [s.hair, s.spa], { status: 'completed' })

  const first = await get(s.auth, `/bookings/${b._id}/benefits`)
  assert.equal(first.status, 200, JSON.stringify(first.body))
  assert.equal(first.body.data.packages.length, 1)
  assert.deepEqual(first.body.data.packages[0].services.map((x) => [x.serviceName, x.remaining, x.redeemed]), [['Haircut', 3, false]]) // spa not in package
  assert.equal(first.body.data.membership.applied, false)
  assert.equal(first.body.data.membership.discount, 300)

  assert.equal((await post(s.auth, `/customer-packages/${cp.id}/redeem`, { bookingId: String(b._id), serviceId: String(s.hair._id) })).status, 200)
  assert.equal((await post(s.auth, `/customer-memberships/${first.body.data.membership.customerMembershipId}/apply`, { bookingId: String(b._id) })).status, 200)

  const second = (await get(s.auth, `/bookings/${b._id}/benefits`)).body.data
  assert.deepEqual(second.packages[0].services.map((x) => [x.remaining, x.redeemed]), [[2, true]])
  assert.equal(second.membership.applied, true)
  assert.equal(second.total, 1200)

  const other = await setup('mp7b@x.com', 'mp-seven-b')
  assert.equal((await get(other.auth, `/bookings/${b._id}/benefits`)).status, 404)
})
