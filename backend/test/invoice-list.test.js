const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
before(h.connect)
after(h.disconnect)

const post = (auth, path, body) => h.request(h.app).post(api(path)).set(auth).send(body)
const get = (auth, path) => h.request(h.app).get(api(path)).set(auth)
let n = 0
const key = () => `lst-key-${String(++n).padStart(6, '0')}`

async function setup(email, slug) {
  const o = await h.ownerWithSalon(email, slug)
  const auth = h.bearer(o.token, o.salonId)
  const hair = await h.models.Service.create({ salonId: o.salonId, name: 'Haircut', price: 1000, durationMin: 30 })
  return { o, auth, hair }
}
const bill = async (s, phone, name) =>
  (await post(s.auth, '/invoices', { requestKey: key(), customerPhone: phone, customerName: name, lines: [{ serviceId: String(s.hair._id), quantity: 1 }] })).body.data.invoice
const pay = (s, inv, amount, method = 'cash') => post(s.auth, `/invoices/${inv.id}/payments`, { requestKey: key(), method, amount })
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })

test('list: search, customer, date, method and payment-status filters, pagination', async () => {
  const s = await setup('lst1@x.com', 'lst-one')
  const a = await bill(s, '9810000001', 'Riya Sharma') // 118000
  const b = await bill(s, '9810000002', 'Meera Joshi')
  const c = await bill(s, '9810000003', 'Riya Verma')
  await pay(s, a, 118000, 'upi')
  await pay(s, b, 50000, 'cash')

  const ids = (r) => r.body.data.invoices.map((i) => i.id)
  const all = await get(s.auth, '/invoices')
  assert.equal(all.body.meta.total, 3)
  assert.deepEqual(ids(all), [c.id, b.id, a.id]) // nayi pehle
  assert.deepEqual(ids(await get(s.auth, '/invoices?search=riya')).sort(), [a.id, c.id].sort())
  assert.deepEqual(ids(await get(s.auth, `/invoices?search=${a.invoiceNumber}`)), [a.id])
  assert.deepEqual(ids(await get(s.auth, '/invoices?customerPhone=9810000002')), [b.id])
  assert.deepEqual(ids(await get(s.auth, '/invoices?paymentStatus=paid')), [a.id])
  assert.deepEqual(ids(await get(s.auth, '/invoices?paymentStatus=partial')), [b.id])
  assert.deepEqual(ids(await get(s.auth, '/invoices?paymentStatus=unpaid')), [c.id])
  assert.deepEqual(ids(await get(s.auth, '/invoices?method=upi')), [a.id])
  assert.deepEqual(ids(await get(s.auth, '/invoices?method=card')), [])
  assert.equal((await get(s.auth, `/invoices?from=${today()}&to=${today()}`)).body.meta.total, 3)
  assert.equal((await get(s.auth, '/invoices?to=2020-01-01')).body.meta.total, 0)
  assert.equal((await get(s.auth, '/invoices?from=2099-01-01')).body.meta.total, 0)
  const page = await get(s.auth, '/invoices?pageSize=2&page=2')
  assert.deepEqual(ids(page), [a.id])
  assert.equal(page.body.meta.total, 3)
  // regex ke khaas akshar safe
  assert.equal((await get(s.auth, '/invoices?search=.*')).status, 200)
  assert.equal((await get(s.auth, '/invoices?search=.*')).body.meta.total, 0)
  // galat filter values
  assert.equal((await get(s.auth, '/invoices?method=bitcoin')).status, 400)
  assert.equal((await get(s.auth, '/invoices?from=yesterday')).status, 400)
  assert.equal((await get(s.auth, '/invoices?pageSize=1000')).status, 400)
})

test('summary: billed, received, pending; refunds reduce received; void bills ignored; recent list', async () => {
  const s = await setup('lst2@x.com', 'lst-two')
  const empty = await get(s.auth, '/invoices/summary')
  assert.deepEqual({ ...empty.body.data.summary }, { invoices: 0, billed: 0, received: 0, pending: 0, refunded: 0, tax: 0, pendingCount: 0 })

  const a = await bill(s, '9810000001', 'A')
  const b = await bill(s, '9810000002', 'B')
  const v = await bill(s, '9810000003', 'V')
  await pay(s, a, 118000)
  await pay(s, b, 40000)
  await post(s.auth, `/invoices/${a.id}/refunds`, { requestKey: key(), method: 'cash', amount: 18000, note: 'discount given later' })
  await post(s.auth, `/invoices/${v.id}/void`, { note: 'wrong customer' })

  const sum = (await get(s.auth, '/invoices/summary')).body.data
  assert.equal(sum.summary.invoices, 2)
  assert.equal(sum.summary.billed, 236000)
  assert.equal(sum.summary.received, 100000 + 40000)
  assert.equal(sum.summary.pending, 236000 - 140000)
  assert.equal(sum.summary.refunded, 18000)
  assert.equal(sum.summary.tax, 36000)
  assert.equal(sum.summary.pendingCount, 2)
  assert.equal(sum.recent.length, 3)
  assert.equal((await get(s.auth, '/invoices/summary?from=2099-01-01')).body.data.summary.billed, 0)
  assert.equal((await get(s.auth, `/invoices/summary?from=${today()}&to=${today()}`)).body.data.summary.billed, 236000)
})

test('list and summary are tenant-isolated and need login', async () => {
  const a = await setup('lst3a@x.com', 'lst-three-a')
  const b = await setup('lst3b@x.com', 'lst-three-b')
  await bill(a, '9810000001', 'Riya')
  assert.equal((await get(b.auth, '/invoices')).body.meta.total, 0)
  assert.equal((await get(b.auth, '/invoices?search=riya')).body.data.invoices.length, 0)
  assert.equal((await get(b.auth, '/invoices/summary')).body.data.summary.billed, 0)
  assert.equal((await get(b.auth, '/invoices/summary')).body.data.recent.length, 0)
  assert.equal((await get({}, '/invoices')).status, 401)
  assert.equal((await get({}, '/invoices/summary')).status, 401)
})
