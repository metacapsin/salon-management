import { request } from './client'

const unwrap = (r) => r.data

// Salon owner/manager ke liye: apne salon ke reviews (server sirf isi salon ke deta he) aur unka jawab.
export const listReviews = ({ page = 1, pageSize = 10, rating } = {}) => {
  const params = new URLSearchParams({ page, pageSize })
  if (rating) params.set('rating', rating)
  return request(`/reviews?${params}`).then(unwrap)
}
export const replyToReview = (id, text) => request(`/reviews/${id}/reply`, { method: 'PUT', body: { text } }).then(unwrap)
export const removeReviewReply = (id) => request(`/reviews/${id}/reply`, { method: 'DELETE' }).then(unwrap)
