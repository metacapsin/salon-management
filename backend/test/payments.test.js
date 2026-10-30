const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
before(h.connect)
after(h.disconnect)

const post = (auth, path, body) => h.request(h.app).post(api(path)).set(auth).send(body)
const get = (auth, path) => h.request(h.app).get(api(path)).set(auth)
let n = 0
const key = () => `pay-key-${String(++n).padStart(6, '0')}`

async function setup(email, slug) {
  const o = await h.ownerWithSalon(email, slug)
  const auth = h.bearer(o.token, o.salonId)
  const hair = await h.models.Service.create({ salonId: o.salonId, name: 'Haircut', price: 1000, durationMin: 30 })
  return { o, auth, hair }
}
// Rs 1000, no GST = 100000 paise
const bill = async (s) => (await post(s.auth, '/invoices', { requestKey: key(), customerPhone: '9810000001', customerName: 'Riya', lines: [{ serviceId: String(s.hair._id), quantity: 1 }] })).body.data.invoice
const pay = (s, inv, amount, extra = {}) => post(s.auth, `/invoices/${inv.id}/payments`, { requestKey: key(), method: 'cash', amount, ...extra })
const detail = async (s, inv) => (await get(s.auth, `/invoices/${inv.id}`)).body.data

test('partial then full payment: status, amount due and history', async () => {
  const s = await setup('pay1@x.com', 'pay-one')
  const inv = await bill(s)
  assert.equal(inv.total, 100000)

  const p1 = await pay(s, inv, 50000, { method: 'upi', reference: 'UPI123' })
  assert.equal(p1.status, 201, JSON.stringify(p1.body))
  assert.equal(p1.body.data.invoice.paymentStatus, 'partial')
  assert.equal(p1.body.data.invoice.amountDue, 50000)

  assert.equal((await pay(s, inv, 50001)).body.error.code, 'OVERPAYMENT') // thoda bhi zyada nahi
  assert.equal((await detail(s, inv)).invoice.amountPaid, 50000)

  const p2 = await pay(s, inv, 50000, { method: 'card' })
  assert.equal(p2.body.data.invoice.paymentStatus, 'paid')
  assert.equal(p2.body.data.invoice.amountDue, 0)
  assert.equal((await pay(s, inv, 1)).body.error.code, 'OVERPAYMENT')

  const d = await detail(s, inv)
  assert.deepEqual(d.payments.map((p) => [p.type, p.method, p.amount]), [['payment', 'upi', 50000], ['payment', 'card', 50000]])
})

test('invalid payment data is rejected', async () => {
  const s = await setup('pay2@x.com', 'pay-two')
  const inv = await bill(s)
  for (const amount of [0, -5, 10.5, '500', null]) assert.equal((await pay(s, inv, amount)).status, 400, String(amount))
  assert.equal((await pay(s, inv, 100, { method: 'bitcoin' })).status, 400)
  assert.equal((await pay(s, inv, 100, { status: 'paid' })).status, 400) // extra field
  assert.equal((await post(s.auth, `/invoices/${inv.id}/payments`, { method: 'cash', amount: 100 })).status, 400) // no key
  assert.equal((await detail(s, inv)).invoice.amountPaid, 0)
})

test('duplicate payment: same key twice or at once records one payment; two different payments cannot overpay', async () => {
  const s = await setup('pay3@x.com', 'pay-three')
  const inv = await bill(s)
  const k = key()
  const body = { requestKey: k, method: 'cash', amount: 30000 }
  const [a, b] = await Promise.all([post(s.auth, `/invoices/${inv.id}/payments`, body), post(s.auth, `/invoices/${inv.id}/payments`, body)])
  assert.ok([a.status, b.status].every((c) => c === 200 || c === 201), JSON.stringify([a.body, b.body]))
  assert.equal((await post(s.auth, `/invoices/${inv.id}/payments`, body)).body.data.duplicate, true)
  assert.equal((await detail(s, inv)).invoice.amountPaid, 30000)
  assert.equal(await h.models.Payment.countDocuments({ invoiceId: inv.id }), 1)
  // wahi key doosri amount ke saath = galat istemaal
  assert.equal((await post(s.auth, `/invoices/${inv.id}/payments`, { ...body, method: 'upi' })).status, 200) // replay returns the original

  // 70000 baaki: do alag 40000 ek saath -> sirf ek jeete
  const race = await Promise.all([pay(s, inv, 40000), pay(s, inv, 40000)])
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409])
  const d = await detail(s, inv)
  assert.equal(d.invoice.amountPaid, 70000)
  assert.equal(d.invoice.paymentStatus, 'partial')
})

