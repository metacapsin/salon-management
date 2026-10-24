// Customer ke liye khula (bina login) discovery: city/area ke hisaab se salons dhundhna.
// Sirf wahi salons dikhte hain jo active hain aur jinhone public booking chalu ki hai.
const express = require('express')
const { sendSuccess } = require('../../utils/response')
const { z, objectId } = require('../../utils/schemas')
const ApiError = require('../../utils/apiError')
const { validate, limiter } = require('../../middleware/common')
const { authenticateCustomer } = require('../../middleware/customerAuth')
const { Salon, Service, Notification, Branch, Booking, Offer } = require('../../models')
const { buildSlots, dateInRange } = require('../bookings/slots')
const { placeKey } = require('../../utils/placeKey')
const { discountFor } = require('../offers/pricing')
const { reverseGeocode, searchPlaces } = require('../../utils/places')

const router = express.Router()
// Salon ki list (shehar, filter, paas ke salons) sabke liye khuli hai. Lekin salon kholna (detail + owner ka phone), slots aur booking
// ke liye customer ko mobile OTP se login karna padta hai: isse "kisne dekha" owner ko pata chalta hai aur phone number scrape nahi hota.

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const exactNoCase = (text) => new RegExp(`^${escapeRegex(text.trim())}$`, 'i')

// Customer ke "service category" chips -> salon ki active services ka filter (category aur zarurat ho to naam).
// Hair ki teen alag chips ek hi "Hair" category se naam dekh kar alag hoti hain.
const CATEGORY_CHIPS = {
  haircut: { category: ['Hair'], name: /cut|styl|trim|blow/i },
  'hair-spa': { category: ['Hair'], name: /spa|keratin|smooth/i },
  coloring: { category: ['Hair'], name: /colou?r|highlight|balayage/i },
  skincare: { category: ['Skin'] },
  makeup: { category: ['Makeup', 'Bridal'] },
  nails: { category: ['Nails'] },
  grooming: { category: ['Grooming'] },
}

const listQuery = z.object({
  city: z.string().trim().min(1).max(100),
  area: z.string().trim().max(100).optional(),
  mode: z.enum(['salon', 'home']).optional(),
  audience: z.enum(['women', 'men', 'unisex']).optional(),
  category: z.enum(Object.keys(CATEGORY_CHIPS)).optional(),
  q: z.string().trim().max(100).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  // Price "starting price" par lagta hai (salon ka sabse sasta rate); jin salons ka price nahi hai wo price filter me nahi aate
  minPrice: z.coerce.number().int().min(0).max(1000000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(1000000).optional(),
  sort: z.enum(['rating', 'nearest', 'price']).default('rating'),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(12),
})

// Do points ke beech ki doori km me (haversine)
function distanceKm(lat1, lng1, lat2, lng2) {
  const rad = (d) => (d * Math.PI) / 180
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(a))
}

function card(salon, distance) {
  return {
    id: salon._id,
    name: salon.name,
    slug: salon.slug,
    about: salon.about,
    coverUrl: salon.coverUrl,
    city: salon.address?.city ?? '',
    area: salon.address?.area ?? '',
    audience: salon.audience,
    serviceModes: salon.serviceModes,
    tags: salon.tags,
    startingPrice: salon.startingPrice,
    rating: salon.rating,
    distanceKm: distance === null ? null : Math.round(distance * 10) / 10,
  }
}

const baseFilter = { status: 'active', publicBookingEnabled: true }

// Card par "20% OFF" jaisa badge: har salon ka sabse bada chal raha offer (aaj salon ki timezone ke hisaab se)
async function offerBadges(salons) {
  const map = new Map()
  if (salons.length === 0) return map
  const offers = await Offer.find({ salonId: { $in: salons.map((s) => s._id) }, active: true }).lean()
  const zone = new Map(salons.map((s) => [String(s._id), s.timezone]))
  for (const o of offers) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: zone.get(String(o.salonId)) })
    if (o.startsOn > today || o.endsOn < today) continue
    const entry = map.get(String(o.salonId)) ?? { count: 0, best: null }
    entry.count += 1
    // percent wale offer ko pehle rakhte hain, phir bade discount ko
    const rank = (x) => (x.discountType === 'percent' ? 1_000_000 : 0) + x.discountValue
    if (!entry.best || rank(o) > rank(entry.best)) entry.best = o
    map.set(String(o.salonId), entry)
  }
  return new Map(
    [...map].map(([id, { count, best }]) => [
      id,
      { count, text: best.discountType === 'percent' ? `${best.discountValue}% OFF` : `₹${best.discountValue} OFF`, title: best.title, endsOn: best.endsOn },
    ]),
  )
}

