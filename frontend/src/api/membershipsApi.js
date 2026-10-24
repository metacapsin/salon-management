import { request } from './client'

const unwrap = (r) => r.data
const qs = (params) => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== null) q.set(k, v)
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const listMembershipPlans = (params = {}) => request(`/membership-plans${qs(params)}`).then(unwrap)
export const createMembershipPlan = (body) => request('/membership-plans', { method: 'POST', body }).then(unwrap)
export const updateMembershipPlan = (id, body) => request(`/membership-plans/${id}`, { method: 'PATCH', body }).then(unwrap)

// list ka poora jawab (data + meta.total) chahiye, isliye unwrap nahi
export const listCustomerMemberships = (params = {}) => request(`/customer-memberships${qs(params)}`)
export const getCustomerMembership = (id) => request(`/customer-memberships/${id}`).then(unwrap)
export const assignMembership = (body) => request('/customer-memberships', { method: 'POST', body }).then(unwrap)
export const markMembershipPaid = (id, paymentMethod) => request(`/customer-memberships/${id}/payment`, { method: 'POST', body: { paymentMethod } }).then(unwrap)
export const applyMembership = (id, bookingId) => request(`/customer-memberships/${id}/apply`, { method: 'POST', body: { bookingId } }).then(unwrap)
export const cancelCustomerMembership = (id, note) => request(`/customer-memberships/${id}/cancel`, { method: 'POST', body: { note } }).then(unwrap)
