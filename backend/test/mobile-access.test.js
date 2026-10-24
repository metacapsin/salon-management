const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const jwt = require('jsonwebtoken')
const h = require('./helpers')

// Step 8 of the mobile app: for every endpoint the mobile app calls, check (1) which roles may use it,
// (2) that one salon can never see or change another salon's data, and (3) that dead sessions stop working.
// The mobile app only HIDES screens. This test proves the server is the real gatekeeper.

const api = (path) => `/api/v1${path}`
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const ROLES = ['owner', 'manager', 'receptionist', 'staff']

const call = (method, who, path, body) => {
  let req = h.request(h.app)[method](api(path)).set(who.auth)
  if (body !== undefined) req = req.send(body)
  return req
}

// Mobile login (JSON refresh token, no cookie) + a membership created straight in the database.
async function member(email, salonId, role) {
  await h.createVerifiedUser(email)
  const login = await h.request(h.app).post(api('/auth/mobile/login')).send({ email, password: h.PASSWORD })
  assert.equal(login.status, 200)
  const userId = login.body.data.user.id
  await h.models.Membership.create({ salonId, userId, role })
  return { email, role, token: login.body.data.accessToken, refreshToken: login.body.data.refreshToken, userId, auth: h.bearer(login.body.data.accessToken, salonId) }
}

let A, B, people, ids, admin

before(async () => {
  await h.connect()
  A = await h.ownerWithSalon('acc-a-owner@x.com', 'acc-salon-a')
  B = await h.ownerWithSalon('acc-b-owner@x.com', 'acc-salon-b')
  people = { owner: { role: 'owner', token: A.token, auth: h.bearer(A.token, A.salonId) } }
  for (const role of ['manager', 'receptionist', 'staff']) people[role] = await member(`acc-a-${role}@x.com`, A.salonId, role)

  // data that belongs to salon A
  const service = await h.models.Service.create({ salonId: A.salonId, name: 'Haircut', price: 500, durationMin: 30 })
  const staff = await h.models.Staff.create({ salonId: A.salonId, name: 'Meera Joshi' })
  const offer = await h.models.Offer.create({ salonId: A.salonId, title: 'Festive', discountType: 'percent', discountValue: 10, startsOn: today(), endsOn: '2099-12-31' })
  const booking = await h.models.Booking.create({
    salonId: A.salonId, customerName: 'Riya Sen', customerPhone: '9810000001', date: today(), startTime: '10:00', durationMin: 30,
    services: [{ serviceId: service._id, name: 'Haircut', price: 500, durationMin: 30 }], total: 500, status: 'pending',
  })
  const inv = await h.request(h.app).post(api('/invoices')).set(people.owner.auth).send({
    requestKey: 'acc-invoice-0001', customerPhone: '9810000001', customerName: 'Riya Sen', lines: [{ serviceId: String(service._id), quantity: 1 }],
  })
  assert.equal(inv.status, 201, JSON.stringify(inv.body))
  ids = { service: String(service._id), staff: String(staff._id), offer: String(offer._id), booking: String(booking._id), invoice: inv.body.data.invoice.id }

  await h.createVerifiedUser('acc-admin@x.com')
  await h.models.User.updateOne({ normalizedEmail: 'acc-admin@x.com' }, { platformRole: 'admin' })
  const al = await h.request(h.app).post(api('/auth/mobile/login')).send({ email: 'acc-admin@x.com', password: h.PASSWORD })
  admin = { token: al.body.data.accessToken, auth: h.bearer(al.body.data.accessToken) }
})
after(h.disconnect)

// ---------- 1. who may READ what (matches the permission table) ----------
const READS = [
  ['/bookings', ['owner', 'manager', 'receptionist']],
  ['/customers', ['owner', 'manager', 'receptionist']],
  ['/services', ROLES],
  ['/staff', ['owner', 'manager', 'receptionist']],
  ['/offers', ['owner', 'manager', 'receptionist']],
  ['/invoices', ['owner', 'manager', 'receptionist']],
  ['/invoices/summary', ['owner', 'manager', 'receptionist']],
  ['/notifications', ['owner', 'manager']],
  ['/users', ['owner', 'manager']],
  ['/audit-events', ['owner', 'manager']],
]

