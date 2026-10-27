import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, RADIUS, TOUCH_MIN } from '../config/theme'

// variant: 'primary' (brown, filled), 'secondary' (outlined), 'gold' (gold on dark backgrounds), 'danger' (red outline).
// Big touch-friendly button. While `loading` it cannot be pressed twice. `icon` is an Ionicons name.
export default function Button({ title, onPress, loading = false, disabled = false, variant = 'primary', icon, style }) {
  const blocked = loading || disabled
  const v = VARIANTS[variant] ?? VARIANTS.primary
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: blocked, busy: loading }}
      onPress={blocked ? undefined : onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: v.bg, borderColor: v.border }, pressed && { backgroundColor: v.pressed }, blocked && styles.blocked, style]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={v.fg} /> : null}
          <Text style={[styles.text, { color: v.fg }]} numberOfLines={1}>{title}</Text>
        </View>
      )}
    </Pressable>
  )
}

const VARIANTS = {
  primary: { bg: COLORS.brown, border: COLORS.brown, pressed: COLORS.brownDark, fg: '#fff' },
  secondary: { bg: COLORS.surface, border: COLORS.line, pressed: COLORS.goldSoft, fg: COLORS.brownDark },
  gold: { bg: COLORS.gold, border: COLORS.gold, pressed: '#d8b84f', fg: COLORS.espresso },
  danger: { bg: COLORS.surface, border: COLORS.error, pressed: COLORS.errorSoft, fg: COLORS.error },
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH_MIN,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  blocked: { opacity: 0.55 },
  text: { fontSize: 16, fontWeight: '600' },
})
