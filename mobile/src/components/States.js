import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT } from '../config/theme'
import Button from './Button'

// Red message box at the top of a form (login, booking...). Renders nothing when there is no message.
export function ErrorBanner({ message }) {
  if (!message) return null
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={COLORS.error} />
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  )
}

// Centered spinner for a page that is still loading.
export function LoadingState({ label }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <ActivityIndicator color={COLORS.brown} size="large" />
      {label ? <Text style={styles.text}>{label}</Text> : null}
    </View>
  )
}

// Nothing to show yet (empty list). `icon` is an Ionicons name. An action button is optional.
export function EmptyState({ icon = 'sparkles-outline', title, text, actionTitle, onAction }) {
  return (
    <View style={styles.center}>
      <View style={styles.badge}>
        <Ionicons name={icon} size={28} color={COLORS.brown} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
      {actionTitle ? <Button title={actionTitle} variant="secondary" onPress={onAction} style={styles.action} /> : null}
    </View>
  )
}

// A request failed. `offline` (the request never reached the server) gets its own wording.
export function ErrorState({ message, offline = false, onRetry }) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <View style={[styles.badge, { backgroundColor: COLORS.errorSoft }]}>
        <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={28} color={COLORS.error} />
      </View>
      <Text style={styles.title}>{offline ? 'No internet connection' : 'Something went wrong'}</Text>
      <Text style={styles.text}>{message}</Text>
      {onRetry ? <Button title="Try again" icon="refresh" variant="secondary" onPress={onRetry} style={styles.action} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: COLORS.errorSoft, borderWidth: 1, borderColor: COLORS.error, borderRadius: 12, padding: 12, marginBottom: 16 },
  bannerText: { flex: 1, color: COLORS.error, fontSize: 14 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  badge: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.goldSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading, textAlign: 'center' },
  text: { fontSize: 14, color: COLORS.muted, textAlign: 'center' },
  action: { marginTop: 10, minWidth: 160 },
})