test('read access: each role gets exactly the screens its permissions allow (403 otherwise)', async () => {
  for (const [path, allowed] of READS) {
    for (const role of ROLES) {
      const res = await call('get', people[role], path)
      if (allowed.includes(role)) assert.equal(res.status, 200, `${role} should read ${path}, got ${res.status}`)
      else {
        assert.equal(res.status, 403, `${role} must NOT read ${path}, got ${res.status}`)
        assert.equal(res.body.error.code, 'PERMISSION_DENIED')
      }
    }
  }
})

test('salon settings: owner and manager get full details, receptionist and staff only a short summary', async () => {
  for (const role of ROLES) {
    const res = await call('get', people[role], '/salons/current')
    assert.equal(res.status, 200)
    const full = ['owner', 'manager'].includes(role)
    assert.equal(res.body.data.salon.weeklyHours !== undefined, full, `${role}: full details = ${full}`)
    assert.equal(res.body.data.salon.ownerContact !== undefined, full)
  }
})

// ---------- 2. who may WRITE what ----------
const WRITES = [
  // [method, path, body, roles that must be refused]
  ['post', '/services', { name: 'Spa', price: 100, durationMin: 30 }, ['receptionist', 'staff']],
  ['patch', () => `/services/${ids.service}`, { price: 1 }, ['receptionist', 'staff']],
  ['delete', () => `/services/${ids.service}`, undefined, ['receptionist', 'staff']],
  ['post', '/staff', { name: 'New Person' }, ['receptionist', 'staff']],
  ['patch', () => `/staff/${ids.staff}`, { title: 'Boss' }, ['receptionist', 'staff']],
  ['post', '/offers', { title: 'Free', discountType: 'percent', discountValue: 100, startsOn: '2026-01-01', endsOn: '2099-01-01' }, ['receptionist', 'staff']],
  ['patch', () => `/offers/${ids.offer}`, { active: false }, ['receptionist', 'staff']],
  ['patch', '/salons/current', { about: 'changed' }, ['manager', 'receptionist', 'staff']],
  ['post', '/bookings', { customerName: 'X Y', customerPhone: '9810000009', serviceId: 'x', date: '2099-01-01', startTime: '10:00' }, ['staff']],
  ['patch', () => `/bookings/${ids.booking}/status`, { status: 'confirmed' }, ['staff']],
  ['post', '/invoices', { requestKey: 'deny-key-0001', customerPhone: '9810000002', customerName: 'Z Z', lines: [] }, ['staff']],
  ['post', () => `/invoices/${ids.invoice}/payments`, { requestKey: 'deny-pay-0001', method: 'cash', amount: 100 }, ['staff']],
  ['post', () => `/invoices/${ids.invoice}/refunds`, { requestKey: 'deny-ref-0001', method: 'cash', amount: 100, note: 'nope' }, ['receptionist', 'staff']],
  ['post', () => `/invoices/${ids.invoice}/void`, { note: 'nope' }, ['manager', 'receptionist', 'staff']],
]

test('write access: roles without the permission get 403 and nothing changes', async () => {
  for (const [method, pathOrFn, body, refused] of WRITES) {
    const path = typeof pathOrFn === 'function' ? pathOrFn() : pathOrFn
    for (const role of refused) {
      const res = await call(method, people[role], path, body)
      assert.equal(res.status, 403, `${role} ${method.toUpperCase()} ${path} must be 403, got ${res.status} ${JSON.stringify(res.body.error)}`)
    }
  }
  // nothing was changed by the refused calls
  const service = await h.models.Service.findById(ids.service)
  assert.equal(service.price, 500)
  assert.equal(service.active, true)
  assert.equal((await h.models.Offer.findById(ids.offer)).active, true)
  assert.notEqual((await h.models.Salon.findById(A.salonId)).about, 'changed')
  assert.equal((await h.models.Invoice.findById(ids.invoice)).status, 'final')
  assert.equal(await h.models.Payment.countDocuments({ salonId: A.salonId }), 0)
})

