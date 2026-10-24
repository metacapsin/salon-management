const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
before(h.connect)
after(h.disconnect)

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const shift = (n) => new Date(Date.parse(`${today()}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10)

async function setup(email, slug) {
  const o = await h.ownerWithSalon(email, slug)
  const auth = h.bearer(o.token, o.salonId)
  const mk = (name, price) => h.models.Service.create({ salonId: o.salonId, name, price, durationMin: 30 })
  const hair = await mk('Haircut', 500)
  const spa = await mk('Hair Spa', 1000)
  return { o, auth, hair, spa }
}

const post = (auth, path, body) => h.request(h.app).post(api(path)).set(auth).send(body)

// Haircut 5x500 + Spa 2x1000 = 4500, package price 3600
const pkgBody = (s, extra = {}) => ({
  name: 'Glow Pack',
  items: [{ serviceId: String(s.hair._id), sessions: 5 }, { serviceId: String(s.spa._id), sessions: 2 }],
  packagePrice: 3600,
  validityDays: 90,
  ...extra,
})

const doneBooking = (s, phone, svc, date = today()) =>
  h.models.Booking.create({
    salonId: s.o.salonId, customerName: 'Riya', customerPhone: phone, date, startTime: '10:00', durationMin: 30,
    services: [{ serviceId: svc._id, name: svc.name, price: svc.price, durationMin: 30 }], total: svc.price, status: 'completed',
  })

test('create package: server computes original price and savings', async () => {
  const s = await setup('pk1@x.com', 'pk-one')
  const res = await post(s.auth, '/packages', { ...pkgBody(s), originalPrice: 1, savings: 99999 }) // extra fields rejected
  assert.equal(res.status, 400)
  const ok = await post(s.auth, '/packages', pkgBody(s))
  assert.equal(ok.status, 201, JSON.stringify(ok.body))
  const p = ok.body.data.package
  assert.equal(p.originalPrice, 4500)
  assert.equal(p.savings, 900)
  assert.equal(p.savingsPercent, 20)
})

test('package validation: price above total, duplicate service, foreign service, duplicate name', async () => {
  const s = await setup('pk2@x.com', 'pk-two')
  const other = await setup('pk2b@x.com', 'pk-two-b')
  assert.equal((await post(s.auth, '/packages', pkgBody(s, { packagePrice: 4501 }))).status, 400)
  assert.equal((await post(s.auth, '/packages', pkgBody(s, { items: [{ serviceId: String(s.hair._id), sessions: 1 }, { serviceId: String(s.hair._id), sessions: 2 }] }))).status, 400)
  assert.equal((await post(s.auth, '/packages', pkgBody(s, { items: [{ serviceId: String(other.hair._id), sessions: 1 }] }))).status, 400)
  assert.equal((await post(s.auth, '/packages', pkgBody(s, { validityDays: 0 }))).status, 400)
  assert.equal((await post(s.auth, '/packages', pkgBody(s))).status, 201)
  assert.equal((await post(s.auth, '/packages', pkgBody(s))).status, 400) // same name
})

test('edit, deactivate, search; other salon cannot see or touch it', async () => {
  const s = await setup('pk3@x.com', 'pk-three')
  const other = await setup('pk3b@x.com', 'pk-three-b')
  const id = (await post(s.auth, '/packages', pkgBody(s))).body.data.package.id
  const patched = await h.request(h.app).patch(api(`/packages/${id}`)).set(s.auth).send({ packagePrice: 3000 })
  assert.equal(patched.body.data.package.savings, 1500)
  await h.request(h.app).patch(api(`/packages/${id}`)).set(s.auth).send({ active: false })
  const inactive = await h.request(h.app).get(api('/packages?status=inactive&search=glow')).set(s.auth)
  assert.equal(inactive.body.data.packages.length, 1)
  assert.equal((await h.request(h.app).get(api('/packages')).set(other.auth)).body.data.packages.length, 0)
  assert.equal((await h.request(h.app).patch(api(`/packages/${id}`)).set(other.auth).send({ active: true })).status, 404)
})

test('assign: price comes from server, same requestKey does not double charge, duplicate needs confirmation', async () => {
  const s = await setup('pk4@x.com', 'pk-four')
  const pkg = (await post(s.auth, '/packages', pkgBody(s))).body.data.package
  const body = { packageId: pkg.id, customerPhone: '9810000011', customerName: 'Riya', requestKey: 'key-aaaaaaaa-1' }

  const a = await post(s.auth, '/customer-packages', { ...body, pricePaid: 1 }) // unknown field rejected
  assert.equal(a.status, 400)
  const first = await post(s.auth, '/customer-packages', body)
  assert.equal(first.status, 201, JSON.stringify(first.body))
  const cp = first.body.data.customerPackage
  assert.equal(cp.pricePaid, 3600)
  assert.equal(cp.totalSessions, 7)
  assert.equal(cp.remainingSessions, 7)
  assert.equal(cp.expiresOn, shift(90))
  assert.equal(cp.status, 'active')

  const again = await post(s.auth, '/customer-packages', body)
  assert.equal(again.body.data.duplicate, true)
  assert.equal(again.body.data.customerPackage.id, cp.id)
  assert.equal(await h.models.CustomerPackage.countDocuments({ salonId: s.o.salonId }), 1)

  const dup = await post(s.auth, '/customer-packages', { ...body, requestKey: 'key-aaaaaaaa-2' })
  assert.equal(dup.status, 409)
  assert.equal(dup.body.error.code, 'DUPLICATE_PACKAGE')
  const confirmed = await post(s.auth, '/customer-packages', { ...body, requestKey: 'key-aaaaaaaa-2', confirmDuplicate: true })
  assert.equal(confirmed.status, 201)

  // package ka price baad me badle to purani bikri nahi badalti
  await h.request(h.app).patch(api(`/packages/${pkg.id}`)).set(s.auth).send({ packagePrice: 2000 })
  const detail = await h.request(h.app).get(api(`/customer-packages/${cp.id}`)).set(s.auth)
  assert.equal(detail.body.data.customerPackage.pricePaid, 3600)
  assert.equal(detail.body.data.history[0].type, 'purchase')
})

test('assign refuses inactive package and package outside its sale window', async () => {
  const s = await setup('pk5@x.com', 'pk-five')
  const off = (await post(s.auth, '/packages', pkgBody(s, { name: 'Old' }))).body.data.package
  await h.request(h.app).patch(api(`/packages/${off.id}`)).set(s.auth).send({ active: false })
  const late = (await post(s.auth, '/packages', pkgBody(s, { name: 'Late', saleStartsOn: shift(5), saleEndsOn: shift(10) }))).body.data.package
  const base = { customerPhone: '9810000012', customerName: 'Neha' }
  assert.equal((await post(s.auth, '/customer-packages', { ...base, packageId: off.id, requestKey: 'key-bbbbbbbb-1' })).status, 400)
  assert.equal((await post(s.auth, '/customer-packages', { ...base, packageId: late.id, requestKey: 'key-bbbbbbbb-2' })).status, 400)
})

test('redeem: only for a completed, matching appointment; never below zero; never twice for the same appointment', async () => {
  const s = await setup('pk6@x.com', 'pk-six')
  const pkg = (await post(s.auth, '/packages', pkgBody(s, { items: [{ serviceId: String(s.hair._id), sessions: 2 }], packagePrice: 900 }))).body.data.package
  const cp = (await post(s.auth, '/customer-packages', { packageId: pkg.id, customerPhone: '9810000013', customerName: 'Riya', requestKey: 'key-cccccccc-1' })).body.data.customerPackage
  const redeem = (b) => post(s.auth, `/customer-packages/${cp.id}/redeem`, b)
  const sid = String(s.hair._id)

  const pending = await h.models.Booking.create({ salonId: s.o.salonId, customerName: 'Riya', customerPhone: '9810000013', date: today(), startTime: '10:00', durationMin: 30, services: [{ serviceId: s.hair._id, name: 'Haircut', price: 500, durationMin: 30 }], total: 500, status: 'confirmed' })
  const early = await redeem({ bookingId: String(pending._id), serviceId: sid })
  assert.equal(early.body.error.code, 'BOOKING_NOT_COMPLETED')

  const stranger = await doneBooking(s, '9899999999', s.hair)
  assert.equal((await redeem({ bookingId: String(stranger._id), serviceId: sid })).body.error.code, 'CUSTOMER_MISMATCH')

  const spaOnly = await doneBooking(s, '9810000013', s.spa)
  assert.equal((await redeem({ bookingId: String(spaOnly._id), serviceId: String(s.spa._id) })).body.error.code, 'SERVICE_NOT_IN_PACKAGE')

  const b1 = await doneBooking(s, '9810000013', s.hair)
  const ok = await redeem({ bookingId: String(b1._id), serviceId: sid })
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.equal(ok.body.data.customerPackage.remainingSessions, 1)
  assert.equal(ok.body.data.customerPackage.usedSessions, 1)

  const twice = await redeem({ bookingId: String(b1._id), serviceId: sid })
  assert.equal(twice.body.error.code, 'ALREADY_REDEEMED')

  const b2 = await doneBooking(s, '9810000013', s.hair)
  const b3 = await doneBooking(s, '9810000013', s.hair)
  // dono ek saath: sirf ek session bacha hai, ek hi kamyab hona chahiye
  const race = await Promise.all([redeem({ bookingId: String(b2._id), serviceId: sid }), redeem({ bookingId: String(b3._id), serviceId: sid })])
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409])
  const after = await h.models.CustomerPackage.findById(cp.id).lean()
  assert.equal(after.items[0].remaining, 0)

  const b4 = await doneBooking(s, '9810000013', s.hair)
  assert.equal((await redeem({ bookingId: String(b4._id), serviceId: sid })).body.error.code, 'NO_SESSIONS_LEFT')

  const detail = await h.request(h.app).get(api(`/customer-packages/${cp.id}`)).set(s.auth)
  assert.equal(detail.body.data.customerPackage.status, 'exhausted')
  assert.equal(detail.body.data.history.filter((x) => x.type === 'redemption').length, 2)
})

test('expired and cancelled packages cannot be used; status filter works', async () => {
  const s = await setup('pk7@x.com', 'pk-seven')
  const pkg = (await post(s.auth, '/packages', pkgBody(s))).body.data.package
  const mkCp = async (phone, key) => (await post(s.auth, '/customer-packages', { packageId: pkg.id, customerPhone: phone, customerName: 'C', requestKey: key })).body.data.customerPackage
  const expired = await mkCp('9810000021', 'key-dddddddd-1')
  const cancelled = await mkCp('9810000022', 'key-dddddddd-2')
  await mkCp('9810000023', 'key-dddddddd-3')
  await h.models.CustomerPackage.updateOne({ _id: expired.id }, { $set: { expiresOn: shift(-1) } })

  const b = await doneBooking(s, '9810000021', s.hair)
  const r = await post(s.auth, `/customer-packages/${expired.id}/redeem`, { bookingId: String(b._id), serviceId: String(s.hair._id) })
  assert.equal(r.body.error.code, 'PACKAGE_EXPIRED')

  const noReason = await post(s.auth, `/customer-packages/${cancelled.id}/cancel`, { note: '' })
  assert.equal(noReason.status, 400)
  assert.equal((await post(s.auth, `/customer-packages/${cancelled.id}/cancel`, { note: 'Customer asked' })).status, 200)
  assert.equal((await post(s.auth, `/customer-packages/${cancelled.id}/cancel`, { note: 'Customer asked' })).body.error.code, 'ALREADY_CANCELLED')
  const b2 = await doneBooking(s, '9810000022', s.hair)
  assert.equal((await post(s.auth, `/customer-packages/${cancelled.id}/redeem`, { bookingId: String(b2._id), serviceId: String(s.hair._id) })).body.error.code, 'PACKAGE_CANCELLED')

  const count = async (status) => (await h.request(h.app).get(api(`/customer-packages?status=${status}`)).set(s.auth)).body.data.customerPackages.length
  assert.equal(await count('active'), 1)
  assert.equal(await count('expired'), 1)
  assert.equal(await count('cancelled'), 1)
})

test('adjust needs a reason and cannot make balance negative; pending payment can be paid once', async () => {
  const s = await setup('pk8@x.com', 'pk-eight')
  const pkg = (await post(s.auth, '/packages', pkgBody(s))).body.data.package
  const cp = (await post(s.auth, '/customer-packages', { packageId: pkg.id, customerPhone: '9810000031', customerName: 'C', requestKey: 'key-eeeeeeee-1', paymentStatus: 'pending' })).body.data.customerPackage
  assert.equal(cp.paymentStatus, 'pending')
  const hairId = String(s.hair._id)
  assert.equal((await post(s.auth, `/customer-packages/${cp.id}/adjust`, { serviceId: hairId, sessions: -1, note: '' })).status, 400)
  assert.equal((await post(s.auth, `/customer-packages/${cp.id}/adjust`, { serviceId: hairId, sessions: -6, note: 'oops' })).body.error.code, 'INVALID_ADJUSTMENT')
  const adj = await post(s.auth, `/customer-packages/${cp.id}/adjust`, { serviceId: hairId, sessions: -5, note: 'used offline' })
  assert.equal(adj.body.data.customerPackage.items[0].remaining, 0)

  assert.equal((await post(s.auth, `/customer-packages/${cp.id}/payment`, { paymentMethod: 'upi' })).body.data.customerPackage.paymentStatus, 'paid')
  assert.equal((await post(s.auth, `/customer-packages/${cp.id}/payment`, { paymentMethod: 'upi' })).body.error.code, 'ALREADY_PAID')
  const hist = (await h.request(h.app).get(api(`/customer-packages/${cp.id}`)).set(s.auth)).body.data.history
  assert.deepEqual(hist.map((x) => x.type), ['purchase', 'adjustment', 'payment'])
})

test('tenant isolation and roles: other salon gets 404; receptionist can sell but not create or adjust', async () => {
  const s = await setup('pk9@x.com', 'pk-nine')
  const other = await setup('pk9b@x.com', 'pk-nine-b')
  const pkg = (await post(s.auth, '/packages', pkgBody(s))).body.data.package
  const cp = (await post(s.auth, '/customer-packages', { packageId: pkg.id, customerPhone: '9810000041', customerName: 'C', requestKey: 'key-ffffffff-1' })).body.data.customerPackage

  assert.equal((await h.request(h.app).get(api(`/customer-packages/${cp.id}`)).set(other.auth)).status, 404)
  assert.equal((await post(other.auth, '/customer-packages', { packageId: pkg.id, customerPhone: '9810000042', customerName: 'C', requestKey: 'key-ffffffff-2' })).status, 400)

  // receptionist: owner ka invite kiye bina seedha membership banate hain
  await h.createVerifiedUser('recep9@x.com')
  const rec = await h.loginAs('recep9@x.com')
  await h.models.Membership.create({ salonId: s.o.salonId, userId: rec.user.id, role: 'receptionist' })
  const rauth = h.bearer(rec.token, s.o.salonId)
  assert.equal((await post(rauth, '/packages', pkgBody(s, { name: 'Nope' }))).status, 403)
  assert.equal((await post(rauth, `/customer-packages/${cp.id}/adjust`, { serviceId: String(s.hair._id), sessions: 1, note: 'trying' })).status, 403)
  assert.equal((await post(rauth, '/customer-packages', { packageId: pkg.id, customerPhone: '9810000043', customerName: 'C', requestKey: 'key-ffffffff-3' })).status, 201)
})
