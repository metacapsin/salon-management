// API address comes from .env (EXPO_PUBLIC_API_URL). Nothing is hardcoded.
import { Platform } from 'react-native'

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '')
export const API_BASE = `${API_URL}/api/v1`

// On a real phone "localhost" is the phone itself, not your PC, so the app can never reach the backend with it.
if (Platform.OS !== 'web' && /^https?:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(API_URL)) {
  console.warn(`EXPO_PUBLIC_API_URL is ${API_URL}. On a phone, use your PC's Wi-Fi IP (http://<PC-IP>:3000) or a deployed https address.`)
}

if (__DEV__ && !API_URL) {
  console.warn('EXPO_PUBLIC_API_URL is not set. Copy mobile/.env.example to mobile/.env, then restart with: npx expo start --web -c')
}
