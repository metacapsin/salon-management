import { Box } from '@mui/material'

// Sirf dikhane wale sunehri sitare. Average jaise 4.3 ho to pachaas fisadi tak bhare dikhte hain (value/5 ki chaudai tak).
export default function Stars({ value, size = 18 }) {
  const percent = Math.max(0, Math.min(5, value)) * 20
  return (
    <Box component="span" role="img" aria-label={`${value} out of 5 stars`} sx={{ position: 'relative', display: 'inline-block', fontSize: size, lineHeight: 1, letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
      <Box component="span" aria-hidden sx={{ color: '#e3d3bd' }}>
        ★★★★★
      </Box>
      <Box component="span" aria-hidden sx={{ position: 'absolute', left: 0, top: 0, width: `${percent}%`, overflow: 'hidden', color: '#c9a24a' }}>
        ★★★★★
      </Box>
    </Box>
  )
}
