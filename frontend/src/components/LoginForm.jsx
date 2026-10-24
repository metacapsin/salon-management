import { useRef, useState } from 'react'
import { ApiError, login } from '../api/authApi'
import { normalizeEmail, validateLogin } from '../utils/validators'

// Server ki galti ko insaan ke samajhne layak message me badalta hai.
// Dhyan: 401 par hum ye NAHI batate ki email galat hai ya password. Dono ke liye ek hi message
// (SRS FR-AUTH-03), taaki koi andaza na laga sake ki kaun si email registered hai.
function getLoginErrorMessage(error) {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.'
  if (error.status === 0) return 'Could not reach the server. Check your internet connection and try again.'
  if (error.status === 401) return 'Incorrect email or password.'
  if (error.status === 403 && error.code === 'EMAIL_NOT_VERIFIED') return 'Please verify your email first. Check your inbox for the link.'
  if (error.status === 403 && error.code === 'ACCOUNT_PENDING_APPROVAL') return 'Your account is waiting for approval. We will email you once it is approved.'
  if (error.status === 403 && error.code === 'ACCOUNT_REJECTED') return 'Your account request was not approved. Please contact support.'
  if (error.status === 429) return 'Too many attempts. Please wait a few minutes and try again.'
  if (error.status >= 500) return 'The server is not responding right now. Please try again in a little while.'
  return 'Could not sign in. Please check your details and try again.'
}

// Props: onSuccess -> login theek hone par parent (App) ko data dene wala function.
function LoginForm({ onSuccess }) {
  // State = wo cheez jo badalti hai aur badalte hi React screen dobara banata hai.
  // useState(initial) hume [abhiKiValue, valueBadalneWalaFunction] deta hai.
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({}) // har field ki apni galti
  const [formError, setFormError] = useState('') // server se aayi galti
  const [isSubmitting, setIsSubmitting] = useState(false)

  // ref = kisi input tak seedha pahunchne ka rasta. Hum galat field par cursor le jaane ke liye use karte hain.
  const emailRef = useRef(null)
  const passwordRef = useRef(null)

  async function handleSubmit(event) {
    // Browser ka default (page reload karke form bhejna) rok do. Hum khud sambhalenge.
    event.preventDefault()
    if (isSubmitting) return // double-click par do baar request na jaye

    const errors = validateLogin({ email, password })
    setFieldErrors(errors)
    setFormError('')

    if (errors.email) {
      emailRef.current.focus()
      return
    }
    if (errors.password) {
      passwordRef.current.focus()
      return
    }

    setIsSubmitting(true)
    try {
      const data = await login({ email: normalizeEmail(email), password })
      onSuccess(data)
    } catch (error) {
      // Email aur password wahi rehte hain jo user ne likhe the (dobara type na karna pade).
      setFormError(getLoginErrorMessage(error))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    // noValidate: browser ke apne pop-up messages band, hamare apne (zyada saaf) messages dikhenge.
    <form className="login-form" onSubmit={handleSubmit} noValidate>
      {/* role="alert": screen-reader isse turant bol deta hai. Likha hua text hai, sirf rang nahi (SRS UX-01). */}
      {formError && (
        <div className="login-form__alert" role="alert">
          <strong>Sign-in failed.</strong> {formError}
        </div>
      )}

      <div className="field">
        <label htmlFor="login-email">Email</label>
        <input
          ref={emailRef}
          id="login-email"
          type="email"
          name="email"
          autoComplete="username"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
        />
        {fieldErrors.email && (
          <p id="login-email-error" className="field__error">
            {fieldErrors.email}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor="login-password">Password</label>
        <div className="field__password">
          <input
            ref={passwordRef}
            id="login-password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={fieldErrors.password ? 'login-password-error' : undefined}
          />
          {/* type="button": warna ye form submit kar deta. aria-pressed: screen-reader ko on/off batata hai. */}
          <button
            type="button"
            className="field__toggle"
            onClick={() => setShowPassword(!showPassword)}
            aria-pressed={showPassword}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
        </div>
        {fieldErrors.password && (
          <p id="login-password-error" className="field__error">
            {fieldErrors.password}
          </p>
        )}
      </div>

      <button type="submit" className="login-form__submit" disabled={isSubmitting} aria-busy={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}

export default LoginForm
