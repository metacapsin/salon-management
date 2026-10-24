const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
const cookieOf = (res) => (res.headers['set-cookie'] || []).find((c) => c.startsWith('glamora_rt='))

before(h.connect)
after(h.disconnect)

test('register: weak password is rejected, valid one is accepted with a neutral message', async () => {
  const weak = await h.request(h.app).post(api('/auth/register')).send({ name: 'A', email: 'weak@x.com', password: 'short' })
  assert.equal(weak.status, 400)
  assert.equal(weak.body.error.code, 'VALIDATION_ERROR')
  assert.ok(weak.body.error.fieldErrors.password)

  const ok = await h.request(h.app).post(api('/auth/register')).send({ name: 'A', email: 'Reg@X.com', password: h.PASSWORD })
  assert.equal(ok.status, 201)
  assert.ok(ok.body.requestId)

  // Same email dobara: bilkul wahi jawab, kuch leak nahi hota
  const again = await h.request(h.app).post(api('/auth/register')).send({ name: 'A', email: 'reg@x.com', password: h.PASSWORD })
  assert.equal(again.status, 201)
  assert.deepEqual(again.body.data, ok.body.data)
  assert.equal(await h.models.User.countDocuments({ normalizedEmail: 'reg@x.com' }), 1)
})

test('register: unknown fields are refused (no client-supplied role)', async () => {
  const res = await h.request(h.app).post(api('/auth/register')).send({ name: 'A', email: 'sneak@x.com', password: h.PASSWORD, role: 'owner', platformRole: 'admin' })
  assert.equal(res.status, 400)
  assert.equal(await h.models.User.countDocuments({ normalizedEmail: 'sneak@x.com' }), 0)
})

test('login: unverified owner cannot sign in; wrong password and unknown email look identical', async () => {
  await h.request(h.app).post(api('/auth/register')).send({ name: 'U', email: 'unv@x.com', password: h.PASSWORD })
  await h.models.User.updateOne({ normalizedEmail: 'unv@x.com' }, { approvalStatus: 'approved' })
  const unverified = await h.request(h.app).post(api('/auth/login')).send({ email: 'unv@x.com', password: h.PASSWORD })
  assert.equal(unverified.status, 403)
  assert.equal(unverified.body.error.code, 'EMAIL_NOT_VERIFIED')

  const wrong = await h.request(h.app).post(api('/auth/login')).send({ email: 'unv@x.com', password: 'wrong-wrong-wrong' })
  const ghost = await h.request(h.app).post(api('/auth/login')).send({ email: 'nobody@x.com', password: 'wrong-wrong-wrong' })
  assert.equal(wrong.status, 401)
  assert.equal(ghost.status, 401)
  assert.deepEqual(wrong.body.error, ghost.body.error)
})

test('login: five failures lock the account for a while, even with the right password', async () => {
  await h.createVerifiedUser('lock@x.com')
  for (let i = 0; i < 5; i++) {
    const res = await h.request(h.app).post(api('/auth/login')).send({ email: 'lock@x.com', password: 'wrong-wrong-wrong' })
    assert.equal(res.status, 401)
  }
  const locked = await h.request(h.app).post(api('/auth/login')).send({ email: 'lock@x.com', password: h.PASSWORD })
  assert.equal(locked.status, 429)
  assert.equal(locked.body.error.code, 'TOO_MANY_ATTEMPTS')
})

test('login returns an access token + HttpOnly refresh cookie, and /me works with Bearer only', async () => {
  await h.createVerifiedUser('me@x.com', { name: 'Maya' })
  const res = await h.request(h.app).post(api('/auth/login')).send({ email: 'me@x.com', password: h.PASSWORD })
  assert.equal(res.status, 200)
  assert.ok(res.body.data.accessToken)
  assert.equal(res.body.data.user.name, 'Maya')
  assert.match(cookieOf(res), /HttpOnly/i)
  assert.match(cookieOf(res), /SameSite=Strict/i)
  assert.equal(res.body.data.user.passwordHash, undefined)

  const noToken = await h.request(h.app).get(api('/me'))
  assert.equal(noToken.status, 401)
  const rawToken = await h.request(h.app).get(api('/me')).set('Authorization', res.body.data.accessToken) // Bearer ke bina nahi chalega
  assert.equal(rawToken.status, 401)
  const good = await h.request(h.app).get(api('/me')).set(h.bearer(res.body.data.accessToken))
  assert.equal(good.status, 200)
  assert.equal(good.body.data.user.email, 'me@x.com')
})

