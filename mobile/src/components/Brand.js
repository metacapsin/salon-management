import { StyleSheet, Text, View } from 'react-native'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { COLORS, FONT } from '../config/theme'

// Glamora logo mark: gold rounded square with a small crown and a serif "G" (same look as the website logo).
export function BrandMark({ size = 56 }) {
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size * 0.28 }]} accessibilityLabel="Glamora logo">
      <MaterialCommunityIcons name="crown" size={size * 0.26} color={COLORS.espresso} style={{ marginBottom: -size * 0.04 }} />
      <Text style={[styles.g, { fontSize: size * 0.52, lineHeight: size * 0.62 }]}>G</Text>
    </View>
  )
}

// Mark + name, with an optional small line under it. `light` = on dark brown (gold name) or dark text on cream.
export function BrandLogo({ size = 56, tagline, light = true, stacked = true }) {
  return (
    <View style={[styles.logo, !stacked && styles.logoRow]}>
      <BrandMark size={size} />
      <View style={stacked ? styles.center : undefined}>
        <Text style={[styles.name, { fontSize: size * 0.62 }, !light && { color: COLORS.espresso }]}>Glamora</Text>
        {tagline ? <Text style={[styles.tagline, !light && { color: COLORS.goldDeep }]}>{tagline}</Text> : null}
      </View>
    </View>
  )
}

// A thin gold line with a diamond in the middle, used as a quiet divider on dark hero areas.
export function GoldDivider({ style }) {
  return (
    <View style={[styles.divider, style]}>
      <View style={styles.dividerLine} />
      <View style={styles.diamond} />
      <View style={styles.dividerLine} />
    </View>
  )
}

const styles = StyleSheet.create({
  mark: {
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#f6e3a1',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  g: { color: COLORS.espresso, fontFamily: FONT.heading, fontWeight: '800' },
  logo: { alignItems: 'center', gap: 10 },
  logoRow: { flexDirection: 'row', gap: 10 },
  center: { alignItems: 'center' },
  name: { color: COLORS.gold, fontFamily: FONT.heading, fontWeight: '700', letterSpacing: 1 },
  tagline: { color: COLORS.goldSoft, fontSize: 11, letterSpacing: 3, textTransform: 'uppercase', marginTop: 2 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'center', width: 140 },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.goldLine },
  diamond: { width: 6, height: 6, backgroundColor: COLORS.gold, transform: [{ rotate: '45deg' }] },
})
