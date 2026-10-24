import { request } from './client'

// Super Admin (server answers 403 to anyone else).
export async function fetchPlatformOverview() {
  const { data } = await request('/platform/overview', { salon: false })
  return data
}

// Salon dashboard numbers. `range` = { from, to } as YYYY-MM-DD, or none for all time.
export async function fetchBillingSummary(range = {}) {
  const query = new URLSearchParams(range).toString()
  const { data } = await request(`/invoices/summary${query ? `?${query}` : ''}`)
  return data.summary
}

// How many appointments are waiting for confirmation (only the total is needed).
export async function fetchPendingAppointmentCount() {
  const { meta } = await request('/bookings?status=pending&pageSize=1')
  return meta?.total ?? 0
}
