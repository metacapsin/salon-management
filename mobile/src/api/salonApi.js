import { request } from './client'

// Every call below goes through request(), which adds the X-Salon-Id of the active salon.
// The server decides what this user may see in that salon.

export async function fetchBookings({ status, page = 1, pageSize = 20 }) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(status ? { status } : {}) })
  const { data, meta } = await request(`/bookings?${query}`)
  return { items: data.bookings, meta }
}

// Free and taken times for one service on one day (optionally for one staff member). Needs appointments.write.
export async function fetchSlots({ date, serviceId, staffId }) {
  const query = new URLSearchParams({ date, serviceId, ...(staffId ? { staffId } : {}) })
  const { data } = await request(`/bookings/slots?${query}`)
  return data.slots // [{ time: '10:00', available: true }]
}

// The salon is chosen by the login (X-Salon-Id), never by the body. The server checks the slot again when saving.
export async function createBooking(body) {
  const { data } = await request('/bookings', { method: 'POST', body })
  return data.booking
}

export async function updateBookingStatus(id, status) {
  const { data } = await request(`/bookings/${id}/status`, { method: 'PATCH', body: { status } })
  return data.booking
}

export async function fetchCustomers({ search, segment, page = 1, pageSize = 20 }) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(search ? { search } : {}), ...(segment ? { segment } : {}) })
  const { data, meta } = await request(`/customers?${query}`)
  return { items: data.customers, summary: data.summary, meta }
}

// ---------- Services (read: all roles, write: owner/manager) ----------
export async function fetchServices({ includeInactive = false } = {}) {
  const { data } = await request(`/services?includeInactive=${includeInactive}`)
  return data.services
}

export async function createService(body) {
  const { data } = await request('/services', { method: 'POST', body })
  return data.service
}

export async function updateService(id, body) {
  const { data } = await request(`/services/${id}`, { method: 'PATCH', body })
  return data.service
}

// The server does not delete: it sets active=false (old bills keep the service name and price).
export async function deactivateService(id) {
  const { data } = await request(`/services/${id}`, { method: 'DELETE' })
  return data.service
}

// ---------- Staff (read: owner/manager/receptionist, write: owner/manager) ----------
export async function fetchStaff({ includeInactive = false } = {}) {
  const { data } = await request(`/staff?includeInactive=${includeInactive}`)
  return data.staff
}

export async function createStaff(body) {
  const { data } = await request('/staff', { method: 'POST', body })
  return data.staff
}

export async function updateStaff(id, body) {
  const { data } = await request(`/staff/${id}`, { method: 'PATCH', body })
  return data.staff
}

// ---------- Offers (read: owner/manager/receptionist, write: owner/manager) ----------
export async function fetchOffers() {
  const { data } = await request('/offers')
  return data.offers
}

export async function createOffer(body) {
  const { data } = await request('/offers', { method: 'POST', body })
  return data.offer
}

export async function updateOffer(id, body) {
  const { data } = await request(`/offers/${id}`, { method: 'PATCH', body })
  return data.offer
}

// ---------- Salon settings (read: owner/manager, write: owner) ----------
// Other roles get only a short summary here (no hours, no address).
export async function fetchSalonSettings() {
  const { data } = await request('/salons/current')
  return data // { salon, role, publishBlockers }
}

export async function updateSalonSettings(body) {
  const { data } = await request('/salons/current', { method: 'PATCH', body })
  return data.salon
}

// ---------- Reviews (Owner / Manager) ----------
// Only this salon's reviews: the salon comes from the login (X-Salon-Id), the server checks it.
// -> { summary: { average, count, breakdown }, reviews, page, pageSize, total }
export async function fetchReviews({ page = 1, pageSize = 10, rating } = {}) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(rating ? { rating: String(rating) } : {}) })
  const { data } = await request(`/reviews?${query}`)
  return data
}
export async function replyToReview(id, text) {
  const { data } = await request(`/reviews/${id}/reply`, { method: 'PUT', body: { text } })
  return data.review
}
export async function removeReviewReply(id) {
  const { data } = await request(`/reviews/${id}/reply`, { method: 'DELETE' })
  return data.review
}
