import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { registerOwner } from '../api/authApi'
import { fieldErrorsOf, friendlyError } from '../api/client'
import { AuthField, AuthPasswordField, FormAlert } from '../components/AuthField'
import AuthLayout from '../layout/AuthLayout'
import { applyServerFieldErrors, registerSchema } from '../utils/formSchemas'

// Salon owner apna account banata hai. Super Admin approve kare, phir email verify ho, tabhi login ho sakta hai.
export default function RegisterPage() {
  const [sentTo, setSentTo] = useState('')
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema), defaultValues: { name: '', email: '', password: '' } })

  async function onSubmit(values) {
    setFormError('')
    try {
      await registerOwner(values)
      setSentTo(values.email.trim().toLowerCase())
    } catch (error) {
      applyServerFieldErrors(fieldErrorsOf(error), setError)
      setFormError(friendlyError(error))
    }
  }

  if (sentTo) {
    return (
      <AuthLayout title="Request received" footer={<Link to="/login">Back to sign in</Link>}>
        <FormAlert tone="ok">
          Thank you! Our team will review your request. Once it is approved, we will email <strong>{sentTo}</strong>, and you can sign in with the email and password you just set.
        </FormAlert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create owner account"
      subtitle="Set up your salon on Galora."
      footer={<Link to="/login">Already have an account? Sign in</Link>}
    >
      <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormAlert>{formError}</FormAlert>
        <AuthField label="Your name" autoComplete="name" error={errors.name?.message} {...register('name')} />
        <AuthField label="Email" type="email" autoComplete="username" inputMode="email" placeholder="you@example.com" error={errors.email?.message} {...register('email')} />
        <AuthPasswordField label="Password" autoComplete="new-password" hint="At least 12 characters. A password manager is welcome." error={errors.password?.message} {...register('password')} />
        <button type="submit" className="login-form__submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? 'Sending request…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  )
}
