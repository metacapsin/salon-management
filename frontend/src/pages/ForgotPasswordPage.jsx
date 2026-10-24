import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { requestPasswordReset } from '../api/authApi'
import { friendlyError } from '../api/client'
import { AuthField, FormAlert } from '../components/AuthField'
import AuthLayout from '../layout/AuthLayout'
import { forgotSchema } from '../utils/formSchemas'

export default function ForgotPasswordPage() {
  const [done, setDone] = useState(false)
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(forgotSchema), defaultValues: { email: '' } })

  async function onSubmit({ email }) {
    setFormError('')
    try {
      await requestPasswordReset(email)
      setDone(true)
    } catch (error) {
      setFormError(friendlyError(error))
    }
  }

  return (
    <AuthLayout title="Reset password" subtitle="We will email you a link that works once for 30 minutes." footer={<Link to="/login">Back to sign in</Link>}>
      {done ? (
        <FormAlert tone="ok">If that email is registered, we have sent a reset link. Check your inbox.</FormAlert>
      ) : (
        <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
          <FormAlert>{formError}</FormAlert>
          <AuthField label="Email" type="email" autoComplete="username" inputMode="email" error={errors.email?.message} {...register('email')} />
          <button type="submit" className="login-form__submit" disabled={isSubmitting} aria-busy={isSubmitting}>
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthLayout>
  )
}
