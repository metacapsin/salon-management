const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
before(h.connect)
after(h.disconnect)

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
const post = (auth, path, body) => h.request(h.app).post(api(path)).set(auth).send(body)
const get = (auth, path) => h.request(h.app).get(api(path)).set(auth)
let keySeq = 0
const key = () => `inv-key-${String(++keySeq).padStart(6, '0')}`

async function setup(email, slug) {
  const o = await h.ownerWithSalon(email, slug)
  const auth = h.bearer(o.token, o.salonId)
  const mk = (name, price) => h.models.Service.create({ salonId: o.salonId, name, price, durationMin: 30 })
  return { o, auth, hair: await mk('Haircut', 500), spa: await mk('Hair Spa', 1000) }
}

const booking = (s, phone, svcs, extra = {}) =>
  h.models.Booking.create({
    salonId: s.o.salonId, customerName: 'Riya', customerPhone: phone, date: today(), startTime: '10:00', durationMin: 30,
    services: svcs.map((v) => ({ serviceId: v._id, name: v.name, price: v.price, durationMin: 30 })),
    total: svcs.reduce((t, v) => t + v.price, 0), status: 'completed', ...extra,
  })

const walkIn = (s, lines, extra = {}) => ({ requestKey: key(), customerPhone: '9810000001', customerName: 'Riya', lines: lines.map(([svc, quantity]) => ({ serviceId: String(svc._id), quantity })), ...extra })

test('walk-in invoice: server computes subtotal, 18% GST (9+9) and total in paise; unique number; validation', async () => {
  const s = await setup('inv1@x.com', 'inv-one')
  const res = await post(s.auth, '/invoices', walkIn(s, [[s.hair, 2]]))
  assert.equal(res.status, 201, JSON.stringify(res.body))
  const inv = res.body.data.invoice
  assert.match(inv.invoiceNumber, /^GLM-\d{4}-000001$/)
  assert.equal(inv.subtotal, 100000) // 2 x Rs 500
  assert.deepEqual({ ...inv.tax }, { ratePercent: 18, cgst: 9000, sgst: 9000, total: 18000 })
  assert.equal(inv.total, 118000)
  assert.equal(inv.amountDue, 118000)
  assert.equal(inv.paymentStatus, 'unpaid')

  const second = await post(s.auth, '/invoices', walkIn(s, [[s.spa, 1]]))
  assert.match(second.body.data.invoice.invoiceNumber, /000002$/)

  // client ki bheji keemat / total par bharosa nahi: extra fields reject
  assert.equal((await post(s.auth, '/invoices', { ...walkIn(s, [[s.hair, 1]]), total: 1 })).status, 400)
  assert.equal((await post(s.auth, '/invoices', { ...walkIn(s, [[s.hair, 1]]), lines: [{ serviceId: String(s.hair._id), quantity: 1, price: 1 }] })).status, 400)
  assert.equal((await post(s.auth, '/invoices', walkIn(s, [[s.hair, 0]]))).status, 400) // quantity 0
  assert.equal((await post(s.auth, '/invoices', walkIn(s, [[s.hair, -2]]))).status, 400)
  assert.equal((await post(s.auth, '/invoices', walkIn(s, [[s.hair, 1.5]]))).status, 400)
  assert.equal((await post(s.auth, '/invoices', { ...walkIn(s, []), lines: [] })).status, 400) // no services
  assert.equal((await post(s.auth, '/invoices', { requestKey: key(), lines: [] })).status, 400)
  assert.equal((await post(s.auth, '/invoices', { ...walkIn(s, [[s.hair, 1]]), lines: [{ serviceId: String(s.hair._id), quantity: 1 }, { serviceId: String(s.hair._id), quantity: 1 }] })).status, 400) // same service twice

  const one = await get(s.auth, `/invoices/${inv.id}`)
  assert.equal(one.body.data.invoice.total, 118000)
  assert.equal(one.body.data.salon.name, 'Salon inv-one')
  assert.equal(await h.models.Invoice.countDocuments({ salonId: s.o.salonId }), 2)
})

