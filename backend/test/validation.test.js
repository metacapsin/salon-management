// Boundary tests for the shared validation rules (password, mobile, name, email),
// sent straight to the API so they do not depend on any frontend check.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const bcrypt = require('bcrypt')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
const request = h.request

const PASSWORD_MESSAGE = 'Password must be between 12 and 20 characters.'
const MOBILE_MESSAGE = 'Please enter a valid 10-digit mobile number.'
const NAME_MESSAGE = 'Please enter a valid name.'
const EMAIL_MESSAGE = 'Please enter a valid email address.'

before(h.connect)
after(h.disconnect)

const post = (path, body) => request(h.app).post(api(path)).send(body)
const fieldError = (res, field) => res.body?.error?.fieldErrors?.[field]

function assertRejected(res, field, message) {
  assert.equal(res.status, 400, `expected 400 but got ${res.status}: ${JSON.stringify(res.body)}`)
  assert.equal(res.body.error.code, 'VALIDATION_ERROR')
  assert.equal(fieldError(res, field), message, JSON.stringify(res.body.error))
  assert.ok(!JSON.stringify(res.body).includes('stack'), 'no stack trace in the response')
}

// ---------- Password: 12 to 20 characters ----------
test('register: password of 11 and 21 characters is refused with the exact message, 12 and 20 are accepted', async () => {
  for (const [n, email] of [[11, 'pw11@x.com'], [21, 'pw21@x.com']]) {
    assertRejected(await post('/auth/register', { name: 'Asha Verma', email, password: 'a'.repeat(n) }), 'password', PASSWORD_MESSAGE)
    assert.equal(await h.models.User.countDocuments({ normalizedEmail: email }), 0)
  }
  for (const [n, email] of [[12, 'pw12@x.com'], [20, 'pw20@x.com']]) {
    const res = await post('/auth/register', { name: 'Asha Verma', email, password: 'a'.repeat(n) })
    assert.equal(res.status, 201, JSON.stringify(res.body))
  }
})

test('register: password is never trimmed (spaces count as characters) and an empty password is refused', async () => {
  // 10 letters + 2 spaces = 12 characters, accepted as typed
  const spaced = await post('/auth/register', { name: 'Asha Verma', email: 'spaces@x.com', password: ' abcdefghij ' })
  assert.equal(spaced.status, 201, JSON.stringify(spaced.body))
  const user = await h.models.User.findOne({ normalizedEmail: 'spaces@x.com' })
  assert.ok(await bcrypt.compare(' abcdefghij ', user.passwordHash), 'stored exactly as typed')

  // 11 letters + 1 trailing space is 12 characters; 9 letters + 2 spaces is 11 and must NOT be padded up to 12
  assertRejected(await post('/auth/register', { name: 'Asha Verma', email: 'pad@x.com', password: ' abcdefghi ' }), 'password', PASSWORD_MESSAGE)
  assertRejected(await post('/auth/register', { name: 'Asha Verma', email: 'empty@x.com', password: '' }), 'password', PASSWORD_MESSAGE)
  assertRejected(await post('/auth/register', { name: 'Asha Verma', email: 'missing@x.com' }), 'password', 'Password is required.')
})

test('change password: new password must be 12 to 20 characters', async () => {
  await h.createVerifiedUser('chgpw@x.com')
  const s = await h.loginAs('chgpw@x.com')
  const call = (newPassword) => request(h.app).post(api('/me/password')).set('Authorization', `Bearer ${s.token}`).send({ currentPassword: h.PASSWORD, newPassword })
  assertRejected(await call('a'.repeat(11)), 'newPassword', PASSWORD_MESSAGE)
  assertRejected(await call('a'.repeat(21)), 'newPassword', PASSWORD_MESSAGE)
  assert.equal((await call('b'.repeat(20))).status, 200)
})

test('password reset: new password must be 12 to 20 characters (checked before the code)', async () => {
  await h.createVerifiedUser('rstpw@x.com')
  for (const n of [11, 21]) {
    assertRejected(await post('/auth/password-reset/confirm', { email: 'rstpw@x.com', otp: '123456', password: 'a'.repeat(n) }), 'password', PASSWORD_MESSAGE)
  }
})

test('super admin creating an owner account follows the same password rule', async () => {
  await h.createVerifiedUser('padmin@x.com')
  await h.models.User.updateOne({ normalizedEmail: 'padmin@x.com' }, { platformRole: 'admin' })
  const admin = await h.loginAs('padmin@x.com')
  const create = (password, email) =>
    request(h.app).post(api('/platform/salons')).set('Authorization', `Bearer ${admin.token}`).send({ name: 'Glow Studio', slug: `glow-${password.length}`, ownerName: 'Meera Joshi', ownerEmail: email, password })
  assertRejected(await create('a'.repeat(21), 'o21@x.com'), 'password', PASSWORD_MESSAGE)
  assertRejected(await create('a'.repeat(11), 'o11@x.com'), 'password', PASSWORD_MESSAGE)
  assert.equal((await create('a'.repeat(20), 'o20@x.com')).status, 201)
})