test('refresh rotates the cookie; reusing an old refresh token kills the whole session family', async () => {
  await h.createVerifiedUser('rot@x.com')
  const login = await h.request(h.app).post(api('/auth/login')).send({ email: 'rot@x.com', password: h.PASSWORD })
  const first = cookieOf(login).split(';')[0]

  const r1 = await h.request(h.app).post(api('/auth/refresh')).set('Cookie', first)
  assert.equal(r1.status, 200)
  const second = cookieOf(r1).split(';')[0]
  assert.notEqual(first, second)
  // Access token abhi bhi chalta hai (same family zinda hai)
  assert.equal((await h.request(h.app).get(api('/me')).set(h.bearer(r1.body.data.accessToken))).status, 200)

  // Purana cookie dobara -> reuse -> sab band
  const reuse = await h.request(h.app).post(api('/auth/refresh')).set('Cookie', first)
  assert.equal(reuse.status, 401)
  const afterReuse = await h.request(h.app).post(api('/auth/refresh')).set('Cookie', second)
  assert.equal(afterReuse.status, 401)
  assert.equal((await h.request(h.app).get(api('/me')).set(h.bearer(r1.body.data.accessToken))).status, 401)
})

test('refresh refuses a request from a foreign origin (CSRF guard)', async () => {
  await h.createVerifiedUser('csrf@x.com')
  const login = await h.request(h.app).post(api('/auth/login')).send({ email: 'csrf@x.com', password: h.PASSWORD })
  const res = await h.request(h.app).post(api('/auth/refresh')).set('Cookie', cookieOf(login).split(';')[0]).set('Origin', 'https://evil.example')
  assert.equal(res.status, 403)
})

test('logout revokes the session: refresh and the old access token both stop working', async () => {
  await h.createVerifiedUser('out@x.com')
  const { agent, token } = await h.loginAs('out@x.com')
  assert.equal((await agent.post(api('/auth/logout'))).status, 200)
  assert.equal((await agent.post(api('/auth/refresh'))).status, 401)
  assert.equal((await h.request(h.app).get(api('/me')).set(h.bearer(token))).status, 401)
})

test('password reset: generic reply, single-use token, old sessions revoked, new password works', async () => {
  await h.createVerifiedUser('reset@x.com')
  const { token: oldAccess } = await h.loginAs('reset@x.com')

  const known = await h.request(h.app).post(api('/auth/password-reset')).send({ email: 'reset@x.com' })
  const unknown = await h.request(h.app).post(api('/auth/password-reset')).send({ email: 'ghost@x.com' })
  assert.equal(known.status, 200)
  assert.deepEqual(known.body.data, unknown.body.data)

  const token = h.tokenFromMail('reset@x.com')
  const newPassword = 'a-brand-new-password-1'
  assert.equal((await h.request(h.app).post(api('/auth/password-reset/confirm')).send({ token, password: 'short' })).status, 400)
  assert.equal((await h.request(h.app).post(api('/auth/password-reset/confirm')).send({ token, password: newPassword })).status, 200)
  assert.equal((await h.request(h.app).post(api('/auth/password-reset/confirm')).send({ token, password: newPassword })).status, 400) // dobara nahi chalega

  assert.equal((await h.request(h.app).get(api('/me')).set(h.bearer(oldAccess))).status, 401)
  assert.equal((await h.request(h.app).post(api('/auth/login')).send({ email: 'reset@x.com', password: h.PASSWORD })).status, 401)
  assert.equal((await h.request(h.app).post(api('/auth/login')).send({ email: 'reset@x.com', password: newPassword })).status, 200)
})

