import { Link as RouterLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, Button, Card, CardActionArea, CardContent, Chip, LinearProgress, List, ListItem, ListItemIcon, ListItemText, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/CheckCircle'
import PendingIcon from '@mui/icons-material/RadioButtonUnchecked'
import GroupIcon from '@mui/icons-material/Group'
import SettingsIcon from '@mui/icons-material/Settings'
import HistoryIcon from '@mui/icons-material/History'
import AccessTimeIcon from '@mui/icons-material/AccessTime'
import PlaceIcon from '@mui/icons-material/PlaceOutlined'
import PhoneIcon from '@mui/icons-material/PhoneOutlined'
import { getCurrentSalon } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS, roleCan } from '../auth/permissions'
import QueryState from '../components/QueryState'
import { COLORS } from '../theme'

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

// Aaj salon khula hai ya band, aur kitne baje tak
function todayHours(salon) {
  const now = new Date()
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const holiday = (salon.holidays ?? []).find((h) => h.date === iso)
  if (holiday) return `Closed today${holiday.name ? ` (${holiday.name})` : ''}`
  const intervals = salon.weeklyHours?.[DAY_KEYS[now.getDay()]] ?? []
  if (intervals.length === 0) return 'Closed today'
  return intervals.map((i) => `${i.start} – ${i.end}`).join(', ')
}

// "Setup checklist" ke 3 kadam. Services/staff ka kadam tab tak adhoora dikhta hai jab tak server blocker bheje.
function setupSteps(blockers) {
  return [
    { label: 'Create your salon', done: true },
    { label: 'Set opening hours', done: !blockers.some((b) => /opening hours/i.test(b)) },
    { label: 'Add services and qualified staff', done: !blockers.some((b) => /service/i.test(b)) },
  ]
}

const QUICK_LINKS = [
  { to: '/settings', label: 'Salon settings', text: 'Details, opening hours, holidays', icon: <SettingsIcon />, capability: 'settings.read' },
]

function InfoRow({ icon, children }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 0.75, color: 'text.secondary' }}>
      {icon}
      <Typography variant="body2" sx={{ color: 'text.primary' }}>
        {children}
      </Typography>
    </Box>
  )
}

// "Today" screen. Appointments, collections waghera aage ke modules me judenge; abhi sirf wahi dikhate hain jo sach me bana hai.
export default function DashboardPage() {
  const { user, role, activeSalonId } = useAuth()
  const query = useQuery({ queryKey: ['salon', activeSalonId, 'current'], queryFn: getCurrentSalon })
  const canSetup = roleCan(role, 'settings.read')
  const salon = query.data?.salon
  const steps = setupSteps(query.data?.publishBlockers ?? [])
  const doneCount = steps.filter((s) => s.done).length
  const firstName = user?.name?.split(' ')[0]
  const dateText = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const address = [salon?.address?.line1, salon?.address?.city, salon?.address?.state, salon?.address?.pincode].filter(Boolean).join(', ')

  return (
    <Box>
      <Box
        sx={{
          p: { xs: 3, md: 4 },
          mb: 3,
          borderRadius: '20px',
          color: '#fff',
          background: `linear-gradient(120deg, ${COLORS.espresso} 0%, ${COLORS.brownDark} 60%, ${COLORS.brown} 100%)`,
          boxShadow: '0 12px 32px rgba(46,27,15,0.25)',
        }}
      >
        <Typography variant="body2" sx={{ color: COLORS.gold, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {dateText}
        </Typography>
        <Typography variant="h4" component="h1" sx={{ mt: 0.5, color: '#fff' }}>
          {greeting()}, {firstName}
        </Typography>
        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Chip label={salon?.name ?? 'Loading…'} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />
          <Chip label={ROLE_LABELS[role] ?? role} sx={{ bgcolor: COLORS.gold, color: COLORS.espresso }} />
          {salon && canSetup && <Chip icon={<AccessTimeIcon sx={{ color: '#fff !important' }} />} label={`Today: ${todayHours(salon)}`} sx={{ bgcolor: 'rgba(255,255,255,0.15)', color: '#fff' }} />}
        </Box>
      </Box>

      <QueryState query={query}>
        {canSetup ? (
          <>
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', md: '3fr 2fr' }, mb: 3 }}>
              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Typography variant="h6" component="h2">
                      Setup checklist
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {doneCount} of {steps.length} done
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={(doneCount / steps.length) * 100}
                    aria-label="Setup progress"
                    sx={{ my: 2, height: 8, borderRadius: 4, bgcolor: COLORS.goldSoft, '& .MuiLinearProgress-bar': { bgcolor: COLORS.gold } }}
                  />
                  <List dense disablePadding>
                    {steps.map((step) => (
                      <ListItem key={step.label} disableGutters>
                        <ListItemIcon sx={{ minWidth: 36 }}>{step.done ? <CheckIcon color="success" /> : <PendingIcon sx={{ color: 'text.disabled' }} />}</ListItemIcon>
                        <ListItemText primary={step.label} secondary={step.done ? 'Done' : 'To do'} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
                      </ListItem>
                    ))}
                  </List>
                  {!steps.every((s) => s.done) && (
                    <Button component={RouterLink} to="/settings" variant="contained" sx={{ mt: 1 }}>
                      Continue setup
                    </Button>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                    Your salon
                  </Typography>
                  <InfoRow icon={<PlaceIcon fontSize="small" />}>{address || 'Address not added yet'}</InfoRow>
                  <InfoRow icon={<PhoneIcon fontSize="small" />}>{salon?.ownerContact?.phone || 'Phone not added yet'}</InfoRow>
                  <InfoRow icon={<AccessTimeIcon fontSize="small" />}>{todayHours(salon)}</InfoRow>
                  <Chip size="small" sx={{ mt: 1.5 }} label={salon?.publicBookingEnabled ? 'Booking page published' : 'Booking page not published'} color={salon?.publicBookingEnabled ? 'success' : 'default'} />
                </CardContent>
              </Card>
            </Box>

            <Typography variant="h6" component="h2" sx={{ mb: 1.5 }}>
              Quick links
            </Typography>
            <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' } }}>
              {QUICK_LINKS.filter((l) => roleCan(role, l.capability)).map((l) => (
                <Card key={l.to}>
                  <CardActionArea component={RouterLink} to={l.to} sx={{ p: 2.5, minHeight: 112 }}>
                    <Box sx={{ color: COLORS.brown, mb: 1 }}>{l.icon}</Box>
                    <Typography sx={{ fontWeight: 700 }}>{l.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {l.text}
                    </Typography>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          </>
        ) : (
          <Card>
            <CardContent sx={{ p: 3 }}>
              <Typography>Your daily schedule will appear here once bookings are available.</Typography>
            </CardContent>
          </Card>
        )}
      </QueryState>
    </Box>
  )
}
