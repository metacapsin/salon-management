import { useState } from 'react'
import { Box, Chip, Typography } from '@mui/material'

const AUDIENCE_LABEL = { women: 'Women', men: 'Men', unisex: 'Unisex' }

// Salon ki badi photo, upar naam, area aur rating. Photo na ho ya load na ho to sunehri initial wala box.
// sx se height/size bahar se milta hai (popup me poori height, booking page me banner).
export default function SalonCover({ salon, titleId, sx }) {
  const [failed, setFailed] = useState(false)
  const showImage = salon.coverUrl && !failed

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-end',
        color: '#fff',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #f3e7c9, #d9bf8a)',
        ...sx,
      }}
    >
      {showImage ? (
        <Box component="img" src={salon.coverUrl} alt={`${salon.name} salon`} onError={() => setFailed(true)} sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Typography aria-hidden sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: '5rem', fontFamily: 'Georgia, serif', color: '#a97f2a' }}>
          {salon.name.charAt(0)}
        </Typography>
      )}
      <Box sx={{ position: 'relative', width: '100%', p: 2.5, pt: 8, background: 'linear-gradient(transparent, rgba(46,27,15,0.88))' }}>
        <Typography variant="h5" component="h2" id={titleId} sx={{ fontWeight: 800, lineHeight: 1.2, fontFamily: '"Playfair Display", Georgia, serif' }}>
          {salon.name}
        </Typography>
        <Typography variant="body2" sx={{ opacity: 0.92, mt: 0.25 }}>
          {salon.area}, {salon.city}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1.25 }}>
          {salon.rating.count > 0 && <Chip size="small" label={`${salon.rating.average.toFixed(1)} ★ (${salon.rating.count})`} sx={{ bgcolor: '#2f7d32', color: '#fff', fontWeight: 700 }} />}
          <Chip size="small" label={AUDIENCE_LABEL[salon.audience]} sx={{ bgcolor: 'rgba(255,255,255,0.92)' }} />
          {salon.serviceModes.homeService && <Chip size="small" label="Home service" sx={{ bgcolor: '#f3e7c9', color: '#7a5a14', fontWeight: 600 }} />}
        </Box>
      </Box>
    </Box>
  )
}
