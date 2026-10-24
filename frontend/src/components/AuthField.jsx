import { useId, useState } from 'react'

// Login page jaisa hi dikhne wala input (login.css ki .field classes). react-hook-form ke register() ke saath chalta hai:
//   <AuthField label="Email" error={errors.email?.message} {...register('email')} />
// React 19 me ref seedha prop ki tarah aata hai.
export function AuthField({ label, error, hint, ref, ...inputProps }) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} ref={ref} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...inputProps} />
      {hint && !error && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  )
}

export function AuthPasswordField({ label, error, hint, ref, ...inputProps }) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const [show, setShow] = useState(false)
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="field__password">
        <input id={id} ref={ref} type={show ? 'text' : 'password'} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...inputProps} />
        <button type="button" className="field__toggle" onClick={() => setShow(!show)} aria-pressed={show}>
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
      {hint && !error && (
        <p id={hintId} className="field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="field__error">
          {error}
        </p>
      )}
    </div>
  )
}

export function FormAlert({ children, tone = 'error' }) {
  if (!children) return null
  return (
    <div className={tone === 'error' ? 'login-form__alert' : 'login-form__alert login-form__alert--ok'} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}
