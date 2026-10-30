import { useCallback, useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Divider, FormControlLabel, Paper, Switch, Tab, Tabs, Typography } from '@mui/material'
import AccessTimeOutlinedIcon from '@mui/icons-material/AccessTimeOutlined'
import ContentCutOutlinedIcon from '@mui/icons-material/ContentCutOutlined'
import LockOutlinedIcon from '@mui/icons-material/LockOutlined'
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined'
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined'
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined'
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined'
import { ApiError } from '../api/client'
import { formatMoney } from '../utils/formatMoney'
import { getCurrentSalon, listServices, saveHours, updateSalon } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import QueryState from '../components/QueryState'
import AccountSecurity from '../features/settings/AccountSecurity'
import HoursEditor from '../features/settings/HoursEditor'
import SalonForm from '../features/settings/SalonForm'
import SalonPhotos from '../features/settings/SalonPhotos'

// Left menu / mobile tabs. Sirf wahi hisse jo backend me sach me save hote hain.
const SECTIONS = [
  { id: 'info', label: 'Salon information', icon: StorefrontOutlinedIcon, text: 'Name, contact, about, who the salon is for and facilities.' },
  { id: 'address', label: 'Address & location', icon: PlaceOutlinedIcon, text: 'Where customers find you, including the map location.' },
  { id: 'hours', label: 'Business hours', icon: AccessTimeOutlinedIcon, text: 'Weekly opening hours and holidays. Customers can book only inside these times.' },
  { id: 'gallery', label: 'Salon gallery', icon: PhotoLibraryOutlinedIcon, text: 'Photos customers see on your salon card and profile.' },
  { id: 'services', label: 'Services', icon: ContentCutOutlinedIcon, text: 'The services you offer right now.' },
  { id: 'booking', label: 'Online booking', icon: PublicOutlinedIcon, text: 'Publish your salon for online booking and set the reception discount limit.' },
  { id: 'security', label: 'Account & security', icon: LockOutlinedIcon, text: 'Change your password and sign out.' },
]
const FORM_SECTIONS = ['info', 'address', 'booking']

// Section ka naam left menu / tabs me pehle se dikhta he, isliye card me alag heading nahi
function SectionCard({ children, sx }) {
  return <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, border: '1px solid #eadfd3', boxShadow: '0 1px 6px rgba(46, 27, 15, 0.06)', ...sx }}>{children}</Paper>
}

