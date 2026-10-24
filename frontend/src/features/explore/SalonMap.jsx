import { Box, Button, Typography } from '@mui/material'

// Salon ki location: chhota map (OpenStreetMap, free, API key nahi chahiye) + "Get directions" button (Google Maps khulta hai).
// Coordinates na hon to sirf address se Google Maps ka link dete hain.
export default function SalonMap({ name, address, location, height = 180 }) {
  const query = location ? `${location.lat},${location.lng}` : encodeURIComponent(`${name}, ${address}`)
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${query}`

  const embed = location
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${location.lng - 0.006},${location.lat - 0.004},${location.lng + 0.006},${location.lat + 0.004}&layer=mapnik&marker=${location.lat}%2C${location.lng}`
    : null

  return (
    <Box sx={{ border: '1px solid #eadfd3', borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
      {embed && (
        <Box component="iframe" title={`Map showing ${name}`} src={embed} loading="lazy" sx={{ width: '100%', height, border: 0, display: 'block', bgcolor: 'action.hover' }} />
      )}
      <Box sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.4, minWidth: 0 }}>
          📍 {address || 'Address not added'}
        </Typography>
        <Button
          component="a"
          href={directions}
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          variant="outlined"
          sx={{ flexShrink: 0, textTransform: 'none', fontWeight: 600, fontSize: '0.85rem', px: 1.75, py: 0.6, borderRadius: 2, color: '#6b4a2e', borderColor: '#e3d3bd', bgcolor: '#faf6f1', '&:hover': { bgcolor: '#f3e7c9', borderColor: '#d9bf8a' } }}
        >
          Get directions ↗
        </Button>
      </Box>
    </Box>
  )
}
