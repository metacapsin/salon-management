const { test, before, after, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const h = require('./helpers')
const { placeKey } = require('../src/utils/placeKey')
const places = require('../src/utils/places')

const api = (path) => `/api/v1${path}`

before(h.connect)
after(h.disconnect)

const realFetch = global.fetch
afterEach(() => {
  global.fetch = realFetch
  places._cache.clear()
})

// Geocoder ka nakli jawab (internet par nirbhar nahi)
const stubFetch = (handler) => {
  global.fetch = async (url) => {
    const body = handler(String(url))
    if (body instanceof Error) throw body
    return { ok: true, json: async () => body }
  }
}

async function salonIn(email, slug, { city, area = '', lat, lng, audience = 'unisex' }) {
  const o = await h.ownerWithSalon(email, slug)
  await h.models.Salon.updateOne(
    { _id: o.salonId },
    { $set: { publicBookingEnabled: true, audience, 'address.area': area, 'address.location': { lat, lng } } },
  )
  // city model se badlo, taaki city-kunji ka hook chale (owner ke Settings se badalne jaisa)
  const salon = await h.models.Salon.findById(o.salonId)
  salon.address.city = city
  await salon.save()
  return o
}

test('place key: spelling differences (B/V, ai/ay, old city names) are the same place', () => {
  assert.equal(placeKey('Bijainagar'), placeKey('Vijainagar'))
  assert.equal(placeKey('Bijainagar'), placeKey('Vijaynagar Tehsil'))
  assert.equal(placeKey('Bangalore'), placeKey('Bengaluru'))
  assert.equal(placeKey('Jaipur Municipal Corporation'), placeKey('Jaipur'))
  assert.notEqual(placeKey('Jaipur'), placeKey('Udaipur'))
  assert.equal(placeKey(''), '')
})

test('salons are found by any spelling of the town; other towns are not mixed in', async () => {
  const a = await salonIn('pl1@x.com', 'pl-one', { city: 'Bijainagar', area: 'Station Road', lat: 25.93, lng: 74.65 })
  await salonIn('pl2@x.com', 'pl-two', { city: 'Jaipur', lat: 26.91, lng: 75.78 })
  const c = await h.customerAgent('9810030001')

  for (const spelling of ['Bijainagar', 'Vijainagar', 'vijaynagar']) {
    const res = await c.get(api(`/public/salons?city=${spelling}`))
    assert.equal(res.status, 200)
    assert.deepEqual(res.body.data.salons.map((s) => String(s.id)), [String(a.salonId)], spelling)
  }
  const none = await c.get(api('/public/salons?city=Sikar'))
  assert.equal(none.body.meta.total, 0)

  // locations: ek hi shehar, do spelling ke salon ek saath ginte jaate hain
  await salonIn('pl3@x.com', 'pl-three', { city: 'Vijainagar', lat: 25.931, lng: 74.651 })
  const loc = await c.get(api('/public/locations'))
  const entry = loc.body.data.cities.find((x) => placeKey(x.city) === placeKey('Bijainagar'))
  assert.equal(entry.salonCount, 2)
  assert.ok(entry.center.lat > 25 && entry.center.lat < 26)
})

test('audience filter: unisex shows only unisex salons; women/men also include unisex', async () => {
  await salonIn('pl4@x.com', 'pl-four', { city: 'Kota', lat: 25.2, lng: 75.8, audience: 'women' })
  await salonIn('pl5@x.com', 'pl-five', { city: 'Kota', lat: 25.21, lng: 75.81, audience: 'men' })
  await salonIn('pl6@x.com', 'pl-six', { city: 'Kota', lat: 25.22, lng: 75.82, audience: 'unisex' })
  const c = await h.customerAgent('9810030002')
  const get = async (audience) => (await c.get(api(`/public/salons?city=Kota&audience=${audience}`))).body.data.salons.map((s) => s.audience).sort()

  assert.deepEqual(await get('unisex'), ['unisex'])
  assert.deepEqual(await get('women'), ['unisex', 'women'])
  assert.deepEqual(await get('men'), ['men', 'unisex'])
})

test('category filter: only salons with a matching active service; hair chips split by service name', async () => {
  const a = await salonIn('pl9@x.com', 'pl-nine', { city: 'Sikar', lat: 27.6, lng: 75.1 })
  const b = await salonIn('pl10@x.com', 'pl-ten', { city: 'Sikar', lat: 27.61, lng: 75.11 })
  const svc = (o, name, category, active = true) => h.models.Service.create({ salonId: o.salonId, name, category, price: 300, durationMin: 30, active })
  await svc(a, 'Haircut', 'Hair')
  await svc(a, 'Hair spa', 'Hair')
  await svc(b, 'Facial', 'Skin')
  await svc(b, 'Colour', 'Hair', false) // band service gina nahi jata
  const c = await h.customerAgent('9810030006')
  const get = async (category) => (await c.get(api(`/public/salons?city=Sikar&category=${category}`))).body.data.salons.map((s) => String(s.id)).sort()

  assert.deepEqual(await get('haircut'), [String(a.salonId)])
  assert.deepEqual(await get('hair-spa'), [String(a.salonId)])
  assert.deepEqual(await get('skincare'), [String(b.salonId)])
  assert.deepEqual(await get('coloring'), [])
  assert.deepEqual(await get('nails'), [])
  assert.equal((await c.get(api('/public/salons?city=Sikar&category=bogus'))).status, 400)
})

test('rating and price filters: only salons inside the range; salons without a price are left out', async () => {
  const set = async (o, fields) => h.models.Salon.updateOne({ _id: o.salonId }, { $set: fields })
  const a = await salonIn('pl11@x.com', 'pl-eleven', { city: 'Churu', lat: 28.3, lng: 74.9 })
  const b = await salonIn('pl12@x.com', 'pl-twelve', { city: 'Churu', lat: 28.31, lng: 74.91 })
  const n = await salonIn('pl13@x.com', 'pl-thirteen', { city: 'Churu', lat: 28.32, lng: 74.92 })
  await set(a, { startingPrice: 200, 'rating.average': 4.6, 'rating.count': 10 })
  await set(b, { startingPrice: 900, 'rating.average': 3.9, 'rating.count': 5 })
  await set(n, { 'rating.average': 0, 'rating.count': 0 }) // naya salon: na price, na rating
  const c = await h.customerAgent('9810030007')
  const get = async (qs) => (await c.get(api(`/public/salons?city=Churu&${qs}`))).body.data.salons.map((s) => String(s.id)).sort()
  const ids = (...os) => os.map((o) => String(o.salonId)).sort()

  assert.deepEqual(await get('minRating=4'), ids(a))
  assert.deepEqual(await get('minRating=3.5'), ids(a, b))
  assert.deepEqual(await get('maxPrice=300'), ids(a))
  assert.deepEqual(await get('minPrice=500&maxPrice=1000'), ids(b))
  assert.deepEqual(await get('minPrice=500'), ids(b))
  assert.deepEqual(await get(''), ids(a, b, n))
  assert.equal((await c.get(api('/public/salons?city=Churu&minRating=9'))).status, 400)
})

test('nearest salons: closest first, across cities, with distance', async () => {
  await salonIn('pl7@x.com', 'pl-seven', { city: 'Ajmer', lat: 26.45, lng: 74.64 })
  await salonIn('pl8@x.com', 'pl-eight', { city: 'Jodhpur', lat: 26.29, lng: 73.02 })
  const c = await h.customerAgent('9810030003')
  const res = await c.get(api('/public/nearest-salons?lat=25.93&lng=74.65&limit=2'))
  assert.equal(res.status, 200)
  assert.equal(res.body.data.salons.length, 2)
  assert.ok(res.body.data.salons[0].distanceKm <= res.body.data.salons[1].distanceKm)
  assert.equal((await h.request(h.app).get(api('/public/nearest-salons?lat=25&lng=74'))).status, 200) // salon ki list bina login ke khuli hai
})

test('reverse place: coordinates give the town name; geocoder failure gives place null, not an error', async () => {
  stubFetch(() => ({ address: { country_code: 'in', town: 'Vijainagar', county: 'Vijaynagar Tehsil', state_district: 'Beawar', state: 'Rajasthan' }, lat: '25.93', lon: '74.65' }))
  const c = await h.customerAgent('9810030004')
  const ok = await c.get(api('/public/places/reverse?lat=25.92584&lng=74.64982'))
  assert.equal(ok.status, 200)
  assert.equal(ok.body.data.place.name, 'Vijainagar')
  assert.equal(ok.body.data.place.state, 'Rajasthan')

  places._cache.clear()
  stubFetch(() => new Error('network down'))
  const down = await c.get(api('/public/places/reverse?lat=19.07&lng=72.87'))
  assert.equal(down.status, 200)
  assert.equal(down.body.data.place, null)

  assert.equal((await c.get(api('/public/places/reverse?lat=abc&lng=1'))).status, 400)
})

test('place search: only towns and villages (not stations or roads), duplicates removed', async () => {
  stubFetch(() => [
    { category: 'railway', type: 'station', name: 'Bijainagar', lat: '25.9', lon: '74.6', address: { state: 'Rajasthan' } },
    { category: 'place', type: 'town', lat: '25.93', lon: '74.65', address: { town: 'Vijainagar', state_district: 'Beawar', state: 'Rajasthan', country_code: 'in' } },
    { category: 'place', type: 'town', lat: '25.94', lon: '74.66', address: { town: 'Vijainagar', state_district: 'Beawar', state: 'Rajasthan', country_code: 'in' } },
  ])
  const c = await h.customerAgent('9810030005')
  const res = await c.get(api('/public/places/search?q=bijai'))
  assert.equal(res.status, 200)
  assert.equal(res.body.data.places.length, 1)
  assert.equal(res.body.data.places[0].name, 'Vijainagar')
  assert.equal((await c.get(api('/public/places/search?q=a'))).status, 400)
})
