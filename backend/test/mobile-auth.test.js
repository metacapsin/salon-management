const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
const mobile = (path) => api(`/auth/mobile${path}`)
const post = (path, body) => h.request(h.app).post(path).send(body)

before(h.connect)
after(h.disconnect)

test('mobile login: returns tokens in JSON, sets no cookie, and the access token works on existing APIs', async () => {
  await h.createVerifiedUser('m1@x.com', { name: 'Mina' })
  const res = await post(mobile('/login'), { email: 'M1@x.com', password: h.PASSWORD })
  assert.equal(res.status, 200)
  assert.ok(res.body.data.accessToken)
  assert.ok(res.body.data.refreshToken.length >= 20)
  assert.equal(res.body.data.user.name, 'Mina')
  assert.equal(res.body.data.user.passwordHash, undefined)
  assert.deepEqual(res.body.data.memberships, [])
  assert.equal(res.headers['set-cookie'], undefined)

  const me = await h.request(h.app).get(api('/me')).set(h.bearer(res.body.data.accessToken))
  assert.equal(me.status, 200)
})

test('mobile login: same failure rules as the website (generic error, unverified, lockout)', async () => {
  await h.request(h.app).post(api('/auth/register')).send({ name: 'U', email: 'm2@x.com', password: h.PASSWORD })
  const pending = await post(mobile('/login'), { email: 'm2@x.com', password: h.PASSWORD })
  assert.equal(pending.body.error.code, 'ACCOUNT_PENDING_APPROVAL')
  await h.models.User.updateOne({ normalizedEmail: 'm2@x.com' }, { approvalStatus: 'approved' })
  const unverified = await post(mobile('/login'), { email: 'm2@x.com', password: h.PASSWORD })
  assert.equal(unverified.status, 403)
  assert.equal(unverified.body.error.code, 'EMAIL_NOT_VERIFIED')

  const wrong = await post(mobile('/login'), { email: 'm2@x.com', password: 'wrong-wrong-wrong' })
  const ghost = await post(mobile('/login'), { email: 'nobody@x.com', password: 'wrong-wrong-wrong' })
  assert.equal(wrong.status, 401)
  assert.deepEqual(wrong.body.error, ghost.body.error)

  await h.createVerifiedUser('m3@x.com')
  for (let i = 0; i < 5; i++) await post(mobile('/login'), { email: 'm3@x.com', password: 'wrong-wrong-wrong' })
  const locked = await post(mobile('/login'), { email: 'm3@x.com', password: h.PASSWORD })
  assert.equal(locked.status, 429)
  assert.equal(locked.body.error.code, 'TOO_MANY_ATTEMPTS')
})

test('mobile endpoints refuse any request that carries an Origin header (browsers)', async () => {
  await h.createVerifiedUser('m4@x.com')
  const login = await h.request(h.app).post(mobile('/login')).set('Origin', 'http://localhost:5173').send({ email: 'm4@x.com', password: h.PASSWORD })
  assert.equal(login.status, 403)
  assert.equal(login.body.data, undefined)

  const ok = await post(mobile('/login'), { email: 'm4@x.com', password: h.PASSWORD })
  for (const path of ['/refresh', '/logout']) {
    const res = await h.request(h.app).post(mobile(path)).set('Origin', 'https://evil.example').send({ refreshToken: ok.body.data.refreshToken })
    assert.equal(res.status, 403)
  }
  // Token ab bhi zinda hai (browser wali request ne kuch bigada nahi)
  assert.equal((await post(mobile('/refresh'), { refreshToken: ok.body.data.refreshToken })).status, 200)
})

test('mobile refresh rotates the token; reusing an old one kills the whole family', async () => {
  await h.createVerifiedUser('m5@x.com')
  const login = await post(mobile('/login'), { email: 'm5@x.com', password: h.PASSWORD })
  const first = login.body.data.refreshToken

  const r1 = await post(mobile('/refresh'), { refreshToken: first })
  assert.equal(r1.status, 200)
  const second = r1.body.data.refreshToken
  assert.notEqual(first, second)
  assert.equal(r1.headers['set-cookie'], undefined)
  assert.equal((await h.request(h.app).get(api('/me')).set(h.bearer(r1.body.data.accessToken))).status, 200)

  const reuse = await post(mobile('/refresh'), { refreshToken: first })
  assert.equal(reuse.status, 401)
  assert.equal((await post(mobile('/refresh'), { refreshToken: second })).status, 401)
  assert.equal((await h.request(h.app).get(api('/me')).set(h.bearer(r1.body.data.accessToken))).status, 401)
})

test('mobile refresh: junk, missing and cookie-only tokens are refused', async () => {
  assert.equal((await post(mobile('/refresh'), { refreshToken: 'x'.repeat(60) })).status, 401)
  assert.equal((await post(mobile('/refresh'), {})).status, 400)
  assert.equal((await post(mobile('/refresh'), { refreshToken: 'x'.repeat(60), extra: 1 })).status, 400)

  // Website ka cookie mobile refresh me kaam nahi karta
  await h.createVerifiedUser('m6@x.com')
  const web = await h.request(h.app).post(api('/auth/login')).send({ email: 'm6@x.com', password: h.PASSWORD })
  const cookie = web.headers['set-cookie'].find((c) => c.startsWith('glamora_rt=')).split(';')[0]
  const res = await h.request(h.app).post(mobile('/refresh')).set('Cookie', cookie).send({})
  assert.equal(res.status, 400)
})

test('mobile logout revokes the session; unknown token still answers 200', async () => {
  await h.createVerifiedUser('m7@x.com')
  const login = await post(mobile('/login'), { email: 'm7@x.com', password: h.PASSWORD })
  const { accessToken, refreshToken } = login.body.data

  assert.equal((await post(mobile('/logout'), { refreshToken })).status, 200)
  assert.equal((await post(mobile('/refresh'), { refreshToken })).status, 401)
  assert.equal((await h.request(h.app).get(api('/me')).set(h.bearer(accessToken))).status, 401)
  assert.equal((await post(mobile('/logout'), { refreshToken: 'x'.repeat(60) })).status, 200)
})

test('deactivated user: mobile refresh stops and the session family is revoked', async () => {
  await h.createVerifiedUser('m8@x.com')
  const login = await post(mobile('/login'), { email: 'm8@x.com', password: h.PASSWORD })
  await h.models.User.updateOne({ normalizedEmail: 'm8@x.com' }, { active: false })
  assert.equal((await post(mobile('/refresh'), { refreshToken: login.body.data.refreshToken })).status, 401)
  assert.equal((await h.request(h.app).get(api('/me')).set(h.bearer(login.body.data.accessToken))).status, 401)
})

test('website cookie flow is unchanged: it still sets a cookie and has no refreshToken in JSON', async () => {
  await h.createVerifiedUser('m9@x.com')
  const web = await h.request(h.app).post(api('/auth/login')).send({ email: 'm9@x.com', password: h.PASSWORD })
  assert.equal(web.status, 200)
  assert.equal(web.body.data.refreshToken, undefined)
  assert.match(web.headers['set-cookie'].find((c) => c.startsWith('glamora_rt=')), /HttpOnly/i)
})
