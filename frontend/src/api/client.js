// Server se baat karne ka ek hi darwaza. Har screen yahan ke functions se hi request bhejti hai.
//
// SRS API contract: sab routes /api/v1 ke neeche. Success: { data, meta, requestId }.
// Error: { error: { code, message, fieldErrors?, details? }, requestId }.
//
// Access token sirf memory (is file ke variable) me rehta hai, localStorage me nahi (SRS SEC-01).
// Page reload par wo chala jaata hai; tab HttpOnly refresh cookie se naya token le aate hain.

const API_BASE = '/api/v1'

// Ek khaas error jisme status (401, 429...), server ka code aur field-wise galtiyan saath rehti hain.
// status 0 = server tak request pahunchi hi nahi (internet/server band).
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
let onCustomerSessionLost = () => {}

export const setAccessToken = (token) => {
  accessToken = token
}
export const setActiveSalonId = (id) => {
  activeSalonId = id
}
// Customer ki login cookie khatam ho jaye (401 CUSTOMER_LOGIN_REQUIRED) to App ko batane ke liye.
export const setCustomerSessionLostHandler = (fn) => {
  onCustomerSessionLost = fn
}
// Jab refresh bhi fail ho jaye (login poori tarah khatam), App ko batane ke liye.
export const setSessionLostHandler = (fn) => {
  onSessionLost = fn
}

async function send(path, { method = 'GET', body, auth = true, salon = true } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`
  if (salon && activeSalonId) headers['X-Salon-Id'] = activeSalonId

  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Could not reach the server.')
  }

  // Server ka jawab JSON na ho (jaise proxy error) to bhi app crash na ho.
  let json = null
  try {
    json = await response.json()
  } catch {
    json = null
  }

  if (!response.ok) {
    if (response.status === 401 && json?.error?.code === 'CUSTOMER_LOGIN_REQUIRED') onCustomerSessionLost()
    throw new ApiError(response.status, json?.error?.code ?? 'UNKNOWN', json?.error?.message ?? '', {
      fieldErrors: json?.error?.fieldErrors,
      details: json?.error?.details,
    })
  }
  if (!json || json.data === undefined) {
    throw new ApiError(response.status, 'UNKNOWN', 'Unexpected server response.')
  }
  return { data: json.data, meta: json.meta }
}

// Ek hi samay par kai requests 401 pa jayen to refresh sirf EK baar chale.
// (Refresh token ek baar ka hai; do baar bhejne par server ise chori samajhkar login band kar deta hai.)
let refreshInFlight = null
export function refreshSession() {
  if (!refreshInFlight) {
    refreshInFlight = send('/auth/refresh', { method: 'POST', auth: false, salon: false })
      .then(({ data }) => {
        accessToken = data.accessToken
        return data
      })
      .catch((error) => {
        if (error instanceof ApiError && error.status !== 0 && error.status < 500) return null
        throw error
      })
      .finally(() => {
        refreshInFlight = null
      })
  }
  return refreshInFlight
}

// Protected request: token purana ho gaya (401) to ek baar refresh karke dobara koshish.
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

// Bina login wale routes (register, login, reset...).
export const publicRequest = (path, options = {}) => send(path, { ...options, auth: false, salon: false })

// Form ki galtiyan {field: message} me lautata hai, react-hook-form ke setError ke liye.
export function fieldErrorsOf(error) {
  return error instanceof ApiError && error.fieldErrors ? error.fieldErrors : {}
}

// Server ki galti ko insaan ke samajhne layak message me badalta hai.
export function friendlyError(error, fallback = 'Something went wrong. Please try again.') {
  if (!(error instanceof ApiError)) return fallback
  if (error.status === 0) return 'Could not reach the server. Check your internet connection and try again.'
  if (error.status === 429) return 'Too many attempts. Please wait a few minutes and try again.'
  if (error.status === 403 && error.code === 'PERMISSION_DENIED') return 'You do not have permission to do this.'
  if (error.status >= 500) return 'The server is not responding right now. Please try again in a little while.'
  return error.message || fallback
}