test('duplicate protection: same requestKey (retry or race) makes one bill; one bill per appointment', async () => {
  const s = await setup('inv2@x.com', 'inv-two')
  const body = walkIn(s, [[s.hair, 1]])
  const [a, b] = await Promise.all([post(s.auth, '/invoices', body), post(s.auth, '/invoices', body)])
  assert.ok([a.status, b.status].every((c) => c === 200 || c === 201), JSON.stringify([a.body, b.body]))
  assert.equal(a.body.data.invoice.id, b.body.data.invoice.id)
  assert.equal(await h.models.Invoice.countDocuments({ salonId: s.o.salonId }), 1)
  assert.equal((await post(s.auth, '/invoices', body)).body.data.duplicate, true)

  const bk = await booking(s, '9810000002', [s.hair])
  const [x, y] = await Promise.all([
    post(s.auth, '/invoices', { requestKey: key(), bookingId: String(bk._id) }),
    post(s.auth, '/invoices', { requestKey: key(), bookingId: String(bk._id) }),
  ])
  assert.deepEqual([x.status, y.status].sort(), [201, 409])
  assert.equal(await h.models.Invoice.countDocuments({ bookingId: bk._id }), 1)
  const again = await post(s.auth, '/invoices', { requestKey: key(), bookingId: String(bk._id) })
  assert.equal(again.body.error.code, 'BOOKING_ALREADY_BILLED')
})

test('offer + membership discounts follow existing rules; invalid discounts rejected', async () => {
  const s = await setup('inv3@x.com', 'inv-three')
  const offer = await h.models.Offer.create({ salonId: s.o.salonId, title: 'Ten off', discountType: 'percent', discountValue: 10, startsOn: '2020-01-01', endsOn: '2099-12-31' })
  const old = await h.models.Offer.create({ salonId: s.o.salonId, title: 'Old', discountType: 'percent', discountValue: 50, startsOn: '2020-01-01', endsOn: '2020-02-01' })
  const once = await h.models.Offer.create({ salonId: s.o.salonId, title: 'Once', discountType: 'flat', discountValue: 100, oncePerCustomer: true, startsOn: '2020-01-01', endsOn: '2099-12-31' })
  const spaOnly = await h.models.Offer.create({ salonId: s.o.salonId, title: 'Spa only', discountType: 'percent', discountValue: 10, serviceIds: [s.spa._id], startsOn: '2020-01-01', endsOn: '2099-12-31' })
  const lines = [[s.hair, 1], [s.spa, 1]]

  assert.equal((await post(s.auth, '/invoices', walkIn(s, lines, { offerId: String(old._id) }))).body.error.code, 'OFFER_INVALID')
  assert.equal((await post(s.auth, '/invoices', walkIn(s, [[s.hair, 1]], { offerId: String(spaOnly._id) }))).body.error.code, 'OFFER_INVALID') // doesn't apply
  // doosre salon ka offer
  const other = await setup('inv3b@x.com', 'inv-three-b')
  const foreign = await h.models.Offer.create({ salonId: other.o.salonId, title: 'Foreign', discountType: 'percent', discountValue: 90, startsOn: '2020-01-01', endsOn: '2099-12-31' })
  assert.equal((await post(s.auth, '/invoices', walkIn(s, lines, { offerId: String(foreign._id) }))).body.error.code, 'OFFER_INVALID')

  // Gold 20% membership (paid, active)
  const t = today()
  await h.models.CustomerMembership.create({
    salonId: s.o.salonId, planId: s.hair._id, planName: 'Gold', customerPhone: '9810000001', customerName: 'Riya', discountType: 'percent', discountValue: 20,
    pricePaid: 2000, paymentStatus: 'paid', purchasedOn: t, startsOn: t, expiresOn: '2099-12-31', requestKey: key(),
  })
  const res = await post(s.auth, '/invoices', walkIn(s, lines, { offerId: String(offer._id) }))
  assert.equal(res.status, 201, JSON.stringify(res.body))
  const inv = res.body.data.invoice
  // 1500: offer 10% = 150, membership 20% = 300 -> 450 off; taxable 1050; GST 189; total 1239
  assert.equal(inv.subtotal, 150000)
  assert.equal(inv.offer.discount, 15000)
  assert.equal(inv.membership.discount, 30000)
  assert.equal(inv.discountTotal, 45000)
  assert.equal(inv.taxableAmount, 105000)
  assert.equal(inv.tax.total, 18900)
  assert.equal(inv.total, 123900)
  assert.equal(await h.models.MembershipLedger.countDocuments({ type: 'invoice_discount', invoiceId: inv.id }), 1)

  // membership "mat lagao"
  const noMem = await post(s.auth, '/invoices', walkIn(s, lines, { applyMembership: false }))
  assert.equal(noMem.body.data.invoice.membership, null)
  assert.equal(noMem.body.data.invoice.total, 177000)

  // unpaid membership koi discount nahi deta
  await h.models.CustomerMembership.updateMany({}, { $set: { paymentStatus: 'pending' } })
  const unpaid = await post(s.auth, '/invoices', walkIn(s, lines))
  assert.equal(unpaid.body.data.invoice.membership, null)

  // oncePerCustomer: pehla chalega, doosra nahi
  assert.equal((await post(s.auth, '/invoices', walkIn(s, lines, { offerId: String(once._id) }))).status, 201)
  assert.equal((await post(s.auth, '/invoices', walkIn(s, lines, { offerId: String(once._id) }))).body.error.code, 'OFFER_INVALID')
})

