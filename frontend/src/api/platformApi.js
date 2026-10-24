import { request } from './client'

// Super Admin ke APIs. Admin kisi salon ke andar nahi hota, isliye X-Salon-Id nahi bhejte (salon: false).
const call = (path, options = {}) => request(`/platform${path}`, { ...options, salon: false })

export const getPlatformOverview = () => call('/overview').then((r) => r.data)

export function listPlatformSalons({ page = 1, q = '', status = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' })
  if (q) params.set('q', q)
  if (status) params.set('status', status)
  return call(`/salons?${params}`)
}

export const listPlatformAudit = ({ page = 1 } = {}) => call(`/audit-events?page=${page}&pageSize=20`)

export function listPlatformUsers({ page = 1, q = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' })
  if (q) params.set('q', q)
  return call(`/users?${params}`)
}

// Contact Us inquiries (sirf Super Admin)
export function listContactInquiries({ page = 1, q = '', status = '', from = '', to = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: '20' })
  for (const [key, value] of Object.entries({ q, status, from, to })) if (value) params.set(key, value)
  return call(`/contact-inquiries?${params}`)
}

export const getContactInquiry = (id) => call(`/contact-inquiries/${id}`).then((r) => r.data.inquiry)

export const setContactInquiryStatus = (id, status) => call(`/contact-inquiries/${id}`, { method: 'PATCH', body: { status } }).then((r) => r.data.inquiry)

export const addContactInquiryNote = (id, text) => call(`/contact-inquiries/${id}/notes`, { method: 'POST', body: { text } }).then((r) => r.data.inquiry)

// Naye owner ki account requests (approve karte hi unhe verification email jaati he)
export function listOwnerRequests({ page = 1, status = 'pending' } = {}) {
  return call(`/owner-requests?page=${page}&pageSize=20&status=${status}`)
}
export const approveOwnerRequest = (id) => call(`/owner-requests/${id}/approve`, { method: 'POST' }).then((r) => r.data)
export const rejectOwnerRequest = (id) => call(`/owner-requests/${id}/reject`, { method: 'POST' }).then((r) => r.data)

export const getPlatformSalon =(id) => call(`/salons/${id}`).then((r) => r.data)

export const setPlatformSalonStatus = (id, body) => call(`/salons/${id}/status`, { method: 'PATCH', body }).then((r) => r.data)

// Admin kisi approved owner ke naam par salon banata he
export const createPlatformSalon = (body) => call('/salons', { method: 'POST', body }).then((r) => r.data)
