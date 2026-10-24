import { request } from './client'

// Billing ka paisa server se PAISE (integer) me aata hai; screen par utils/formatMoney.js ka formatPaise dikhata hai.
const unwrap = (r) => r.data
const qs = (params) => {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '' && v !== null) q.set(k, v)
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const getBillingSummary = (params = {}) => request(`/invoices/summary${qs(params)}`).then(unwrap)
// list ka poora jawab (data + meta.total) chahiye, isliye unwrap nahi
export const listInvoices = (params = {}) => request(`/invoices${qs(params)}`)
export const getInvoice = (id) => request(`/invoices/${id}`).then(unwrap)
export const createInvoice = (body) => request('/invoices', { method: 'POST', body }).then(unwrap)
export const recordPayment = (id, body) => request(`/invoices/${id}/payments`, { method: 'POST', body }).then(unwrap)
export const refundInvoice = (id, body) => request(`/invoices/${id}/refunds`, { method: 'POST', body }).then(unwrap)
export const voidInvoice = (id, note) => request(`/invoices/${id}/void`, { method: 'POST', body: { note } }).then(unwrap)
export const previewInvoice = (body) => request('/invoices/preview', { method: 'POST', body }).then(unwrap)
export const listBillableAppointments = (customerPhone) => request(`/invoices/billable-appointments${qs({ customerPhone })}`).then(unwrap)
