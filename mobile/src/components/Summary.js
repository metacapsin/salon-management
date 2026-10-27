import { StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, FONT, RADIUS, SHADOW, TOUCH_MIN } from '../config/theme'

// Dark summary panel at the top of a list: one big number (`value` + `label`), then small tiles.
// tiles = [{ icon, label, value, hint? }]. `icon` (Ionicons name) is the badge at the top right.
export function SummaryPanel({ value, label, icon = 'stats-chart', tiles = [], loading = false }) {
  return (
    <View style={styles.summary}>
      <View style={styles.top}>
        <View style={{ flexShrink: 1 }}>
          <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>{loading ? '…' : value}</Text>
          <Text style={styles.label}>{label}</Text>
        </View>
        <View style={styles.badge}>
          <Ionicons name={icon} size={26} color={COLORS.espresso} />
        </View>
      </View>
      {tiles.length > 0 ? (
        <View style={styles.tiles}>
          {tiles.map((t) => (
            <View key={t.label} style={styles.tile}>
              <View style={styles.tileHead}>
                <Ionicons name={t.icon} size={14} color={COLORS.gold} />
                <Text style={styles.tileValue} numberOfLines={1} adjustsFontSizeToFit>{loading ? '…' : t.value}</Text>
              </View>
              <Text style={styles.tileLabel} numberOfLines={1}>{t.label}</Text>
              {t.hint ? <Text style={styles.tileHint} numberOfLines={1}>{t.hint}</Text> : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

// Search box with a magnifier. Pass TextInput props (value, onChangeText, placeholder, accessibilityLabel...).
export function SearchBox(props) {
  return (
    <View style={styles.search}>
      <Ionicons name="search" size={20} color={COLORS.muted} />
      <TextInput placeholderTextColor="#a8978a" autoCapitalize="none" autoCorrect={false} {...props} style={styles.searchInput} />
    </View>
  )
}

const styles = StyleSheet.create({
  summary: { backgroundColor: COLORS.espresso, borderRadius: RADIUS.xl, padding: 18, marginBottom: 14, ...SHADOW },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  value: { color: COLORS.gold, fontSize: 36, fontWeight: '700', fontFamily: FONT.heading },
  label: { color: COLORS.goldSoft, fontSize: 14, marginTop: -2 },
  badge: { width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 16 },
  tile: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: RADIUS.md, borderWidth: 1, borderColor: 'rgba(230,199,103,0.25)', paddingVertical: 10, paddingHorizontal: 12 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tileValue: { flexShrink: 1, color: COLORS.cream, fontSize: 18, fontWeight: '700' },
  tileLabel: { color: COLORS.goldSoft, fontSize: 12, marginTop: 2 },
  tileHint: { color: COLORS.gold, fontSize: 11, marginTop: 1 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: TOUCH_MIN, borderWidth: 1, borderColor: COLORS.line, borderRadius: RADIUS.md, backgroundColor: COLORS.surface, paddingHorizontal: 14 },
  searchInput: { flex: 1, minHeight: TOUCH_MIN - 2, fontSize: 16, color: COLORS.ink, paddingVertical: 0, outlineStyle: 'none' },
})
