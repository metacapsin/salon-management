import { request } from './client'

// Memberships (Silver, Gold...). Prices here are WHOLE RUPEES (not paise), like packages.
// Read: owner/manager/receptionist (memberships.read). Plans are written by the OWNER only (memberships.write).
// Selling and taking payment: memberships.sell (owner/manager/receptionist). Cancel: memberships.adjust (owner/manager).

export async function fetchPlans({ status } = {}) {
  const { data } = await request(`/membership-plans${status ? `?status=${status}` : ''}`)
  return data.plans
}

export async function createPlan(body) {
  const { data } = await request('/membership-plans', { method: 'POST', body })
  return data.plan
}

export async function updatePlan(id, body) {
  const { data } = await request(`/membership-plans/${id}`, { method: 'PATCH', body })
  return data.plan
}

export async function fetchMembers({ search, status, page = 1, pageSize = 20 }) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(search ? { search } : {}), ...(status ? { status } : {}) })
  const { data, meta } = await request(`/customer-memberships?${query}`)
  return { items: data.customerMemberships, meta }
}

export async function fetchMember(id) {
  const { data } = await request(`/customer-memberships/${id}`)
  return data // { customerMembership, history }
}

// The server fixes the price, dates and discount rule. We send only which plan, to whom, and how it was paid.
export async function sellMembership(body) {
  const { data } = await request('/customer-memberships', { method: 'POST', body })
  return data.customerMembership
}

export async function markMembershipPaid(id, paymentMethod) {
  const { data } = await request(`/customer-memberships/${id}/payment`, { method: 'POST', body: { paymentMethod } })
  return data.customerMembership
}

export async function cancelMembership(id, note) {
  const { data } = await request(`/customer-memberships/${id}/cancel`, { method: 'POST', body: { note } })
  return data.customerMembership
}
