const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')
const { outbox } = require('../src/utils/sms')

const api = (path) => `/api/v1${path}`

before(h.connect)
after(h.disconnect)

const askOtp = (agent, phone) => agent.post(api('/customer/auth/request-otp')).send({ phone })
const verify = (agent, body) => agent.post(api('/customer/auth/verify-otp')).send(body)

test('mobile number rules: only 10 digits (6-9 start) or 12 digits with 91', async () => {
  const agent = h.request.agent(h.app)
  for (const bad of ['12345', '98100abcde', '+91 98100 12345', '5810012345', '981001234567', '98100123456']) {
    assert.equal((await askOtp(agent, bad)).status, 400, `should refuse ${bad}`)
  }
  assert.equal((await askOtp(agent, '9810020001')).status, 200)
  assert.equal((await askOtp(agent, '919810020002')).status, 200) // 12 digit, 91 ke saath
})

test('OTP login: new customer gives a name, gets a cookie, and /me works; the SMS goes out and the code is not stored', async () => {
  const agent = h.request.agent(h.app)
  assert.equal((await agent.get(api('/customer/me'))).status, 401)

  const asked = await askOtp(agent, '9810020003')
  assert.equal(asked.status, 200)
  const code = asked.body.data.devOtp
  assert.match(code, /^\d{6}$/)
  assert.ok(outbox.some((m) => m.to === '+919810020003' && m.text.includes(code)))
  assert.equal(await h.models.CustomerOtp.countDocuments({ codeHash: code }), 0) // sirf hash

  // naya customer: naam chahiye, code kharch nahi hota
  const needs = await verify(agent, { phone: '9810020003', otp: code })
  assert.equal(needs.body.data.needsName, true)
  assert.equal((await agent.get(api('/customer/me'))).status, 401)

  const done = await verify(agent, { phone: '9810020003', otp: code, name: 'Kavya Sharma' })
  assert.equal(done.status, 200, JSON.stringify(done.body))
  assert.equal(done.body.data.customer.phone, '9810020003')

  const me = await agent.get(api('/customer/me'))
  assert.equal(me.body.data.customer.name, 'Kavya Sharma')

  // code sirf ek baar chalta hai
  assert.equal((await verify(agent, { phone: '9810020003', otp: code, name: 'Kavya Sharma' })).status, 400)

  await agent.post(api('/customer/auth/logout'))
  assert.equal((await agent.get(api('/customer/me'))).status, 401)
})

test('12 digit and 10 digit forms are the same customer; returning customer needs no name', async () => {
  const a = h.request.agent(h.app)
  const first = await askOtp(a, '9810020004')
  await verify(a, { phone: '9810020004', otp: first.body.data.devOtp, name: 'Meera Joshi' })

  // 30 second ka cooldown test me todne ke liye purane codes hata do (asli app me user ruk kar dobara maangta hai)
  await h.models.CustomerOtp.deleteMany({ phone: '9810020004' })
  const b = h.request.agent(h.app)
  const second = await askOtp(b, '919810020004')
  const res = await verify(b, { phone: '919810020004', otp: second.body.data.devOtp })
  assert.equal(res.status, 200, JSON.stringify(res.body))
  assert.equal(res.body.data.customer.name, 'Meera Joshi')
  assert.equal(await h.models.Customer.countDocuments({ phone: '9810020004' }), 1)
})

test('wrong code: 5 tries and then locked; a new code cannot be asked within 30 seconds; name must be letters only', async () => {
  const agent = h.request.agent(h.app)
  const asked = await askOtp(agent, '9810020005')
  const code = asked.body.data.devOtp
  const wrong = code === '000000' ? '111111' : '000000'

  const first = await verify(agent, { phone: '9810020005', otp: wrong, name: 'Riya Singh' })
  assert.equal(first.status, 400)
  assert.equal(first.body.error.code, 'OTP_INVALID')
  assert.match(first.body.error.message, /4 tries left/)
  for (let i = 0; i < 4; i++) await verify(agent, { phone: '9810020005', otp: wrong, name: 'Riya Singh' })
  // 5 galat ke baad sahi code bhi nahi chalta
  const locked = await verify(agent, { phone: '9810020005', otp: code, name: 'Riya Singh' })
  assert.equal(locked.status, 429)
  assert.equal(locked.body.error.code, 'OTP_LOCKED')

  const again = await askOtp(agent, '9810020005')
  assert.equal(again.status, 429)
  assert.equal(again.body.error.code, 'OTP_COOLDOWN')

  const other = h.request.agent(h.app)
  const o2 = await askOtp(other, '9810020006')
  assert.equal((await verify(other, { phone: '9810020006', otp: o2.body.data.devOtp, name: 'Riya123' })).status, 400)
  assert.equal((await verify(other, { phone: '9810020006', otp: '12345' })).status, 400)
})