test('package: session covers the service (no double charge), deducted once, never twice per appointment', async () => {
  const s = await setup('inv4@x.com', 'inv-four')
  const pkg = (await post(s.auth, '/packages', { name: 'Hair Pack', items: [{ serviceId: String(s.hair._id), sessions: 3 }], packagePrice: 1200, validityDays: 90 })).body.data.package
  const cp = (await post(s.auth, '/customer-packages', { packageId: pkg.id, customerPhone: '9810000013', customerName: 'Riya', requestKey: key() })).body.data.customerPackage
  const remaining = async () => (await h.models.CustomerPackage.findById(cp.id).lean()).items[0].remaining

  // appointment complete nahi -> session nahi kat sakta
  const pending = await booking(s, '9810000013', [s.hair, s.spa], { status: 'confirmed' })
  const early = await post(s.auth, '/invoices', { requestKey: key(), bookingId: String(pending._id), packageRedemptions: [{ customerPackageId: cp.id, serviceId: String(s.hair._id) }] })
  assert.equal(early.body.error.code, 'BOOKING_NOT_COMPLETED')
  assert.equal(await remaining(), 3)

  const bk = await booking(s, '9810000013', [s.hair, s.spa])
  const ok = await post(s.auth, '/invoices', { requestKey: key(), bookingId: String(bk._id), packageRedemptions: [{ customerPackageId: cp.id, serviceId: String(s.hair._id) }] })
  assert.equal(ok.status, 201, JSON.stringify(ok.body))
  const inv = ok.body.data.invoice
  assert.equal(inv.subtotal, 100000) // sirf Hair Spa; Haircut package se
  assert.equal(inv.total, 118000)
  assert.equal(inv.lines.find((l) => l.name === 'Haircut').lineTotal, 0)
  assert.equal(inv.lines.find((l) => l.name === 'Haircut').package.packageName, 'Hair Pack')
  assert.equal(await remaining(), 2)

  // dusre appointment: session pehle se (BenefitsDialog/redeem API se) kat chuka -> bill me sirf cover hota hai, dobara nahi katta
  const bk2 = await booking(s, '9810000013', [s.hair])
  const red = await post(s.auth, `/customer-packages/${cp.id}/redeem`, { bookingId: String(bk2._id), serviceId: String(s.hair._id) })
  assert.equal(red.status, 200)
  assert.equal(await remaining(), 1)
  const inv2 = await post(s.auth, '/invoices', { requestKey: key(), bookingId: String(bk2._id) })
  assert.equal(inv2.status, 201)
  assert.equal(inv2.body.data.invoice.total, 0)
  assert.equal(inv2.body.data.invoice.paymentStatus, 'paid')
  assert.equal(await remaining(), 1)

  // dusre customer ka package nahi chalta
  const stranger = await booking(s, '9899999999', [s.hair])
  const bad = await post(s.auth, '/invoices', { requestKey: key(), bookingId: String(stranger._id), packageRedemptions: [{ customerPackageId: cp.id, serviceId: String(s.hair._id) }] })
  assert.equal(bad.status, 400)
  assert.equal(await remaining(), 1)

  // ek hi session ke liye do alag appointments ek saath: sirf ek jeete
  const b3 = await booking(s, '9810000013', [s.hair])
  const b4 = await booking(s, '9810000013', [s.hair])
  const red2 = (b) => post(s.auth, '/invoices', { requestKey: key(), bookingId: String(b._id), packageRedemptions: [{ customerPackageId: cp.id, serviceId: String(s.hair._id) }] })
  const race = await Promise.all([red2(b3), red2(b4)])
  assert.equal(race.filter((r) => r.status === 201).length, 1, JSON.stringify(race.map((r) => r.body)))
  assert.equal(await remaining(), 0)
  assert.equal(await h.models.PackageLedger.countDocuments({ type: 'redemption' }), 3)
})

