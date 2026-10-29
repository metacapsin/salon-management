import { useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Button from '../../components/Button'
import TextField from '../../components/TextField'
import { friendlyError, requestPasswordReset } from '../../api/client'
import { canRememberLogin } from '../../auth/tokenStore'
import { COLORS, FONT, RADIUS } from '../../config/theme'
import { ErrorBanner } from '../../components/States'
import CustomerLoginForm from './CustomerLoginForm'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Same rules as the website/backend: valid email, password not empty.
function validate({ email, password }) {
  const errors = {}
  if (!email.trim()) errors.email = 'Enter your email.'
  else if (!EMAIL_PATTERN.test(email.trim())) errors.email = 'Enter a valid email address.'
  if (!password) errors.password = 'Enter your password.'
  return errors
}

// Salon team (owner, manager, receptionist, staff, Super Admin): email + password, with a "forgot password" step.
function TeamLoginForm({ onSubmit }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [resetSent, setResetSent] = useState(false)
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

  async function sendReset() {
    setFormError('')
    if (!EMAIL_PATTERN.test(email.trim())) return setErrors({ email: 'Enter a valid email address.' })
    setErrors({})
    setLoading(true)
    try {
      await requestPasswordReset(email.trim())
      setResetSent(true)
    } catch (error) {
      setFormError(friendlyError(error))
    } finally {
      setLoading(false)
    }
  }

  if (forgot) {
    return (
      <View>
        <Text style={styles.subtitle}>Enter your email. If it is registered, we will send you a link to choose a new password.</Text>
        <ErrorBanner message={formError} />
        {resetSent ? (
          <View style={styles.notice}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
            <Text style={styles.noticeText}>If that email is registered, we have sent a reset link. Open it, set a new password, then sign in here.</Text>
          </View>
        ) : null}
        <TextField label="Email" icon="mail-outline" value={email} onChangeText={setEmail} error={errors.email} placeholder="you@salon.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" autoCorrect={false} returnKeyType="send" onSubmitEditing={sendReset} />
        <Button title={resetSent ? 'Send again' : 'Send reset link'} onPress={sendReset} loading={loading} />
        <Pressable onPress={() => { setForgot(false); setResetSent(false); setFormError('') }} accessibilityRole="button" style={styles.link}>
          <Text style={styles.linkText}>Back to sign in</Text>
        </Pressable>
      </View>
    )
  }

  return (
    <View>
      <Text style={styles.subtitle}>For salon owners, managers, receptionists and staff.</Text>
      <ErrorBanner message={formError} />
      <TextField
        label="Email"
        icon="mail-outline"
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
        icon="lock-closed-outline"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        placeholder="Your password"
        secureTextEntry
        autoCapitalize="none"
        autoComplete="password"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />
      <Pressable onPress={() => { setForgot(true); setFormError('') }} accessibilityRole="button" style={[styles.link, styles.linkRight]}>
        <Text style={styles.linkText}>Forgot password?</Text>
      </Pressable>
      <Button title="Sign in" onPress={handleSubmit} loading={loading} />
    </View>
  )
}

// Two ways in: customers (email + mobile + code; a new customer is signed up on the spot) and the salon team (email + password).
// The screen only collects details. Which app opens afterwards is decided by the server's answer, not by this choice.
// `onSubmit({ email, password })`, `onRequestOtp`, `onVerifyOtp` come from the parent and may throw an Error with a readable message.
// `initialMode` ('customer' | 'team') locks the page to one kind of login with no switcher: customers come here from a salon,
// the salon team from the "Salon login" button. Without it both tabs show.
export default function LoginScreen({ onSubmit, onRequestOtp, onVerifyOtp, initialMode, onBack }) {
  const [mode, setMode] = useState(initialMode ?? 'customer')
  const locked = Boolean(initialMode)
  const insets = useSafeAreaInsets()

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to salons" style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={COLORS.gold} />
            <Text style={styles.backText}>Find a salon</Text>
          </Pressable>
        ) : null}
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="sparkles" size={28} color={COLORS.espresso} />
          </View>
          <Text style={styles.brand}>Galora</Text>
          <Text style={styles.tag}>Beauty & salon, beautifully simple</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{locked ? (mode === 'customer' ? 'Sign in to continue' : 'Salon login') : mode === 'customer' ? 'Welcome' : 'Welcome back'}</Text>
          {locked ? <View style={{ height: 14 }} /> : <View style={styles.tabs} accessibilityRole="tablist">
            {[['customer', 'Customer'], ['team', 'Salon team']].map(([key, label]) => (
              <Pressable key={key} onPress={() => setMode(key)} accessibilityRole="tab" accessibilityState={{ selected: mode === key }} style={[styles.tab, mode === key && styles.tabOn]}>
                <Text style={[styles.tabText, mode === key && styles.tabTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>}

          {!canRememberLogin() ? (
            <View style={styles.notice}>
              <Ionicons name="information-circle" size={20} color={COLORS.warn} />
              <Text style={styles.noticeText}>
                This browser is blocking site data, so you will have to sign in again every time you refresh the page. To fix it: click the icon at the left of the address bar, open Site settings, and set Cookies / site data to Allow.
              </Text>
            </View>
          ) : null}

          {mode === 'customer' ? <CustomerLoginForm onRequestOtp={onRequestOtp} onVerifyOtp={onVerifyOtp} /> : <TeamLoginForm onSubmit={onSubmit} />}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.espresso },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 20 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, alignSelf: 'flex-start', marginBottom: 8 },
  backText: { color: COLORS.gold, fontSize: 15, fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  brand: { fontSize: 36, fontWeight: '700', color: COLORS.gold, fontFamily: FONT.heading },
  tag: { marginTop: 4, fontSize: 14, color: COLORS.goldSoft, textAlign: 'center' },
  card: { width: '100%', maxWidth: 440, alignSelf: 'center', backgroundColor: COLORS.cream, borderRadius: RADIUS.xl, padding: 20 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading },
  tabs: { flexDirection: 'row', marginTop: 14, marginBottom: 16, backgroundColor: '#efe6db', borderRadius: RADIUS.md, padding: 4 },
  tab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.sm },
  tabOn: { backgroundColor: COLORS.espresso },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.muted },
  tabTextOn: { color: COLORS.gold },
  subtitle: { marginBottom: 16, fontSize: 14, color: COLORS.muted },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: COLORS.goldSoft, borderRadius: RADIUS.md, padding: 12, marginBottom: 16 },
  noticeText: { flex: 1, color: COLORS.ink, fontSize: 13 },
  link: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  linkRight: { alignSelf: 'flex-end', marginTop: -8 },
  linkText: { color: COLORS.brown, fontSize: 14, fontWeight: '600' },
})
