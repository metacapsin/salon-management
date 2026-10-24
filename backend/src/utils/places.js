// Poore India ki jagahon (shehar, kasba, gaon) ke liye: coordinates se naam (reverse) aur naam se jagah (search).
// OpenStreetMap ka free Nominatim use karte hain (API key nahi chahiye). Unke niyam: 1 request/second se zyada nahi,
// apni pehchaan wala User-Agent, aur jawab cache karna. Isliye har request line me lagti hai, aur jawab yaad rakhe jaate hain.
const env = require('../config/env')

const BASE = 'https://nominatim.openstreetmap.org'
const USER_AGENT = env.GEOCODER_USER_AGENT || 'Glamora/1.0 (salon discovery app)'
const MIN_GAP_MS = 1100
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_MAX = 2000

const cache = new Map() // key -> { at, value }
let queue = Promise.resolve()
let lastCall = 0

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function remember(key, value) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value) // sabse purani hatao
  cache.set(key, { at: Date.now(), value })
}

// Ek ke baad ek, kam se kam MIN_GAP_MS ke fasle par
function throttled(task) {
  const run = queue.then(async () => {
    const wait = lastCall + MIN_GAP_MS - Date.now()
    if (wait > 0 && !env.isTest) await sleep(wait)
    lastCall = Date.now()
    return task()
  })
  queue = run.catch(() => {})
  return run
}

async function getJson(path, params) {
  const url = `${BASE}${path}?${new URLSearchParams({ format: 'jsonv2', addressdetails: '1', 'accept-language': 'en', ...params })}`
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw new Error(`Geocoder responded ${response.status}`)
  return response.json()
}

// Address me se sabse chhoti "basti" ka naam: shehar > kasba > gaon > mohalla
function placeName(address = {}) {
  return cleanTehsil(address.city || address.town || address.village || address.municipality || address.hamlet || address.suburb || address.county || '')
}
// "Vijaynagar Tehsil" -> "Vijaynagar", "Jaipur Municipal Corporation" -> "Jaipur"
const cleanTehsil = (n) => n.replace(/\s+(Tehsil|Tahsil|Taluk|Taluka|Municipal Corporation|Municipal Council|Municipality|Nagar Nigam|Nagar Palika|Nagar Parishad)$/i, '')
const districtOf = (address = {}) => address.state_district || address.county || address.district || ''

function present(item) {
  const address = item.address ?? {}
  const name = placeName(address) || item.name || ''
  return { name, district: districtOf(address), state: address.state ?? '', lat: Number(item.lat), lng: Number(item.lon) }
}

// Coordinates -> { name, district, state } ya null (jagah na mile ya geocoder band ho)
async function reverseGeocode(lat, lng) {
  // ~1 km ke dabbe me cache (3 decimal), taaki aas-paas ke log ek hi jawab baantein
  const key = `r:${lat.toFixed(2)},${lng.toFixed(2)}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  // zoom 12 = kasba/shehar ka level (14 par chhote gaon/mohalle ka naam aa jaata hai jo log nahi bolte)
  const data = await throttled(() => getJson('/reverse', { lat: String(lat), lon: String(lng), zoom: '12' }))
  if (!data || data.error || data.address?.country_code !== 'in') return null
  const value = present(data)
  if (!value.name) return null
  remember(key, value)
  return value
}

// Naam se jagah dhundhna (type karte waqt suggestions): [{ name, district, state, lat, lng }]
async function searchPlaces(query) {
  const q = query.trim().toLowerCase()
  const key = `s:${q}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  // Spelling ka farq: log "Bijainagar" likhte hain, OpenStreetMap me "Vijainagar" ho sakta hai. Pehle jo likha wahi, na mile to b<->v badal kar.
  const variants = [...new Set([query.trim(), query.trim().replace(/b/gi, 'v'), query.trim().replace(/v/gi, 'b')])]
  const seen = new Set()
  const places = []
  for (const variant of variants) {
    const data = await throttled(() => getJson('/search', { q: `${variant}, India`, countrycodes: 'in', limit: '10' }))
    for (const item of Array.isArray(data) ? data : []) {
      // Sirf basti/shehar jaisi jagah (sadak, dukan, station nahi)
      const isSettlement = item.category === 'place' || (item.category === 'boundary' && item.type === 'administrative')
      if (!isSettlement) continue
      const place = present(item)
      if (!place.name || Number.isNaN(place.lat)) continue
      const dedupe = `${place.name}|${place.state}|${place.district}`.toLowerCase()
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      places.push(place)
    }
    if (places.length > 0) break
  }
  const value = places.slice(0, 6)
  remember(key, value)
  return value
}

module.exports = { reverseGeocode, searchPlaces, _cache: cache }
