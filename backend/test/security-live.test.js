// Live API security checks. Tests glamora_test database me chalte hain (asli data safe).
// Covers: har protected route bina token ke, nakli/expired/tampered token, customer<->staff token mixing,
// NoSQL injection, mass assignment, role escalation, security headers.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const jwt = require('jsonwebtoken')
const h = require('./helpers')

const api = (p) => `/api/v1${p}`
const SRC = path.join(__dirname, '..', 'src', 'modules')
const FAKE_ID = '64b64b64b64b64b64b64b64b'

before(h.connect)
after(h.disconnect)

// Har protected mount ki route files padhke (method, url) ki list banate hain.
const PROTECTED = [
  ['/salons', 'salons/salons.routes.js'],
  ['/users', 'users/users.routes.js'],
  ['/services', 'services/services.routes.js'],
  ['/staff', 'staff/staff.routes.js'],
  ['/offers', 'offers/offers.routes.js'],
  ['/packages', 'packages/packages.routes.js'],
  ['/membership-plans', 'memberships/membershipPlans.routes.js'],
  ['/customer-memberships', 'memberships/customerMemberships.routes.js'],
  ['/customer-packages', 'packages/customerPackages.routes.js'],
  ['/customers', 'customers/salonCustomers.routes.js'],
  ['/bookings', 'bookings/bookings.routes.js'],
  ['/invoices', 'billing/invoices.routes.js'],
  ['/notifications', 'notifications/notifications.routes.js'],
  ['/reviews', 'reviews/ownerReviews.routes.js'],
  ['/audit-events', 'audit/audit.routes.js'],
  ['/platform', 'platform/platform.routes.js'],
]

function protectedRoutes() {
  const out = []
  for (const [prefix, file] of PROTECTED) {
    const src = fs.readFileSync(path.join(SRC, file), 'utf8')
    const re = /\brouter\.(get|post|put|patch|delete)\(\s*'([^']*)'/g
    let m
    while ((m = re.exec(src))) out.push({ method: m[1], url: api(prefix + m[2].replace(/:\w+/g, FAKE_ID)) })
  }
  return out
}

test('every protected route refuses a request with no token (401)', async () => {
  const routes = protectedRoutes()
  assert.ok(routes.length > 60, `expected many routes, found ${routes.length}`)
  const bad = []
  for (const r of routes) {
    const res = await h.request(h.app)[r.method](r.url).send({})
    if (res.status !== 401) bad.push(`${r.method.toUpperCase()} ${r.url} -> ${res.status}`)
  }
  assert.deepEqual(bad, [], `routes reachable without a token:\n${bad.join('\n')}`)
})

test('every protected route also refuses garbage and wrong-scheme tokens', async () => {
  const routes = protectedRoutes()
  const bad = []
  for (const r of routes) {
    for (const auth of ['Bearer garbage', 'Bearer ', 'Basic YWRtaW46YWRtaW4=', 'Bearer null', 'Bearer undefined']) {
      const res = await h.request(h.app)[r.method](r.url).set('Authorization', auth).send({})
      if (res.status !== 401) bad.push(`${r.method.toUpperCase()} ${r.url} [${auth}] -> ${res.status}`)
    }
  }
  assert.deepEqual(bad, [], bad.join('\n'))
})

