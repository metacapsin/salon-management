const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')

const api = (path) => `/api/v1${path}`
const request = h.request

before(h.connect)
after(h.disconnect)

async function seed(salonId, rows) {
  await h.models.Booking.insertMany(
    rows.map((r) => ({ salonId, mode: 'salon', durationMin: 30, startTime: '11:00', services: [], status: 'completed', ...r })),
  )
}

test('customers list is built from bookings, grouped by phone, scoped to the salon', async () => {
  const o = await h.ownerWithSalon('cu1@x.com', 'cu-one')
  const auth = h.bearer(o.token, o.salonId)
  const now = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10)
  await seed(o.salonId, [
    { customerName: 'Priya', customerPhone: '9810000001', date: now, total: 300 },
    { customerName: 'Priya', customerPhone: '9810000001', date: now, total: 500 },
    { customerName: 'Anjali', customerPhone: '9810000002', date: '2020-01-01', total: 900 },
    { customerName: 'Neha', customerPhone: '9810000003', date: now, total: 400, status: 'pending' },
    { customerName: 'Ghost', customerPhone: '9810000004', date: now, total: 100, status: 'cancelled' },
  ])

  const res = await request(h.app).get(api('/customers')).set(auth)
  assert.equal(res.status, 200, JSON.stringify(res.body))
  const byPhone = Object.fromEntries(res.body.data.customers.map((c) => [c.phone, c]))
  assert.equal(Object.keys(byPhone).length, 3) // cancelled wala customer nahi
  assert.equal(byPhone['9810000001'].visits, 2)
  assert.equal(byPhone['9810000001'].spent, 800)
  assert.equal(byPhone['9810000001'].segment, 'regular')
  assert.equal(byPhone['9810000002'].segment, 'inactive')
  assert.equal(byPhone['9810000003'].segment, 'new')
  assert.equal(byPhone['9810000003'].visits, 0)
  assert.equal(res.body.data.summary.total, 3)
  assert.equal(res.body.data.summary.newThisMonth >= 2, true)

  const inactive = await request(h.app).get(api('/customers?segment=inactive')).set(auth)
  assert.deepEqual(inactive.body.data.customers.map((c) => c.name), ['Anjali'])
  const byName = await request(h.app).get(api('/customers?search=priy')).set(auth)
  assert.deepEqual(byName.body.data.customers.map((c) => c.phone), ['9810000001'])
  const byPhoneSearch = await request(h.app).get(api('/customers?search=0003')).set(auth)
  assert.deepEqual(byPhoneSearch.body.data.customers.map((c) => c.name), ['Neha'])
  assert.equal((await request(h.app).get(api('/customers?search=.*')).set(auth)).body.data.customers.length, 0) // regex safe

  const other = await h.ownerWithSalon('cu2@x.com', 'cu-two')
  const otherList = await request(h.app).get(api('/customers')).set(h.bearer(other.token, other.salonId))
  assert.equal(otherList.body.data.customers.length, 0)
  assert.equal((await request(h.app).get(api('/customers'))).status, 401)
})
