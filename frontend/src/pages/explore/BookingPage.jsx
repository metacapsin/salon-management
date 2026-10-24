import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Box, Button, Paper, Typography } from '@mui/material'
import { getSalonDetail } from '../../api/publicApi'
import { useCustomer } from '../../customer/CustomerAuthContext'
import QueryState from '../../components/QueryState'
import BookingForm from '../../features/explore/BookingForm'
import SalonCover from '../../features/explore/SalonCover'
import SalonMap from '../../features/explore/SalonMap'
import { formatMoney } from '../../utils/formatMoney'
import Logo from '../landing/Logo'
import '../../styles/landing.css'
import '../../styles/explore.css'

function Booked({ booking }) {
  const when = new Date(`${booking.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <Paper variant="outlined" sx={{ p: { xs: 3, md: 5 }, textAlign: 'center', display: 'grid', gap: 1.5, justifyItems: 'center' }}>
      <Typography sx={{ fontSize: '3.5rem' }} aria-hidden>
        🎉
      </Typography>
      <Typography variant="h5" component="h1" sx={{ fontWeight: 800 }}>
        Appointment requested
      </Typography>
      <Typography>
        {booking.salonName}
        <br />
        <strong>
          {when} at {booking.startTime}
        </strong>
      </Typography>
      {booking.offer && (
        <Typography sx={{ px: 2, py: 1, borderRadius: 2, bgcolor: '#fff8e6', border: '1px dashed #c9a24a', fontWeight: 600 }}>
          🏷️ Offer applied: {booking.offer.title}. You saved {formatMoney(booking.offer.discount)} (was {formatMoney(booking.subtotal)}).
        </Typography>
      )}
      <Typography color="text.secondary">Total {formatMoney(booking.total)}, pay at the salon. The salon will call you to confirm.</Typography>
      <Button component={Link} to="/explore" variant="contained" sx={{ '&&': { color: '#fff' } }}>
        Back to salons
      </Button>
    </Paper>
  )
}

// Appointment book karne ka alag page (/book/:salonId): left me form, right me salon aur uska map.
export default function BookingPage() {
  const { salonId } = useParams()
  const { customer, logout } = useCustomer()
  const navigate = useNavigate()
  const [booking, setBooking] = useState(null)
  // Naya page hamesha upar se dikhe (Explore ki scroll position yahan na aaye)
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  const query = useQuery({ queryKey: ['public', 'salon', salonId], queryFn: () => getSalonDetail(salonId) })
  const salon = query.data
  // Pichla page (Explore, filters ke saath) hota to wahin wapas, nahi to Explore
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate('/explore'))

  return (
    <div className="lp ex">
      <header className="ex-header">
        <div className="lp-container ex-header__inner">
          <Link to="/" aria-label="Glamora home">
            <Logo />
          </Link>
          <div className="ex-header__user">
            <Link to="/explore" style={{ color: '#fff', textDecoration: 'none' }}>
              All salons
            </Link>
            <span>{customer.name}</span>
            <button type="button" className="ex-header__logout" onClick={logout}>
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Title wali patti: header ke neeche ek jagah tiki rehti hai, form scroll karne par ye nahi hilti */}
      {salon && !booking && (
        <div className="ex-titlebar">
          <div className="lp-container ex-titlebar__inner">
            <Button onClick={goBack} size="small" sx={{ textTransform: 'none', color: 'var(--lp-brown)' }}>
              ← Back
            </Button>
            <h1 className="ex-titlebar__title">Book an appointment</h1>
          </div>
        </div>
      )}

      <main className="lp-container ex-main">
        <QueryState query={query} empty={<Alert severity="info">This salon is not available.</Alert>}>
          {salon && booking && <Booked booking={booking} />}
          {salon && !booking && (
            <>
              <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '1fr 360px' }, alignItems: 'start' }}>
                <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 3, order: { xs: 2, md: 1 } }}>
                  <BookingForm salon={salon} onBooked={setBooking} />
                </Paper>

                <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', position: { md: 'sticky' }, top: { md: 150 }, order: { xs: 1, md: 2 } }}>
                  <SalonCover salon={salon} sx={{ height: 190 }} />
                  <Box sx={{ p: 2, display: 'grid', gap: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Owner: <strong>{salon.owner.name}</strong>
                      {salon.owner.phone && <> · {salon.owner.phone}</>}
                    </Typography>
                    <SalonMap name={salon.name} address={salon.address} location={salon.location} height={160} />
                  </Box>
                </Paper>
              </Box>
            </>
          )}
        </QueryState>
      </main>
    </div>
  )
}