// GET /public/locations -> city ki list, har city ke areas aur salon ginti (picker ke liye)
router.get('/locations', async (req, res) => {
  const rows = await Salon.aggregate([
    { $match: { ...baseFilter, 'address.cityKey': { $nin: ['', null] } } },
    {
      $group: {
        // Spelling ka farq (Bijainagar/Vijainagar) ek hi shehar ginta hai: kunji se group, naam pehle salon ka
        _id: { key: '$address.cityKey', area: '$address.area' },
        city: { $first: '$address.city' },
        count: { $sum: 1 },
        // Sirf coordinates wale salons gine jate hain, taaki bina-coordinates wale salon centre ko na bigaden
        latSum: { $sum: '$address.location.lat' },
        lngSum: { $sum: '$address.location.lng' },
        located: { $sum: { $cond: [{ $isNumber: '$address.location.lat' }, 1, 0] } },
      },
    },
  ])
  const cities = new Map()
  for (const { _id, city, count, latSum, lngSum, located } of rows) {
    const entry = cities.get(_id.key) ?? { city, salonCount: 0, areas: [], latSum: 0, lngSum: 0, located: 0 }
    entry.salonCount += count
    entry.latSum += latSum
    entry.lngSum += lngSum
    entry.located += located
    if (_id.area) entry.areas.push({ area: _id.area, salonCount: count })
    cities.set(_id.key, entry)
  }
  // Har shehar ka centre (uske salons ke coordinates ka average): "Near me" sabse paas ka shehar isi se chunta hai
  const data = [...cities.values()]
    .map(({ latSum, lngSum, located, ...c }) => ({ ...c, center: located > 0 ? { lat: latSum / located, lng: lngSum / located } : null }))
    .sort((a, b) => b.salonCount - a.salonCount)
  for (const c of data) c.areas.sort((a, b) => a.area.localeCompare(b.area))
  sendSuccess(req, res, { cities: data })
})

// GET /public/salons?city=Delhi&area=Rohini&mode=home&sort=nearest&lat=..&lng=..
router.get('/salons', validate({ query: listQuery }), async (req, res) => {
  const f = req.valid.query
  // Shehar kunji se milta hai: "Bijainagar", "Vijainagar" aur "Vijaynagar" teeno ek hi jagah ke salons dikhate hain
  const filter = { ...baseFilter, 'address.cityKey': placeKey(f.city) }
  if (f.area) filter['address.area'] = exactNoCase(f.area)
  if (f.mode === 'salon') filter['serviceModes.salonVisit'] = true
  if (f.mode === 'home') filter['serviceModes.homeService'] = true
  // "women" chunne par women-only aur unisex dono dikhte hain, "men" par men-only aur unisex; "unisex" par sirf unisex salons
  if (f.audience === 'unisex') filter.audience = 'unisex'
  else if (f.audience) filter.audience = { $in: [f.audience, 'unisex'] }
  if (f.q) filter.name = new RegExp(escapeRegex(f.q), 'i')
  if (f.minRating) filter['rating.average'] = { $gte: f.minRating } // rating wale salons hi (0 reviews ka average 0 hota hai)
  if (f.minPrice !== undefined || f.maxPrice !== undefined) {
    filter.startingPrice = { ...(f.minPrice !== undefined ? { $gte: f.minPrice } : {}), ...(f.maxPrice !== undefined ? { $lte: f.maxPrice } : {}) }
  }
  if (f.category) {
    const chip = CATEGORY_CHIPS[f.category]
    const match = { active: true, category: { $in: chip.category }, ...(chip.name ? { name: chip.name } : {}) }
    filter._id = { $in: await Service.distinct('salonId', match) }
  }

  const salons = await Salon.find(filter).limit(500).lean()
  const hasOrigin = f.lat !== undefined && f.lng !== undefined
  const items = salons.map((s) => {
    const { lat, lng } = s.address?.location ?? {}
    const known = hasOrigin && typeof lat === 'number' && typeof lng === 'number'
    return card(s, known ? distanceKm(f.lat, f.lng, lat, lng) : null)
  })
  const badges = await offerBadges(salons)
  for (const item of items) item.offer = badges.get(String(item.id)) ?? null

  const byRating = (a, b) => b.rating.average - a.rating.average || b.rating.count - a.rating.count
  const sorters = {
    rating: byRating,
    price: (a, b) => (a.startingPrice ?? Infinity) - (b.startingPrice ?? Infinity) || byRating(a, b),
    nearest: (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || byRating(a, b),
  }
  items.sort(sorters[f.sort])

  const start = (f.page - 1) * f.pageSize
  sendSuccess(req, res, { salons: items.slice(start, start + f.pageSize) }, { meta: { page: f.page, pageSize: f.pageSize, total: items.length } })
})

// ---------- poore India ki jagahein: location se naam, naam se jagah, aur sabse paas ke salons ----------
const placesLimit = limiter({ windowMs: 60_000, limit: 60 })
const coordQuery = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) })

