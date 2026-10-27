import { request } from './client'

// Super Admin only. These calls carry no X-Salon-Id: the admin is not "inside" one salon,
// and the server answers 403 to anyone who is not a platform admin.

export async function fetchPlatformSalons({ q, status, page = 1, pageSize = 20 }) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(q ? { q } : {}), ...(status ? { status } : {}) })
  const { data, meta } = await request(`/platform/salons?${query}`, { salon: false })
  return { items: data.salons, meta }
}

export async function fetchPlatformSalon(id) {
  const { data } = await request(`/platform/salons/${id}`, { salon: false })
  return data.salon
}

// Website "Contact us" messages. list returns per-status counts in `counts` (for the filter chips).
export const INQUIRY_STATUSES = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export async function fetchInquiries({ q, status, page = 1, pageSize = 20 }) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(q ? { q } : {}), ...(status ? { status } : {}) })
  const { data, meta } = await request(`/platform/contact-inquiries?${query}`, { salon: false })
  return { items: data.inquiries, counts: data.counts, meta }
}

export async function fetchInquiry(id) {
  const { data } = await request(`/platform/contact-inquiries/${id}`, { salon: false })
  return data.inquiry
}

export async function setInquiryStatus(id, status) {
  const { data } = await request(`/platform/contact-inquiries/${id}`, { method: 'PATCH', body: { status }, salon: false })
  return data.inquiry
}

export async function addInquiryNote(id, text) {
  const { data } = await request(`/platform/contact-inquiries/${id}/notes`, { method: 'POST', body: { text }, salon: false })
  return data.inquiry
}

// Audit history of every salon plus platform actions, newest first. Read only.
export async function fetchPlatformAudit({ page = 1, pageSize = 20 }) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  const { data, meta } = await request(`/platform/audit-events?${query}`, { salon: false })
  return { items: data.events, meta }
}

// Every user on the platform with the salons and roles they hold. Read only; the server never sends password data.
export async function fetchPlatformUsers({ q, page = 1, pageSize = 20 }) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(q ? { q } : {}) })
  const { data, meta } = await request(`/platform/users?${query}`, { salon: false })
  return { items: data.users, meta }
}

// New owners who registered and wait for the Super Admin's OK. status: pending | approved | rejected.
export async function fetchOwnerRequests({ status = 'pending', page = 1, pageSize = 20 }) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), status })
  const { data, meta } = await request(`/platform/owner-requests?${query}`, { salon: false })
  return { items: data.requests, meta }
}

// Approving an already-approved owner just sends the "you can sign in" email again.
export async function approveOwnerRequest(id) {
  const { data } = await request(`/platform/owner-requests/${id}/approve`, { method: 'POST', salon: false })
  return data.request
}

export async function rejectOwnerRequest(id) {
  const { data } = await request(`/platform/owner-requests/${id}/reject`, { method: 'POST', salon: false })
  return data.request
}

export async function setPlatformSalonStatus(id, { status, reason }) {
  const { data } = await request(`/platform/salons/${id}/status`, { method: 'PATCH', body: { status, ...(reason ? { reason } : {}) }, salon: false })
  return data.salon
}
