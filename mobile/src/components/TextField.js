import { StyleSheet, Text, TextInput, View } from 'react-native'
import { COLORS, TOUCH_MIN } from '../config/theme'

// Label + input + error text. `error` turns the border red. A `style` you pass is added on top of the base style.
export default function TextField({ label, error, style, ...inputProps }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#a8978a"
        {...inputProps}
        style={[styles.input, error && styles.inputError, style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', color: COLORS.ink, marginBottom: 6 },
  input: {
    minHeight: TOUCH_MIN,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 10,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    fontSize: 16,
    color: COLORS.ink,
  },
  inputError: { borderColor: COLORS.error },
  error: { marginTop: 4, fontSize: 13, color: COLORS.error },
})
