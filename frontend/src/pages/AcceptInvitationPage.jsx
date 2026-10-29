import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { acceptInvitation } from '../api/authApi'
import { fieldErrorsOf, friendlyError } from '../api/client'
import { AuthField, AuthPasswordField, FormAlert } from '../components/AuthField'
import AuthLayout from '../layout/AuthLayout'
import { acceptSchema, applyServerFieldErrors } from '../utils/formSchemas'

// Owner ne team member ko invite kiya. Naya user: naam + naya password. Pehle se account ho: bas apna password.
export default function AcceptInvitationPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [done, setDone] = useState(null)
  const [formError, setFormError] = useState('')
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(acceptSchema), defaultValues: { name: '', password: '' } })

  async function onSubmit({ name, password }) {
    setFormError('')
    try {
      const data = await acceptInvitation({ token, name: name || undefined, password })
      setDone(data)
    } catch (error) {
      applyServerFieldErrors(fieldErrorsOf(error), setError)
      setFormError(error?.code === 'INVALID_TOKEN' ? 'This invitation is invalid or has expired. Ask the owner to send a new one.' : friendlyError(error))
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Join a salon" footer={<Link to="/login">Go to sign in</Link>}>
        <FormAlert>This link is incomplete. Open the link from your invitation email again.</FormAlert>
      </AuthLayout>
    )
  }

  if (done) {
    return (
      <AuthLayout title="Welcome aboard" footer={<Link to="/login">Go to sign in</Link>}>
        <FormAlert tone="ok">You have joined {done.salonName}. Sign in to continue.</FormAlert>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Join a salon" subtitle="Accept your invitation to start working on Galora." footer={<Link to="/login">Go to sign in</Link>}>
      <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <FormAlert>{formError}</FormAlert>
        <AuthField label="Your name" autoComplete="name" hint="New to Galora? Enter your name. Already have an account? Leave it empty." error={errors.name?.message} {...register('name')} />
        <AuthPasswordField label="Password" autoComplete="new-password" hint="New account: choose at least 12 characters. Existing account: enter your current password." error={errors.password?.message} {...register('password')} />
        <button type="submit" className="login-form__submit" disabled={isSubmitting} aria-busy={isSubmitting}>
          {isSubmitting ? 'Joining…' : 'Accept invitation'}
        </button>
      </form>
    </AuthLayout>
  )
}
