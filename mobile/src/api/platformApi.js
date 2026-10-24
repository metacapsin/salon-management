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

export async function setPlatformSalonStatus(id, { status, reason }) {
  const { data } = await request(`/platform/salons/${id}/status`, { method: 'PATCH', body: { status, ...(reason ? { reason } : {}) }, salon: false })
  return data.salon
}
