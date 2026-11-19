import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS, SOFT_SHADOW } from '../config/theme'
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
  return (
    <View style={styles.sectionRow}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  )
}

// One number with a label, e.g. "Billed today  ₹4,200". `icon` is an optional Ionicons name.
export function StatCard({ label, value, loading, hint, icon }) {
  return (
    <View style={styles.stat}>
      {icon ? (
        <View style={styles.statIcon}>
          <Ionicons name={icon} size={17} color={COLORS.gold} />
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
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.xl - 4, borderWidth: 1, borderColor: COLORS.line, padding: 16, marginBottom: 12, ...SOFT_SHADOW },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, marginBottom: 12 },
  sectionBar: { width: 4, height: 20, borderRadius: 2, backgroundColor: COLORS.gold },
  sectionTitle: { flexShrink: 1, fontSize: 19, fontWeight: '700', color: COLORS.espresso, fontFamily: FONT.heading, letterSpacing: 0.3 },
  stat: { flex: 1, minWidth: 120, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl - 4, borderWidth: 1, borderColor: COLORS.line, padding: 14, ...SOFT_SHADOW },
  statIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.espresso, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 23, fontWeight: '700', color: COLORS.espresso, fontFamily: FONT.heading },
  statLabel: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  statHint: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  errorCard: { alignItems: 'center', gap: 10, backgroundColor: COLORS.errorSoft, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.error, padding: 16, marginBottom: 12 },
  errorText: { color: COLORS.error, textAlign: 'center' },
})
