import { useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Button from '../../components/Button'
import TextField from '../../components/TextField'
import { ErrorBanner } from '../../components/States'
import { COLORS } from '../../config/theme'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_PATTERN = /^(91)?[6-9]\d{9}$/
const NAME_PATTERN = /^\p{L}[\p{L} .'-]*$/u

// Customer sign in, same as the website: email + mobile number -> a 6 digit code arrives on the email.
// A new customer is asked for a name once the code is right. The same mobile number is never created twice (the server checks).
// `onRequestOtp(phone, email)` and `onVerifyOtp({ phone, otp, name? })` come from the parent and may throw an Error with a readable message.
export default function CustomerLoginForm({ onRequestOtp, onVerifyOtp }) {
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [step, setStep] = useState('details') // 'details' | 'code'
  const [needsName, setNeedsName] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const phoneRef = useRef(null)

  const digits = phone.replace(/\D/g, '')

  async function sendCode() {
    const found = {}
    if (!EMAIL_PATTERN.test(email.trim())) found.email = 'Enter a valid email address.'
    if (!PHONE_PATTERN.test(digits)) found.phone = 'Enter a 10 digit mobile number.'
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length > 0) return
    setLoading(true)
    try {
      const sent = await onRequestOtp(digits.slice(-10), email.trim())
      setSentTo(sent.sentTo ?? email.trim())
      // Development only, when the server has no email provider: it returns the code so login can be tried.
      if (__DEV__ && sent.devOtp) setOtp(sent.devOtp)
      setStep('code')
    } catch (error) {
      setFormError(error?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function confirmCode() {
    const found = {}
    if (!/^\d{6}$/.test(otp)) found.otp = 'Enter the 6 digit code.'
    if (needsName && !NAME_PATTERN.test(name.trim())) found.name = 'Enter your name (letters only).'
    setErrors(found)
    setFormError('')
    if (Object.keys(found).length > 0) return
    setLoading(true)
    try {
      const result = await onVerifyOtp({ phone: digits.slice(-10), otp, name: needsName ? name.trim() : undefined })
      if (result?.needsName) setNeedsName(true) // new customer: the code was right, now we need a name
    } catch (error) {
      setFormError(error?.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  function back() {
    setStep('details')
    setNeedsName(false)
    setOtp('')
    setErrors({})
    setFormError('')
  }

  return (
    <View>
      <Text style={styles.subtitle}>
        {step === 'details' ? 'Enter your email and mobile number. New here? We will create your account after you confirm the code we email you.' : `Enter the 6 digit code sent to ${sentTo}.`}
      </Text>

      <ErrorBanner message={formError} />

      {step === 'details' ? (
        <>
          <TextField
            label="Email"
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            error={errors.email}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => phoneRef.current?.focus()}
          />
          <TextField
            ref={phoneRef}
            label="Mobile number"
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
            placeholder="10 digit mobile number"
            keyboardType="phone-pad"
            autoComplete="tel"
            maxLength={14}
            returnKeyType="go"
            onSubmitEditing={sendCode}
          />
          <Button title="Send code" icon="paper-plane-outline" onPress={sendCode} loading={loading} />
        </>
      ) : (
        <>
          <TextField
            label="Code"
            icon="keypad-outline"
            value={otp}
            onChangeText={(v) => setOtp(v.replace(/\D/g, '').slice(0, 6))}
            error={errors.otp}
            placeholder="6 digit code"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            maxLength={6}
            editable={!needsName}
            returnKeyType="go"
            onSubmitEditing={confirmCode}
          />
          {needsName ? (
            <TextField label="Your name" icon="person-outline" value={name} onChangeText={setName} error={errors.name} placeholder="Full name" autoCapitalize="words" autoComplete="name" returnKeyType="go" onSubmitEditing={confirmCode} />
          ) : null}
          <Button title={needsName ? 'Create account' : 'Verify'} onPress={confirmCode} loading={loading} />
          <View style={styles.links}>
            <Pressable onPress={back} accessibilityRole="button" style={styles.link}>
              <Text style={styles.linkText}>Change email or number</Text>
            </Pressable>
            {!needsName ? (
              <Pressable onPress={sendCode} disabled={loading} accessibilityRole="button" style={styles.link}>
                <Text style={styles.linkText}>Resend code</Text>
              </Pressable>
            ) : null}
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  subtitle: { marginBottom: 16, fontSize: 14, color: COLORS.muted },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  link: { minHeight: 44, justifyContent: 'center' },
  linkText: { color: COLORS.brown, fontSize: 14, fontWeight: '600' },
})
