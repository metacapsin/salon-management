import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Paper } from '@mui/material'
import { useCustomer } from '../../customer/CustomerAuthContext'
import CustomerLoginForm from '../../features/explore/CustomerLoginForm'
import Logo from '../landing/Logo'
import '../../styles/landing.css'
import '../../styles/explore.css'

// Customer login page (seedha /customer-login kholne par, ya booking page se login chahiye hone par).
// Salon dekhte waqt login ka popup alag se aata hai (LoginDialog), ye page uske bina bhi kaam karta hai.
export default function CustomerLoginPage() {
  const { status } = useCustomer()
  const navigate = useNavigate()
  const location = useLocation()
  const goTo = location.state?.from?.pathname ? `${location.state.from.pathname}${location.state.from.search ?? ''}` : '/#find-salon'

  if (status === 'authenticated') return <Navigate to={goTo} replace />

  return (
    <div className="lp ex ex-login">
      <header className="ex-header">
        <div className="lp-container ex-header__inner">
          <Link to="/" aria-label="Galora home">
            <Logo />
          </Link>
        </div>
      </header>

      <main className="ex-login__main">
        <Paper variant="outlined" sx={{ width: '100%', maxWidth: 440, p: { xs: 3, sm: 4 }, borderRadius: 4 }}>
          <CustomerLoginForm onDone={() => navigate(goTo, { replace: true })} />
        </Paper>
      </main>
    </div>
  )
}
