import { useState } from 'react'
import { Box, IconButton, Menu, MenuItem, Paper, Typography } from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { formatMoney } from '../../utils/formatMoney'

// Mobile par appointments ki compact list: har appointment ek chhoti row, 3-dot menu me actions.
// Data aur actions parent (AppointmentsPage) se aate hain; yahan koi business logic nahi.
const shortDate = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export default function AppointmentsMobileList({ bookings, statusStyle, actions, canWrite, canBenefits, busy, onChange, onBenefits }) {
  const [menu, setMenu] = useState(null) // { anchor, booking }
  const close = () => setMenu(null)
  const b = menu?.booking

  return (
    <Paper variant="outlined" component="ul" aria-label="Appointments" sx={{ listStyle: 'none', m: 0, p: 0, overflow: 'hidden' }}>
      {bookings.map((item) => {
        const st = statusStyle[item.status]
        const sub = [item.services.map((s) => s.name).join(', '), item.staffName].filter(Boolean).join(' · ')
        const extra = [item.mode === 'home' && item.address ? `🏠 ${item.address}` : '', item.note ? `Note: ${item.note}` : '', item.membership ? `⭐ −${formatMoney(item.membership.discount)}` : '', item.offer ? `🏷️ −${formatMoney(item.offer.discount)}` : ''].filter(Boolean).join(' · ')
        return (
          <Box component="li" key={item.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 1.25, pr: 0.25, py: 0.75, borderBottom: '1px solid', borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
            <Box sx={{ width: 46, flex: 'none', textAlign: 'center', lineHeight: 1.15, py: 0.5, borderRadius: '8px', background: 'linear-gradient(180deg,#f3e7c9,#fbf3de)', border: '1px solid #ead9a8' }}>
              <Typography component="span" sx={{ display: 'block', fontSize: '0.8rem', fontWeight: 800 }}>
                {item.startTime}
              </Typography>
              <Typography component="span" sx={{ display: 'block', fontSize: '0.62rem', fontWeight: 700, color: '#8a6a1f', textTransform: 'uppercase' }}>
                {shortDate(item.date)}
              </Typography>
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'capitalize', lineHeight: 1.3 }}>
                {item.customerName}
              </Typography>
              <Typography noWrap variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
                {sub || '—'}
              </Typography>
              {extra && (
                <Typography noWrap variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
                  {extra}
                </Typography>
              )}
            </Box>
            <Box sx={{ flex: 'none', textAlign: 'right' }}>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, lineHeight: 1.3 }}>{formatMoney(item.total)}</Typography>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 0.8, py: 0.1, borderRadius: 99, bgcolor: st.bg, color: st.fg, fontSize: '0.68rem', fontWeight: 700, textTransform: 'capitalize' }}>
                <Box component="span" sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: st.dot }} />
                {item.status}
              </Box>
            </Box>
            <IconButton size="small" aria-label={`Actions for ${item.customerName}`} onClick={(e) => setMenu({ anchor: e.currentTarget, booking: item })} sx={{ flex: 'none', width: 36, height: 36 }}>
              <MoreVertIcon fontSize="small" />
            </IconButton>
          </Box>
        )
      })}
      <Menu anchorEl={menu?.anchor} open={Boolean(menu)} onClose={close}>
        {b && (
          <MenuItem component="a" href={`tel:${b.customerPhone}`} onClick={close}>
            Call {b.customerPhone}
          </MenuItem>
        )}
        {b && canWrite && canBenefits && b.status !== 'cancelled' && (
          <MenuItem onClick={() => { close(); onBenefits(b) }}>Benefits</MenuItem>
        )}
        {b && canWrite && actions[b.status].map((a) => (
          <MenuItem key={a.to} disabled={busy} sx={a.color ? { color: 'error.main' } : { fontWeight: 700 }} onClick={() => { close(); onChange({ id: b.id, to: a.to, booking: b }) }}>
            {a.label}
          </MenuItem>
        ))}
      </Menu>
    </Paper>
  )
}
