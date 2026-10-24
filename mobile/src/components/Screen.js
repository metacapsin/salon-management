import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { COLORS } from '../config/theme'
import Button from './Button'

// Scrollable page with pull-to-refresh and the cream background.
export function Screen({ children, onRefresh, refreshing = false }) {
  const insets = useSafeAreaInsets()
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.brown} /> : undefined}
    >
      {children}
    </ScrollView>
  )
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>
}

export function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>
}

// One number with a label, e.g. "Billed today  ₹4,200".
export function StatCard({ label, value, loading, hint }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{loading ? '…' : value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  )
}

// Shown when a request failed; the user can try again.
export function ErrorNote({ message, onRetry }) {
  return (
    <Card style={styles.errorCard}>
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} /> : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, padding: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.ink, fontFamily: 'serif', marginTop: 8, marginBottom: 10 },
  stat: { flex: 1, minWidth: 140, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, padding: 14 },
  statLabel: { fontSize: 13, color: COLORS.muted },
  statValue: { fontSize: 22, fontWeight: '700', color: COLORS.ink, marginTop: 4 },
  statHint: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  errorCard: { borderColor: COLORS.error },
  errorText: { color: COLORS.error, marginBottom: 12 },
})
