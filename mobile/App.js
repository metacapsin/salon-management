import { useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ApiError } from './src/api/client'
import { AuthProvider, useAuth } from './src/auth/AuthContext'
import RootNavigator, { GuestNavigator } from './src/navigation/RootNavigator'
import SplashScreen from './src/screens/SplashScreen'

function Root() {
  const { status } = useAuth()
  // Show the brand splash for at least 1.8 s (and as long as the saved sign-in is still being checked).
  const [splashDone, setSplashDone] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setSplashDone(true), 1800)
    return () => clearTimeout(id)
  }, [])
  if (status === 'loading' || !splashDone) return <SplashScreen />
  // Not signed in: the first page is Find a Salon. Login is asked only when a salon is opened, or from the "Salon login" button.
  if (status === 'anonymous') return <GuestNavigator />
  return <RootNavigator />
}

export default function App() {
  // Do not retry 4xx answers (403/404 will not change by asking again).
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: (count, error) => !(error instanceof ApiError && error.status >= 400 && error.status < 500) && count < 2,
          },
        },
      }),
  )
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <Root />
          <StatusBar style="light" />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  )
}
