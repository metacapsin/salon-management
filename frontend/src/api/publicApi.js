import { publicRequest } from './client'

// Customer-side discovery: login ki zaroorat nahi.
export const getLocations = () => publicRequest('/public/locations').then((r) => r.data)

export const searchSalons = (filters) => {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value)
  }
  return publicRequest(`/public/salons?${params}`).then((r) => ({ salons: r.data.salons, meta: r.meta }))
}

export const getSalonDetail = (id) => publicRequest(`/public/salons/${id}`).then((r) => r.data.salon)

// Customer ne salon kholi: owner ko khabar (ek customer ek salon ke liye ek ghante me ek hi baar ginta hai).
// Customer login se pehchana jaata hai, isliye alag id nahi bhejni. Fail hone par customer ko kuch nahi dikhta.
// Ek page-visit me ek salon ki khabar sirf ek baar jaati hai (dev mode me React effect do baar chalta hai)
const reported = new Set()
export function recordSalonView(id) {
  if (reported.has(id)) return Promise.resolve(null)
  reported.add(id)
  return publicRequest(`/public/salons/${id}/view`, { method: 'POST' }).catch(() => null)
}

export const getSlots = (id, date, duration) =>
  publicRequest(`/public/salons/${id}/slots?date=${date}&duration=${duration}`).then((r) => r.data.slots)
export const createBooking = (id, body) => publicRequest(`/public/salons/${id}/bookings`, { method: 'POST', body }).then((r) => r.data.booking)

// Contact Us form: koi bhi bhej sakta hai (login ki zaroorat nahi). Server sirf "mil gaya" batata hai.
export const sendContactInquiry = (body) => publicRequest('/contact', { method: 'POST', body }).then((r) => r.data)

// Poore India ki jagahein
export const reversePlace = (lat, lng) => publicRequest(`/public/places/reverse?lat=${lat}&lng=${lng}`).then((r) => r.data.place)
export const searchPlaces = (q) => publicRequest(`/public/places/search?q=${encodeURIComponent(q)}`).then((r) => r.data.places)
export const nearestSalons = (lat, lng, limit = 3) => publicRequest(`/public/nearest-salons?lat=${lat}&lng=${lng}&limit=${limit}`).then((r) => r.data.salons)