test('forged, expired, tampered and wrong-secret tokens are all refused', async () => {
  const owner = await h.ownerWithSalon('sec-owner@example.com', 'sec-owner')
  const claims = jwt.decode(owner.token)
  const secret = process.env.JWT_ACCESS_SECRET
  const hit = (token) => h.request(h.app).get(api('/users')).set(h.bearer(token, owner.salonId))

  // sanity: asli token chalta he
  assert.equal((await hit(owner.token)).status, 200)

  const expired = jwt.sign({ sub: claims.sub, fam: claims.fam }, secret, { algorithm: 'HS256', expiresIn: -60 })
  const wrongSecret = jwt.sign({ sub: claims.sub, fam: claims.fam }, 'another-secret-another-secret-123456789', { algorithm: 'HS256', expiresIn: 600 })
  const fakeFamily = jwt.sign({ sub: claims.sub, fam: 'not-a-real-family' }, secret, { algorithm: 'HS256', expiresIn: 600 })
  const noFamily = jwt.sign({ sub: claims.sub }, secret, { algorithm: 'HS256', expiresIn: 600 })
  const unknownUser = jwt.sign({ sub: FAKE_ID, fam: claims.fam }, secret, { algorithm: 'HS256', expiresIn: 600 })
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const algNone = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: claims.sub, fam: claims.fam, exp: claims.exp })}.`
  const [hd, , sig] = owner.token.split('.')
  const tampered = `${hd}.${b64({ ...claims, sub: FAKE_ID })}.${sig}`
  const hs512 = jwt.sign({ sub: claims.sub, fam: claims.fam }, secret, { algorithm: 'HS512', expiresIn: 600 })

  for (const [name, token] of Object.entries({ expired, wrongSecret, fakeFamily, noFamily, unknownUser, algNone, tampered, hs512 })) {
    const res = await hit(token)
    assert.equal(res.status, 401, `${name} token was accepted (${res.status})`)
  }
})

test('customer token cannot be used on salon APIs, and a salon token cannot be used on customer APIs', async () => {
  const owner = await h.ownerWithSalon('sec-mix@example.com', 'sec-mix')
  const customer = await h.customerAgent('9810000777')

  const asCustomer = await customer.get(api('/users')).set(h.bearer('x', owner.salonId))
  assert.equal(asCustomer.status, 401)
  const cookieOnly = await customer.get(api('/services')).set('X-Salon-Id', owner.salonId)
  assert.equal(cookieOnly.status, 401)

  // customer ka asli JWT Bearer me bhejo (same secret, alag typ)
  const custMe = await customer.get(api('/customer/me'))
  assert.equal(custMe.status, 200)
  const forgedCustomerTyp = jwt.sign({ sub: owner.user.id, fam: jwt.decode(owner.token).fam }, process.env.JWT_ACCESS_SECRET, { algorithm: 'HS256', expiresIn: 600 })
  const onCustomerApi = await h.request(h.app).get(api('/customer/me')).set('Authorization', `Bearer ${forgedCustomerTyp}`)
  assert.equal(onCustomerApi.status, 401, 'staff token (no typ=customer) must not open customer APIs')
  const staffTokenOnCustomerApi = await h.request(h.app).get(api('/customer/me')).set('Authorization', `Bearer ${owner.token}`)
  assert.equal(staffTokenOnCustomerApi.status, 401)
})

test('NoSQL operators and wrong types in login/query input are refused, never executed', async () => {
  await h.createVerifiedUser('sec-inject@example.com')
  const bodies = [
    { email: { $ne: null }, password: { $ne: null } },
    { email: 'sec-inject@example.com', password: { $gt: '' } },
    { email: { $regex: '.*' }, password: h.PASSWORD },
    { email: ['sec-inject@example.com'], password: h.PASSWORD },
    { email: 'sec-inject@example.com', password: [h.PASSWORD] },
  ]
  for (const body of bodies) {
    const res = await h.request(h.app).post(api('/auth/login')).send(body)
    assert.ok([400, 401].includes(res.status), `login accepted ${JSON.stringify(body)} -> ${res.status}`)
    assert.equal(res.body.data?.accessToken, undefined)
  }

  const owner = await h.ownerWithSalon('sec-query@example.com', 'sec-query')
  const queries = ['search[$ne]=x', 'search=((((', 'search=.*', 'q[$gt]=', 'status[$ne]=active', 'page=-1', 'pageSize=999999', 'page=abc']
  for (const base of ['/customers', '/services', '/bookings', '/invoices', '/staff', '/users']) {
    for (const q of queries) {
      const res = await h.request(h.app).get(`${api(base)}?${q}`).set(h.bearer(owner.token, owner.salonId))
      assert.ok(res.status < 500, `${base}?${q} -> ${res.status}`)
      assert.ok(!/stack|MongoServerError|node_modules/i.test(res.text), `${base}?${q} leaked internals`)
    }
  }
})

test('mass assignment: client cannot set salonId, role, platformRole or owner fields', async () => {
  const a = await h.ownerWithSalon('sec-mass-a@example.com', 'sec-mass-a')
  const b = await h.ownerWithSalon('sec-mass-b@example.com', 'sec-mass-b')

  // doosre salon ki id body me
  const svc = await h.request(h.app).post(api('/services')).set(h.bearer(a.token, a.salonId))
    .send({ name: 'Haircut', price: 300, durationMin: 30, salonId: b.salonId, category: 'Hair' })
  if (svc.status === 201) {
    const mine = await h.models.Service.findById(svc.body.data.service?.id ?? svc.body.data.id)
    assert.equal(String(mine.salonId), String(a.salonId), 'service landed in another salon')
  } else {
    assert.equal(svc.status, 400, JSON.stringify(svc.body))
  }
  assert.equal(await h.models.Service.countDocuments({ salonId: b.salonId }), 0)

  // register me role / platformRole / approvalStatus
  for (const extra of [{ platformRole: 'admin' }, { role: 'owner' }, { approvalStatus: 'approved' }, { active: true }]) {
    const res = await h.request(h.app).post(api('/auth/register')).send({ name: 'Mallory', email: `m${Math.random().toString(36).slice(2, 8)}@example.com`, password: h.PASSWORD, ...extra })
    assert.equal(res.status, 400, `register accepted ${JSON.stringify(extra)}`)
  }
  const admins = await h.models.User.countDocuments({ platformRole: 'admin' })
  assert.equal(admins, 0)

  // salon update me status / ownerId jaise fields
  const patch = await h.request(h.app).patch(api(`/salons/${a.salonId}`)).set(h.bearer(a.token, a.salonId)).send({ status: 'active', ownerId: b.user.id, platformRole: 'admin' })
  assert.ok([400, 404, 405].includes(patch.status) || patch.status === 200, `unexpected ${patch.status}`)
  const freshUser = await h.models.User.findById(a.user.id)
  assert.notEqual(freshUser.platformRole, 'admin')
})

test('role escalation: manager and receptionist cannot invite owners, change roles or reach platform APIs', async () => {
  const owner = await h.ownerWithSalon('sec-role-owner@example.com', 'sec-role')
  async function member(email, role) {
    const inv = await h.request(h.app).post(api('/users/invitations')).set(h.bearer(owner.token, owner.salonId)).send({ email, role })
    assert.equal(inv.status, 201, JSON.stringify(inv.body))
    const accept = await h.request(h.app).post(api('/auth/accept-invitation')).send({ token: h.tokenFromMail(email), name: `${role} user`, password: h.PASSWORD })
    assert.equal(accept.status, 201, JSON.stringify(accept.body))
    return h.loginAs(email)
  }
  const manager = await member('sec-manager@example.com', 'manager')
  const recep = await member('sec-recep@example.com', 'receptionist')

  for (const who of [manager, recep]) {
    const inviteOwner = await h.request(h.app).post(api('/users/invitations')).set(h.bearer(who.token, owner.salonId)).send({ email: 'x-evil@example.com', role: 'owner' })
    assert.equal(inviteOwner.status, 403)
    const selfPromote = await h.request(h.app).patch(api(`/users/${who.user.id}`)).set(h.bearer(who.token, owner.salonId)).send({ role: 'owner' })
    assert.equal(selfPromote.status, 403)
    const plat = await h.request(h.app).get(api('/platform/salons')).set(h.bearer(who.token))
    assert.equal(plat.status, 403)
    const del = await h.request(h.app).delete(api(`/services/${FAKE_ID}`)).set(h.bearer(who.token, owner.salonId))
    // manager ko services.write milta he (404 = record nahi mila), receptionist ko nahi (403)
    assert.equal(del.status, who === recep ? 403 : 404)
  }

  // owner khud bhi platform role / invalid role invite nahi kar sakta
  for (const role of ['admin', 'superadmin', 'platform', '', null]) {
    const res = await h.request(h.app).post(api('/users/invitations')).set(h.bearer(owner.token, owner.salonId)).send({ email: 'x-role@example.com', role })
    assert.equal(res.status, 400, `invited as role ${role} -> ${res.status}`)
  }
  const ownerOnPlatform = await h.request(h.app).get(api('/platform/salons')).set(h.bearer(owner.token))
  assert.equal(ownerOnPlatform.status, 403)

  // owner header ke bina / galat id ke saath
  const noSalon = await h.request(h.app).get(api('/services')).set(h.bearer(owner.token))
  assert.equal(noSalon.status, 400)
  const badSalon = await h.request(h.app).get(api('/services')).set(h.bearer(owner.token, 'not-an-id'))
  assert.equal(badSalon.status, 400)
  const fakeSalon = await h.request(h.app).get(api('/services')).set(h.bearer(owner.token, FAKE_ID))
  assert.equal(fakeSalon.status, 404)
})

test('security headers: no x-powered-by, nosniff, JSON content type, CORS only for our origin', async () => {
  const res = await h.request(h.app).get(api('/users')).set('Origin', 'https://evil.example.com')
  assert.equal(res.headers['x-powered-by'], undefined)
  assert.equal(res.headers['x-content-type-options'], 'nosniff')
  assert.match(res.headers['content-type'], /application\/json/)
  assert.notEqual(res.headers['access-control-allow-origin'], '*')
  assert.notEqual(res.headers['access-control-allow-origin'], 'https://evil.example.com')

  // oversized body
  const big = await h.request(h.app).post(api('/auth/login')).send({ email: 'a@b.co', password: 'x'.repeat(200000) })
  assert.equal(big.status, 413)
  // malformed JSON
  const bad = await h.request(h.app).post(api('/auth/login')).set('Content-Type', 'application/json').send('{"email":')
  assert.equal(bad.status, 400)
})

test('stored XSS payloads are never executed by the API (returned as JSON text) and bad ids never crash', async () => {
  const owner = await h.ownerWithSalon('sec-xss@example.com', 'sec-xss')
  const payload = '<img src=x onerror=alert(1)>'
  const res = await h.request(h.app).post(api('/services')).set(h.bearer(owner.token, owner.salonId)).send({ name: payload, price: 100, durationMin: 30, category: 'Hair' })
  assert.ok([201, 400].includes(res.status), `${res.status}`)
  assert.match(res.headers['content-type'], /application\/json/)

  for (const id of ['abc', '%00', '../../etc/passwd', '{"$ne":1}', 'null']) {
    for (const base of ['/services', '/bookings', '/invoices', '/customers', '/staff', '/packages']) {
      const r = await h.request(h.app).get(`${api(base)}/${encodeURIComponent(id)}`).set(h.bearer(owner.token, owner.salonId))
      assert.ok(r.status >= 400 && r.status < 500, `${base}/${id} -> ${r.status}`)
    }
  }
  // uploads: path traversal
  const trav = await h.request(h.app).get('/uploads/..%2f..%2f.env')
  assert.ok([400, 403, 404].includes(trav.status), `uploads traversal -> ${trav.status}`)
  assert.doesNotMatch(trav.text, /JWT_ACCESS_SECRET/)
})
