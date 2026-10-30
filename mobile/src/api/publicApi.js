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

// ---------- Reviews and the customer's own notifications ----------
// Everything here is the customer's own data; the server checks that on every call.

// -> { notifications: [{ id, type, title, body, unread, createdAt, bookingId, salonName, canReview }], unreadCount }
export async function fetchMyNotifications() {
  const { data } = await request('/public/notifications', asCustomer)
  return data
}
export const markNotificationRead = (id) => request(`/public/notifications/${id}/read`, { ...asCustomer, method: 'POST' })
export const markAllNotificationsRead = () => request('/public/notifications/read-all', { ...asCustomer, method: 'POST' })

// -> { booking: { salonName, services, date, ... }, canReview, review: null | { id, rating, comment, images } }
export async function fetchReviewContext(bookingId) {
  const { data } = await request(`/public/my-bookings/${bookingId}/review`, asCustomer)
  return data
}
export async function submitReview(bookingId, body) {
  const { data } = await request(`/public/my-bookings/${bookingId}/review`, { ...asCustomer, method: 'POST', body })
  return data.review
}
export async function editReview(id, body) {
  const { data } = await request(`/public/reviews/${id}`, { ...asCustomer, method: 'PATCH', body })
  return data.review
}

// "Helpful" on someone else's review: one vote per customer, the server counts the real votes. -> { helpfulCount, isHelpful }
export async function setReviewHelpful(id, on) {
  const { data } = await request(`/public/reviews/${id}/helpful`, { ...asCustomer, method: on ? 'PUT' : 'DELETE' })
  return data
}

// A salon's real reviews, newest first. -> { summary: { average, count, breakdown }, reviews, page, pageSize, total }
export async function fetchSalonReviews(salonId, page = 1) {
  const { data } = await request(`/public/salons/${salonId}/reviews?page=${page}&pageSize=5`, asCustomer)
  return data
}
