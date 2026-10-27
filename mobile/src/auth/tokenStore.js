import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

// Only the refresh token is stored (the access token lives in memory only).
// On Android it goes into SecureStore (Android Keystore encryption). Nothing below changes that.
//
// The browser preview (expo start --web) is for local development only. SecureStore does not exist there, so it uses
// sessionStorage. If the browser blocks site data (some Chrome settings do), the token is kept in memory, and ALSO
// in window.name, but only in a development build running on localhost. window.name survives a page refresh in the
// same tab even when storage is blocked. A production build (__DEV__ is false) never uses window.name.
const KEY = 'glamora_refresh_token'
// A customer's long-lived login token is kept the same way (SecureStore on a phone).
const CUSTOMER_KEY = 'glamora_customer_token'
const NAME_PREFIX = 'glamora_dev_rt='
const isWeb = Platform.OS === 'web'

let memoryToken = null

// Touching window.sessionStorage itself can throw (SecurityError) when site data is blocked.
function webStorage() {
  try {
    return globalThis.sessionStorage ?? null
  } catch {
    return null
  }
}

function devNameAllowed() {
  try {
    return Boolean(__DEV__) && ['localhost', '127.0.0.1'].includes(globalThis.location?.hostname)
  } catch {
    return false
  }
}
const nameGet = () => (devNameAllowed() && String(globalThis.name ?? '').startsWith(NAME_PREFIX) ? String(globalThis.name).slice(NAME_PREFIX.length) : null)
const nameSet = (token) => {
  if (devNameAllowed()) globalThis.name = NAME_PREFIX + token
}
const nameClear = () => {
  try {
    if (String(globalThis.name ?? '').startsWith(NAME_PREFIX)) globalThis.name = ''
  } catch {
    // nothing to clear
  }
}

// Web preview only: will the login survive a page refresh? Always true on Android (SecureStore).
export function canRememberLogin() {
  if (!isWeb) return true
  if (devNameAllowed()) return true // the localhost development fallback above keeps it
  try {
    const store = globalThis.sessionStorage
    store.setItem('glamora_probe', '1')
    store.removeItem('glamora_probe')
    return true
  } catch {
    return false
  }
}

export async function getRefreshToken() {
  try {
    if (isWeb) return webStorage()?.getItem(KEY) ?? nameGet() ?? memoryToken
    return await SecureStore.getItemAsync(KEY)
  } catch {
    return isWeb ? (nameGet() ?? memoryToken) : null
  }
}

// On Android this throws if saving fails: the caller must not continue with a rotated token it could not keep.
export async function saveRefreshToken(token) {
  if (isWeb) {
    memoryToken = token
    try {
      webStorage().setItem(KEY, token)
    } catch {
      nameSet(token) // storage is blocked: development fallback (localhost only)
    }
    return
  }
  return SecureStore.setItemAsync(KEY, token)
}

export async function clearRefreshToken() {
  memoryToken = null
  try {
    if (isWeb) {
      nameClear()
      webStorage()?.removeItem(KEY)
    } else {
      await SecureStore.deleteItemAsync(KEY)
    }
  } catch {
    // nothing more we can do
  }
}

const memoryCustomer = { token: null }

export async function getCustomerToken() {
  try {
    if (isWeb) return webStorage()?.getItem(CUSTOMER_KEY) ?? memoryCustomer.token
    return await SecureStore.getItemAsync(CUSTOMER_KEY)
  } catch {
    return isWeb ? memoryCustomer.token : null
  }
}

export async function saveCustomerToken(token) {
  if (isWeb) {
    memoryCustomer.token = token
    try {
      webStorage().setItem(CUSTOMER_KEY, token)
    } catch {
      // blocked storage: it stays in memory until the page is refreshed
    }
    return
  }
  return SecureStore.setItemAsync(CUSTOMER_KEY, token)
}

export async function clearCustomerToken() {
  memoryCustomer.token = null
  try {
    if (isWeb) webStorage()?.removeItem(CUSTOMER_KEY)
    else await SecureStore.deleteItemAsync(CUSTOMER_KEY)
  } catch {
    // nothing more we can do
  }
}
