import { useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { ActivityIndicator, View } from 'react-native'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { ApiError } from './src/api/client'
import { AuthProvider, useAuth } from './src/auth/AuthContext'
import { COLORS } from './src/config/theme'
import RootNavigator from './src/navigation/RootNavigator'
import LoginScreen from './src/screens/auth/LoginScreen'

function Root() {
  const { status, login } = useAuth()
  if (status === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.espresso, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={COLORS.gold} size="large" />
      </View>
    )
  }
  if (status === 'anonymous') return <LoginScreen onSubmit={({ email, password }) => login(email, password)} />
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
