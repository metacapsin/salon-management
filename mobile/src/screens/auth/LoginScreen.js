import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import Button from '../../components/Button'
import TextField from '../../components/TextField'
import { canRememberLogin } from '../../auth/tokenStore'
import { COLORS } from '../../config/theme'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Same rules as the website/backend: valid email, password not empty.
function validate({ email, password }) {
  const errors = {}
  if (!email.trim()) errors.email = 'Enter your email.'
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address.'
  if (!password) errors.password = 'Enter your password.'
  return errors
}

// `onSubmit({ email, password })` is given by the parent and may throw an Error with a readable message.
// This screen only handles the form; the real login call is connected in Step 5.
export default function LoginScreen({ onSubmit }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const passwordRef = useRef(null)

  async function handleSubmit() {
    const found = validate({ email, password })
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length > 0) return

    setLoading(true)
    try {
      await onSubmit({ email: email.trim(), password })
    } catch (error) {
      setFormError(error?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.brand}>Glamora</Text>
          <Text style={styles.tag}>Salon management</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>Welcome back. Enter your details to continue.</Text>

          {!canRememberLogin() ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                This browser is blocking site data, so you will have to sign in again every time you refresh the page. To fix it: click the icon at the left of the address bar, open Site settings, and set Cookies / site data to Allow.
              </Text>
            </View>
          ) : null}

          {formError ? (
            <View style={styles.banner} accessibilityRole="alert">
              <Text style={styles.bannerText}>{formError}</Text>
            </View>
          ) : null}

          <TextField
            label="Email"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            placeholder="you@salon.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
          />

          <TextField
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            error={errors.password}
            placeholder="Your password"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoComplete="password"
            autoCorrect={false}
            returnKeyType="go"
            onSubmitEditing={handleSubmit}
          />

          <Pressable
            onPress={() => setShowPassword((v) => !v)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>{showPassword ? 'Hide password' : 'Show password'}</Text>
          </Pressable>

          <Button title="Sign in" onPress={handleSubmit} loading={loading} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.espresso },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  header: { alignItems: 'center', marginBottom: 24 },
  brand: { fontSize: 38, fontWeight: '700', color: COLORS.gold, fontFamily: 'serif' },
  tag: { marginTop: 4, fontSize: 15, color: COLORS.goldSoft },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    backgroundColor: COLORS.cream,
    borderRadius: 16,
    padding: 20,
  },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.ink, fontFamily: 'serif' },
  subtitle: { marginTop: 4, marginBottom: 20, fontSize: 14, color: COLORS.muted },
  banner: {
    backgroundColor: '#fdecea',
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: { color: COLORS.error, fontSize: 14 },
  notice: { backgroundColor: COLORS.goldSoft, borderRadius: 10, padding: 12, marginBottom: 16 },
  noticeText: { color: COLORS.ink, fontSize: 13 },
  toggle: { minHeight: 44, justifyContent: 'center', marginBottom: 8, alignSelf: 'flex-start' },
  toggleText: { color: COLORS.brown, fontSize: 14, fontWeight: '600' },
})
