import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { clearRefreshToken } from './tokenStore'
import { ApiError, friendlyError, loginRequest, logoutRequest, refreshSession, setAccessToken, setActiveSalonId, setSessionLostHandler } from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  // status: 'loading' (restoring the saved login) | 'anonymous' | 'authenticated'
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [activeSalonId, setActive] = useState(null)
  const restored = useRef(false)

  const applySession = useCallback((data) => {
    const first = data.memberships[0]?.salonId ?? null
    setActive(first)
    setActiveSalonId(first)
    setUser(data.user)
    setMemberships(data.memberships)
    setStatus('authenticated')
  }, [])

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setActiveSalonId(null)
    setUser(null)
    setMemberships([])
    setActive(null)
    setStatus('anonymous')
    // No data of the previous user or salon may stay in the cache.
    queryClient.clear()
  }, [queryClient])

  // App start: bring back the saved login (refresh token -> new access token).
  useEffect(() => {
    if (restored.current) return
    restored.current = true
    refreshSession()
      .then((data) => (data ? applySession(data) : clearSession()))
      .catch(() => clearSession())
  }, [applySession, clearSession])

  useEffect(() => {
    setSessionLostHandler(clearSession)
  }, [clearSession])

  // Throws an Error with a readable message, which LoginScreen shows.
  const login = useCallback(
    async (email, password) => {
      try {
        applySession(await loginRequest(email, password))
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

  const logout = useCallback(async () => {
    await logoutRequest()
    await clearRefreshToken()
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

  const activeMembership = memberships.find((m) => m.salonId === activeSalonId) ?? null

  const value = useMemo(
    () => ({
      status,
      user,
      memberships,
      activeSalonId,
      activeSalon: activeMembership,
      role: activeMembership?.role ?? null,
      isPlatformAdmin: user?.platformRole === 'admin',
      login,
      logout,
      switchSalon,
    }),
    [status, user, memberships, activeSalonId, activeMembership, login, logout, switchSalon],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
