import { publicRequest } from './client'

// Customer ka mobile OTP login. Session HttpOnly cookie me rehta hai (JS use padh nahi sakti).
export const requestOtp = (phone, email) => publicRequest('/customer/auth/request-otp', { method: 'POST', body: { phone, ...(email ? { email } : {}) } }).then((r) => r.data)
export const verifyOtp = (body) => publicRequest('/customer/auth/verify-otp', { method: 'POST', body }).then((r) => r.data)
export const getCustomerMe = () => publicRequest('/customer/me').then((r) => r.data.customer)
export const customerLogout = () => publicRequest('/customer/auth/logout', { method: 'POST' }).then((r) => r.data)