test('password reset token expires after 30 minutes', async () => {
  await h.createVerifiedUser('exp@x.com')
  await h.request(h.app).post(api('/auth/password-reset')).send({ email: 'exp@x.com' })
  const token = h.tokenFromMail('exp@x.com')
  await h.models.VerificationToken.updateMany({ purpose: 'password_reset' }, { expiresAt: new Date(Date.now() - 1000) })
  const res = await h.request(h.app).post(api('/auth/password-reset/confirm')).send({ token, password: 'a-brand-new-password-1' })
  assert.equal(res.status, 400)
  assert.equal(res.body.error.code, 'INVALID_TOKEN')
})

test('audit never stores passwords or tokens', async () => {
  const events = await h.models.AuditEvent.find().lean()
  assert.ok(events.length > 0)
  assert.doesNotMatch(JSON.stringify(events), new RegExp(h.PASSWORD))
})

test('owner approval: register sends no email, login is blocked until Super Admin approves, then login works with no extra verify step', async () => {
  const email = 'newowner@x.com'
  const before = h.outbox.length
  await h.request(h.app).post(api('/auth/register')).send({ name: 'New Owner', email, password: h.PASSWORD })
  assert.equal(h.outbox.length, before, 'no email before approval')

  const pending = await h.request(h.app).post(api('/auth/login')).send({ email, password: h.PASSWORD })
  assert.equal(pending.status, 403)
  assert.equal(pending.body.error.code, 'ACCOUNT_PENDING_APPROVAL')
  // resend-verification se approval bypass nahi hona chahiye
  await h.request(h.app).post(api('/auth/resend-verification')).send({ email })
  assert.equal(h.outbox.length, before)

  await h.createVerifiedUser('approver@x.com')
  await h.models.User.updateOne({ normalizedEmail: 'approver@x.com' }, { platformRole: 'admin' })
  const admin = await h.loginAs('approver@x.com')
  const adminH = { Authorization: `Bearer ${admin.token}` }

  const list = await h.request(h.app).get(api('/platform/owner-requests')).set(adminH)
  assert.equal(list.status, 200)
  const row = list.body.data.requests.find((r) => r.email === email)
  assert.ok(row)

  // Owner khud approve nahi kar sakta
  const sneaky = await h.loginAs('approver@x.com')
  await h.models.User.updateOne({ normalizedEmail: 'approver@x.com' }, { platformRole: null })
  const denied = await h.request(h.app).post(api(`/platform/owner-requests/${row.id}/approve`)).set({ Authorization: `Bearer ${sneaky.token}` })
  assert.ok([401, 403].includes(denied.status))
  await h.models.User.updateOne({ normalizedEmail: 'approver@x.com' }, { platformRole: 'admin' })

  const beforeApprove = h.outbox.length
  const approve = await h.request(h.app).post(api(`/platform/owner-requests/${row.id}/approve`)).set(adminH)
  assert.equal(approve.status, 200)
  assert.equal(h.outbox.length, beforeApprove + 1, 'verification email goes out on approval')

  const mail = h.outbox[h.outbox.length - 1]
  assert.equal(mail.to, email)
  assert.match(mail.text, /\/login/)
  const ok = await h.request(h.app).post(api('/auth/login')).send({ email, password: h.PASSWORD })
  assert.equal(ok.status, 200)
})

test('owner approval: a rejected request can never sign in', async () => {
  const email = 'rejected@x.com'
  await h.request(h.app).post(api('/auth/register')).send({ name: 'No Way', email, password: h.PASSWORD })
  const user = await h.models.User.findOne({ normalizedEmail: email })
  const admin = await h.loginAs('approver@x.com')
  const res = await h.request(h.app).post(api(`/platform/owner-requests/${user._id}/reject`)).set({ Authorization: `Bearer ${admin.token}` })
  assert.equal(res.status, 200)
  const login = await h.request(h.app).post(api('/auth/login')).send({ email, password: h.PASSWORD })
  assert.equal(login.status, 403)
  assert.equal(login.body.error.code, 'ACCOUNT_REJECTED')
})
