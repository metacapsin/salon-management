const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const h = require('./helpers')
const { toPaise, gstOn } = require('../src/modules/billing/money')
const { Invoice } = require('../src/models')

before(h.connect)
after(h.disconnect)

test('money: rupees to paise and no GST', () => {
  assert.equal(toPaise(499), 49900)
  assert.equal(toPaise(0.1 + 0.2), 30)
  assert.deepEqual(gstOn(100000), { taxRatePercent: 0, cgst: 0, sgst: 0, tax: 0 })
  // odd paisa: cgst + sgst hamesha tax ke barabar
  const g = gstOn(10001)
  assert.equal(g.cgst + g.sgst, g.tax)
})

test('invoice model rejects fractional paise and duplicate invoice numbers', async () => {
  await Invoice.init()
  const salonId = new mongoose.Types.ObjectId()
  const base = {
    salonId, customerPhone: '9810000001', customerName: 'A', lines: [], subtotal: 0, discountTotal: 0, taxableAmount: 0,
    tax: { ratePercent: 18, cgst: 0, sgst: 0, total: 0 }, total: 0, requestKey: 'key-00000001', invoiceNumber: 'GLM-2026-000001',
  }
  await assert.rejects(new Invoice({ ...base, total: 10.5 }).validate(), /total/)
  await Invoice.create(base)
  await assert.rejects(Invoice.create({ ...base, requestKey: 'key-00000002' }), (e) => e.code === 11000)
  await assert.rejects(Invoice.create({ ...base, invoiceNumber: 'GLM-2026-000002' }), (e) => e.code === 11000) // same requestKey
  await Invoice.deleteMany({ salonId })
})
