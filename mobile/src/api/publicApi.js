// Salon discovery for customers. Same public endpoints as the website (/public/*); nothing new on the server.
import { request } from './client'

const open = { auth: false, salon: false }

// -> [{ city, salonCount, areas: [{ area, salonCount }], center }]
export async function fetchLocations() {
  const { data } = await request('/public/locations', open)
  return data.cities
}

// Salons of one city, best rated first. -> { salons, total }
export async function fetchCitySalons({ city, q, category }) {
  const params = new URLSearchParams({ city, sort: 'rating', pageSize: '50' })
  if (q) params.set('q', q)
  if (category) params.set('category', category)
  const { data, meta } = await request(`/public/salons?${params}`, open)
  return { salons: data.salons, total: meta?.total ?? data.salons.length }
}

// The salons closest to the customer, wherever they are. -> { salons, total }
export async function fetchNearestSalons({ lat, lng }) {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng), limit: '10' })
  const { data } = await request(`/public/nearest-salons?${params}`, open)
  return { salons: data.salons, total: data.salons.length }
}

// ---------- One salon: these need the customer's login (the server checks it) ----------
const asCustomer = { salon: false }

// -> { id, name, about, coverUrl, address, owner: { phone }, offers, services, serviceModes, rating, ... }
export async function fetchSalon(id) {
  const { data } = await request(`/public/salons/${id}`, asCustomer)
  return data.salon
}

// Tells the salon that a customer opened its page (same as the website). Never blocks the screen.
export function recordSalonView(id) {
  return request(`/public/salons/${id}/view`, { ...asCustomer, method: 'POST' }).catch(() => {})
}

// -> [{ time: '10:30', available: true }]
export async function fetchSlots(id, { date, duration }) {
  const params = new URLSearchParams({ date, duration: String(duration) })
  const { data } = await request(`/public/salons/${id}/slots?${params}`, asCustomer)
  return data.slots
}

// body: { mode, address, note, date, startTime, serviceIds, offerId? }. The server re-checks prices, slot and offer.
export async function createBooking(id, body) {
  const { data } = await request(`/public/salons/${id}/bookings`, { ...asCustomer, method: 'POST', body })
  return data.booking
}

// ---------- The customer's own appointments ----------
// -> [{ id, salonName, date, startTime, durationMin, mode, services: [name], total, status, canCancel }]
export async function fetchMyBookings() {
  const { data } = await request('/public/my-bookings', asCustomer)
  return data.bookings
}

// The server allows this only for pending/confirmed bookings, up to 2 hours before the start.
export async function cancelMyBooking(id) {
  const { data } = await request(`/public/my-bookings/${id}/cancel`, { ...asCustomer, method: 'POST' })
  return data.booking
}
