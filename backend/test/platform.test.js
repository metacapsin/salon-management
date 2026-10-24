const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
const request = h.request

before(h.connect)
after(h.disconnect)

async function makeAdmin(email) {
  await h.createVerifiedUser(email)
  await h.models.User.updateOne({ normalizedEmail: email }, { platformRole: 'admin' })
  return h.loginAs(email)
}

test('platform APIs: only a platform admin can use them (owner, manager and anonymous are refused)', async () => {
  const owner = await h.ownerWithSalon('pl-owner@x.com', 'pl-owner')
  const paths = ['/platform/overview', '/platform/salons', `/platform/salons/${owner.salonId}`]

  for (const p of paths) {
    assert.equal((await request(h.app).get(api(p))).status, 401, p)
    const asOwner = await request(h.app).get(api(p)).set(h.bearer(owner.token, owner.salonId))
    assert.equal(asOwner.status, 403, p)
  }
  const patch = await request(h.app).patch(api(`/platform/salons/${owner.salonId}/status`)).set(h.bearer(owner.token, owner.salonId)).send({ status: 'suspended' })
  assert.equal(patch.status, 403)
  assert.equal((await h.models.Salon.findById(owner.salonId)).status, 'active')

  // platformRole sirf database se aata he: register me bhejne par 400 (auth.test.js me bhi check hota he)
  assert.equal(owner.user.platformRole, null)
})

test('platform admin sees every salon, counts are real, and can suspend / activate with an audit record', async () => {
  const a = await h.ownerWithSalon('pl-a@x.com', 'pl-a')
  const b = await h.ownerWithSalon('pl-b@x.com', 'pl-b')
  const admin = await makeAdmin('pl-admin@x.com')
  assert.equal(admin.user.platformRole, 'admin')
  const auth = { Authorization: `Bearer ${admin.token}` } // koi X-Salon-Id nahi

  const overview = await request(h.app).get(api('/platform/overview')).set(auth)
  assert.equal(overview.status, 200, JSON.stringify(overview.body))
  assert.equal(overview.body.data.stats.total, await h.models.Salon.countDocuments({}))
  assert.equal(overview.body.data.stats.total >= 2, true)

  const list = await request(h.app).get(api('/platform/salons')).set(auth)
  const ids = list.body.data.salons.map((s) => s.id)
  assert.equal(ids.includes(a.salonId) && ids.includes(b.salonId), true)
  assert.equal(list.body.data.salons.find((s) => s.id === a.salonId).memberCount, 1)

  const search = await request(h.app).get(api('/platform/salons?q=pl-b')).set(auth)
  assert.deepEqual(search.body.data.salons.map((s) => s.id), [b.salonId])
  assert.equal((await request(h.app).get(api('/platform/salons?q=.*')).set(auth)).body.data.salons.length, 0) // regex safe

  const detail = await request(h.app).get(api(`/platform/salons/${a.salonId}`)).set(auth)
  assert.equal(detail.status, 200)
  assert.equal(detail.body.data.salon.teamByRole.owner, 1)

  const suspend = await request(h.app).patch(api(`/platform/salons/${a.salonId}/status`)).set(auth).send({ status: 'suspended', reason: 'test' })
  assert.equal(suspend.status, 200, JSON.stringify(suspend.body))
  assert.equal((await h.models.Salon.findById(a.salonId)).status, 'suspended')
  assert.equal(await h.models.AuditEvent.countDocuments({ salonId: a.salonId, action: 'platform.salon_suspended' }), 1)

  // Suspended salon me owner ab likh nahi sakta
  const write = await request(h.app).patch(api('/salons/current')).set(h.bearer(a.token, a.salonId)).send({ about: 'x' })
  assert.equal(write.status, 403)

  const back = await request(h.app).patch(api(`/platform/salons/${a.salonId}/status`)).set(auth).send({ status: 'active' })
  assert.equal(back.body.data.salon.status, 'active')

  assert.equal((await request(h.app).patch(api(`/platform/salons/${a.salonId}/status`)).set(auth).send({ status: 'deleted' })).status, 400)
  assert.equal((await request(h.app).get(api('/platform/salons/not-an-id')).set(auth)).status, 400)
  assert.equal((await request(h.app).get(api('/platform/salons/64b000000000000000000000')).set(auth)).status, 404)
})