test('new appointment: free-time lookup and booking need appointments.write; a taken time is refused with 409', async () => {
  const day = new Date(Date.now() + 86400000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const slotsPath = `/bookings/slots?date=${day}&serviceId=${ids.service}`
  assert.equal((await call('get', people.staff, slotsPath)).status, 403)
  for (const role of ['owner', 'manager', 'receptionist']) assert.equal((await call('get', people[role], slotsPath)).status, 200, `${role} slots`)
  // salon B cannot ask for free times on salon A's service
  assert.equal((await call('get', { auth: h.bearer(B.token, B.salonId) }, slotsPath)).status, 400)

  // a salon with no opening hours has no free times, so give salon A hours first
  const everyDay = Object.fromEntries(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => [d, [{ start: '10:00', end: '20:00' }]]))
  await h.models.Branch.updateOne({ salonId: A.salonId }, { weeklyHours: everyDay })
  const staff = await h.models.Staff.create({ salonId: A.salonId, name: 'Slot Staff' })
  const body = { customerName: 'Slot Tester', customerPhone: '9810000077', serviceId: ids.service, staffId: String(staff._id), date: day, startTime: '11:00' }
  const first = await call('post', people.receptionist, '/bookings', body)
  assert.equal(first.status, 201, JSON.stringify(first.body))
  const second = await call('post', people.manager, '/bookings', { ...body, customerPhone: '9810000078' })
  assert.equal(second.status, 409)
  assert.equal(second.body.error.code, 'SLOT_UNAVAILABLE')
})

test('allowed writes work for the right roles (owner + manager can refund; only owner can void)', async () => {
  const pay = await call('post', people.receptionist, `/invoices/${ids.invoice}/payments`, { requestKey: 'ok-pay-0001', method: 'cash', amount: 59000 })
  assert.equal(pay.status, 201, JSON.stringify(pay.body))
  const refund = await call('post', people.manager, `/invoices/${ids.invoice}/refunds`, { requestKey: 'ok-ref-0001', method: 'cash', amount: 59000, note: 'test refund' })
  assert.equal(refund.status, 201, JSON.stringify(refund.body))
  const managerVoid = await call('post', people.manager, `/invoices/${ids.invoice}/void`, { note: 'manager cannot' })
  assert.equal(managerVoid.status, 403)
  const ownerVoid = await call('post', people.owner, `/invoices/${ids.invoice}/void`, { note: 'owner can' })
  assert.equal(ownerVoid.status, 200, JSON.stringify(ownerVoid.body))
})

// ---------- 3. super admin vs salon people ----------
test('platform (Super Admin) APIs: only the admin; salon owners and staff get 403', async () => {
  for (const role of ROLES) {
    for (const [method, path, body] of [
      ['get', '/platform/overview'],
      ['get', '/platform/salons'],
      ['get', `/platform/salons/${A.salonId}`],
      ['patch', `/platform/salons/${A.salonId}/status`, { status: 'suspended' }],
      ['get', '/platform/users'],
    ]) {
      const res = await call(method, { auth: h.bearer(people[role].token) }, path, body)
      assert.equal(res.status, 403, `${role} ${path} must be 403, got ${res.status}`)
    }
  }
  assert.equal((await call('get', admin, '/platform/overview')).status, 200)
  assert.equal((await call('get', admin, '/platform/salons')).status, 200)
  assert.equal((await h.models.Salon.findById(A.salonId)).status, 'active') // the refused PATCH did nothing
})

