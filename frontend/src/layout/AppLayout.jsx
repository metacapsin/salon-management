import { useState } from 'react'
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom'
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Select,
  Toolbar,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import MenuIcon from '@mui/icons-material/Menu'
import DashboardIcon from '@mui/icons-material/SpaceDashboard'
import GroupIcon from '@mui/icons-material/Group'
import SettingsIcon from '@mui/icons-material/Settings'
import HistoryIcon from '@mui/icons-material/History'
import AddBusinessIcon from '@mui/icons-material/AddBusiness'
import LogoutIcon from '@mui/icons-material/Logout'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS, roleCan } from '../auth/permissions'
import { COLORS } from '../theme'

const DRAWER_WIDTH = 264
const SIDEBAR_TEXT = '#e9dccd'

// Menu me sirf wahi dikhta hai jo us role ke liye allowed hai. (Server phir bhi har request par check karta hai.)
const NAV = [
  { to: '/', label: 'Today', icon: <DashboardIcon />, end: true },
  { to: '/team', label: 'Team', icon: <GroupIcon />, capability: 'users.read' },
  { to: '/settings', label: 'Salon settings', icon: <SettingsIcon />, capability: 'settings.read' },
  { to: '/audit', label: 'Audit history', icon: <HistoryIcon />, capability: 'audit.read' },
]

// Naam se chhote akshar ("Asha Verma" -> "AV")
function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('')
}

const navItemSx = {
  minHeight: 48,
  mx: 1.5,
  mb: 0.5,
  borderRadius: '10px',
  color: SIDEBAR_TEXT,
  '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 40 },
  '&:hover': { bgcolor: 'rgba(255,255,255,0.07)' },
  '&.active': { bgcolor: 'rgba(201,162,74,0.18)', color: COLORS.gold, fontWeight: 700, '& .MuiTypography-root': { fontWeight: 700 } },
  '&:focus-visible': { outline: `2px solid ${COLORS.gold}`, outlineOffset: 2 },
}

export default function AppLayout() {
  const { user, memberships, activeSalonId, activeSalon, role, switchSalon, logout } = useAuth()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const [open, setOpen] = useState(false)
  const location = useLocation()

  // Koi salon nahi hai to pehle salon banao
  if (memberships.length === 0) return <Navigate to="/onboarding" replace state={{ from: location }} />

  const items = NAV.filter((item) => !item.capability || roleCan(role, item.capability))

  const drawer = (
    <Box sx={{ width: DRAWER_WIDTH, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: COLORS.espresso, color: SIDEBAR_TEXT }}>
      <Box sx={{ px: 3, pt: 3, pb: 2 }}>
        <Typography sx={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.9rem', fontWeight: 700, color: COLORS.gold, lineHeight: 1 }}>Galora</Typography>
        <Typography variant="caption" sx={{ color: 'rgba(233,220,205,0.7)', letterSpacing: '0.08em' }}>
          SALON &amp; BEAUTY PARLOUR
        </Typography>
      </Box>

      <Box sx={{ mx: 1.5, mb: 2, p: 1.5, borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.06)' }}>
        <Typography variant="caption" component="label" htmlFor="salon-switcher" sx={{ color: 'rgba(233,220,205,0.7)' }}>
          Salon
        </Typography>
        {memberships.length > 1 ? (
          <Select
            id="salon-switcher"
            fullWidth
            size="small"
            value={activeSalonId ?? ''}
            onChange={(event) => switchSalon(event.target.value)}
            inputProps={{ 'aria-label': 'Active salon' }}
            sx={{
              color: '#fff',
              mt: 0.5,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
              '& .MuiSvgIcon-root': { color: '#fff' },
              bgcolor: 'transparent',
            }}
          >
            {memberships.map((m) => (
              <MenuItem key={m.salonId} value={m.salonId}>
                {m.salonName}
              </MenuItem>
            ))}
          </Select>
        ) : (
          <Typography sx={{ fontWeight: 700, color: '#fff' }}>{activeSalon?.salonName}</Typography>
        )}
        <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip size="small" label={ROLE_LABELS[role] ?? role} sx={{ bgcolor: COLORS.gold, color: COLORS.espresso }} />
          {activeSalon?.salonStatus === 'suspended' && <Chip size="small" color="error" label="Suspended" />}
        </Box>
      </Box>

      <List component="nav" aria-label="Main" sx={{ flexGrow: 1, py: 0 }}>
        {items.map((item) => (
          <ListItemButton key={item.to} component={NavLink} to={item.to} end={item.end} onClick={() => setOpen(false)} sx={navItemSx}>
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
        <ListItemButton component={NavLink} to="/onboarding" onClick={() => setOpen(false)} sx={navItemSx}>
          <ListItemIcon>
            <AddBusinessIcon />
          </ListItemIcon>
          <ListItemText primary="Add another salon" />
        </ListItemButton>
      </List>

      <Box sx={{ p: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
          <Avatar sx={{ bgcolor: COLORS.gold, color: COLORS.espresso, fontWeight: 700 }}>{initials(user?.name)}</Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: '#fff' }} title={user?.name}>
              {user?.name}
            </Typography>
            <Typography variant="caption" noWrap display="block" sx={{ color: 'rgba(233,220,205,0.7)' }} title={user?.email}>
              {user?.email}
            </Typography>
          </Box>
        </Box>
        <Button
          fullWidth
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={logout}
          sx={{ color: SIDEBAR_TEXT, borderColor: 'rgba(255,255,255,0.3)', '&:hover': { borderColor: COLORS.gold, bgcolor: 'rgba(201,162,74,0.1)' } }}
        >
          Sign out
        </Button>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" elevation={0} sx={{ display: { md: 'none' }, bgcolor: COLORS.espresso, color: '#fff' }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" aria-label="Open menu" onClick={() => setOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Typography sx={{ ml: 1, fontFamily: "'Playfair Display', Georgia, serif", fontSize: '1.4rem', fontWeight: 700, color: COLORS.gold }}>Galora</Typography>
          <Typography variant="body2" sx={{ ml: 'auto', color: SIDEBAR_TEXT }} noWrap>
            {activeSalon?.salonName}
          </Typography>
        </Toolbar>
      </AppBar>

      <Drawer
        variant={isDesktop ? 'permanent' : 'temporary'}
        open={isDesktop ? true : open}
        onClose={() => setOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ width: { md: DRAWER_WIDTH }, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', border: 0, bgcolor: COLORS.espresso } }}
      >
        {drawer}
      </Drawer>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0, p: { xs: 2, md: 4 }, pt: { xs: 9, md: 4 } }}>
        {activeSalon?.salonStatus === 'suspended' && (
          <Box role="alert" sx={{ mb: 2, p: 1.5, border: 1, borderColor: 'error.main', borderRadius: 1, bgcolor: '#fdecec', color: 'error.dark' }}>
            This salon is suspended. You can read your data, but changes are not allowed.
          </Box>
        )}
        <Outlet />
      </Box>
    </Box>
  )
}
