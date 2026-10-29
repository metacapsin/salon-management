const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
const request = h.request

before(h.connect)
after(h.disconnect)

const valid = (over = {}) => ({
  name: 'Asha Verma',
  email: 'Asha@Example.com',
  phone: '+91 98100 12345',
  message: 'I own two salons in Jaipur and want to join Galora.',
  ...over,
})

async function makeAdmin(email) {
  await h.createVerifiedUser(email)
  await h.models.User.updateOne({ normalizedEmail: email }, { platformRole: 'admin' })
  return h.loginAs(email)
}

test('anyone can send an inquiry without an account; it is saved and the reply leaks nothing', async () => {
  const res = await request(h.app).post(api('/contact')).send(valid())
  assert.equal(res.status, 201, JSON.stringify(res.body))
  assert.deepEqual(res.body.data, { received: true })

  const saved = await h.models.ContactInquiry.findOne({ name: 'Asha Verma' })
  assert.equal(saved.status, 'new')
  assert.equal(saved.email, 'asha@example.com') // chhote akshar me
})

test('the form is validated on the server (bad email, phone, short text, extra fields)', async () => {
  const bad = async (over, field) => {
    const res = await request(h.app).post(api('/contact')).send(valid(over))
    assert.equal(res.status, 400, `${field}: ${JSON.stringify(res.body)}`)
    assert.equal(res.body.error.code, 'VALIDATION_ERROR')
    assert.ok(res.body.error.fieldErrors[field], `${field} should have an error`)
  }
  await bad({ name: 'A' }, 'name')
  await bad({ email: 'not-an-email' }, 'email')
  await bad({ phone: 'abc' }, 'phone')
  await bad({ phone: '12' }, 'phone')
  await bad({ message: 'too short' }, 'message')
  await bad({ message: 'x'.repeat(2001) }, 'message')
  await bad({ subject: 'Hello' }, '_') // ab subject field nahi hai
  await bad({ status: 'resolved' }, '_') // extra field (unknown key) refuse
  assert.equal((await request(h.app).post(api('/contact')).send({})).status, 400)
  assert.equal(await h.models.ContactInquiry.countDocuments({ name: 'A' }), 0)
})

test('the same inquiry sent twice is stored once, and a filled honeypot is silently dropped', async () => {
  await h.models.ContactInquiry.deleteMany({})
  const body = valid({ message: 'Duplicate check message here' })
  const first = await request(h.app).post(api('/contact')).send(body)
  const second = await request(h.app).post(api('/contact')).send({ ...body, email: 'ASHA@example.com', message: 'duplicate CHECK message here' })
  assert.equal(first.status, 201)
  assert.equal(second.status, 201) // bhejne wale ko farq nahi dikhta
  assert.equal(await h.models.ContactInquiry.countDocuments({}), 1)

  const bot = await request(h.app).post(api('/contact')).send(valid({ message: 'Bot message from spam', website: 'http://spam.example' }))
  assert.equal(bot.status, 201)
  assert.equal(await h.models.ContactInquiry.countDocuments({ message: 'Bot message from spam' }), 0)

  // Alag sawaal wahi insaan bhej sakta hai
  await request(h.app).post(api('/contact')).send(valid({ message: 'Another question from same person' }))
  assert.equal(await h.models.ContactInquiry.countDocuments({}), 2)
})

test('the public API cannot read, list, edit or delete inquiries', async () => {
  const sent = await h.models.ContactInquiry.findOne({})
  const id = String(sent._id)
  for (const [method, path] of [
    ['get', '/contact'],
    ['get', `/contact/${id}`],
    ['patch', `/contact/${id}`],
    ['delete', `/contact/${id}`],
    ['get', '/contact/inquiries'],
  ]) {
    const res = await request(h.app)[method](api(path)).send({ status: 'closed' })
    assert.equal(res.status, 404, `${method} ${path}`)
  }
  assert.equal((await h.models.ContactInquiry.findById(id)).status, 'new')
  // Galat Origin se aayi browser request refuse (CSRF jaisa bachav, baaki public forms jaisa)
  const evil = await request(h.app).post(api('/contact')).set('Origin', 'https://evil.example').send(valid({ message: 'Message from evil origin' }))
  assert.equal(evil.status, 403)
})

test('admin inquiry APIs: only a platform admin (not anonymous, owner, or customer)', async () => {
  const owner = await h.ownerWithSalon('ci-owner@x.com', 'ci-owner')
  const customer = await h.customerAgent('9810055555')
  const sent = await h.models.ContactInquiry.findOne({})
  const id = String(sent._id)
  const calls = [
    ['get', '/platform/contact-inquiries'],
    ['get', `/platform/contact-inquiries/${id}`],
    ['patch', `/platform/contact-inquiries/${id}`],
    ['post', `/platform/contact-inquiries/${id}/notes`],
  ]
  for (const [method, path] of calls) {
    assert.equal((await request(h.app)[method](api(path)).send({ status: 'closed', text: 'hi' })).status, 401, `anon ${path}`)
    const asOwner = await request(h.app)[method](api(path)).set(h.bearer(owner.token, owner.salonId)).send({ status: 'closed', text: 'hi' })
    assert.equal(asOwner.status, 403, `owner ${path}`)
    // Customer ki cookie platform API ko nahi chalati
    assert.equal((await customer[method](api(path)).send({ status: 'closed', text: 'hi' })).status, 401, `customer ${path}`)
  }
  const after = await h.models.ContactInquiry.findById(id)
  assert.equal(after.status, 'new')
  assert.equal(after.adminNotes.length, 0)
})

