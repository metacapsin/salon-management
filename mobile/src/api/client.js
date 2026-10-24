// The one place that talks to the backend. Same response shapes as the website:
// success { data, meta, requestId }, error { error: { code, message, fieldErrors } }.
// The access token stays in memory only; the refresh token is kept by tokenStore.
import { API_BASE } from '../config/env'
import { clearRefreshToken, getRefreshToken, saveRefreshToken } from '../auth/tokenStore'

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

async function send(path, { method = 'GET', body, auth = true, salon = true } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (salon && activeSalonId) headers['X-Salon-Id'] = activeSalonId

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server.')
  }

  let json = null
  try {
    json = await response.json()
  } catch {
    json = null
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
  if (error.status === 0) return 'Could not reach the server. Check your connection and try again.'
  if (error.status === 429) return 'Too many attempts. Please wait a few minutes and try again.'
  if (error.status >= 500) return 'The server is not responding right now. Please try again in a little while.'
  return error.message || `${fallback} (${error.status} ${error.code})`
}
