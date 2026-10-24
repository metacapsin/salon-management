import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import LoginForm from '../components/LoginForm'
import AuthLayout from '../layout/AuthLayout'

// Login ke baad user ko wahin bhejte hain jahan wo jaana chahta tha (warna dashboard).
function LoginPage() {
  const { status, user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // Super Admin ko seedha /admin, baaki sab ko dashboard
  const home = (u) => (u?.platformRole === 'admin' ? '/admin' : '/dashboard')
  const from = location.state?.from?.pathname ?? home(user)

  if (status === 'authenticated') return <Navigate to={from} replace />

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Enter your details to continue."
      footer={
        <>
          <Link to="/forgot-password">Forgot password?</Link>
          <Link to="/register">Create an owner account</Link>
        </>
      }
    >
      <LoginForm
        onSuccess={(data) => {
          login(data)
          navigate(location.state?.from?.pathname ?? home(data.user), { replace: true })
        }}
      />
    </AuthLayout>
  )
}

export default LoginPage
