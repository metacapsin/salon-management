import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { clearRefreshToken } from './tokenStore'
import { ApiError, forgetCustomerLogin, friendlyError, loginRequest, logoutRequest, refreshSession, requestCustomerOtp, restoreCustomer, setAccessToken, setActiveSalonId, setSessionLostHandler, verifyCustomerOtp } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  // status: 'loading' (restoring the saved login) | 'anonymous' | 'authenticated'
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [customer, setCustomer] = useState(null)
  const [activeSalonId, setActive] = useState(null)
  // A guest who tapped a salon: after a customer login that salon opens (see FindSalonScreen). { id, name } or null.
  const [pendingSalon, setPendingSalon] = useState(null)
  const restored = useRef(false)

  // Keep the API client's salon in step with the chosen one on every render. In development a live reload can re-run
  // the client module (its copy resets to null) while this state survives; without this the server answers "Select a salon first."
  useEffect(() => {
    setActiveSalonId(activeSalonId)
  })

  const applySession = useCallback((data) => {
    const first = data.memberships[0]?.salonId ?? null
    setActive(first)
    setActiveSalonId(first)
    setUser(data.user)
    setMemberships(data.memberships)
    setCustomer(null)
    setPendingSalon(null) // a salon team member does not continue to a customer's salon page
    setStatus('authenticated')
  }, [])

  const applyCustomer = useCallback((profile) => {
    setActive(null)
    setActiveSalonId(null)
    setUser(null)
    setMemberships([])
    setCustomer(profile)
    setStatus('authenticated')
  }, [])

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setActiveSalonId(null)
    setUser(null)
    setMemberships([])
    setCustomer(null)
    setActive(null)
    setPendingSalon(null)
    setStatus('anonymous')
    // No data of the previous user or salon may stay in the cache.
    queryClient.clear()
  }, [queryClient])

  // App start: bring back the saved login (refresh token -> new access token).
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    // Salon team login first, then a saved customer login. The server checks both again.
    refreshSession()
      .then(async (data) => {
        if (data) return applySession(data)
        const profile = await restoreCustomer()
        if (profile) applyCustomer(profile)
        else clearSession()
      })
      .catch(() => clearSession())
  }, [applySession, applyCustomer, clearSession])

  useEffect(() => {
    setSessionLostHandler(clearSession)
  }, [clearSession])

  // Throws an Error with a readable message, which LoginScreen shows.
  const login = useCallback(
    async (email, password) => {
      try {
        const data = await loginRequest(email, password)
        await forgetCustomerLogin() // one kind of login at a time
        applySession(data)
      } catch (error) {
        // Development only: show the real reason in the console (never the password or tokens).
        if (__DEV__) console.warn('Login failed:', error?.name, error?.status, error?.code, error?.message)
        // Development only: also show the technical reason on screen (an unexpected, non-server error).
        const detail = __DEV__ && !(error instanceof ApiError) ? ` [${error?.name}: ${error?.message}]` : ''
        throw new Error(friendlyError(error) + detail)
      }
    },
    [applySession],
  )

  // Customer: ask for a code (sent to the email), then confirm it. verifyOtp returns { needsName: true } for a new customer.
  const requestOtp = useCallback(async (phone, email) => {
    try {
      return await requestCustomerOtp(phone, email)
    } catch (error) {
      throw new Error(friendlyError(error))
    }
  }, [])

  const verifyOtp = useCallback(
    async (details) => {
      try {
        const result = await verifyCustomerOtp(details)
        if (result.needsName) return result
        await clearRefreshToken() // one kind of login at a time
        applyCustomer(result.customer)
        return result
      } catch (error) {
        throw new Error(friendlyError(error))
      }
    },
    [applyCustomer],
  )

  const logout = useCallback(async () => {
    await logoutRequest()
    await clearRefreshToken()
    await forgetCustomerLogin()
    clearSession()
  }, [clearSession])

  // Only a salon the user really belongs to can be chosen (the server checks this again on every request).
  const switchSalon = useCallback(
    (salonId) => {
      if (!memberships.some((m) => m.salonId === salonId)) return
      setActive(salonId)
      setActiveSalonId(salonId)
      queryClient.clear()
    },
    [memberships, queryClient],
  )

  // What kind of account this is, decided from what the server returned (never from what the user picked).
  const accountType = customer ? 'customer' : user?.platformRole === 'admin' ? 'admin' : memberships.length > 0 ? 'salon' : user ? 'none' : null

  const activeMembership = memberships.find((m) => m.salonId === activeSalonId) ?? null

  const value = useMemo(
    () => ({
      status,
      user,
      customer,
      accountType,
      pendingSalon,
      setPendingSalon,
      memberships,
      activeSalonId,
      activeSalon: activeMembership,
      role: activeMembership?.role ?? null,
      isPlatformAdmin: user?.platformRole === 'admin',
      login,
      requestOtp,
      verifyOtp,
      logout,
      switchSalon,
    }),
    [status, user, customer, accountType, pendingSalon, memberships, activeSalonId, activeMembership, login, requestOtp, verifyOtp, logout, switchSalon],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