test('sign in: the password must also be 12 to 20 characters (website and mobile endpoints, and the current-password check)', async () => {
  await h.createVerifiedUser('signin@x.com')
  for (const n of [11, 21]) {
    assertRejected(await post('/auth/login', { email: 'signin@x.com', password: 'a'.repeat(n) }), 'password', PASSWORD_MESSAGE)
    assertRejected(await post('/auth/mobile/login', { email: 'signin@x.com', password: 'a'.repeat(n) }), 'password', PASSWORD_MESSAGE)
  }
  assertRejected(await post('/auth/login', { email: 'signin@x.com', password: '' }), 'password', PASSWORD_MESSAGE)
  // right length but wrong password is still the generic sign-in failure (no hint about the account)
  const wrong = await post('/auth/login', { email: 'signin@x.com', password: 'a'.repeat(12) })
  assert.equal(wrong.status, 401)
  assert.equal((await post('/auth/login', { email: 'signin@x.com', password: h.PASSWORD })).status, 200)

  const s = await h.loginAs('signin@x.com')
  const change = (currentPassword) => request(h.app).post(api('/me/password')).set('Authorization', `Bearer ${s.token}`).send({ currentPassword, newPassword: 'b'.repeat(15) })
  assertRejected(await change('a'.repeat(21)), 'currentPassword', PASSWORD_MESSAGE)
})

// ---------- Name ----------
test('register: names with digits, symbols, only spaces or one letter are refused; extra spaces are cleaned', async () => {
  const bad = ['Raj2', '1234', '@@@', '   ', 'A', 'Asha<script>', '12 34', '---']
  for (const [i, name] of bad.entries()) {
    const res = await post('/auth/register', { name, email: `badname${i}@x.com`, password: h.PASSWORD })
    assert.equal(res.status, 400, `name ${JSON.stringify(name)} should be refused`)
    assert.ok(fieldError(res, 'name'), `name ${JSON.stringify(name)} should have a name error`)
  }
  assertRejected(await post('/auth/register', { name: '   ', email: 'blank@x.com', password: h.PASSWORD }), 'name', 'Name is required.')
  assertRejected(await post('/auth/register', { name: 'Raj2', email: 'raj2@x.com', password: h.PASSWORD }), 'name', NAME_MESSAGE)
  assertRejected(await post('/auth/register', { name: 'A'.repeat(36), email: 'long@x.com', password: h.PASSWORD }), 'name', 'Name can be at most 35 characters.')

  for (const [i, name] of ['Aarti Sharma', "Meera D'Souza", 'Anne-Marie', '  Priya    Kumari  '].entries()) {
    const res = await post('/auth/register', { name, email: `goodname${i}@x.com`, password: h.PASSWORD })
    assert.equal(res.status, 201, `name ${JSON.stringify(name)} should be accepted: ${JSON.stringify(res.body)}`)
  }
  const saved = await h.models.User.findOne({ normalizedEmail: 'goodname3@x.com' })
  assert.equal(saved.name, 'Priya Kumari', 'trimmed and repeated spaces collapsed')
})

// ---------- Email ----------
test('email: invalid formats are refused, spaces and capitals are cleaned', async () => {
  for (const [i, email] of ['abc', 'a@b', '@x.com', 'a b@x.com', 'a@@x.com', ''].entries()) {
    const res = await post('/auth/register', { name: 'Asha Verma', email, password: h.PASSWORD })
    assert.equal(res.status, 400, `email ${JSON.stringify(email)} should be refused`)
    assert.equal(fieldError(res, 'email'), email === '' ? 'Email is required.' : EMAIL_MESSAGE, `case ${i}`)
  }
  const ok = await post('/auth/register', { name: 'Asha Verma', email: '  Clean@Mail.COM ', password: h.PASSWORD })
  assert.equal(ok.status, 201)
  assert.equal(await h.models.User.countDocuments({ normalizedEmail: 'clean@mail.com' }), 1)
})

// ---------- Mobile number ----------
test('customer login: mobile numbers of 9 and 11 digits, wrong first digit, letters, symbols and +91 are refused', async () => {
  const bad = ['981002000', '98100200012', '5810020001', '0810020001', '98100abcde', '98100-20001', '+919810020001', '919810020001', ' ', '']
  for (const phone of bad) {
    assertRejected(await post('/customer/auth/request-otp', { phone }), 'phone', MOBILE_MESSAGE)
  }
  assert.equal((await post('/customer/auth/request-otp', { phone: '9810020001' })).status, 200)
  assert.equal((await post('/customer/auth/request-otp', { phone: '6810020002' })).status, 200)
})

