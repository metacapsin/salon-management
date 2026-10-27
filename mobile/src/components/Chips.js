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
  pending: { bg: COLORS.warnSoft, fg: COLORS.warn },
  confirmed: { bg: COLORS.infoSoft, fg: COLORS.info },
  completed: { bg: COLORS.successSoft, fg: COLORS.success },
  cancelled: { bg: COLORS.errorSoft, fg: COLORS.error },
  unpaid: { bg: COLORS.warnSoft, fg: COLORS.warn },
  partial: { bg: COLORS.infoSoft, fg: COLORS.info },
  paid: { bg: COLORS.successSoft, fg: COLORS.success },
  void: { bg: COLORS.errorSoft, fg: COLORS.error },
  upcoming: { bg: COLORS.infoSoft, fg: COLORS.info },
  expired: { bg: COLORS.errorSoft, fg: COLORS.error },
  exhausted: { bg: '#efe6db', fg: COLORS.muted },
  running: { bg: COLORS.successSoft, fg: COLORS.success },
  scheduled: { bg: COLORS.infoSoft, fg: COLORS.info },
  ended: { bg: '#efe6db', fg: COLORS.muted },
  off: { bg: '#efe6db', fg: COLORS.muted },
  active: { bg: COLORS.successSoft, fg: COLORS.success },
  suspended: { bg: COLORS.warnSoft, fg: COLORS.warn },
  regular: { bg: COLORS.successSoft, fg: COLORS.success },
  new: { bg: COLORS.infoSoft, fg: COLORS.info },
  inactive: { bg: '#efe6db', fg: COLORS.muted },
  approved: { bg: COLORS.successSoft, fg: COLORS.success },
  rejected: { bg: COLORS.errorSoft, fg: COLORS.error },
  'in progress': { bg: COLORS.warnSoft, fg: COLORS.warn },
  resolved: { bg: COLORS.successSoft, fg: COLORS.success },
  closed: { bg: '#efe6db', fg: COLORS.muted },
  verified: { bg: COLORS.successSoft, fg: COLORS.success },
  'not verified': { bg: COLORS.warnSoft, fg: COLORS.warn },
  deactivated: { bg: COLORS.errorSoft, fg: COLORS.error },
  no_show: { bg: COLORS.errorSoft, fg: COLORS.error },
}

export function StatusBadge({ status, label }) {
  const colors = BADGE[status] ?? BADGE.inactive
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <View style={[styles.dot, { backgroundColor: colors.fg }]} />
      <Text style={[styles.badgeText, { color: colors.fg }]}>{label ?? String(status).replace('_', ' ')}</Text>
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
  chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface, justifyContent: 'center' },
  chipSelected: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  chipText: { fontSize: 14, color: COLORS.ink },
  chipTextSelected: { color: COLORS.gold, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
})
