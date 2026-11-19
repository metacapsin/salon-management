import { Box, FormHelperText, TextField, Typography } from '@mui/material'
import { formatDuration, joinDuration, splitDuration } from '../utils/duration'

// Service ki duration chunne ka field: ready chips + custom hours/minutes.
// value aur onChange dono total minutes (number) me hain.
export default function DurationField({ value, onChange, error }) {
  const total = Number(value) || 0
  const { hours, minutes } = splitDuration(total)

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 0.75 }}>
        Duration
      </Typography>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: '1fr 1fr' }}>
        <TextField
          label="Hours"
          type="number"
          size="small"
          value={total ? hours : ''}
          onChange={(e) => onChange(joinDuration(e.target.value, minutes))}
          slotProps={{ htmlInput: { min: 0, max: 8, step: 1 } }}
        />
        <TextField
          label="Minutes"
          type="number"
          size="small"
          value={total ? minutes : ''}
          onChange={(e) => onChange(joinDuration(hours, e.target.value))}
          slotProps={{ htmlInput: { min: 0, max: 59, step: 5 } }}
        />
      </Box>
      <FormHelperText error={Boolean(error)} sx={{ mx: 0 }}>
        {error ? error : total > 0 ? `Service time: ${formatDuration(total)}` : 'Type hours and minutes (up to 8 hours).'}
      </FormHelperText>
    </Box>
  )
}