test('customer login: a new customer name is validated the same way', async () => {
  const asked = await post('/customer/auth/request-otp', { phone: '9810020003' })
  assertRejected(await post('/customer/auth/verify-otp', { phone: '9810020003', otp: asked.body.data.devOtp, name: 'Riya123' }), 'name', NAME_MESSAGE)
})

test('contact form: only a valid 10-digit mobile number and a real name are accepted', async () => {
  const valid = { name: 'Asha Verma', email: 'asha@example.com', phone: '9810012345', message: 'I own two salons and want to join Galora.' }
  for (const phone of ['981001234', '98100123456', '5810012345', '+91 98100 12345', 'abcdefghij']) {
    assertRejected(await post('/contact', { ...valid, phone }), 'phone', MOBILE_MESSAGE)
  }
  assertRejected(await post('/contact', { ...valid, name: '1234' }), 'name', NAME_MESSAGE)
  assert.equal((await post('/contact', valid)).status, 201)
})

test('salon-side forms refuse invalid names and mobile numbers sent directly to the API', async () => {
  const o = await h.ownerWithSalon('valid1@x.com', 'valid-one')
  const auth = h.bearer(o.token, o.salonId)
  const send = (method, path, body) => request(h.app)[method](api(path)).set(auth).send(body)

  // Staff: name rules, optional phone must be a valid mobile number when given
  assertRejected(await send('post', '/staff', { name: 'Staff1' }), 'name', NAME_MESSAGE)
  for (const phone of ['12345', '98100123456', '+919810012345', 'abc']) {
    assertRejected(await send('post', '/staff', { name: 'Asha Rao', phone }), 'phone', MOBILE_MESSAGE)
  }
  const staff = await send('post', '/staff', { name: '  Asha    Rao ', phone: '9810012345' })
  assert.equal(staff.status, 201, JSON.stringify(staff.body))
  assert.equal(staff.body.data.staff.name, 'Asha Rao')
  assert.equal((await send('post', '/staff', { name: 'No Phone' })).status, 201, 'phone stays optional')

  // Salon settings: phone, owner name
  assertRejected(await send('patch', '/salons/current', { phone: '12345' }), 'phone', MOBILE_MESSAGE)
  assertRejected(await send('patch', '/salons/current', { ownerName: 'Owner9' }), 'ownerName', NAME_MESSAGE)
  assert.equal((await send('patch', '/salons/current', { phone: '9810012345' })).status, 200)
  assert.equal((await send('patch', '/salons/current', { phone: '' })).status, 200, 'an empty phone is allowed')

  // Appointments, billing, packages and memberships all share one customer name and mobile rule
  const someId = '64b000000000000000000001'
  const appt = { customerName: 'Riya Sharma', customerPhone: '9810012345', serviceId: someId, date: '2030-01-01', startTime: '10:00' }
  assertRejected(await send('post', '/bookings', { ...appt, customerPhone: '981001234' }), 'customerPhone', MOBILE_MESSAGE)
  assertRejected(await send('post', '/bookings', { ...appt, customerPhone: '919810012345' }), 'customerPhone', MOBILE_MESSAGE)
  assertRejected(await send('post', '/bookings', { ...appt, customerName: 'Riya99' }), 'customerName', NAME_MESSAGE)
  assertRejected(await send('post', '/invoices', { requestKey: 'key-aaaaaaaa-1', customerPhone: '98100123', customerName: 'Riya Sharma', lines: [] }), 'customerPhone', MOBILE_MESSAGE)
  assertRejected(await send('post', '/customer-packages', { packageId: someId, customerPhone: '12345', customerName: 'Riya Sharma', requestKey: 'key-aaaaaaaa-2' }), 'customerPhone', MOBILE_MESSAGE)
  assertRejected(await send('post', '/customer-packages', { packageId: someId, customerPhone: '9810012345', customerName: '###', requestKey: 'key-aaaaaaaa-3' }), 'customerName', NAME_MESSAGE)
  assertRejected(await send('post', '/customer-memberships', { planId: someId, customerPhone: '98100123456', customerName: 'Riya Sharma', requestKey: 'key-aaaaaaaa-4' }), 'customerPhone', MOBILE_MESSAGE)
})

