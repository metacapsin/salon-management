// Login/register jaise account ke kaam. Server ka address/format client.js me ek hi jagah hai.
import { publicRequest, request } from './client'

export { ApiError } from './client'

const post = (path, body) => publicRequest(path, { method: 'POST', body }).then((r) => r.data)

export const login = ({ email, password }) => post('/auth/login', { email, password })
export const registerOwner = ({ name, email, password }) => post('/auth/register', { name, email, password })
export const verifyEmail = (token) => post('/auth/verify-email', { token })
export const resendVerification = (email) => post('/auth/resend-verification', { email })
export const requestPasswordReset = (email) => post('/auth/password-reset', { email })
export const confirmPasswordReset = ({ token, password }) => post('/auth/password-reset/confirm', { token, password })
export const acceptInvitation = ({ token, name, password }) => post('/auth/accept-invitation', { token, name, password })
export const logoutRequest = () => post('/auth/logout')
export const fetchMe = () => request('/me').then((r) => r.data)
