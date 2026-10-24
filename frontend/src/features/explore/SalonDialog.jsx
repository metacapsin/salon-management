import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Box, Button, Chip, Dialog, IconButton, Link, Typography, useMediaQuery } from '@mui/material'
import { getSalonDetail, recordSalonView } from '../../api/publicApi'
import QueryState from '../../components/QueryState'
import { formatMoney } from '../../utils/formatMoney'
import OfferList from './OfferList'
import SalonCover from './SalonCover'
import SalonMap from './SalonMap'

// Beech wale hisse ka upar wala bhaag: owner ka naam aur phone. Ye scroll nahi hota (jagah par tika rehta hai).
function Header({ detail }) {
  const phoneDigits = detail.owner.phone.replace(/[^\d+]/g, '')
  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 3, bgcolor: '#faf6f1', border: '1px solid #eadfd3' }}>
        <Avatar sx={{ bgcolor: '#c9a24a', width: 52, height: 52, fontWeight: 700 }}>{(detail.owner.name || 'O').charAt(0)}</Avatar>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.2 }}>
            Salon owner
          </Typography>
          <Typography sx={{ fontWeight: 700 }}>{detail.owner.name || 'Not added'}</Typography>
          {detail.owner.phone ? (
            <Link href={`tel:${phoneDigits}`} underline="hover" sx={{ fontWeight: 600 }}>
              📞 {detail.owner.phone}
            </Link>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Phone number not added
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}

// Beech wale hisse ka neeche wala bhaag: salon ke baare me aur services ke rate (category ke hisaab se). Sirf ye scroll hota hai.
function Services({ detail }) {
  const groups = {}
  for (const s of detail.services) (groups[s.category] ??= []).push(s)

  return (
    <Box sx={{ display: 'grid', gap: 3 }}>
      {detail.about && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            About
          </Typography>
          <Typography variant="body2">{detail.about}</Typography>
        </Box>
      )}

      <OfferList offers={detail.offers} services={detail.services} />

      <Box>
        <Typography variant="overline" color="text.secondary">
          Services and charges
        </Typography>
        {detail.services.length === 0 ? (
          <Typography color="text.secondary">This salon has not added its price list yet. Please call to ask.</Typography>
        ) : (
          Object.entries(groups).map(([category, items]) => (
            <Box key={category} sx={{ mt: 1.5 }}>
              <Typography variant="subtitle2" sx={{ color: '#a97f2a', mb: 0.75, display: 'flex', alignItems: 'center', gap: 1, '&::after': { content: '""', flex: 1, height: '1px', bgcolor: '#eadfd3' } }}>
                {category}
              </Typography>
              {items.map((s) => (
                <Box key={s.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, px: 1.5, py: 1.25, mb: 0.75, borderRadius: 2, border: '1px solid #f0e6da', transition: 'background-color .15s, border-color .15s', '&:hover': { bgcolor: '#faf6f1', borderColor: '#e3d3bd' } }}>
                  <Box>
                    <Typography sx={{ fontWeight: 600 }}>{s.name}</Typography>
                    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Typography variant="caption" color="text.secondary">
                        {s.durationMin} min
                      </Typography>
                      {s.atSalon && <Chip size="small" label="At salon" />}
                      {s.atHome && <Chip size="small" color="secondary" label="Home" />}
                    </Box>
                  </Box>
                  <Typography sx={{ fontWeight: 800, whiteSpace: 'nowrap', color: '#5c3b22' }}>{formatMoney(s.price)}</Typography>
                </Box>
              ))}
            </Box>
          ))
        )}
      </Box>
    </Box>
  )
}

