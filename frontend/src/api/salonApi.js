import { request } from './client'

const unwrap = (r) => r.data

export const createSalon = (body) => request('/salons', { method: 'POST', body, salon: false }).then(unwrap)
export const getCurrentSalon = () => request('/salons/current').then(unwrap)
export const updateSalon = (body) => request('/salons/current', { method: 'PATCH', body }).then(unwrap)
export const saveHours = (body) => request('/salons/current/hours', { method: 'PUT', body }).then(unwrap)

export const listTeam = (page) => request(`/users?page=${page}&pageSize=20`)
export const listInvitations = (page) => request(`/users/invitations?page=${page}&pageSize=20`)
export const inviteMember = (body) => request('/users/invitations', { method: 'POST', body }).then(unwrap)
export const revokeInvitation = (id) => request(`/users/invitations/${id}`, { method: 'DELETE' }).then(unwrap)
export const updateMember = (userId, body) => request(`/users/${userId}`, { method: 'PATCH', body }).then(unwrap)

export const listAudit = (page) => request(`/audit-events?page=${page}&pageSize=20`)

export const listServices = () => request('/services?includeInactive=true').then(unwrap)
export const createService = (body) => request('/services', { method: 'POST', body }).then(unwrap)
export const updateService = (id, body) => request(`/services/${id}`, { method: 'PATCH', body }).then(unwrap)

export const listOffers = () => request('/offers').then(unwrap)
export const createOffer = (body) => request('/offers', { method: 'POST', body }).then(unwrap)
export const updateOffer = (id, body) => request(`/offers/${id}`, { method: 'PATCH', body }).then(unwrap)

export const listStaff = () => request('/staff?includeInactive=true').then(unwrap)
export const createStaff = (body) => request('/staff', { method: 'POST', body }).then(unwrap)
export const updateStaff = (id, body) => request(`/staff/${id}`, { method: 'PATCH', body }).then(unwrap)
export const deleteStaff = (id) => request(`/staff/${id}`, { method: 'DELETE' }).then(unwrap)

export const listNotifications = () => request('/notifications').then(unwrap)
export const markAllNotificationsRead = () => request('/notifications/read-all', { method: 'POST' }).then(unwrap)

export const listBookings = (page, status, pageSize = 20) => request(`/bookings?page=${page}&pageSize=${pageSize}${status ? `&status=${status}` : ''}`)
export const createBooking = (body) => request('/bookings', { method: 'POST', body }).then(unwrap)
export const listBookingSlots = ({ date, serviceId, staffId }) =>
  request(`/bookings/slots?date=${date}&serviceId=${serviceId}${staffId ? `&staffId=${staffId}` : ''}`).then(unwrap)
export const setBookingStatus = (id, status) => request(`/bookings/${id}/status`, { method: 'PATCH', body: { status } }).then(unwrap)

export const getBookingBenefits = (id) => request(`/bookings/${id}/benefits`).then(unwrap)

export const listCustomers = ({ page, search, segment }) =>
  request(`/customers?page=${page}&pageSize=20${search ? `&search=${encodeURIComponent(search)}` : ''}${segment ? `&segment=${segment}` : ''}`)
