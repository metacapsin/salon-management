const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`

before(h.connect)
after(h.disconnect)

// Owner ke saath ek manager (invitation se) bana deta hai.
async function inviteAndAccept(owner, email, role) {
  const inv = await h.request(h.app).post(api('/users/invitations')).set(h.bearer(owner.token, owner.salonId)).send({ email, role })
  assert.equal(inv.status, 201, JSON.stringify(inv.body))
  const token = h.tokenFromMail(email)
  const accept = await h.request(h.app).post(api('/auth/accept-invitation')).send({ token, name: `${role} user`, password: h.PASSWORD })
  assert.equal(accept.status, 201, JSON.stringify(accept.body))
  return h.loginAs(email)
}

test('creating a salon makes salon + branch + owner membership together', async () => {
  const owner = await h.ownerWithSalon('o1@x.com', 'alpha-salon')
  assert.equal(await h.models.Salon.countDocuments({ slug: 'alpha-salon' }), 1)
  assert.equal(await h.models.Branch.countDocuments({ salonId: owner.salonId }), 1)
  const m = await h.models.Membership.findOne({ salonId: owner.salonId })
  assert.equal(m.role, 'owner')
  assert.equal(String(m.userId), String(owner.user.id))
})

test('slug rules: reserved/invalid refused, duplicate gives 409 and leaves no half-created salon', async () => {
  const owner = await h.ownerWithSalon('o2@x.com', 'beta-salon')
  const post = (slug) => h.request(h.app).post(api('/salons')).set(h.bearer(owner.token)).send({ name: 'Another', slug })

  assert.equal((await post('Bad Slug!')).status, 400)
  assert.equal((await post('ab')).status, 400)
  assert.equal((await post('admin')).status, 400)

  const before = await h.models.Salon.countDocuments()
  const dup = await post('beta-salon')
  assert.equal(dup.status, 409)
  assert.equal(dup.body.error.code, 'SLUG_TAKEN')
  assert.equal(await h.models.Salon.countDocuments(), before)
  assert.equal(await h.models.Branch.countDocuments(), before)
})

test('AT-02: another salon id returns 404, and switching salon returns only that salon data', async () => {
  const a = await h.ownerWithSalon('a@x.com', 'salon-a')
  const b = await h.ownerWithSalon('b@x.com', 'salon-b')

  const cross = await h.request(h.app).get(api('/salons/current')).set(h.bearer(a.token, b.salonId))
  assert.equal(cross.status, 404)
  const crossUsers = await h.request(h.app).get(api('/users')).set(h.bearer(a.token, b.salonId))
  assert.equal(crossUsers.status, 404)
  const crossAudit = await h.request(h.app).get(api('/audit-events')).set(h.bearer(a.token, b.salonId))
  assert.equal(crossAudit.status, 404)

  const own = await h.request(h.app).get(api('/salons/current')).set(h.bearer(a.token, a.salonId))
  assert.equal(own.body.data.salon.slug, 'salon-a')

  // Ek user, do salon: header badalte hi data badalta hai
  await h.models.Membership.create({ salonId: b.salonId, userId: a.user.id, role: 'manager' })
  const switched = await h.request(h.app).get(api('/salons/current')).set(h.bearer(a.token, b.salonId))
  assert.equal(switched.body.data.salon.slug, 'salon-b')
  const team = await h.request(h.app).get(api('/users')).set(h.bearer(a.token, b.salonId))
  assert.deepEqual(team.body.data.members.map((m) => m.email).sort(), ['a@x.com', 'b@x.com'])
})

test('AT-01: publishing is blocked with an explanation while setup is incomplete', async () => {
  const o = await h.ownerWithSalon('pub@x.com', 'pub-salon')
  const res = await h.request(h.app).patch(api('/salons/current')).set(h.bearer(o.token, o.salonId)).send({ publicBookingEnabled: true })
  assert.equal(res.status, 409)
  assert.equal(res.body.error.code, 'PUBLISH_BLOCKED')
  assert.ok(res.body.error.details.blockers.length >= 1)
  const salon = await h.models.Salon.findById(o.salonId)
  assert.equal(salon.publicBookingEnabled, false)
})

test('opening hours: valid hours saved, overlaps and bad times refused', async () => {
  const o = await h.ownerWithSalon('hrs@x.com', 'hours-salon')
  const put = (body) => h.request(h.app).put(api('/salons/current/hours')).set(h.bearer(o.token, o.salonId)).send(body)

  const ok = await put({ weeklyHours: { mon: [{ start: '09:00', end: '20:00' }], tue: [{ start: '09:00', end: '13:00' }, { start: '14:00', end: '20:00' }] }, holidays: [{ date: '2026-11-01', name: 'Closed' }] })
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.equal(ok.body.data.salon.weeklyHours.mon[0].start, '09:00')
  assert.equal(ok.body.data.salon.weeklyHours.wed.length, 0)

  assert.equal((await put({ weeklyHours: { mon: [{ start: '09:00', end: '12:00' }, { start: '11:00', end: '14:00' }] }, holidays: [] })).status, 400)
  assert.equal((await put({ weeklyHours: { mon: [{ start: '10:00', end: '09:00' }] }, holidays: [] })).status, 400)
  assert.equal((await put({ weeklyHours: { mon: [{ start: '09:03', end: '12:00' }] }, holidays: [] })).status, 400)
  assert.equal((await put({ weeklyHours: {}, holidays: [{ date: '2026-11-01' }, { date: '2026-11-01' }] })).status, 400)
})

test('permission matrix: manager reads settings but cannot edit; receptionist cannot see team or audit', async () => {
  const owner = await h.ownerWithSalon('perm-o@x.com', 'perm-salon')
  const manager = await inviteAndAccept(owner, 'perm-m@x.com', 'manager')
  const recep = await inviteAndAccept(owner, 'perm-r@x.com', 'receptionist')
  const salonId = owner.salonId

  assert.equal((await h.request(h.app).get(api('/salons/current')).set(h.bearer(manager.token, salonId))).body.data.salon.settings !== undefined, true)
  assert.equal((await h.request(h.app).patch(api('/salons/current')).set(h.bearer(manager.token, salonId)).send({ name: 'Hacked' })).status, 403)
  assert.equal((await h.request(h.app).post(api('/users/invitations')).set(h.bearer(manager.token, salonId)).send({ email: 'z@x.com', role: 'manager' })).status, 403)
  assert.equal((await h.request(h.app).get(api('/users')).set(h.bearer(manager.token, salonId))).status, 200)
  assert.equal((await h.request(h.app).get(api('/audit-events')).set(h.bearer(manager.token, salonId))).status, 200)

  assert.equal((await h.request(h.app).get(api('/users')).set(h.bearer(recep.token, salonId))).status, 403)
  assert.equal((await h.request(h.app).get(api('/audit-events')).set(h.bearer(recep.token, salonId))).status, 403)
  const summaryOnly = await h.request(h.app).get(api('/salons/current')).set(h.bearer(recep.token, salonId))
  assert.equal(summaryOnly.status, 200)
  assert.equal(summaryOnly.body.data.salon.settings, undefined) // receptionist ko settings detail nahi
  assert.equal((await h.request(h.app).patch(api('/users/' + manager.user.id)).set(h.bearer(recep.token, salonId)).send({ role: 'owner' })).status, 403)
})

test('invitations: single-use, expire after 48h without creating a membership, staff role needs a profile', async () => {
  const owner = await h.ownerWithSalon('inv-o@x.com', 'inv-salon')
  const send = (email, role) => h.request(h.app).post(api('/users/invitations')).set(h.bearer(owner.token, owner.salonId)).send({ email, role })

  assert.equal((await send('s@x.com', 'staff')).status, 400)
  assert.equal((await send('x@x.com', 'owner')).status, 400)

  assert.equal((await send('new@x.com', 'receptionist')).status, 201)
  const token = h.tokenFromMail('new@x.com')
  const weak = await h.request(h.app).post(api('/auth/accept-invitation')).send({ token, name: 'New', password: 'short' })
  assert.equal(weak.status, 400)
  const ok = await h.request(h.app).post(api('/auth/accept-invitation')).send({ token, name: 'New', password: h.PASSWORD })
  assert.equal(ok.status, 201)
  const again = await h.request(h.app).post(api('/auth/accept-invitation')).send({ token, name: 'New', password: h.PASSWORD })
  assert.equal(again.status, 400)

  // Expired
  assert.equal((await send('late@x.com', 'manager')).status, 201)
  const lateToken = h.tokenFromMail('late@x.com')
  await h.models.VerificationToken.updateMany({ purpose: 'invitation', 'payload.email': 'late@x.com' }, { expiresAt: new Date(Date.now() - 1000) })
  const expired = await h.request(h.app).post(api('/auth/accept-invitation')).send({ token: lateToken, name: 'Late', password: h.PASSWORD })
  assert.equal(expired.status, 400)
  assert.equal(await h.models.User.countDocuments({ normalizedEmail: 'late@x.com' }), 0)
  assert.equal(await h.models.Membership.countDocuments({ salonId: owner.salonId }), 2) // owner + "new"
})

test('AT-03: deactivating a member blocks their still-valid token at once', async () => {
  const owner = await h.ownerWithSalon('deact-o@x.com', 'deact-salon')
  const rec = await inviteAndAccept(owner, 'deact-r@x.com', 'receptionist')
  assert.equal((await h.request(h.app).get(api('/salons/current')).set(h.bearer(rec.token, owner.salonId))).status, 200)

  const off = await h.request(h.app).patch(api('/users/' + rec.user.id)).set(h.bearer(owner.token, owner.salonId)).send({ active: false })
  assert.equal(off.status, 200)
  assert.equal((await h.request(h.app).get(api('/salons/current')).set(h.bearer(rec.token, owner.salonId))).status, 404)

  // User khud poore deactivate ho to token bhi bekaar
  await h.models.User.updateOne({ _id: rec.user.id }, { active: false })
  assert.equal((await h.request(h.app).get(api('/me')).set(h.bearer(rec.token))).status, 401)
})

test('the last active owner cannot be demoted or deactivated; with a second owner it can', async () => {
  const owner = await h.ownerWithSalon('last-o@x.com', 'last-salon')
  const patchSelf = (body) => h.request(h.app).patch(api('/users/' + owner.user.id)).set(h.bearer(owner.token, owner.salonId)).send(body)

  const demote = await patchSelf({ role: 'manager' })
  assert.equal(demote.status, 409)
  assert.equal(demote.body.error.code, 'LAST_OWNER')
  assert.equal((await patchSelf({ active: false })).status, 409)

  const mgr = await inviteAndAccept(owner, 'last-m@x.com', 'manager')
  assert.equal((await h.request(h.app).patch(api('/users/' + mgr.user.id)).set(h.bearer(owner.token, owner.salonId)).send({ role: 'owner' })).status, 200)
  assert.equal((await patchSelf({ role: 'manager' })).status, 200)
  const salon = await h.models.Salon.findById(owner.salonId)
  assert.deepEqual(salon.ownerIds.map(String), [String(mgr.user.id)])
})

test('lists are paginated and capped', async () => {
  const owner = await h.ownerWithSalon('page-o@x.com', 'page-salon')
  const big = await h.request(h.app).get(api('/users?pageSize=1000')).set(h.bearer(owner.token, owner.salonId))
  assert.equal(big.status, 400)
  const ok = await h.request(h.app).get(api('/audit-events?page=1&pageSize=2')).set(h.bearer(owner.token, owner.salonId))
  assert.equal(ok.status, 200)
  assert.equal(ok.body.meta.pageSize, 2)
  assert.ok(ok.body.data.events.length <= 2)
})

test('suspended salon: reads work, writes are refused', async () => {
  const owner = await h.ownerWithSalon('susp-o@x.com', 'susp-salon')
  await h.models.Salon.updateOne({ _id: owner.salonId }, { status: 'suspended' })
  assert.equal((await h.request(h.app).get(api('/salons/current')).set(h.bearer(owner.token, owner.salonId))).status, 200)
  const write = await h.request(h.app).patch(api('/salons/current')).set(h.bearer(owner.token, owner.salonId)).send({ name: 'New name' })
  assert.equal(write.status, 403)
  assert.equal(write.body.error.code, 'SALON_SUSPENDED')
})

test('errors never leak internals and unknown routes return the standard shape', async () => {
  const res = await h.request(h.app).get(api('/does-not-exist'))
  assert.equal(res.status, 404)
  assert.equal(res.body.error.code, 'NOT_FOUND')
  const bad = await h.request(h.app).post(api('/auth/login')).set('Content-Type', 'application/json').send('{"email":')
  assert.equal(bad.status, 400)
  assert.doesNotMatch(JSON.stringify(bad.body), /SyntaxError|at /)
})
