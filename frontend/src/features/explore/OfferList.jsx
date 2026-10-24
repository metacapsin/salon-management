import { Box, Typography } from '@mui/material'
import { formatMoney } from '../../utils/formatMoney'

// Server ke pricing.js jaisa hisaab (sirf dikhane ke liye; asli discount server lagata hai)
export function discountFor(offer, services) {
  const eligible = services.filter((s) => offer.serviceIds.length === 0 || offer.serviceIds.includes(s.id))
  const base = eligible.reduce((sum, s) => sum + s.price, 0)
  const raw = offer.discountType === 'percent' ? Math.floor((base * offer.discountValue) / 100) : offer.discountValue
  return base === 0 ? 0 : Math.min(raw, base)
}

const bigText = (o) => (o.discountType === 'percent' ? `${o.discountValue}%` : formatMoney(o.discountValue))

// "Haircut, Facial par" ya "Saari services par"
function appliesTo(offer, services) {
  if (offer.serviceIds.length === 0) return 'Valid on all services'
  const names = services.filter((s) => offer.serviceIds.includes(s.id)).map((s) => s.name)
  return `Valid on ${names.length ? names.join(', ') : 'selected services'}`
}

const dayText = (day) => new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

// Coupon jaisa ticket: baayein bada "20% OFF", daayein offer ka naam, kis service par, kab se kab tak.
export default function OfferList({ offers, services }) {
  if (!offers?.length) return null
  return (
    <Box>
      <Typography variant="overline" color="text.secondary">
        Offers
      </Typography>
      {offers.map((o) => (
        <Box key={o.id} sx={{ mt: 0.75, display: 'flex', borderRadius: 2.5, overflow: 'hidden', border: '1px solid #e3cf9b', bgcolor: '#fffaf0', boxShadow: '0 2px 8px rgba(169,127,42,.15)' }}>
          <Box sx={{ minWidth: 92, px: 1.5, py: 1.5, display: 'grid', placeItems: 'center', textAlign: 'center', color: '#fff', background: 'linear-gradient(135deg, #c9a24a, #8b5e3c)', borderRight: '2px dashed #fffaf0' }}>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: '1.4rem', lineHeight: 1 }}>{bigText(o)}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.1em' }}>OFF</Typography>
            </Box>
          </Box>
          <Box sx={{ p: 1.5, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, color: '#5c3b22' }}>{o.title}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {appliesTo(o, services)}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              📅 {dayText(o.startsOn)} to {dayText(o.endsOn)}
              {o.oncePerCustomer ? ' · once per customer' : ''}
            </Typography>
            {o.description && (
              <Typography variant="caption" display="block">
                {o.description}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Box>
  )
}