test('platform admin can list, filter, search, open, update status and add notes', async () => {
  await h.models.ContactInquiry.deleteMany({})
  const admin = await makeAdmin('ci-admin@x.com')
  const auth = { Authorization: `Bearer ${admin.token}` }

  await request(h.app).post(api('/contact')).send(valid({ name: 'Ravi Kumar', email: 'ravi@x.com', message: 'Login is not working for me', phone: '9811100000' }))
  await request(h.app).post(api('/contact')).send(valid({ name: 'Meena Shah', email: 'meena@x.com', message: 'We want a partnership offer', phone: '9822200000' }))
  await request(h.app).post(api('/contact')).send(valid({ name: 'Zoya Khan', email: 'zoya@x.com', message: 'Hello there, just a question', phone: '9833300000' }))

  const list = await request(h.app).get(api('/platform/contact-inquiries')).set(auth)
  assert.equal(list.status, 200, JSON.stringify(list.body))
  assert.equal(list.body.meta.total, 3)
  assert.equal(list.body.data.counts.total, 3)
  assert.equal(list.body.data.counts.new, 3)
  assert.equal(list.body.data.inquiries[0].name, 'Zoya Khan') // sabse nayi pehle
  assert.equal('message' in list.body.data.inquiries[0], false) // list me sirf preview

  const ravi = list.body.data.inquiries.find((i) => i.name === 'Ravi Kumar')
  const one = await request(h.app).get(api(`/platform/contact-inquiries/${ravi.id}`)).set(auth)
  assert.equal(one.status, 200)
  assert.equal(one.body.data.inquiry.email, 'ravi@x.com')
  assert.equal(one.body.data.inquiry.phone, '9811100000')
  assert.ok(one.body.data.inquiry.message.length > 10)

  // search (regex-safe) + type + pagination
  const search = async (qs) => (await request(h.app).get(api(`/platform/contact-inquiries?${qs}`)).set(auth)).body
  assert.deepEqual((await search('q=meena@')).data.inquiries.map((i) => i.name), ['Meena Shah'])
  assert.deepEqual((await search('q=9833300000')).data.inquiries.map((i) => i.name), ['Zoya Khan'])
  assert.equal((await search('q=.*')).data.inquiries.length, 0)
  assert.deepEqual((await search('q=partnership')).data.inquiries.map((i) => i.name), ['Meena Shah']) // message me bhi search
  const paged = await search('pageSize=2&page=2')
  assert.equal(paged.data.inquiries.length, 1)
  assert.equal(paged.meta.total, 3)

  // status badalna: filter, counts, audit
  const patch = await request(h.app).patch(api(`/platform/contact-inquiries/${ravi.id}`)).set(auth).send({ status: 'in_progress' })
  assert.equal(patch.status, 200, JSON.stringify(patch.body))
  assert.equal(patch.body.data.inquiry.status, 'in_progress')
  const filtered = await search('status=in_progress')
  assert.deepEqual(filtered.data.inquiries.map((i) => i.name), ['Ravi Kumar'])
  assert.equal(filtered.meta.total, 1)
  assert.equal(filtered.data.counts.new, 2) // cards filter se alag hain
  assert.equal(filtered.data.counts.in_progress, 1)
  assert.equal(await h.models.AuditEvent.countDocuments({ action: 'platform.inquiry_status_changed' }), 1)
  assert.equal((await request(h.app).patch(api(`/platform/contact-inquiries/${ravi.id}`)).set(auth).send({ status: 'deleted' })).status, 400)
  assert.equal((await request(h.app).patch(api(`/platform/contact-inquiries/${ravi.id}`)).set(auth).send({ status: 'closed', message: 'edited' })).status, 400)

  // notes
  const note = await request(h.app).post(api(`/platform/contact-inquiries/${ravi.id}/notes`)).set(auth).send({ text: 'Called, will fix login today.' })
  assert.equal(note.status, 201, JSON.stringify(note.body))
  assert.equal(note.body.data.inquiry.notes.length, 1)
  assert.equal(note.body.data.inquiry.notes[0].authorName, 'Test User')
  assert.equal((await request(h.app).post(api(`/platform/contact-inquiries/${ravi.id}/notes`)).set(auth).send({ text: '   ' })).status, 400)

  // date filter (IST din): aaj ka din milta he, kal ka nahi
  const ist = (offsetDays) => new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86_400_000).toISOString().slice(0, 10)
  assert.equal((await search(`from=${ist(0)}&to=${ist(0)}`)).meta.total, 3)
  assert.equal((await search(`from=${ist(1)}`)).meta.total, 0)
  assert.equal((await search(`to=${ist(-1)}`)).meta.total, 0)
  assert.equal((await request(h.app).get(api('/platform/contact-inquiries?from=yesterday')).set(auth)).status, 400)

  // Refresh ke baad bhi wahi data (database me save he)
  const again = await request(h.app).get(api(`/platform/contact-inquiries/${ravi.id}`)).set(auth)
  assert.equal(again.body.data.inquiry.status, 'in_progress')
  assert.equal(again.body.data.inquiry.notes.length, 1)

  assert.equal((await request(h.app).get(api('/platform/contact-inquiries/not-an-id')).set(auth)).status, 400)
  assert.equal((await request(h.app).get(api('/platform/contact-inquiries/64b000000000000000000000')).set(auth)).status, 404)
})
