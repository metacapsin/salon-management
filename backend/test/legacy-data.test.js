// Purane records (jab rules alag the) tootne nahi chahiye: save par sirf badli hui value validate hoti he.
// Bug jo mila tha: Super Admin ne purane "+91 98100 11644" phone wale salon ko suspend kiya to 500 aaya.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`

before(h.connect)
after(h.disconnect)

test('legacy salon (old +91 phone, long owner name) can still be suspended and activated by the Super Admin', async () => {
  const owner = await h.ownerWithSalon('lg-owner@x.com', 'lg-owner')
  await h.createVerifiedUser('lg-admin@x.com')
  await h.models.User.updateOne({ normalizedEmail: 'lg-admin@x.com' }, { platformRole: 'admin' })
  const admin = await h.loginAs('lg-admin@x.com')

  // purana data seedha database me (model ke rules ko bypass karke), jaise purane records the
  await h.models.Salon.collection.updateOne(
    { _id: new h.models.Salon.base.Types.ObjectId(owner.salonId) },
    { $set: { 'ownerContact.phone': '+91 98100 11644', 'ownerContact.name': 'A Very Long Legacy Owner Name Beyond Thirty Five Characters' } },
  )

  const suspend = await h.request(h.app).patch(api(`/platform/salons/${owner.salonId}/status`)).set(h.bearer(admin.token)).send({ status: 'suspended' })
  assert.equal(suspend.status, 200, JSON.stringify(suspend.body))
  assert.equal((await h.models.Salon.findById(owner.salonId)).status, 'suspended')

  const activate = await h.request(h.app).patch(api(`/platform/salons/${owner.salonId}/status`)).set(h.bearer(admin.token)).send({ status: 'active' })
  assert.equal(activate.status, 200, JSON.stringify(activate.body))
})

test('the safety net still refuses a NEW bad value on a record that was just modified', async () => {
  const owner = await h.ownerWithSalon('lg-owner2@x.com', 'lg-owner2')
  const salon = await h.models.Salon.findById(owner.salonId)
  salon.ownerContact.phone = '12345'
  await assert.rejects(() => salon.save(), /valid 10-digit mobile number/)

  const customer = new h.models.Customer({ phone: '+91 98100 11644', name: 'Test Customer' })
  await assert.rejects(() => customer.save(), /valid 10-digit mobile number/)
})
