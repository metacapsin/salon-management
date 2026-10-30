import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { confirmPasswordReset, requestPasswordReset } from '../api/authApi'
import { fieldErrorsOf, friendlyError } from '../api/client'
import { AuthField, AuthPasswordField, FormAlert } from '../components/AuthField'
import AuthLayout from '../layout/AuthLayout'
import { applyServerFieldErrors, forgotSchema, resetSchema } from '../utils/formSchemas'

// Do step ek hi page par: (1) email dalo -> email par 6 digit OTP aata he, (2) OTP + naya password dalo.
export default function ForgotPasswordPage() {
  const [step, setStep] = useState('email') // 'email' | 'otp' | 'done'
  const [sentTo, setSentTo] = useState('')
  const [formError, setFormError] = useState('')
  const [info, setInfo] = useState('')

  const emailForm = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })
  const resetForm = useForm({ resolver: zodResolver(resetSchema), defaultValues: { otp: '', password: '' } })

  async function sendCode({ email }) {
    setFormError('')
    setInfo('')
    try {
      await requestPasswordReset(email)
      setSentTo(email)
      setStep('otp')
    } catch (error) {
      setFormError(friendlyError(error))
    }
  }

  async function resend() {
    setFormError('')
    setInfo('')
    try {
      await requestPasswordReset(sentTo)
      setInfo('A new code is on its way. If you just asked for one, wait 30 seconds first.')
    } catch (error) {
      setFormError(friendlyError(error))
    }
  }

  async function changePassword({ otp, password }) {
    setFormError('')
    setInfo('')
    try {
      await confirmPasswordReset({ email: sentTo, otp, password })
      setStep('done')
    } catch (error) {
      applyServerFieldErrors(fieldErrorsOf(error), resetForm.setError)
      setFormError(friendlyError(error))
    }
  }

  if (step === 'done') {
    return (
      <AuthLayout title="Password changed" footer={<Link to="/login">Back to sign in</Link>}>
        <FormAlert tone="ok">Your password is changed. Sign in with the new password.</FormAlert>
      </AuthLayout>
    )
  }

  if (step === 'otp') {
    const { register, handleSubmit, formState } = resetForm
    return (
      <AuthLayout title="Enter the code" subtitle={`We sent a 6 digit code to ${sentTo}. It works for 10 minutes.`} footer={<Link to="/login">Back to sign in</Link>}>
        <form className="login-form" onSubmit={handleSubmit(changePassword)} noValidate>
          <FormAlert>{formError}</FormAlert>
          <FormAlert tone="ok">{info}</FormAlert>
          <AuthField label="6 digit code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} error={formState.errors.otp?.message} {...register('otp')} />
          <AuthPasswordField label="New password" autoComplete="new-password" hint="At least 12 characters." error={formState.errors.password?.message} {...register('password')} />
          <button type="submit" className="login-form__submit" disabled={formState.isSubmitting} aria-busy={formState.isSubmitting}>
            {formState.isSubmitting ? 'Saving…' : 'Change password'}
          </button>
          <button type="button" className="field__toggle" onClick={resend} style={{ alignSelf: 'center', marginTop: 8 }}>
            Send the code again
          </button>
        </form>
      </AuthLayout>
    )
  }

  const { register, handleSubmit, formState } = emailForm
  return (
    <AuthLayout title="Reset password" subtitle="We will email you a 6 digit code." footer={<Link to="/login">Back to sign in</Link>}>
      <form className="login-form" onSubmit={handleSubmit(sendCode)} noValidate>
        <FormAlert>{formError}</FormAlert>
        <AuthField label="Email" type="email" autoComplete="username" inputMode="email" error={formState.errors.email?.message} {...register('email')} />
        <button type="submit" className="login-form__submit" disabled={formState.isSubmitting} aria-busy={formState.isSubmitting}>
          {formState.isSubmitting ? 'Sending…' : 'Send code'}
        </button>
      </form>
    </AuthLayout>
  )
}
