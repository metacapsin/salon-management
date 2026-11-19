import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT } from '../config/theme'
import Button from './Button'
import { BrandMark } from './Brand'

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

// Soft pulse (opacity) used by the loading logo and the skeleton blocks.
function usePulse(from = 0.45) {
  const value = useRef(new Animated.Value(from)).current
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(value, { toValue: from, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [value, from])
  return value
}

// Centered loading page: the Glamora mark pulsing gently, with an optional label.
export function LoadingState({ label }) {
  const pulse = usePulse()
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'}>
      <Animated.View style={{ opacity: pulse, transform: [{ scale: pulse.interpolate({ inputRange: [0.45, 1], outputRange: [0.94, 1] }) }] }}>
        <BrandMark size={52} />
      </Animated.View>
      <Text style={styles.loadingText}>{label ?? 'Loading'}</Text>
    </View>
  )
}

// Soft placeholder block, for lists that want to show their shape while loading.
export function Skeleton({ height = 16, width = '100%', radius = 8, style }) {
  const pulse = usePulse(0.4)
  return <Animated.View style={[{ height, width, borderRadius: radius, backgroundColor: COLORS.creamDeep, opacity: pulse }, style]} />
}

// Nothing to show yet (empty list). `icon` is an Ionicons name. An action button is optional.
export function EmptyState({ icon = 'sparkles-outline', title, text, actionTitle, onAction }) {
  return (
    <View style={styles.center}>
      <View style={styles.ring}>
        <View style={styles.badge}>
          <Ionicons name={icon} size={30} color={COLORS.gold} />
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {text ? <Text style={styles.text}>{text}</Text> : null}
      {actionTitle ? <Button title={actionTitle} variant="primary" onPress={onAction} style={styles.action} /> : null}
    </View>
  )
}

// A request failed. `offline` (the request never reached the server) gets its own wording.
export function ErrorState({ message, offline = false, onRetry }) {
  return (
    <View style={styles.center} accessibilityRole="alert">
      <View style={[styles.ring, { borderColor: 'rgba(198,40,40,0.3)' }]}>
        <View style={[styles.badge, { backgroundColor: COLORS.errorSoft }]}>
          <Ionicons name={offline ? 'cloud-offline-outline' : 'alert-circle-outline'} size={30} color={COLORS.error} />
        </View>
      </View>
      <Text style={styles.title}>{offline ? 'No internet connection' : 'Something went wrong'}</Text>
      <Text style={styles.text}>{message}</Text>
      {onRetry ? <Button title="Try again" icon="refresh" variant="primary" onPress={onRetry} style={styles.action} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: COLORS.errorSoft, borderWidth: 1, borderColor: COLORS.error, borderRadius: 14, padding: 12, marginBottom: 16 },
  bannerText: { flex: 1, color: COLORS.error, fontSize: 14 },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 24, gap: 8 },
  loadingText: { marginTop: 10, fontSize: 13, color: COLORS.muted, letterSpacing: 1, textTransform: 'uppercase' },
  ring: { width: 92, height: 92, borderRadius: 46, borderWidth: 1, borderColor: COLORS.goldLine, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  badge: { width: 68, height: 68, borderRadius: 34, backgroundColor: COLORS.espresso, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.espresso, fontFamily: FONT.heading, textAlign: 'center' },
  text: { fontSize: 14, color: COLORS.muted, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  action: { marginTop: 14, minWidth: 180 },
})