test('tenant isolation and auth', async () => {
  const a = await setup('inv5a@x.com', 'inv-five-a')
  const b = await setup('inv5b@x.com', 'inv-five-b')
  const bk = await booking(a, '9810000005', [a.hair])
  const made = await post(a.auth, '/invoices', { requestKey: key(), bookingId: String(bk._id) })
  assert.equal(made.status, 201)

  assert.equal((await post(b.auth, '/invoices', { requestKey: key(), bookingId: String(bk._id) })).status, 400) // doosre salon ki booking
  assert.equal((await post(b.auth, '/invoices', walkIn(b, [[a.hair, 1]]))).status, 400) // doosre salon ki service
  assert.equal((await get(b.auth, `/invoices/${made.body.data.invoice.id}`)).status, 404)
  // header se doosre salon me ghusna: membership nahi -> mana
  const sneaky = await get(h.bearer(b.o.token, a.o.salonId), `/invoices/${made.body.data.invoice.id}`)
  assert.ok([403, 404].includes(sneaky.status))
  // requestKey doosre salon me same ho sakti hai, par us salon ka bill alag banta hai
  const sameKey = await post(b.auth, '/invoices', walkIn(b, [[b.hair, 1]], { requestKey: 'shared-key-0001' }))
  const sameKeyA = await post(a.auth, '/invoices', walkIn(a, [[a.hair, 1]], { requestKey: 'shared-key-0001' }))
  assert.equal(sameKey.status, 201)
  assert.equal(sameKeyA.status, 201)
  assert.notEqual(sameKey.body.data.invoice.id, sameKeyA.body.data.invoice.id)

  assert.equal((await h.request(h.app).post(api('/invoices')).send(walkIn(a, [[a.hair, 1]]))).status, 401)
  assert.equal((await get({}, `/invoices/${made.body.data.invoice.id}`)).status, 401)
})

test('preview gives the same numbers as the real bill and writes nothing; billable appointments list', async () => {
  const s = await setup('inv6@x.com', 'inv-six')
  const offer = await h.models.Offer.create({ salonId: s.o.salonId, title: 'Ten off', discountType: 'percent', discountValue: 10, startsOn: '2020-01-01', endsOn: '2099-12-31' })
  const body = { customerPhone: '9810000007', customerName: 'Riya', lines: [{ serviceId: String(s.spa._id), quantity: 2 }], offerId: String(offer._id) }

  const pv = await post(s.auth, '/invoices/preview', body)
  assert.equal(pv.status, 200, JSON.stringify(pv.body))
  assert.equal(await h.models.Invoice.countDocuments({ salonId: s.o.salonId }), 0)
  assert.equal(await h.models.InvoiceCounter.countDocuments({ salonId: s.o.salonId }), 0)
  const real = (await post(s.auth, '/invoices', { ...body, requestKey: key() })).body.data.invoice
  for (const k of ['subtotal', 'discountTotal', 'taxableAmount', 'total']) assert.equal(pv.body.data[k], real[k], k)
  assert.equal(pv.body.data.total, 212400) // 2 x 1000 = 2000, 10% off = 1800, GST 324, total 2124
  assert.equal((await post(s.auth, '/invoices/preview', { ...body, total: 1 })).status, 400)
  assert.equal((await post(s.auth, '/invoices/preview', { ...body, offerId: String(new (require('mongoose').Types.ObjectId)()) })).body.error.code, 'OFFER_INVALID')

  const mine = await booking(s, '9810000008', [s.hair])
  await booking(s, '9810000008', [s.spa], { status: 'cancelled' })
  const billed = await booking(s, '9810000008', [s.spa])
  await post(s.auth, '/invoices', { requestKey: key(), bookingId: String(billed._id) })
  const list = await get(s.auth, '/invoices/billable-appointments?customerPhone=9810000008')
  assert.deepEqual(list.body.data.appointments.map((a) => a.id), [String(mine._id)])
  assert.equal((await get(s.auth, '/invoices/billable-appointments?customerPhone=123')).status, 400)
  const other = await setup('inv6b@x.com', 'inv-six-b')
  assert.equal((await get(other.auth, '/invoices/billable-appointments?customerPhone=9810000008')).body.data.appointments.length, 0)
})
