import { Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { COLORS } from '../config/theme'

// Label on the left, on/off switch on the right. Whole row is tappable (44px+ high).
export function SwitchRow({ label, value, onValueChange, hint }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={() => onValueChange(!value)} style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: COLORS.espresso, false: COLORS.line }} thumbColor="#fff" />
    </Pressable>
  )
}

// Wrapped chips where several can be selected (for example the services a staff member does).
export function MultiChips({ label, options, selected, onChange, error }) {
  const toggle = (value) => onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.wrap}>
        {options.map((o) => {
          const on = selected.includes(o.value)
          return (
            <Pressable key={o.value} accessibilityRole="button" accessibilityLabel={o.label} accessibilityState={{ selected: on }} onPress={() => toggle(o.value)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.label}</Text>
            </Pressable>
          )
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

// Single choice from a short list (for example the service category).
export function ChoiceChips({ label, options, value, onChange, error }) {
  return (
    <View style={styles.block}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.wrap}>
        {options.map((o) => {
          const on = o === value
          return (
            <Pressable key={o} accessibilityRole="button" accessibilityLabel={o} accessibilityState={{ selected: on }} onPress={() => onChange(o)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{o}</Text>
            </Pressable>
          )
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  rowText: { flex: 1 },
  rowLabel: { fontSize: 15, color: COLORS.ink },
  hint: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  block: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginBottom: 8 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: COLORS.line, backgroundColor: '#fff', justifyContent: 'center' },
  chipOn: { backgroundColor: COLORS.brown, borderColor: COLORS.brown },
  chipText: { fontSize: 14, color: COLORS.ink },
  chipTextOn: { color: '#fff', fontWeight: '600' },
  error: { marginTop: 6, fontSize: 13, color: COLORS.error },
})
