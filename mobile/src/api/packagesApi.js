import { request } from './client'

// Packages. Prices here are WHOLE RUPEES (not paise), unlike billing.
// Read: owner/manager/receptionist (packages.read). Templates are written by owner/manager (packages.write).
// Selling and taking payment: packages.sell (owner/manager/receptionist). Cancel: packages.adjust (owner/manager).

export async function fetchPackages({ status } = {}) {
  const { data } = await request(`/packages${status ? `?status=${status}` : ''}`)
  return data.packages
}

export async function createPackage(body) {
  const { data } = await request('/packages', { method: 'POST', body })
  return data.package
}

export async function updatePackage(id, body) {
  const { data } = await request(`/packages/${id}`, { method: 'PATCH', body })
  return data.package
}

export async function fetchCustomerPackages({ search, status, page = 1, pageSize = 20 }) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize), ...(search ? { search } : {}), ...(status ? { status } : {}) })
  const { data, meta } = await request(`/customer-packages?${query}`)
  return { items: data.customerPackages, meta }
}

export async function fetchCustomerPackage(id) {
  const { data } = await request(`/customer-packages/${id}`)
  return data // { customerPackage, history }
}

// The server fixes the price, expiry and balance. We send only which package, to whom, and how it was paid.
export async function sellPackage(body) {
  const { data } = await request('/customer-packages', { method: 'POST', body })
  return data.customerPackage
}

export async function markPackagePaid(id, paymentMethod) {
  const { data } = await request(`/customer-packages/${id}/payment`, { method: 'POST', body: { paymentMethod } })
  return data.customerPackage
}

export async function cancelCustomerPackage(id, note) {
  const { data } = await request(`/customer-packages/${id}/cancel`, { method: 'POST', body: { note } })
  return data.customerPackage
}
