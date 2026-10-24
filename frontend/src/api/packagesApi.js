import { request } from './client'

const unwrap = (r) => r.data
const qs = (params) => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== null) q.set(k, v)
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const listPackages = (params = {}) => request(`/packages${qs(params)}`).then(unwrap)
export const createPackage = (body) => request('/packages', { method: 'POST', body }).then(unwrap)
export const updatePackage = (id, body) => request(`/packages/${id}`, { method: 'PATCH', body }).then(unwrap)

// list ka poora jawab (data + meta.total) chahiye, isliye unwrap nahi
export const listCustomerPackages = (params = {}) => request(`/customer-packages${qs(params)}`)
export const getCustomerPackage = (id) => request(`/customer-packages/${id}`).then(unwrap)
export const assignPackage = (body) => request('/customer-packages', { method: 'POST', body }).then(unwrap)
export const markPackagePaid = (id, paymentMethod) => request(`/customer-packages/${id}/payment`, { method: 'POST', body: { paymentMethod } }).then(unwrap)
export const adjustPackage = (id, body) => request(`/customer-packages/${id}/adjust`, { method: 'POST', body }).then(unwrap)
export const redeemPackage = (id, body) => request(`/customer-packages/${id}/redeem`, { method: 'POST', body }).then(unwrap)
export const cancelCustomerPackage = (id, note) => request(`/customer-packages/${id}/cancel`, { method: 'POST', body: { note } }).then(unwrap)