// GET /public/places/reverse?lat=..&lng=.. -> { place: { name, district, state } | null }
// Customer kahan hai (shehar/kasba/gaon). Geocoder band ho to place null aata hai, error nahi.
router.get('/places/reverse', placesLimit, validate({ query: coordQuery }), async (req, res) => {
  let place = null
  try {
    place = await reverseGeocode(req.valid.query.lat, req.valid.query.lng)
  } catch (error) {
    console.warn('[places] reverse geocode failed:', error.message)
  }
  sendSuccess(req, res, { place })
})

// GET /public/places/search?q=bijai -> type karte waqt suggestions (poore India ke shehar, kasbe, gaon)
router.get('/places/search', placesLimit, validate({ query: z.object({ q: z.string().trim().min(2).max(60) }) }), async (req, res) => {
  let places = []
  try {
    places = await searchPlaces(req.valid.query.q)
  } catch (error) {
    console.warn('[places] search failed:', error.message)
  }
  sendSuccess(req, res, { places })
})

// GET /public/nearest-salons?lat=..&lng=..&limit=3 -> jahan bhi hon, customer ke sabse paas ke salons (shehar ki parwah kiye bina)
const nearestQuery = coordQuery.extend({ limit: z.coerce.number().int().min(1).max(10).default(3) })
router.get('/nearest-salons', validate({ query: nearestQuery }), async (req, res) => {
  const { lat, lng, limit } = req.valid.query
  const salons = await Salon.find({ ...baseFilter, 'address.location.lat': { $type: 'number' }, 'address.location.lng': { $type: 'number' } }).limit(2000).lean()
  const items = salons
    .map((s) => card(s, distanceKm(lat, lng, s.address.location.lat, s.address.location.lng)))
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
  const badges = await offerBadges(salons)
  for (const item of items) item.offer = badges.get(String(item.id)) ?? null
  sendSuccess(req, res, { salons: items })
})

// ---------- ek salon ki detail (customer ke popup ke liye) ----------
const idParams = z.object({ id: objectId })
const publishedFilter = (id) => ({ _id: id, ...baseFilter })

