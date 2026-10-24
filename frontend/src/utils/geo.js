// Location ke chhote madadgaar: doori, sabse paas ka shehar, aur browser ke location error ka saaf message.

// Do points ke beech ki doori km me (haversine)
export function distanceKm(a, b) {
  const rad = (d) => (d * Math.PI) / 180
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(h))
}

// Un shehron me se jinke coordinates pata hain, sabse paas wala: { city, km } ya undefined
export function nearestCity(cities, me) {
  return cities
    .filter((c) => c.center)
    .map((c) => ({ city: c.city, km: distanceKm(me, c.center) }))
    .sort((a, b) => a.km - b.km)[0]
}

// Browser se current location, promise ke roop me: { lat, lng }. Fail hone par error (code 1/2/3) ke saath reject.
export function getPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(Object.assign(new Error('Geolocation is not supported'), { code: 0 }))
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ lat: coords.latitude, lng: coords.longitude }),
      reject,
      // maximumAge: haal hi me mili location dobara use ho sakti hai, taaki jaldi jawab aaye
      { timeout: 15_000, maximumAge: 60_000 },
    )
  })
}

export function locationErrorMessage(error) {
  if (error?.code === 1) return 'Location is blocked. Click the lock icon next to the address bar, set Location to Allow, then try again. Or choose your city and area.'
  if (error?.code === 2) return 'Your device could not find your location. Turn on Location in your device settings and try again, or choose your city and area.'
  if (error?.code === 3) return 'Finding your location took too long. Please try again, or choose your city and area.'
  if (error?.code === 0) return 'Your browser cannot share location. Please choose your city and area.'
  return 'Could not get your location. Please choose your city and area instead.'
}

// "Near me" ka sandesh jab jagah ka naam na mile aur sabse paas ke salon wale shehar par jana pade
export function nearMeNotice(nearest) {
  if (!nearest) return ''
  if (nearest.km > 60) return `We have no salons within 60 km of you yet. Showing the closest city, ${nearest.city} (${Math.round(nearest.km)} km away).`
  return `Showing salons near you in ${nearest.city}, closest first.`
}

// Do naam ek hi jagah ke hain? Spelling ka thoda farq chalta hai (Bijainagar / Vijainagar / Vijaynagar).
// Server ki placeKey jaisa, par halka: sirf screen par "is shehar me salon hain ya nahi" batane ke liye.
const simple = (n) =>
  n
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/[vw]/g, 'b')
    .replace(/ai|ay|ae|ei|ey/g, 'a')
    .replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1')
export const samePlace = (a, b) => Boolean(a && b) && simple(a) === simple(b)
