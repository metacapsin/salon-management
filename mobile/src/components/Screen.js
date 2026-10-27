import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS } from '../config/theme'
import Button from './Button'

// Scrollable page with pull-to-refresh and the cream background. Keyboard taps do not get swallowed.
export function Screen({ children, onRefresh, refreshing = false }) {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brown} /> : undefined}
    >
      {children}
    </ScrollView>
  )
}

// White card with a subtle border (no heavy shadows).
export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

// One number with a label, e.g. "Billed today  ₹4,200". `icon` is an optional Ionicons name.
export function StatCard({ label, value, loading, hint, icon }) {
  return (
    <View style={styles.stat}>
      {icon ? (
        <View style={styles.statIcon}>
          <Ionicons name={icon} size={18} color={COLORS.brown} />
        </View>
      ) : null}
      <Text style={styles.statValue}>{loading ? '…' : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  )
}

// Shown when a request failed; the user can try again. A failed connection gets its own wording.
export function ErrorNote({ message, onRetry }) {
  return (
    <View style={styles.errorCard} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={24} color={COLORS.error} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button title="Try again" variant="secondary" icon="refresh" onPress={onRetry} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: 16 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.line, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading, marginTop: 8, marginBottom: 10 },
  stat: { flex: 1, minWidth: 120, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.line, padding: 14 },
  statIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: COLORS.goldSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 22, fontWeight: '700', color: COLORS.ink },
  statLabel: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  statHint: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  errorCard: { alignItems: 'center', gap: 10, backgroundColor: COLORS.errorSoft, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.error, padding: 16, marginBottom: 12 },
  errorText: { color: COLORS.error, textAlign: 'center' },
})