test('refund: authorised role only, reason needed, never more than received, status recomputed, audited', async () => {
  const s = await setup('pay4@x.com', 'pay-four')
  const inv = await bill(s)
  await pay(s, inv, 100000)

  const refund = (amount, extra = {}) => post(s.auth, `/invoices/${inv.id}/refunds`, { requestKey: key(), method: 'cash', amount, note: 'Customer unhappy', ...extra })
  assert.equal((await refund(10000, { note: '' })).status, 400) // reason zaroori
  assert.equal((await refund(100001)).body.error.code, 'REFUND_TOO_LARGE')
  const r = await refund(20000)
  assert.equal(r.status, 201, JSON.stringify(r.body))
  assert.equal(r.body.data.invoice.paymentStatus, 'partial')
  assert.equal(r.body.data.invoice.amountDue, 20000)
  assert.equal((await refund(80001)).body.error.code, 'REFUND_TOO_LARGE') // ab sirf 80000 bacha

  // receptionist refund nahi kar sakta, payment kar sakta hai
  const inviteMail = 'pay4-r@x.com'
  await post(s.auth, '/users/invitations', { email: inviteMail, role: 'receptionist' })
  await post({}, '/auth/accept-invitation', { token: h.tokenFromMail(inviteMail), name: 'Rec', password: h.PASSWORD })
  const rec = await h.loginAs(inviteMail)
  const recAuth = h.bearer(rec.token, s.o.salonId)
  assert.equal((await post(recAuth, `/invoices/${inv.id}/refunds`, { requestKey: key(), method: 'cash', amount: 100, note: 'try' })).status, 403)
  assert.equal((await post(recAuth, `/invoices/${inv.id}/payments`, { requestKey: key(), method: 'cash', amount: 100 })).status, 201)
  assert.equal((await post(recAuth, `/invoices/${inv.id}/void`, { note: 'try void' })).status, 403)

  const d = await detail(s, inv)
  assert.equal(d.payments.filter((p) => p.type === 'refund').length, 1)
  const audit = await h.models.AuditEvent.find({ salonId: s.o.salonId, entityId: inv.id }).lean()
  const actions = audit.map((a) => a.action)
  assert.ok(actions.includes('invoice.refunded') && actions.includes('invoice.payment_recorded') && actions.includes('invoice.created'))
  const refundAudit = audit.find((a) => a.action === 'invoice.refunded')
  assert.equal(refundAudit.redactedChanges.note, 'Customer unhappy')
  assert.ok(refundAudit.actorId)
})

test('void: only after full refund, owner only, no more payments, appointment can be billed again', async () => {
  const s = await setup('pay5@x.com', 'pay-five')
  const bk = await h.models.Booking.create({ salonId: s.o.salonId, customerName: 'Riya', customerPhone: '9810000005', date: '2026-10-20', startTime: '10:00', durationMin: 30, services: [{ serviceId: s.hair._id, name: 'Haircut', price: 1000, durationMin: 30 }], total: 1000, status: 'completed' })
  const inv = (await post(s.auth, '/invoices', { requestKey: key(), bookingId: String(bk._id) })).body.data.invoice
  await pay(s, inv, 20000)

  assert.equal((await post(s.auth, `/invoices/${inv.id}/void`, { note: 'wrong bill' })).body.error.code, 'REFUND_FIRST')
  assert.equal((await post(s.auth, `/invoices/${inv.id}/refunds`, { requestKey: key(), method: 'cash', amount: 20000, note: 'cancel bill' })).status, 201)
  assert.equal((await post(s.auth, `/invoices/${inv.id}/void`, { note: '' })).status, 400)
  const v = await post(s.auth, `/invoices/${inv.id}/void`, { note: 'wrong bill' })
  assert.equal(v.status, 200, JSON.stringify(v.body))
  assert.equal(v.body.data.invoice.status, 'void')
  assert.equal(v.body.data.invoice.amountDue, 0)
  assert.equal((await post(s.auth, `/invoices/${inv.id}/void`, { note: 'again' })).body.error.code, 'INVOICE_VOID')
  assert.equal((await pay(s, inv, 100)).body.error.code, 'INVOICE_VOID')
  assert.equal((await post(s.auth, `/invoices/${inv.id}/refunds`, { requestKey: key(), method: 'cash', amount: 1, note: 'x y z' })).body.error.code, 'INVOICE_VOID')

  const again = await post(s.auth, '/invoices', { requestKey: key(), bookingId: String(bk._id) })
  assert.equal(again.status, 201) // naya number, purana record bacha rehta hai
  assert.notEqual(again.body.data.invoice.invoiceNumber, inv.invoiceNumber)
  assert.equal(await h.models.Invoice.countDocuments({ bookingId: bk._id }), 2)
  assert.ok((await h.models.AuditEvent.findOne({ entityId: inv.id, action: 'invoice.voided' })))
})

test('tenant isolation and auth of payments, refunds and void', async () => {
  const a = await setup('pay6a@x.com', 'pay-six-a')
  const b = await setup('pay6b@x.com', 'pay-six-b')
  const inv = await bill(a)
  assert.equal((await pay(b, inv, 100)).status, 404)
  assert.equal((await post(b.auth, `/invoices/${inv.id}/refunds`, { requestKey: key(), method: 'cash', amount: 1, note: 'sneaky' })).status, 404)
  assert.equal((await post(b.auth, `/invoices/${inv.id}/void`, { note: 'sneaky' })).status, 404)
  assert.equal((await h.request(h.app).post(api(`/invoices/${inv.id}/payments`)).send({ requestKey: key(), method: 'cash', amount: 100 })).status, 401)
  assert.equal((await detail(a, inv)).invoice.amountPaid, 0)
})
