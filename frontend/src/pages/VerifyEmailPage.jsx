import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { verifyEmail } from '../api/authApi'
import { friendlyError } from '../api/client'
import { FormAlert } from '../components/AuthField'
import AuthLayout from '../layout/AuthLayout'

// Email wala link yahan khulta hai. Token ek baar ka hai, isliye request sirf ek baar bhejte hain
// (React StrictMode development me effect do baar chalata hai, ref isse rokta hai).
export default function VerifyEmailPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const started = useRef(false)
  const [state, setState] = useState(token ? { phase: 'working' } : { phase: 'error', message: 'This link is incomplete. Open the link from your email again.' })

  useEffect(() => {
    if (!token || started.current) return
    started.current = true
    verifyEmail(token)
      .then(() => setState({ phase: 'done' }))
      .catch((error) => setState({ phase: 'error', message: friendlyError(error) }))
  }, [token])

  return (
    <AuthLayout title="Verify email" footer={<Link to="/login">Go to sign in</Link>}>
      {state.phase === 'working' && <p role="status">Verifying your email…</p>}
      {state.phase === 'done' && <FormAlert tone="ok">Your email is verified. You can sign in now.</FormAlert>}
      {state.phase === 'error' && (
        <FormAlert>
          {state.message} Links expire after 24 hours. To get a new one, <Link to="/register">register again</Link> with the same email.
        </FormAlert>
      )}
    </AuthLayout>
  )
}
