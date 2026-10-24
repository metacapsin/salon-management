import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ApiError, setCustomerSessionLostHandler } from '../api/client'
import { customerLogout, getCustomerMe } from '../api/customerApi'

// Customer (salon dhundhne aur book karne wala) ka login. Salon owner/staff ke AuthContext se bilkul alag hai.
// status: 'loading' | 'authenticated' | 'anonymous'
const CustomerAuthContext = createContext(null)

export function CustomerAuthProvider({ children }) {
  const queryClient = useQueryClient()
  const [state, setState] = useState({ status: 'loading', customer: null })

  // Page khulte hi cookie se pata karo ki customer login hai ya nahi
  useEffect(() => {
    let cancelled = false
    getCustomerMe()
      .then((customer) => !cancelled && setState({ status: 'authenticated', customer }))
      .catch((error) => {
        if (cancelled) return
        // Server band ho to bhi "anonymous" maante hain; login page khud error dikha dega
        if (!(error instanceof ApiError)) console.error(error)
        setState({ status: 'anonymous', customer: null })
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Kisi bhi request par "login chahiye" aaye (cookie khatam) to wapas login par bhejne ke liye
  useEffect(() => {
    setCustomerSessionLostHandler(() => setState({ status: 'anonymous', customer: null }))
    return () => setCustomerSessionLostHandler(() => {})
  }, [])

  const signedIn = useCallback((customer) => setState({ status: 'authenticated', customer }), [])

  const logout = useCallback(async () => {
    try {
      await customerLogout()
    } finally {
      setState({ status: 'anonymous', customer: null })
      queryClient.removeQueries({ queryKey: ['public'] }) // purana customer ka data na bache
    }
  }, [queryClient])

  const value = useMemo(() => ({ ...state, signedIn, logout }), [state, signedIn, logout])
  return <CustomerAuthContext.Provider value={value}>{children}</CustomerAuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCustomer() {
  const ctx = useContext(CustomerAuthContext)
  if (!ctx) throw new Error('useCustomer must be used inside CustomerAuthProvider')
  return ctx
}
