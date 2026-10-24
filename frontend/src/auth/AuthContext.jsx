import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { fetchMe, logoutRequest } from '../api/authApi'
import { refreshSession, setAccessToken, setActiveSalonId, setSessionLostHandler } from '../api/client'

const AuthContext = createContext(null)

const SALON_KEY = 'glamora.activeSalonId'

// localStorage kabhi band/khaali ho sakta hai (private window), isliye try/catch. Sirf salon ki id yaad rakhte hain, token nahi.
function readStoredSalon() {
  try {
    return localStorage.getItem(SALON_KEY)
  } catch {
    return null
  }
}
function storeSalon(id) {
  try {
    if (id) localStorage.setItem(SALON_KEY, id)
    else localStorage.removeItem(SALON_KEY)
  } catch {
    // koi baat nahi
  }
}

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  // status: 'loading' (session wapas la rahe hain) | 'anonymous' | 'authenticated'
  const [status, setStatus] = useState('loading')
  const [user, setUser] = useState(null)
  const [memberships, setMemberships] = useState([])
  const [activeSalonId, setActive] = useState(null)
  const restored = useRef(false)

  const chooseSalon = useCallback((list, preferred) => {
    const id = list.find((m) => m.salonId === preferred)?.salonId ?? list[0]?.salonId ?? null
    setActive(id)
    setActiveSalonId(id)
    storeSalon(id)
  }, [])

  // login ya refresh ke baad: user, salon list aur active salon set karo
  const applySession = useCallback(
    (data, { keepSalon } = {}) => {
      setAccessToken(data.accessToken ?? null)
      setUser(data.user)
      setMemberships(data.memberships)
      chooseSalon(data.memberships, keepSalon ?? readStoredSalon())
      setStatus('authenticated')
    },
    [chooseSalon],
  )

  const clearSession = useCallback(() => {
    setAccessToken(null)
    setActiveSalonId(null)
    setUser(null)
    setMemberships([])
    setActive(null)
    setStatus('anonymous')
    // Pichle user/salon ka koi data cache me na bache (SRS section 15.2, AT-29)
    queryClient.clear()
  }, [queryClient])

  // Page khulte hi: refresh cookie se purana login wapas lao
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

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } catch {
      // server tak na pahunche tab bhi yahan se nikal jao
    }
    clearSession()
  }, [clearSession])

  // Salon badalna: us salon ka purana cache saaf, naya data dobara aata hai
  const switchSalon = useCallback(
    (salonId) => {
      setActive(salonId)
      setActiveSalonId(salonId)
      storeSalon(salonId)
      queryClient.clear()
    },
    [queryClient],
  )

  // Naya salon banane ya role badalne ke baad list dobara lao
  const reloadMemberships = useCallback(
    async (preferredSalonId, { clearCache = true } = {}) => {
      const data = await fetchMe()
      setUser(data.user)
      setMemberships(data.memberships)
      chooseSalon(data.memberships, preferredSalonId ?? activeSalonId)
      if (clearCache) queryClient.clear()
    },
    [activeSalonId, chooseSalon, queryClient],
  )

  const activeMembership = memberships.find((m) => m.salonId === activeSalonId) ?? null

  const value = useMemo(
    () => ({
      status,
      user,
      memberships,
      activeSalonId,
      role: activeMembership?.role ?? null,
      activeSalon: activeMembership,
      login: applySession,
      logout,
      switchSalon,
      reloadMemberships,
    }),
    [status, user, memberships, activeSalonId, activeMembership, applySession, logout, switchSalon, reloadMemberships],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