test('a Super Admin is not "inside" any salon: salon APIs answer 404 or 400, never private salon data', async () => {
  const withHeader = await h.request(h.app).get(api('/invoices')).set(h.bearer(admin.token, A.salonId))
  assert.equal(withHeader.status, 404)
  const noHeader = await h.request(h.app).get(api('/customers')).set(admin.auth)
  assert.equal(noHeader.status, 400)
  const detail = await call('get', admin, `/platform/salons/${A.salonId}`)
  assert.equal(JSON.stringify(detail.body).includes('Riya'), false) // no customer data in the platform view
})

// ---------- 4. salon isolation: salon B can never touch salon A ----------
const A_LISTS = ['/bookings', '/customers', '/services', '/staff', '/offers', '/invoices', '/invoices/summary', '/users', '/notifications', '/audit-events', '/salons/current']

test('isolation: salon B owner using salon A id in the header gets 404 on every endpoint', async () => {
  const intruder = { auth: h.bearer(B.token, A.salonId) }
  for (const path of A_LISTS) {
    const res = await call('get', intruder, path)
    assert.equal(res.status, 404, `GET ${path} with a foreign salon id must be 404, got ${res.status}`)
    assert.equal(JSON.stringify(res.body).includes('Riya'), false)
  }
  for (const [method, path, body] of [
    ['post', '/services', { name: 'Injected', price: 1, durationMin: 30 }],
    ['post', `/invoices/${ids.invoice}/payments`, { requestKey: 'iso-key-0001', method: 'cash', amount: 1 }],
    ['patch', '/salons/current', { name: 'Hijacked' }],
  ]) {
    assert.equal((await call(method, intruder, path, body)).status, 404, `${method} ${path}`)
  }
  assert.equal(await h.models.Service.countDocuments({ salonId: A.salonId, name: 'Injected' }), 0)
  assert.notEqual((await h.models.Salon.findById(A.salonId)).name, 'Hijacked')
})

test('isolation: with its own salon id, salon B sees none of A\'s data and cannot open A\'s records by id', async () => {
  const own = { auth: h.bearer(B.token, B.salonId) }
  for (const path of ['/bookings', '/customers', '/services', '/staff', '/offers', '/invoices']) {
    const res = await call('get', own, path)
    assert.equal(res.status, 200)
    assert.equal(JSON.stringify(res.body.data).includes('Riya') || JSON.stringify(res.body.data).includes('Meera'), false, `${path} leaked salon A data`)
  }
  assert.equal((await call('get', own, `/invoices/${ids.invoice}`)).status, 404)
  assert.equal((await call('patch', own, `/services/${ids.service}`, { price: 1 })).status, 404)
  assert.equal((await call('delete', own, `/services/${ids.service}`)).status, 404)
  assert.equal((await call('patch', own, `/staff/${ids.staff}`, { title: 'x' })).status, 404)
  assert.equal((await call('patch', own, `/offers/${ids.offer}`, { active: false })).status, 404)
  assert.equal((await call('patch', own, `/bookings/${ids.booking}/status`, { status: 'confirmed' })).status, 404)
  assert.equal((await call('post', own, `/invoices/${ids.invoice}/payments`, { requestKey: 'iso-key-0002', method: 'cash', amount: 1 })).status, 404)
  assert.equal((await call('post', own, `/invoices/${ids.invoice}/refunds`, { requestKey: 'iso-key-0003', method: 'cash', amount: 1, note: 'steal' })).status, 404)
  assert.equal((await call('post', own, `/invoices/${ids.invoice}/void`, { note: 'steal' })).status, 404)
})

test('isolation: salon B cannot attach salon A\'s services, offers or appointments to its own records', async () => {
  const own = { auth: h.bearer(B.token, B.salonId) }
  assert.equal((await call('post', own, '/staff', { name: 'Spy', serviceIds: [ids.service] })).status, 400)
  assert.equal((await call('post', own, '/offers', { title: 'Cross', discountType: 'percent', discountValue: 5, startsOn: '2026-01-01', endsOn: '2099-01-01', serviceIds: [ids.service] })).status, 400)
  const bill = await call('post', own, '/invoices', { requestKey: 'iso-bill-0001', customerPhone: '9810000003', customerName: 'Cross Bill', lines: [{ serviceId: ids.service, quantity: 1 }] })
  assert.ok([400, 404].includes(bill.status), `billing salon A's service must fail, got ${bill.status}`)
  const withBooking = await call('post', own, '/invoices', { requestKey: 'iso-bill-0002', bookingId: ids.booking, lines: [{ serviceId: ids.service, quantity: 1 }] })
  assert.ok([400, 404].includes(withBooking.status), `billing salon A's appointment must fail, got ${withBooking.status}`)
  assert.equal(await h.models.Invoice.countDocuments({ salonId: B.salonId }), 0)
})