// GET /public/salons/:id -> owner ka naam, phone, address aur services ki price list
router.get('/salons/:id', authenticateCustomer, validate({ params: idParams }), async (req, res) => {
  const salon = await Salon.findOne(publishedFilter(req.valid.params.id)).lean()
  if (!salon) throw new ApiError(404, 'NOT_FOUND', 'Salon not found.')
  const services = await Service.find({ salonId: salon._id, active: true }).sort({ category: 1, name: 1 }).lean()
  // Sirf aaj chal rahe offers (salon ki timezone ke hisaab se aaj ki date)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: salon.timezone })
  const offers = await Offer.find({ salonId: salon._id, active: true, startsOn: { $lte: today }, endsOn: { $gte: today } }).sort({ endsOn: 1 }).lean()
  const a = salon.address ?? {}
  sendSuccess(req, res, {
    salon: {
      ...card(salon, null),
      offers: offers.map((o) => ({
        id: o._id,
        title: o.title,
        description: o.description,
        discountType: o.discountType,
        discountValue: o.discountValue,
        serviceIds: o.serviceIds,
        startsOn: o.startsOn,
        endsOn: o.endsOn,
        oncePerCustomer: o.oncePerCustomer,
      })),
      owner: { name: salon.ownerContact?.name ?? '', phone: salon.ownerContact?.phone ?? '' },
      address: [a.line1, a.area, a.city, a.state, a.pincode].filter(Boolean).join(', '),
      location: typeof a.location?.lat === 'number' && typeof a.location?.lng === 'number' ? { lat: a.location.lat, lng: a.location.lng } : null,
      services: services.map((s) => ({
        id: s._id,
        name: s.name,
        category: s.category,
        description: s.description,
        price: s.price,
        durationMin: s.durationMin,
        atSalon: s.atSalon,
        atHome: s.atHome,
      })),
    },
  })
})

// POST /public/salons/:id/view -> customer ne salon kholi; owner ko notification.
// Ek hi customer ek ghante me ek salon ke liye ek hi baar ginta hai, aur request par rate limit hai (spam se bachav).
const viewLimit = limiter({ windowMs: 60_000, limit: 30 })
router.post('/salons/:id/view', authenticateCustomer, viewLimit, validate({ params: idParams }), async (req, res) => {
  const salon = await Salon.findOne(publishedFilter(req.valid.params.id)).select('name').lean()
  if (!salon) throw new ApiError(404, 'NOT_FOUND', 'Salon not found.')
  const viewerId = String(req.customer._id)
  const since = new Date(Date.now() - 60 * 60 * 1000)
  // Ek hi step me "dhundho, na mile to banao": do requests ek saath aayein to bhi ek hi notification banti hai
  const result = await Notification.updateOne(
    { salonId: salon._id, type: 'salon_viewed', viewerKey: viewerId, createdAt: { $gt: since } },
    { $setOnInsert: { title: 'A customer is looking at your salon', body: `${req.customer.name} (+91 ${req.customer.phone}) just opened your salon page on Glamora.` } },
    { upsert: true },
  )
  sendSuccess(req, res, { counted: result.upsertedCount > 0 })
})

// ---------- booking ----------
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')
const slotsQuery = z.object({ date: dateStr, duration: z.coerce.number().int().min(5).max(600) })
const OPEN_STATUSES = ['pending', 'confirmed']
const OUT_OF_RANGE = 'Choose a date within the next 30 days.'

async function slotsFor(salon, date, durationMin) {
  const [branch, bookings] = await Promise.all([
    Branch.findOne({ salonId: salon._id }).lean(),
    Booking.find({ salonId: salon._id, date, status: { $in: OPEN_STATUSES } }).select('startTime durationMin').lean(),
  ])
  return buildSlots({ date, durationMin, branch, bookings, timeZone: salon.timezone })
}

// GET /public/salons/:id/slots?date=2026-10-20&duration=60 -> us din ke time slots
router.get('/salons/:id/slots', authenticateCustomer, validate({ params: idParams, query: slotsQuery }), async (req, res) => {
  const salon = await Salon.findOne(publishedFilter(req.valid.params.id)).select('timezone').lean()
  if (!salon) throw new ApiError(404, 'NOT_FOUND', 'Salon not found.')
  const { date, duration } = req.valid.query
  if (!dateInRange(date, salon.timezone)) throw new ApiError(400, 'VALIDATION_ERROR', OUT_OF_RANGE, { fieldErrors: { date: OUT_OF_RANGE } })
  sendSuccess(req, res, { slots: await slotsFor(salon, date, duration) })
})

const bookingBody = z
  .strictObject({
    mode: z.enum(['salon', 'home']).default('salon'),
    address: z.string().trim().max(300).default(''),
    note: z.string().trim().max(300).default(''),
    date: dateStr,
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm.'),
    serviceIds: z.array(objectId).min(1, 'Choose at least one service.').max(8),
    offerId: objectId.optional(),
  })
  .refine((b) => b.mode !== 'home' || b.address.length >= 8, { message: 'Enter your full address for home service.', path: ['address'] })
