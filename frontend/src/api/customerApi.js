import { publicRequest } from './client'

// Customer ka mobile OTP login. Session HttpOnly cookie me rehta hai (JS use padh nahi sakti).
export const requestOtp = (phone, email) => publicRequest('/customer/auth/request-otp', { method: 'POST', body: { phone, ...(email ? { email } : {}) } }).then((r) => r.data)
export const verifyOtp = (body) => publicRequest('/customer/auth/verify-otp', { method: 'POST', body }).then((r) => r.data)
export const getCustomerMe = () => publicRequest('/customer/me').then((r) => r.data.customer)
export const customerLogout = () => publicRequest('/customer/auth/logout', { method: 'POST' }).then((r) => r.data)

// Customer ki khabrein (review request, thanks) aur reviews. Sab login (cookie) se, customer ki apni hi cheezein.
export const getMyNotifications = () => publicRequest('/public/notifications').then((r) => r.data)
export const markNotificationRead = (id) => publicRequest(`/public/notifications/${id}/read`, { method: 'POST' }).then((r) => r.data)
export const markAllNotificationsRead = () => publicRequest('/public/notifications/read-all', { method: 'POST' }).then((r) => r.data)
export const getReviewContext = (bookingId) => publicRequest(`/public/my-bookings/${bookingId}/review`).then((r) => r.data)
export const submitReview = (bookingId, body) => publicRequest(`/public/my-bookings/${bookingId}/review`, { method: 'POST', body }).then((r) => r.data.review)
export const editReview = (id, body) => publicRequest(`/public/reviews/${id}`, { method: 'PATCH', body }).then((r) => r.data.review)
export const getSalonReviews = (salonId, page = 1) => publicRequest(`/public/salons/${salonId}/reviews?page=${page}&pageSize=5`).then((r) => r.data)

// "Helpful" on someone else's review (one vote per customer; the server counts the real votes)
export const markReviewHelpful = (id) => publicRequest(`/public/reviews/${id}/helpful`, { method: 'PUT' }).then((r) => r.data)
export const unmarkReviewHelpful = (id) => publicRequest(`/public/reviews/${id}/helpful`, { method: 'DELETE' }).then((r) => r.data)