test('isolation: the same person in two salons only ever sees the salon they ask for', async () => {
  const both = await member('acc-both@x.com', A.salonId, 'receptionist')
  await h.models.Membership.create({ salonId: B.salonId, userId: both.userId, role: 'owner' })
  await h.models.Service.create({ salonId: B.salonId, name: 'B Only Service', price: 100, durationMin: 30 })
  const inA = await call('get', { auth: h.bearer(both.token, A.salonId) }, '/services')
  const inB = await call('get', { auth: h.bearer(both.token, B.salonId) }, '/services')
  assert.deepEqual(inA.body.data.services.map((s) => s.name), ['Haircut'])
  assert.deepEqual(inB.body.data.services.map((s) => s.name), ['B Only Service'])
  // the role is per salon: receptionist in A (no settings), owner in B (settings)
  assert.equal((await call('get', { auth: h.bearer(both.token, A.salonId) }, '/offers')).status, 200)
  assert.equal((await call('post', { auth: h.bearer(both.token, A.salonId) }, '/offers', { title: 'x', discountType: 'percent', discountValue: 5, startsOn: '2026-01-01', endsOn: '2099-01-01' })).status, 403)
  assert.equal((await call('post', { auth: h.bearer(both.token, B.salonId) }, '/offers', { title: 'x ok', discountType: 'percent', discountValue: 5, startsOn: '2026-01-01', endsOn: '2099-01-01' })).status, 201)
})

// ---------- 5. dead sessions ----------
test('sessions: deactivated user, removed member, mobile logout, expired and forged tokens all stop working at once', async () => {
  const gone = await member('acc-gone@x.com', A.salonId, 'receptionist')
  assert.equal((await call('get', gone, '/services')).status, 200)
  await h.models.Membership.updateOne({ salonId: A.salonId, userId: gone.userId }, { active: false })
  assert.equal((await call('get', gone, '/services')).status, 404) // no longer a member: salon does not even exist for them

  const off = await member('acc-off@x.com', A.salonId, 'manager')
  await h.models.User.updateOne({ _id: off.userId }, { active: false })
  assert.equal((await call('get', off, '/services')).status, 401)

  const out = await member('acc-out@x.com', A.salonId, 'manager')
  assert.equal((await h.request(h.app).post(api('/auth/mobile/logout')).send({ refreshToken: out.refreshToken })).status, 200)
  assert.equal((await call('get', out, '/services')).status, 401)

  const live = await member('acc-live@x.com', A.salonId, 'manager')
  const expired = jwt.sign({ sub: live.userId, fam: 'x' }, process.env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: -60 })
  const forged = jwt.sign({ sub: live.userId, fam: 'x' }, 'a-totally-different-secret-value-123456', { algorithm: 'HS256' })
  for (const token of [expired, forged, 'not-a-token', '']) {
    const res = await h.request(h.app).get(api('/services')).set({ Authorization: `Bearer ${token}`, 'X-Salon-Id': String(A.salonId) })
    assert.equal(res.status, 401, `token "${String(token).slice(0, 12)}" must be 401`)
  }
  const noAuth = await h.request(h.app).get(api('/services')).set({ 'X-Salon-Id': String(A.salonId) })
  assert.equal(noAuth.status, 401)
})

