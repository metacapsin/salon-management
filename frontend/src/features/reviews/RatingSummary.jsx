import { Box, ButtonBase, Typography } from '@mui/material'
import Stars from './Stars'

// Average, total aur 5..1 star ki patti. onPick dene par har patti dabane wali ban jati he (owner ke filter ke liye);
// active = abhi chuna hua star (ya null). Customer profile par bina onPick ke sirf dikhta he.
export default function RatingSummary({ summary, onPick, active = null }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'auto minmax(0, 520px)' }, justifyContent: { sm: 'start' }, gap: { xs: 1, sm: 4 }, alignItems: 'center', px: 2, py: 1, borderRadius: 2.5, bgcolor: '#faf6f1', border: '1px solid #eadfd3' }}>
      <Box sx={{ textAlign: 'center' }}>
        <Typography sx={{ fontSize: '2.1rem', fontWeight: 800, lineHeight: 1, color: '#2e1b0f', fontFamily: '"Playfair Display", Georgia, serif' }}>{summary.average.toFixed(1)}</Typography>
        <Stars value={summary.average} size={16} />
        <Typography variant="caption" color="text.secondary">
          {summary.count} {summary.count === 1 ? 'review' : 'reviews'}
        </Typography>
      </Box>
      <Box sx={{ display: 'grid', gap: 0 }}>
        {[5, 4, 3, 2, 1].map((star) => {
          const n = summary.breakdown[star] ?? 0
          const percent = summary.count ? (n / summary.count) * 100 : 0
          const row = (
            <>
              <Typography variant="body2" sx={{ fontWeight: 600, textAlign: 'left' }}>
                {star} ★
              </Typography>
              <Box role="img" aria-label={`${n} reviews with ${star} stars`} sx={{ height: 6, borderRadius: 3, bgcolor: '#eadfd3', overflow: 'hidden' }}>
                <Box sx={{ width: `${percent}%`, height: '100%', bgcolor: '#c9a24a', borderRadius: 4 }} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'right' }}>
                {n}
              </Typography>
            </>
          )
          const grid = { display: 'grid', gridTemplateColumns: '38px 1fr 30px', alignItems: 'center', gap: 1 }
          if (!onPick) return <Box key={star} sx={grid}>{row}</Box>
          return (
            <ButtonBase key={star} onClick={() => onPick(active === star ? null : star)} aria-pressed={active === star} aria-label={`Show ${star} star reviews`} sx={{ ...grid, width: '100%', borderRadius: 1, px: 0.5, py: 0, bgcolor: active === star ? '#f3e7c9' : 'transparent', '&:hover': { bgcolor: '#f3e7c9' } }}>
              {row}
            </ButtonBase>
          )
        })}
      </Box>
    </Box>
  )
}