// Ek side ka hissa: location (map + directions) aur book karne ke buttons. Bade screen par ye alag column me rehta hai.
function LocationSide({ detail, onBook }) {
  const phoneDigits = detail.owner.phone.replace(/[^\d+]/g, '')
  return (
    <Box sx={{ display: 'grid', gap: 2, alignContent: 'start' }}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1 }}>
        Find us
      </Typography>
      <SalonMap name={detail.name} address={detail.address} location={detail.location} height="clamp(150px, 27vh, 230px)" />
      <Box sx={{ display: 'grid', gap: 1, p: 2, borderRadius: 3, bgcolor: '#fff', border: '1px solid #eadfd3' }}>
        {detail.startingPrice !== null && (
          <Typography variant="body2" color="text.secondary">
            Services from <strong style={{ color: '#2e1b0f', fontSize: '1.1rem' }}>{formatMoney(detail.startingPrice)}</strong>
          </Typography>
        )}
        <Button
          variant="contained"
          size="large"
          onClick={onBook}
          disabled={detail.services.length === 0}
          sx={{ py: 1.4, fontWeight: 700, textTransform: 'none', fontSize: '1rem', borderRadius: 2.5, background: 'linear-gradient(135deg, #8b5e3c, #5c3b22)', boxShadow: '0 6px 16px rgba(92,59,34,.28)' }}
        >
          Book appointment
        </Button>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
          Free to book · pay at the salon
        </Typography>
        {detail.services.length === 0 && (
          <Typography variant="caption" color="text.secondary">
            Online booking opens once the salon adds its price list.
          </Typography>
        )}
        {detail.owner.phone && (
          <Button variant="text" size="small" component="a" href={`tel:${phoneDigits}`} sx={{ textTransform: 'none', color: 'text.secondary' }}>
            or call the salon
          </Button>
        )}
      </Box>
    </Box>
  )
}

// Customer ke liye salon ka popup (screen se thoda chhota): photo | owner + services | map + book.
// Book dabane par alag "Book appointment" page khulta hai. Khulte hi owner ko "customer dekh raha hai" notification jaati hai.
export default function SalonDialog({ salon, onClose }) {
  const navigate = useNavigate()
  const small = useMediaQuery('(max-width:899.95px)')

  useEffect(() => {
    recordSalonView(salon.id)
  }, [salon.id])

  const query = useQuery({ queryKey: ['public', 'salon', salon.id], queryFn: () => getSalonDetail(salon.id) })
  const detail = query.data
  const book = () => navigate(`/book/${salon.id}`)

  return (
    <Dialog
      open
      onClose={onClose}
      fullScreen={small}
      maxWidth={false}
      aria-labelledby="salon-dialog-title"
      slotProps={{ paper: { sx: { width: small ? '100%' : 'min(1180px, 94vw)', height: small ? '100%' : '90vh', m: 0, borderRadius: small ? 0 : 4, overflow: 'hidden', display: 'block' } } }}
    >
      <IconButton
        onClick={onClose}
        aria-label="Close"
        sx={{ position: 'absolute', top: 12, right: 12, zIndex: 3, bgcolor: 'rgba(255,255,255,0.92)', '&:hover': { bgcolor: '#fff' } }}
      >
        ✕
      </IconButton>

      <Box
        sx={{
          height: '100%',
          display: 'grid',
          overflowY: { xs: 'auto', md: 'hidden' },
          gridTemplateColumns: { xs: '1fr', md: '260px 1fr 300px', lg: '340px 1fr 340px' },
          gridTemplateRows: { xs: 'auto', md: '100%' },
        }}
      >
        <SalonCover salon={salon} titleId="salon-dialog-title" sx={{ minHeight: { xs: 220, md: '100%' } }} />

        {/* Beech: upar owner/tiles (fixed), neeche services (sirf ye scroll). Chhote screen par sab ek saath neeche scroll hota hai. */}
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0 }}>
          <QueryState query={query}>
            {detail && (
              <>
                <Box sx={{ flexShrink: 0, p: { xs: 2, md: 3 }, pb: { md: 2 }, borderBottom: { md: '1px solid #eadfd3' } }}>
                  <Header detail={detail} />
                </Box>
                <Box sx={{ flex: 1, minHeight: 0, overflowY: { md: 'auto' }, p: { xs: 2, md: 3 }, pt: { md: 2 } }}>
                  <Services detail={detail} />
                  {/* Chhote screen par map/booking sabse neeche aata hai (alag side column nahi hota) */}
                  <Box sx={{ display: { xs: 'block', md: 'none' }, mt: 3 }}>
                    <LocationSide detail={detail} onBook={book} />
                  </Box>
                </Box>
              </>
            )}
          </QueryState>
        </Box>

        {/* Daayein: location + book. Ye alag side me hai aur services ke saath scroll nahi hota. */}
        <Box sx={{ display: { xs: 'none', md: 'block' }, overflowY: 'auto', scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' }, p: 3, pt: 7, bgcolor: '#faf6f1', borderLeft: '1px solid #eadfd3' }}>
          {detail && <LocationSide detail={detail} onBook={book} />}
        </Box>
      </Box>
    </Dialog>
  )
}