test('suspended salon: the mobile app can still read, but every write is refused', async () => {
  const S = await h.ownerWithSalon('acc-susp-owner@x.com', 'acc-susp-salon')
  await h.models.Salon.updateOne({ _id: S.salonId }, { status: 'suspended' })
  const auth = { auth: h.bearer(S.token, S.salonId) }
  assert.equal((await call('get', auth, '/services')).status, 200)
  assert.equal((await call('get', auth, '/invoices')).status, 200)
  for (const [method, path, body] of [
    ['post', '/services', { name: 'Late', price: 1, durationMin: 30 }],
    ['post', '/offers', { title: 'Late', discountType: 'percent', discountValue: 5, startsOn: '2026-01-01', endsOn: '2099-01-01' }],
    ['post', '/staff', { name: 'Late Person' }],
  ]) {
    const res = await call(method, auth, path, body)
    assert.equal(res.status, 403)
    assert.equal(res.body.error.code, 'SALON_SUSPENDED')
  }
})

test('packages: roles, selling, cancelling and isolation between salons', async () => {
  const mk = await call('post', people.owner, '/packages', { name: 'Haircut Saver', items: [{ serviceId: ids.service, sessions: 5 }], packagePrice: 2000, validityDays: 90 })
  assert.equal(mk.status, 201, JSON.stringify(mk.body))
  const pkgId = mk.body.data.package.id

  // who may read / write templates
  for (const role of ROLES) {
    const read = await call('get', people[role], '/packages')
    assert.equal(read.status, ['owner', 'manager', 'receptionist'].includes(role) ? 200 : 403, `${role} read /packages`)
  }
  for (const role of ['receptionist', 'staff']) {
    assert.equal((await call('post', people[role], '/packages', { name: 'Cheap', items: [], packagePrice: 1, validityDays: 10 })).status, 403)
    assert.equal((await call('patch', people[role], `/packages/${pkgId}`, { active: false })).status, 403)
  }

  // receptionist may sell, but not cancel; staff may do neither
  const sale = { requestKey: 'pkg-sale-key-0001', packageId: pkgId, customerPhone: '9810000055', customerName: 'Pkg Buyer', paymentStatus: 'pending' }
  assert.equal((await call('post', people.staff, '/customer-packages', sale)).status, 403)
  const sold = await call('post', people.receptionist, '/customer-packages', sale)
  assert.equal(sold.status, 201, JSON.stringify(sold.body))
  const cpId = sold.body.data.customerPackage.id
  assert.equal(sold.body.data.customerPackage.pricePaid, 2000) // price comes from the template, never from the client
  assert.equal((await call('post', people.receptionist, `/customer-packages/${cpId}/cancel`, { note: 'not allowed' })).status, 403)
  assert.equal((await call('post', people.receptionist, `/customer-packages/${cpId}/payment`, { paymentMethod: 'cash' })).status, 200)

  // salon B can neither see, change nor sell salon A's packages
  const own = { auth: h.bearer(B.token, B.salonId) }
  assert.equal((await call('get', own, `/customer-packages/${cpId}`)).status, 404)
  assert.equal((await call('post', own, `/customer-packages/${cpId}/cancel`, { note: 'steal it' })).status, 404)
  assert.equal((await call('post', own, `/customer-packages/${cpId}/payment`, { paymentMethod: 'cash' })).status, 404)
  assert.equal((await call('patch', own, `/packages/${pkgId}`, { active: false })).status, 404)
  assert.equal((await call('post', own, '/customer-packages', { ...sale, requestKey: 'pkg-cross-key-001' })).status, 400)
  assert.equal(JSON.stringify((await call('get', own, '/customer-packages')).body.data).includes('Pkg Buyer'), false)
  assert.equal((await call('get', { auth: h.bearer(B.token, A.salonId) }, '/packages')).status, 404)

  // the owner can cancel, and only once
  assert.equal((await call('post', people.owner, `/customer-packages/${cpId}/cancel`, { note: 'owner cancels' })).status, 200)
  assert.equal((await call('post', people.owner, `/customer-packages/${cpId}/cancel`, { note: 'again please' })).status, 409)
})