test('a salon owner token does not work as a customer login, and the customer cookie is httpOnly', async () => {
  const owner = await h.ownerWithSalon('cu1@x.com', 'cu-one')
  const res = await h.request(h.app).get(api(`/public/salons/${owner.salonId}`)).set('Authorization', `Bearer ${owner.token}`)
  assert.equal(res.status, 401)

  const agent = h.request.agent(h.app)
  const asked = await askOtp(agent, '9810020007')
  const done = await verify(agent, { phone: '9810020007', otp: asked.body.data.devOtp, name: 'Tara Das' })
  const cookie = done.headers['set-cookie'].find((c) => c.startsWith('glamora_ct='))
  assert.match(cookie, /HttpOnly/i)
  assert.match(cookie, /SameSite=Lax/i)
})

test('email OTP: the code goes to the email (not SMS), is masked in the reply, and a known customer always gets it on the saved email', async () => {
  const mail = require('../src/utils/mailer').outbox
  const agent = h.request.agent(h.app)
  const asked = await agent.post(api('/customer/auth/request-otp')).send({ phone: '9810020010', email: 'Kavya@Example.com' })
  assert.equal(asked.status, 200)
  assert.equal(asked.body.data.sentTo, 'k***@example.com')
  const code = asked.body.data.devOtp
  const sent = mail.find((m) => m.to === 'kavya@example.com' && m.text.includes(code))
  assert.ok(sent, 'email should carry the code')
  assert.ok(!outbox.some((m) => m.to === '+919810020010'), 'no SMS when email is used')

  const done = await verify(agent, { phone: '9810020010', otp: code, name: 'Kavya Sharma' })
  assert.equal(done.status, 200, JSON.stringify(done.body))
  assert.equal((await h.models.Customer.findOne({ phone: '9810020010' })).email, 'kavya@example.com')

  // koi aur apna email daal kar isi number ka code apne email par nahi mangwa sakta
  await h.models.CustomerOtp.deleteMany({ phone: '9810020010' })
  const again = await h.request.agent(h.app).post(api('/customer/auth/request-otp')).send({ phone: '9810020010', email: 'other@example.com' })
  assert.equal(again.body.data.sentTo, 'k***@example.com')
  assert.ok(!mail.some((m) => m.to === 'other@example.com'))
})

test('mobile app: OTP to email, token in JSON, Bearer works on /me, no duplicate customer, browsers and wrong token types refused', async () => {
  const agent = h.request.agent(h.app)
  const phone = '9810020077'
  const asked = await agent.post(api('/customer/auth/request-otp')).send({ phone, email: 'mobile.cust@example.com' })
  assert.equal(asked.status, 200)
  const code = asked.body.data.devOtp
  const mobileVerify = (body, set = {}) => agent.post(api('/customer/auth/mobile/verify-otp')).set(set).send(body)

  // a browser (Origin header) never gets the token
  assert.equal((await mobileVerify({ phone, otp: code, name: 'Mobile Cust' }, { Origin: 'https://evil.example' })).status, 403)

  const done = await mobileVerify({ phone, otp: code, name: 'Mobile Cust' })
  assert.equal(done.status, 200, JSON.stringify(done.body))
  const token = done.body.data.accessToken
  assert.ok(token)
  assert.equal(done.headers['set-cookie'], undefined)

  const plain = h.request(h.app)
  assert.equal((await plain.get(api('/customer/me'))).status, 401)
  const me = await plain.get(api('/customer/me')).set('Authorization', `Bearer ${token}`)
  assert.equal(me.status, 200)
  assert.equal(me.body.data.customer.phone, phone)
  assert.equal((await plain.get(api('/customer/me')).set('Authorization', 'Bearer not-a-token')).status, 401)

  // customer token is useless on salon-staff endpoints
  assert.equal((await plain.get(api('/me')).set('Authorization', `Bearer ${token}`)).status, 401)

  // same phone logs in again -> same customer, no duplicate
  await h.models.CustomerOtp.deleteMany({ phone })
  const again = await agent.post(api('/customer/auth/request-otp')).send({ phone })
  const second = await mobileVerify({ phone, otp: again.body.data.devOtp })
  assert.equal(second.status, 200)
  assert.equal(await h.models.Customer.countDocuments({ phone }), 1)
})
