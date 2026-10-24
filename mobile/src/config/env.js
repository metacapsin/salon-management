// API address comes from .env (EXPO_PUBLIC_API_URL). Nothing is hardcoded.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '')
export const API_BASE = `${API_URL}/api/v1`

if (__DEV__ && !API_URL) {
  console.warn('EXPO_PUBLIC_API_URL is not set. Copy mobile/.env.example to mobile/.env, then restart with: npx expo start --web -c')
}
