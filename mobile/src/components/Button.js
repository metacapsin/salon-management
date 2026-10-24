import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native'
import { COLORS, TOUCH_MIN } from '../config/theme'

// Big touch-friendly button. While `loading` it cannot be pressed twice.
export default function Button({ title, onPress, loading = false, disabled = false }) {
  const blocked = loading || disabled
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: blocked, busy: loading }}
      onPress={blocked ? undefined : onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, blocked && styles.blocked]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.text}>{title}</Text>}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH_MIN,
    borderRadius: 10,
    backgroundColor: COLORS.brown,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  pressed: { backgroundColor: COLORS.brownDark },
  blocked: { opacity: 0.7 },
  text: { color: '#fff', fontSize: 16, fontWeight: '600' },
})