// ---------- Database safety net ----------
test('the database itself refuses bad names, mobile numbers and emails even if a route forgets to check', async () => {
  const bad = (doc, path) => assert.rejects(() => doc.validate(), (err) => Boolean(err.errors?.[path]), `${path} should fail validation`)
  await bad(new h.models.Customer({ phone: '12345', name: 'Riya Sharma' }), 'phone')
  await bad(new h.models.Customer({ phone: '+919810012345', name: 'Riya Sharma' }), 'phone')
  await bad(new h.models.Customer({ phone: '9810012345', name: 'Riya123' }), 'name')
  await bad(new h.models.Customer({ phone: '9810012345', name: 'Riya  Sharma' }), 'name')
  await bad(new h.models.User({ name: 'Asha', email: 'not-an-email', normalizedEmail: 'x', passwordHash: 'x' }), 'email')
  await bad(new h.models.ContactInquiry({ name: 'Asha Verma', email: 'a@b.com', phone: '123', message: 'hello hello hello' }), 'phone')
  await new h.models.Customer({ phone: '9810012345', name: 'Riya Sharma' }).validate()
})

test('validation errors never leak stack traces or internals', async () => {
  const res = await post('/auth/register', { name: 'Raj2', email: 'x', password: 'a'.repeat(30), role: 'owner' })
  assert.equal(res.status, 400)
  const text = JSON.stringify(res.body)
  assert.ok(!/stack|node_modules|at .*\(.*\.js/i.test(text))
  assert.ok(res.body.requestId)
})

// ---------- Dates ----------
test('dates: impossible calendar dates are refused everywhere a date is typed; past offers cannot be created', async () => {
  const o = await h.ownerWithSalon('dates1@x.com', 'dates-one')
  const auth = h.bearer(o.token, o.salonId)
  const send = (method, path, body) => request(h.app)[method](api(path)).set(auth).send(body)

  const offer = { title: 'Festive 10', discountType: 'percent', discountValue: 10, startsOn: '2030-01-01', endsOn: '2030-01-31' }
  for (const bad of ['2030-02-31', '9999-99-99', '2030-13-01', 'abc', '01-02-2030']) {
    assertRejected(await send('post', '/offers', { ...offer, startsOn: bad }), 'startsOn', 'Please enter a valid date.')
    assertRejected(await send('post', '/offers', { ...offer, endsOn: bad }), 'endsOn', 'Please enter a valid date.')
  }
  assertRejected(await send('post', '/offers', { ...offer, startsOn: '2030-02-01', endsOn: '2030-01-31' }), 'endsOn', 'End date cannot be before the start date.')
  assertRejected(await send('post', '/offers', { ...offer, startsOn: '2020-01-01', endsOn: '2020-01-31' }), 'endsOn', 'End date cannot be in the past.')
  assert.equal((await send('post', '/offers', offer)).status, 201)

  const pkg = { name: 'Hair x3', items: [{ serviceId: '64b000000000000000000001', sessions: 3 }], packagePrice: 1200, validityDays: 30 }
  assertRejected(await send('post', '/packages', { ...pkg, saleStartsOn: '2030-02-30' }), 'saleStartsOn', 'Please enter a valid date.')
  assertRejected(await send('put', '/salons/current/hours', { weeklyHours: {}, holidays: [{ date: '2030-02-30', name: 'x' }] }), 'holidays.0.date', 'Please enter a valid date.')
})

// ---------- Address and PIN code ----------
test('address: invalid characters and bad PIN codes are refused, spaces are cleaned, empty parts stay optional', async () => {
  const o = await h.ownerWithSalon('addr1@x.com', 'addr-one')
  const auth = h.bearer(o.token, o.salonId)
  const patch = (address) => request(h.app).patch(api('/salons/current')).set(auth).send({ address })

  for (const [field, value, message] of [
    ['line1', '<script>alert(1)</script>', 'Please enter a valid address.'],
    ['city', 'Jaipur@@', 'Please enter a valid address.'],
    ['line1', 'a'.repeat(201), 'Address can be at most 200 characters.'],
    ['pincode', '12345', 'Please enter a valid 6-digit PIN code.'],
    ['pincode', '012345', 'Please enter a valid 6-digit PIN code.'],
    ['pincode', '30200A', 'Please enter a valid 6-digit PIN code.'],
  ]) {
    const res = await patch({ [field]: value })
    assert.equal(res.status, 400, `${field}=${value} should be refused`)
    assert.equal(fieldError(res, `address.${field}`), message, JSON.stringify(res.body.error))
  }

  const ok = await patch({ line1: '  12,   MG   Road ', city: 'Jaipur', pincode: '302001' })
  assert.equal(ok.status, 200, JSON.stringify(ok.body))
  assert.equal(ok.body.data.salon.address.line1, '12, MG Road')
  assert.equal((await patch({ line1: '   ' })).status, 200, 'a salon address part may be left empty')
})