// Salon settings: Owner badal sakta hai, Manager sirf padh sakta hai (SRS permission matrix).
export default function SettingsPage() {
  const { role, activeSalonId, reloadMemberships } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['salon', activeSalonId, 'current']
  const query = useQuery({ queryKey, queryFn: getCurrentSalon })
  const readOnly = !roleCan(role, 'settings.write')
  const servicesQuery = useQuery({ queryKey: ['salon', activeSalonId, 'services'], queryFn: listServices })
  const activeServices = (servicesQuery.data?.services ?? []).filter((s) => s.active !== false)
  const [publishBlockers, setPublishBlockers] = useState([])
  const [current, setCurrent] = useState('info')
  const [dirty, setDirty] = useState(false)
  const onDirtyChange = useCallback((value) => setDirty(value), [])

  // Unsaved badlav ke saath tab band / refresh karne par browser ki warning
  useEffect(() => {
    if (!dirty) return undefined
    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const publish = useMutation({
    mutationFn: (enabled) => updateSalon({ publicBookingEnabled: enabled }),
    onSuccess: () => {
      setPublishBlockers([])
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'PUBLISH_BLOCKED') setPublishBlockers(error.details?.blockers ?? [])
    },
  })

  async function saveDetails(values) {
    await updateSalon({
      name: values.name,
      slug: values.slug,
      phone: values.phone,
      ownerName: values.ownerName,
      about: values.about,
      audience: values.audience,
      facilities: values.facilities,
      location: values.lat === '' ? null : { lat: Number(values.lat), lng: Number(values.lng) },
      address: { line1: values.line1, city: values.city, area: values.area, state: values.state, pincode: values.pincode },
      settings: { receptionDiscountLimitPercent: values.receptionDiscountLimitPercent },
    })
    await queryClient.invalidateQueries({ queryKey })
    // Naam badla ho to side menu me bhi badle
    await reloadMemberships(activeSalonId, { clearCache: false })
  }

  async function saveSalonHours(values) {
    await saveHours(values)
    await queryClient.invalidateQueries({ queryKey })
  }

  const show = (id) => ({ display: current === id ? 'block' : 'none' })
  const blockers = publishBlockers.length > 0 ? publishBlockers : (query.data?.publishBlockers ?? [])

  return (
    <Box>
      {readOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You can view these settings. Only the owner can change them.
        </Alert>
      )}
      <QueryState query={query}>
        {query.data?.salon && (
          <Box sx={{ display: 'grid', gap: { xs: 1.5, md: 3 }, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '250px minmax(0, 1fr)' }, alignItems: 'start' }}>
            {/* Mobile / tablet: upar scroll hone wale tabs */}
            <Paper sx={{ display: { xs: 'block', md: 'none' }, borderRadius: 3, border: '1px solid #eadfd3', overflow: 'hidden' }}>
              <Tabs value={current} onChange={(_, value) => setCurrent(value)} variant="scrollable" scrollButtons="auto" aria-label="Settings sections" sx={{ minHeight: 44, '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 600 }, '& .MuiTabs-indicator': { bgcolor: '#c9a24a' } }}>
                {SECTIONS.map((s) => (
                  <Tab key={s.id} value={s.id} label={s.label} />
                ))}
              </Tabs>
            </Paper>

            {/* Desktop: left menu */}
            <Paper component="nav" aria-label="Settings sections" sx={{ display: { xs: 'none', md: 'grid' }, gap: 0.5, p: 1, position: 'sticky', top: 16, borderRadius: 3, border: '1px solid #eadfd3', boxShadow: '0 1px 6px rgba(46, 27, 15, 0.06)' }}>
              {SECTIONS.map((s) => {
                const Icon = s.icon
                const active = s.id === current
                return (
                  <Button
                    key={s.id}
                    onClick={() => setCurrent(s.id)}
                    aria-current={active ? 'page' : undefined}
                    startIcon={<Icon fontSize="small" />}
                    sx={{ justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', fontWeight: 600, py: 1, px: 1.5, borderRadius: 2, color: active ? '#2e1b0f' : 'text.secondary', bgcolor: active ? '#f6e9bf' : 'transparent', '&:hover': { bgcolor: active ? '#f6e9bf' : '#faf6f1' }, '& .MuiButton-startIcon': { color: active ? '#a9801f' : 'inherit' } }}
                  >
                    {s.label}
                  </Button>
                )
              })}
            </Paper>

            <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
              {/* Ek hi form: info, address aur booking ke fields; Save sab ek saath save karta he */}
              <Box sx={{ display: FORM_SECTIONS.includes(current) ? 'block' : 'none' }}>
                <SectionCard>
                  <SalonForm
                    key={activeSalonId}
                    initial={query.data.salon}
                    readOnly={readOnly}
                    section={FORM_SECTIONS.includes(current) ? current : 'info'}
                    submitLabel="Save changes"
                    onSubmit={saveDetails}
                    onDirtyChange={onDirtyChange}
                    onErrorSection={setCurrent}
                  />
                </SectionCard>
              </Box>

              <Box sx={show('hours')}>
                <SectionCard>
                  <HoursEditor key={`hours-${activeSalonId}`} initial={query.data.salon} readOnly={readOnly} onSave={saveSalonHours} />
                </SectionCard>
              </Box>

              <Box sx={show('gallery')}>
                <SectionCard>
                  <SalonPhotos images={query.data.salon.images ?? []} readOnly={readOnly} onChanged={() => queryClient.invalidateQueries({ queryKey })} />
                </SectionCard>
              </Box>

              <Box sx={show('services')}>
                <SectionCard>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
                    <Button component={RouterLink} to="/services" variant="outlined" size="small" sx={{ textTransform: 'none' }}>
                      Manage services
                    </Button>
                  </Box>
                  <QueryState query={servicesQuery}>
                    {activeServices.length === 0 ? (
                      <Typography color="text.secondary">No services yet. Add your first service so customers can book.</Typography>
                    ) : (
                      <Box sx={{ display: 'grid' }}>
                        {activeServices.map((s) => (
                          <Box key={s.id ?? s._id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Box sx={{ flexGrow: 1 }}>
                              <Typography sx={{ fontWeight: 600 }}>{s.name}</Typography>
                              <Typography variant="body2" color="text.secondary">
                                {s.category} · {s.durationMin} min
                              </Typography>
                            </Box>
                            <Typography sx={{ fontWeight: 700 }}>{formatMoney(s.price)}</Typography>
                          </Box>
                        ))}
                      </Box>
                    )}
                  </QueryState>
                </SectionCard>
              </Box>

              <Box sx={show('security')}>
                <SectionCard sx={{ maxWidth: 820 }}>
                  <AccountSecurity />
                </SectionCard>
              </Box>

              <Box sx={show('booking')}>
                <Paper sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, border: '1px solid #eadfd3', boxShadow: '0 1px 6px rgba(46, 27, 15, 0.06)' }}>
                  <Typography variant="h6" component="h2" sx={{ mb: 0.5, fontSize: '1.05rem', fontWeight: 700 }}>
                    Public booking page
                  </Typography>
                  <FormControlLabel
                    control={<Switch checked={query.data.salon.publicBookingEnabled} disabled={readOnly || publish.isPending} onChange={(e) => publish.mutate(e.target.checked)} />}
                    label={query.data.salon.publicBookingEnabled ? 'Published' : 'Not published'}
                  />
                  {blockers.length > 0 && !query.data.salon.publicBookingEnabled && (
                    <Alert severity={publishBlockers.length > 0 ? 'warning' : 'info'} sx={{ mt: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        Before you can publish:
                      </Typography>
                      <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                        {blockers.map((text) => (
                          <li key={text}>{text}</li>
                        ))}
                      </ul>
                    </Alert>
                  )}
                  <Divider sx={{ my: 2 }} />
                  <Typography variant="body2" color="text.secondary">
                    When published, your salon shows up for customers in Explore and they can book online. Publishing needs opening hours and at least one active service.
                  </Typography>
                </Paper>
              </Box>
            </Box>
          </Box>
        )}
      </QueryState>
    </Box>
  )
}
