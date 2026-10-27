import { useEffect, useState } from 'react'
import { Alert, Box, Button, TextField, Typography } from '@mui/material'
import { ApiError, fieldErrorsOf, friendlyError } from '../../api/client'
import { requestOtp, verifyOtp } from '../../api/customerApi'
import { useCustomer } from '../../customer/CustomerAuthContext'

const PHONE = /^(91)?[6-9]\d{9}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const NAME = /^\p{L}[\p{L} .'-]*$/u
const onlyDigits = (v, max) => v.replace(/\D/g, '').slice(0, max)
const onlyNameChars = (v) => v.replace(/[^\p{L} .'-]/gu, '').replace(/^[^\p{L}]+/u, '').slice(0, 60)
// Galat akshar key dabate hi rok do (paste ke liye onChange me bhi safai hoti hai)
const blockKey = (allowed) => (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return
  if (!allowed.test(e.key)) e.preventDefault()
}
const blockNonDigits = blockKey(/\d/)
const blockNonNameChars = blockKey(/[\p{L} .'-]/u)

// Customer login ka form: mobile number -> OTP -> (naya ho to) naam. Page par bhi aur popup me bhi yahi chalta hai.
export default function CustomerLoginForm({ onDone, intro }) {
  const { signedIn } = useCustomer()
  const [step, setStep] = useState('phone') // phone | otp | name
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState('') // masked email jahan code gaya
  const [otp, setOtp] = useState('')
  const [name, setName] = useState('')
  const [devOtp, setDevOtp] = useState('')
  const [secondsLeft, setSecondsLeft] = useState(0)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  // "Dobara bhejo" ka ginti-ulti
  useEffect(() => {
    if (secondsLeft <= 0) return undefined
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  const shownPhone = phone.slice(-10).replace(/(\d{5})(\d{5})/, '$1 $2')

  function fail(error) {
    setErrors(fieldErrorsOf(error))
    setFormError(friendlyError(error))
    if (error instanceof ApiError && error.code === 'OTP_COOLDOWN') setSecondsLeft(error.details?.retryAfterSec ?? 30)
  }

  async function sendCode(event) {
    event?.preventDefault()
    setErrors({})
    setFormError('')
    if (!PHONE.test(phone)) {
      setErrors({ phone: 'Enter a 10 digit mobile number (or 12 digits with 91).' })
      return
    }
    if (!EMAIL.test(email.trim())) {
      setErrors({ email: 'Enter a valid email address. We will send the code there.' })
      return
    }
    setBusy(true)
    try {
      const result = await requestOtp(phone, email.trim())
      setSentTo(result.sentTo ?? '')
      setDevOtp(result.devOtp ?? '')
      setSecondsLeft(result.resendAfterSec)
      setOtp('')
      setStep('otp')
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  async function submitCode(event) {
    event.preventDefault()
    setErrors({})
    setFormError('')
    if (!/^\d{6}$/.test(otp)) {
      setErrors({ otp: 'Enter the 6 digit code.' })
      return
    }
    if (step === 'name' && (name.trim().length < 2 || !NAME.test(name.trim()))) {
      setErrors({ name: 'Enter your name using letters only.' })
      return
    }
    setBusy(true)
    try {
      const result = await verifyOtp({ phone, otp, ...(step === 'name' ? { name: name.trim() } : {}) })
      if (result.needsName) {
        setStep('name')
        return
      }
      signedIn(result.customer)
      onDone?.(result.customer)
    } catch (error) {
      fail(error)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Typography variant="h4" component="h1" sx={{ fontFamily: 'var(--lp-heading)', fontWeight: 700, color: 'var(--lp-espresso)' }}>
        {step === 'phone' ? 'Log in to Glamora' : step === 'otp' ? 'Enter the code' : 'One last thing'}
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5, mb: 3 }}>
        {step === 'phone' && (intro ?? 'Log in with your mobile number to find and book salons near you.')}
        {step === 'otp' && (sentTo ? `We emailed a 6 digit code to ${sentTo}. Check your inbox (and spam).` : `We sent a 6 digit code to +91 ${shownPhone}.`)}
        {step === 'name' && 'Welcome! Tell us your name so the salon knows who is coming.'}
      </Typography>

      {formError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {formError}
        </Alert>
      )}

      {step === 'phone' && (
        <Box component="form" onSubmit={sendCode} noValidate sx={{ display: 'grid', gap: 2 }}>
          <TextField
            label="Mobile number"
            type="tel"
            autoFocus
            value={phone}
            onChange={(e) => setPhone(onlyDigits(e.target.value, 12))}
            onKeyDown={blockNonDigits}
            error={Boolean(errors.phone)}
            helperText={errors.phone ?? '10 digits (or 12 with 91).'}
            autoComplete="tel-national"
            slotProps={{ htmlInput: { inputMode: 'numeric' } }}
          />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value.trim().slice(0, 254))}
            error={Boolean(errors.email)}
            helperText={errors.email ?? 'We will email you a one time code.'}
            autoComplete="email"
          />
          <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ py: 1.3, textTransform: 'none', fontWeight: 700 }}>
            {busy ? 'Sending…' : 'Send OTP'}
          </Button>
        </Box>
      )}

      {step !== 'phone' && (
        <Box component="form" onSubmit={submitCode} noValidate sx={{ display: 'grid', gap: 2 }}>
          {devOtp && (
            <Alert severity="info" action={<Button color="inherit" size="small" onClick={() => setOtp(devOtp)}>Use it</Button>}>
              Development mode: email/SMS is not connected yet. Your code is <strong>{devOtp}</strong>.
            </Alert>
          )}
          <TextField
            label="6 digit code"
            autoFocus
            value={otp}
            onChange={(e) => setOtp(onlyDigits(e.target.value, 6))}
            onKeyDown={blockNonDigits}
            error={Boolean(errors.otp)}
            helperText={errors.otp}
            autoComplete="one-time-code"
            slotProps={{ htmlInput: { inputMode: 'numeric', style: { letterSpacing: '0.4em', fontSize: '1.25rem' } } }}
          />
          {step === 'name' && (
            <TextField
              label="Your name"
              value={name}
              onChange={(e) => setName(onlyNameChars(e.target.value))}
              onKeyDown={blockNonNameChars}
              error={Boolean(errors.name)}
              helperText={errors.name ?? 'Letters only.'}
              autoComplete="name"
            />
          )}
          <Button type="submit" variant="contained" size="large" disabled={busy} sx={{ py: 1.3, textTransform: 'none', fontWeight: 700 }}>
            {busy ? 'Checking…' : step === 'name' ? 'Continue' : 'Verify and continue'}
          </Button>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button size="small" onClick={() => { setStep('phone'); setFormError(''); setErrors({}); setDevOtp('') }} sx={{ textTransform: 'none' }}>
              Change number or email
            </Button>
            <Button size="small" onClick={sendCode} disabled={busy || secondsLeft > 0} sx={{ textTransform: 'none' }}>
              {secondsLeft > 0 ? `Resend code in ${secondsLeft}s` : 'Resend code'}
            </Button>
          </Box>
        </Box>
      )}
    </>
  )
}
