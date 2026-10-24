import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { COLORS } from '../config/theme'

// Horizontal filter chips. options = [{ value, label }]; the selected one is filled brown.
// inset = left/right space; use 0 when the chips sit inside a list that already has its own padding.
export function FilterChips({ options, value, onChange, inset = 16 }) {
  return (
    // flexGrow 0: without it a horizontal ScrollView grows to fill a tall parent and the chips become huge.
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll} contentContainerStyle={[styles.row, { paddingHorizontal: inset }]}>
      {options.map((o) => {
        const selected = o.value === value
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => onChange(o.value)}
            style={[styles.chip, selected && styles.chipSelected]}
          >
            <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{o.label}</Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

// Two or three big equal tabs in one rounded box, for switching a whole screen (not for filters).
export function Segmented({ options, value, onChange }) {
  return (
    <View style={styles.segWrap}>
      <View style={styles.seg}>
        {options.map((o) => {
          const selected = o.value === value
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={o.label}
              onPress={() => onChange(o.value)}
              style={[styles.segItem, selected && styles.segItemOn]}
            >
              <Text style={[styles.segText, selected && styles.segTextOn]} numberOfLines={1}>
                {o.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const BADGE = {
  pending: { bg: '#fff4d6', fg: '#8a6100' },
  confirmed: { bg: '#e3effb', fg: '#1d4f91' },
  completed: { bg: '#e2f2e4', fg: COLORS.success },
  cancelled: { bg: '#f6e1e1', fg: COLORS.error },
  unpaid: { bg: '#fff4d6', fg: '#8a6100' },
  partial: { bg: '#e3effb', fg: '#1d4f91' },
  paid: { bg: '#e2f2e4', fg: COLORS.success },
  void: { bg: '#f6e1e1', fg: COLORS.error },
  upcoming: { bg: '#e3effb', fg: '#1d4f91' },
  expired: { bg: '#f6e1e1', fg: COLORS.error },
  exhausted: { bg: '#eee7df', fg: COLORS.muted },
  running: { bg: '#e2f2e4', fg: COLORS.success },
  scheduled: { bg: '#e3effb', fg: '#1d4f91' },
  ended: { bg: '#eee7df', fg: COLORS.muted },
  off: { bg: '#eee7df', fg: COLORS.muted },
  active: { bg: '#e2f2e4', fg: COLORS.success },
  suspended: { bg: '#fff4d6', fg: '#8a6100' },
  regular: { bg: '#e2f2e4', fg: COLORS.success },
  new: { bg: '#e3effb', fg: '#1d4f91' },
  inactive: { bg: '#eee7df', fg: COLORS.muted },
}

export function StatusBadge({ status }) {
  const colors = BADGE[status] ?? BADGE.inactive
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.fg }]}>{status}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  // Neither grow nor shrink: on a short screen the list below must not squash the chips.
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  segWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  seg: { flexDirection: 'row', backgroundColor: '#efe6db', borderRadius: 12, padding: 4 },
  segItem: { flex: 1, minHeight: 40, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  segItemOn: { backgroundColor: '#fff', shadowColor: '#3a2415', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  segText: { fontSize: 14, color: COLORS.muted, fontWeight: '500' },
  segTextOn: { color: COLORS.brownDark, fontWeight: '700' },
  chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff', justifyContent: 'center' },
  chipSelected: { backgroundColor: COLORS.brown, borderColor: COLORS.brown },
  chipText: { fontSize: 14, color: COLORS.ink },
  chipTextSelected: { color: '#fff', fontWeight: '600' },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
})
