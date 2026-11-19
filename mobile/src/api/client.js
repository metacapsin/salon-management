// The one place that talks to the backend. Same response shapes as the website:
// success { data, meta, requestId }, error { error: { code, message, fieldErrors } }.
// The access token stays in memory only; the refresh token is kept by tokenStore.
import { API_BASE, API_URL } from '../config/env'
import { clearCustomerToken, clearRefreshToken, getCustomerToken, getRefreshToken, saveCustomerToken, saveRefreshToken } from '../auth/tokenStore'

// status 0 = the request never reached the server (no internet / server off).
export class ApiError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = extra.fieldErrors
    this.details = extra.details
  }
}

let accessToken = null
let activeSalonId = null
let onSessionLost = () => {}

export const setAccessToken = (token) => {
  accessToken = token
}
export const setActiveSalonId = (id) => {
  activeSalonId = id
}
export const setSessionLostHandler = (fn) => {
  onSessionLost = fn
}

async function send(path, { method = 'GET', body, auth = true, salon = true, token } = {}) {
  const headers = { Accept: 'application/json' }
  // A photo (Blob) goes as the raw file with its own type; everything else is JSON.
  const isFile = typeof Blob !== 'undefined' && body instanceof Blob
  if (isFile) headers['Content-Type'] = body.type
  else if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = `Bearer ${token}`
  else if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (salon && activeSalonId) headers['X-Salon-Id'] = activeSalonId

  // React Native's fetch has no timeout of its own: if the phone cannot really reach the server (blocked port, wrong Wi-Fi,
  // server asleep) the request just hangs and the screen shows a spinner forever. We stop it ourselves, so the screen can
  // show its error message and "Try again" button. Photo uploads get more time.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), isFile ? 60_000 : 15_000)
  let response
  let json = null
  try {
    try {
      response = await fetch(`${API_BASE}${path}`, { method, headers, signal: controller.signal, body: body === undefined ? undefined : isFile ? body : JSON.stringify(body) })
    } catch (cause) {
      // Say WHY: our own 15s timer fired (phone cannot really reach the server: firewall, wrong Wi-Fi) or the connection was refused straight away.
      const timedOut = controller.signal.aborted
      throw new ApiError(0, timedOut ? 'NETWORK_TIMEOUT' : 'NETWORK_ERROR', `Could not reach the server at ${API_URL || '(no API address set)'}${timedOut ? ' (timed out)' : ''}.`, { details: { url: API_URL, timedOut, reason: cause?.message } })
    }
    try {
      json = await response.json()
    } catch {
      json = null
    }
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    throw new ApiError(response.status, json?.error?.code ?? 'UNKNOWN', json?.error?.message ?? '', { fieldErrors: json?.error?.fieldErrors, details: json?.error?.details })
  }
  if (!json || json.data === undefined) throw new ApiError(response.status, 'UNKNOWN', 'Unexpected server response.')
  return { data: json.data, meta: json.meta }
}

// Login: returns { accessToken, refreshToken, user, memberships }. The refresh token is saved before we return.
export async function loginRequest(email, password) {
  const { data } = await send('/auth/mobile/login', { method: 'POST', body: { email, password }, auth: false, salon: false })
  await saveRefreshToken(data.refreshToken)
  accessToken = data.accessToken
  return data
}

// ---------- Customer (phone + email OTP) ----------
// The customer token is sent as the same Bearer header. The server tells it apart from salon staff tokens.
// Returns { sentTo?, devOtp?, resendAfterSec }.
export async function requestCustomerOtp(phone, email) {
  const { data } = await send('/customer/auth/request-otp', { method: 'POST', body: { phone, email }, auth: false, salon: false })
  return data
}

// Returns { needsName: true } (new customer: ask the name, then call again) or { customer }.
export async function verifyCustomerOtp({ phone, otp, name }) {
  const body = { phone, otp }
  if (name) body.name = name
  const { data } = await send('/customer/auth/mobile/verify-otp', { method: 'POST', body, auth: false, salon: false })
  if (data.needsName) return { needsName: true }
  await saveCustomerToken(data.accessToken)
  accessToken = data.accessToken
  return { customer: data.customer }
}

// App start: a saved customer login -> the profile, checked by the server. Null if there is none or it is no longer valid.
export async function restoreCustomer() {
  const stored = await getCustomerToken()
  if (!stored) return null
  try {
    const { data } = await send('/customer/me', { auth: false, salon: false, token: stored })
    accessToken = stored
    return data.customer
  } catch (error) {
    if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
      await clearCustomerToken()
      return null
    }
    throw error
  }
}

export const forgetCustomerLogin = clearCustomerToken

// Only ONE refresh at a time: the refresh token works once, and a second use looks like theft to the server.
let refreshInFlight = null
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      const stored = await getRefreshToken()
      if (!stored) return null
      try {
        const { data } = await send('/auth/mobile/refresh', { method: 'POST', body: { refreshToken: stored }, auth: false, salon: false })
        // Save the new token FIRST. If saving fails we stop: the old one is already used up on the server.
        await saveRefreshToken(data.refreshToken)
        accessToken = data.accessToken
        return data
      } catch (error) {
        // Server said the session is over (4xx): forget it. Network/server trouble (0 or 5xx): keep the token and retry later.
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          await clearRefreshToken()
          return null
        }
        throw error
      }
    })().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

// Protected request: if the access token expired (401), refresh once and try again.
export async function request(path, options = {}) {
  try {
    return await send(path, options)
  } catch (error) {
    const expired = error instanceof ApiError && error.status === 401 && options.auth !== false
    if (!expired) throw error
    const session = await refreshSession()
    if (!session) {
      onSessionLost()
      throw error
    }
    return send(path, options)
  }
}

// Tell the server to end the session. Local data is cleared by the caller whatever happens here.
export async function logoutRequest() {
  const stored = await getRefreshToken()
  if (!stored) return
  try {
    await send('/auth/mobile/logout', { method: 'POST', body: { refreshToken: stored }, auth: false, salon: false })
  } catch {
    // offline: the local token is deleted anyway
  }
}

export function friendlyError(error, fallback = 'Something went wrong. Please try again.') {
  if (!(error instanceof ApiError)) return fallback
  if (error.status === 0) {
    // A production (https) address is not shown to customers; a development http address is, so a wrong IP or a blocked port is easy to spot.
    const where = API_URL.startsWith('https://') ? '' : ` Tried: ${API_URL || '(no API address set)'}${error.code === 'NETWORK_TIMEOUT' ? ' - no answer (check Wi-Fi, firewall, backend running)' : ' - connection refused'}.`
    return `Could not reach the server. Check your connection and try again.${where}`
  }
  if (error.status === 429) return 'Too many attempts. Please wait a few minutes and try again.'
  // The server itself says why it could not do this (for example the login code email could not be sent).
  if (error.code === 'MAIL_SEND_FAILED' || error.code === 'SMS_FAILED' || error.code === 'PROVIDER_NOT_CONFIGURED') return error.message || fallback
  if (error.status >= 500) return 'The server is not responding right now. Please try again in a little while.'
  return error.message || `${fallback} (${error.status} ${error.code})`
}

// "Forgot password": the server emails a 6 digit code. It always answers the same, whether or not the email is registered.
export async function requestPasswordReset(email) {
  await send('/auth/password-reset', { method: 'POST', body: { email }, auth: false, salon: false })
}

// Second step: the emailed code plus the new password (at least 12 characters).
export async function confirmPasswordReset({ email, otp, password }) {
  await send('/auth/password-reset/confirm', { method: 'POST', body: { email, otp, password }, auth: false, salon: false })
}
