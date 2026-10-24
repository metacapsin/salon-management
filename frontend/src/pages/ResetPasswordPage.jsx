import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { confirmPasswordReset } from '../api/authApi'
import { fieldErrorsOf, friendlyError } from '../api/client'
import { AuthPasswordField, FormAlert } from '../components/AuthField'
import AuthLayout from '../layout/AuthLayout'
import { applyServerFieldErrors, resetSchema } from '../utils/formSchemas'

export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(resetSchema), defaultValues: { password: '' } })

  async function onSubmit({ password }) {
    setFormError('')
    try {
      await confirmPasswordReset({ token, password })
      setDone(true)
    } catch (error) {
      applyServerFieldErrors(fieldErrorsOf(error), setError)
      setFormError(error?.code === 'INVALID_TOKEN' ? 'This link is invalid or has expired. Request a new one.' : friendlyError(error))
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Choose a new password" footer={<Link to="/forgot-password">Request a new link</Link>}>
        <FormAlert>This link is incomplete. Open the link from your email again.</FormAlert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Choose a new password" footer={<Link to="/login">Back to sign in</Link>}>
      {done ? (
        <FormAlert tone="ok">Your password is changed. Sign in with the new password.</FormAlert>
      ) : (
        <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormAlert>{formError}</FormAlert>
          <AuthPasswordField label="New password" autoComplete="new-password" hint="At least 12 characters." error={errors.password?.message} {...register('password')} />
          <button type="submit" className="login-form__submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Change password'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