test('a platform admin is not automatically a member of salons (normal salon APIs still need membership)', async () => {
  const a = await h.ownerWithSalon('pl-c@x.com', 'pl-c')
  const admin = await makeAdmin('pl-admin2@x.com')
  const res = await request(h.app).get(api('/salons/current')).set(h.bearer(admin.token, a.salonId))
  assert.equal(res.status, 404)
})

test('platform audit and users lists: admin only, no secrets, platform-wide', async () => {
  const o = await h.ownerWithSalon('pl-d@x.com', 'pl-d')
  const admin = await makeAdmin('pl-admin3@x.com')
  const auth = { Authorization: `Bearer ${admin.token}` }

  for (const p of ['/platform/audit-events', '/platform/users']) {
    assert.equal((await request(h.app).get(api(p))).status, 401, p)
    assert.equal((await request(h.app).get(api(p)).set(h.bearer(o.token, o.salonId))).status, 403, p)
  }

  const audit = await request(h.app).get(api('/platform/audit-events')).set(auth)
  assert.equal(audit.status, 200, JSON.stringify(audit.body))
  const created = audit.body.data.events.find((e) => e.action === 'salon.created' && e.salonId === o.salonId)
  assert.equal(created.salonName, 'Salon pl-d')
  assert.equal((await request(h.app).get(api(`/platform/audit-events?salonId=${o.salonId}`)).set(auth)).body.data.events.every((e) => e.salonId === o.salonId), true)

  const users = await request(h.app).get(api('/platform/users?q=pl-d@')).set(auth)
  assert.equal(users.status, 200)
  assert.equal(users.body.data.users.length, 1)
  assert.deepEqual(users.body.data.users[0].salons.map((s) => s.role), ['owner'])
  assert.equal(JSON.stringify(users.body).includes('passwordHash'), false)
})

test('platform admin can create an owner account and salon together; duplicates and non-admins are refused', async () => {
  const admin = await makeAdmin('pl-create-admin@x.com')
  const auth = { Authorization: `Bearer ${admin.token}` }
  const body = { ownerName: 'Made Owner', ownerEmail: 'PL-Create-Owner@x.com', password: 'a-long-strong-pass-1', name: 'Admin Made Salon', slug: 'admin-made-salon', address: { city: 'Jaipur' } }

  const created = await request(h.app).post(api('/platform/salons')).set(auth).send(body)
  assert.equal(created.status, 201, JSON.stringify(created.body))
  assert.equal(created.body.data.salon.ownerEmail, 'pl-create-owner@x.com')
  assert.equal(JSON.stringify(created.body).includes('a-long-strong-pass-1'), false)
  assert.equal(created.body.data.emailSent, true)
  const mail = h.outbox.find((m) => m.to === 'pl-create-owner@x.com')
  assert.ok(mail, 'owner gets an email')
  assert.equal(JSON.stringify(mail).includes('a-long-strong-pass-1'), false) // password kabhi email nahi hota
  const owner = await h.models.User.findOne({ normalizedEmail: 'pl-create-owner@x.com' })
  assert.equal(owner.approvalStatus, 'approved')
  assert.equal(Boolean(owner.verifiedAt), true)
  const salon = await h.models.Salon.findById(created.body.data.salon.id)
  assert.equal(String(salon.ownerIds[0]), String(owner._id))
  assert.equal(await h.models.Membership.countDocuments({ salonId: salon._id, userId: owner._id, role: 'owner' }), 1)
  assert.equal(await h.models.Membership.countDocuments({ salonId: salon._id, userId: admin.user.id }), 0)
  // naya owner naye password se login kar sakta he
  assert.equal((await h.loginAs('pl-create-owner@x.com', 'a-long-strong-pass-1')).user.email, 'pl-create-owner@x.com')

  assert.equal((await request(h.app).post(api('/platform/salons')).set(auth).send({ ...body, slug: 'another-slug' })).status, 409) // email taken
  assert.equal((await request(h.app).post(api('/platform/salons')).set(auth).send({ ...body, ownerEmail: 'other-owner@x.com' })).status, 409) // slug taken
  assert.equal(await h.models.User.countDocuments({ normalizedEmail: 'other-owner@x.com' }), 0)

  const plain = await h.ownerWithSalon('pl-create-plain@x.com', 'pl-create-plain')
  assert.equal((await request(h.app).post(api('/platform/salons')).set(h.bearer(plain.token, plain.salonId)).send({ ...body, ownerEmail: 'x2@x.com', slug: 'other-salon' })).status, 403)
})
