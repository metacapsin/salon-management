import { forwardRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { COLORS, RADIUS, TOUCH_MIN } from '../config/theme'

// Label + input + error text. `error` turns the border red, focus turns it gold-brown.
// `icon` (Ionicons name) shows at the left. `secureTextEntry` adds a show/hide eye button at the right.
// A `style` you pass is added on top of the base input style.
const TextField = forwardRef(function TextField({ label, error, style, icon, secureTextEntry, multiline, ...inputProps }, ref) {
  const [focused, setFocused] = useState(false)
  const [hidden, setHidden] = useState(true)
  const secure = Boolean(secureTextEntry)
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.box, focused && styles.boxFocused, error && styles.boxError, multiline && styles.boxMulti]}>
        {icon ? <Ionicons name={icon} size={20} color={COLORS.muted} style={styles.icon} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          placeholderTextColor="#a8978a"
          {...inputProps}
          multiline={multiline}
          secureTextEntry={secure && hidden}
          onFocus={(e) => {
            setFocused(true)
            inputProps.onFocus?.(e)
          }}
          onBlur={(e) => {
            setFocused(false)
            inputProps.onBlur?.(e)
          }}
          style={[styles.input, multiline && styles.inputMulti, style]}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'} hitSlop={8} style={styles.eye}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={COLORS.muted} />
          </Pressable>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
})

export default TextField

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginBottom: 6 },
  box: {
    minHeight: TOUCH_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    paddingHorizontal: 14,
  },
  boxFocused: { borderColor: COLORS.brown },
  boxError: { borderColor: COLORS.error },
  boxMulti: { alignItems: 'flex-start', paddingVertical: 4 },
  icon: { marginRight: 10 },
  input: { flex: 1, minHeight: TOUCH_MIN - 2, fontSize: 16, color: COLORS.ink, paddingVertical: 0, outlineStyle: 'none' },
  inputMulti: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  eye: { marginLeft: 8, minWidth: 28, alignItems: 'center' },
  error: { marginTop: 4, fontSize: 13, color: COLORS.error },
})