const bookLimit = limiter({ windowMs: 10 * 60_000, limit: 10 })

// POST /public/salons/:id/bookings -> logged-in customer appointment maangta hai. Naam aur phone uske account se aate hain
// (OTP se verify hue), form se nahi. Owner ko notification jaati hai.
router.post('/salons/:id/bookings', authenticateCustomer, bookLimit, validate({ params: idParams, body: bookingBody }), async (req, res) => {
  const salon = await Salon.findOne(publishedFilter(req.valid.params.id)).select('name timezone').lean()
  if (!salon) throw new ApiError(404, 'NOT_FOUND', 'Salon not found.')
  const b = req.valid.body
  if (!dateInRange(b.date, salon.timezone)) throw new ApiError(400, 'VALIDATION_ERROR', OUT_OF_RANGE, { fieldErrors: { date: OUT_OF_RANGE } })

  // Price/naam hamesha server se (customer ke bheje price par bharosa nahi)
  const ids = [...new Set(b.serviceIds)]
  const services = await Service.find({ _id: { $in: ids }, salonId: salon._id, active: true }).lean()
  if (services.length !== ids.length) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'One of the services is no longer available.', { fieldErrors: { serviceIds: 'One of the services is no longer available.' } })
  }
  const placeOk = services.every((s) => (b.mode === 'home' ? s.atHome : s.atSalon))
  if (!placeOk) {
    const message = b.mode === 'home' ? 'Some services are not available at home.' : 'Some services are not available at the salon.'
    throw new ApiError(400, 'VALIDATION_ERROR', message, { fieldErrors: { serviceIds: message } })
  }

  const durationMin = services.reduce((sum, s) => sum + s.durationMin, 0)
  const slot = (await slotsFor(salon, b.date, durationMin)).find((s) => s.time === b.startTime)
  if (!slot?.available) {
    throw new ApiError(409, 'SLOT_UNAVAILABLE', 'This time is no longer available. Please choose another time.', { fieldErrors: { startTime: 'This time is no longer available.' } })
  }

  const subtotal = services.reduce((sum, s) => sum + s.price, 0)
  let applied = null
  if (b.offerId) {
    const today = new Date().toLocaleDateString('en-CA', { timeZone: salon.timezone })
    const offer = await Offer.findOne({ _id: b.offerId, salonId: salon._id, active: true, startsOn: { $lte: today }, endsOn: { $gte: today } }).lean()
    const offerError = (message) => new ApiError(400, 'OFFER_INVALID', message, { fieldErrors: { offerId: message } })
    if (!offer) throw offerError('This offer is no longer available.')
    const discount = discountFor(offer, services)
    if (discount === 0) throw offerError('This offer does not apply to the services you chose.')
    if (offer.oncePerCustomer && (await Booking.exists({ salonId: salon._id, customerId: req.customer._id, 'offer.offerId': offer._id, status: { $ne: 'cancelled' } }))) {
      throw offerError('You have already used this offer.')
    }
    applied = { offerId: offer._id, title: offer.title, discount }
  }

  const booking = await Booking.create({
    salonId: salon._id,
    customerId: req.customer._id,
    customerName: req.customer.name,
    customerPhone: req.customer.phone,
    mode: b.mode,
    address: b.mode === 'home' ? b.address : '',
    note: b.note,
    date: b.date,
    startTime: b.startTime,
    durationMin,
    services: services.map((s) => ({ serviceId: s._id, name: s.name, price: s.price, durationMin: s.durationMin })),
    subtotal,
    offer: applied,
    total: subtotal - (applied?.discount ?? 0),
  })
  await Notification.create({
    salonId: salon._id,
    type: 'booking_created',
    title: 'New appointment request',
    body: `${req.customer.name} wants ${services.map((s) => s.name).join(', ')} on ${b.date} at ${b.startTime}.`,
  })
  sendSuccess(
    req,
    res,
    { booking: { id: booking._id, date: booking.date, startTime: booking.startTime, total: booking.total, subtotal, offer: applied ? { title: applied.title, discount: applied.discount } : null, status: booking.status, salonName: salon.name } },
    { status: 201 },
  )
})

module.exports = router