test('memberships: only the owner makes plans; sellers sell; manager/owner cancel; other salons see nothing', async () => {
  const plan = { name: 'Gold', price: 2000, durationDays: 365, discountType: 'percent', discountValue: 20 }
  for (const role of ['manager', 'receptionist', 'staff']) assert.equal((await call('post', people[role], '/membership-plans', plan)).status, 403, `${role} must not create plans`)
  const made = await call('post', people.owner, '/membership-plans', plan)
  assert.equal(made.status, 201, JSON.stringify(made.body))
  const planId = made.body.data.plan.id
  assert.equal((await call('patch', people.manager, `/membership-plans/${planId}`, { active: false })).status, 403)

  for (const role of ROLES) {
    assert.equal((await call('get', people[role], '/membership-plans')).status, ['owner', 'manager', 'receptionist'].includes(role) ? 200 : 403, `${role} read plans`)
    assert.equal((await call('get', people[role], '/customer-memberships')).status, ['owner', 'manager', 'receptionist'].includes(role) ? 200 : 403, `${role} read members`)
  }

  const sale = { requestKey: 'mem-sale-key-0001', planId, customerPhone: '9810000066', customerName: 'Member Buyer', paymentStatus: 'pending' }
  assert.equal((await call('post', people.staff, '/customer-memberships', sale)).status, 403)
  const sold = await call('post', people.receptionist, '/customer-memberships', sale)
  assert.equal(sold.status, 201, JSON.stringify(sold.body))
  const cm = sold.body.data.customerMembership
  assert.equal(cm.pricePaid, 2000) // from the plan, never from the client
  assert.equal(cm.benefitsActive, false) // no discount until the payment is received
  assert.equal((await call('post', people.receptionist, `/customer-memberships/${cm.id}/cancel`, { note: 'not allowed' })).status, 403)
  const paid = await call('post', people.receptionist, `/customer-memberships/${cm.id}/payment`, { paymentMethod: 'cash' })
  assert.equal(paid.status, 200)
  assert.equal(paid.body.data.customerMembership.benefitsActive, true)

  const own = { auth: h.bearer(B.token, B.salonId) }
  assert.equal((await call('get', own, `/customer-memberships/${cm.id}`)).status, 404)
  assert.equal((await call('post', own, `/customer-memberships/${cm.id}/cancel`, { note: 'steal it' })).status, 404)
  assert.equal((await call('patch', own, `/membership-plans/${planId}`, { active: false })).status, 404)
  assert.equal((await call('post', own, '/customer-memberships', { ...sale, requestKey: 'mem-cross-key-0001' })).status, 400)
  assert.equal(JSON.stringify((await call('get', own, '/customer-memberships')).body.data).includes('Member Buyer'), false)

  assert.equal((await call('post', people.manager, `/customer-memberships/${cm.id}/cancel`, { note: 'manager cancels' })).status, 200)
  assert.equal((await call('post', people.owner, `/customer-memberships/${cm.id}/cancel`, { note: 'again please' })).status, 409)
})

test('bad input never crashes the server or leaks internals (the mobile app shows these messages)', async () => {
  const bad = { auth: h.bearer(A.token, 'not-an-id') }
  const res = await call('get', bad, '/services')
  assert.equal(res.status, 400)
  const notFound = await call('get', people.owner, '/invoices/000000000000000000000001')
  assert.equal(notFound.status, 404)
  const junkId = await call('get', people.owner, '/invoices/not-an-object-id')
  assert.ok([400, 404].includes(junkId.status))
  const huge = await call('post', people.owner, '/services', { name: 'x'.repeat(5000), price: 1, durationMin: 30 })
  assert.equal(huge.status, 400)
  for (const r of [res, notFound, junkId, huge]) {
    const text = JSON.stringify(r.body)
    assert.equal(/stack|mongoose|node_modules|\bat \w+ \(/i.test(text), false, 'error leaked internals')
    assert.ok(r.body.error.code && r.body.requestId)
  }
})
