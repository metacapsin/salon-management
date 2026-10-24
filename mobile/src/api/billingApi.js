import { request } from './client'

// Billing. All money here is in PAISE (integer). Allowed for owner/manager/receptionist (billing.read);
// recording a payment needs billing.write. The server checks both.

export async function fetchInvoices({ search, paymentStatus, status, page = 1, pageSize = 20 }) {
  const query = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
    ...(search ? { search } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(status ? { status } : {}),
  })
  const { data, meta } = await request(`/invoices?${query}`)
  return { items: data.invoices, meta }
}

export async function fetchInvoice(id) {
  const { data } = await request(`/invoices/${id}`)
  return data // { invoice, payments, salon }
}

export async function recordPayment(id, { requestKey, method, amount, reference, note }) {
  const { data } = await request(`/invoices/${id}/payments`, {
    method: 'POST',
    body: { requestKey, method, amount, reference: reference ?? '', note: note ?? '' },
  })
  return data
}

// ---------- Create a bill (billing.write) ----------
// Appointments of this customer that do not have a bill yet.
export async function fetchBillableAppointments(customerPhone) {
  const { data } = await request(`/invoices/billable-appointments?customerPhone=${encodeURIComponent(customerPhone)}`)
  return data.appointments
}

// The server does all the maths (prices, offer, membership, GST). We send only ids and quantities, never prices.
export async function previewInvoice(body) {
  const { data } = await request('/invoices/preview', { method: 'POST', body })
  return data
}

export async function createInvoice(body) {
  const { data } = await request('/invoices', { method: 'POST', body })
  return data.invoice
}

// ---------- Refund (billing.refund: owner/manager) and void (billing.void: owner) ----------
export async function refundPayment(id, { requestKey, method, amount, reference, note }) {
  const { data } = await request(`/invoices/${id}/refunds`, {
    method: 'POST',
    body: { requestKey, method, amount, reference: reference ?? '', note },
  })
  return data
}

// A bill is never deleted: "void" cancels it. The server allows it only when nothing is left received (refund first).
export async function voidInvoice(id, note) {
  const { data } = await request(`/invoices/${id}/void`, { method: 'POST', body: { note } })
  return data.invoice
}
