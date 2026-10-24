import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Divider, FormControlLabel, Paper, Switch, Typography } from '@mui/material'
import { ApiError } from '../api/client'
import { formatMoney } from '../utils/formatMoney'
import { getCurrentSalon, listServices, saveHours, updateSalon } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import QueryState from '../components/QueryState'
import HoursEditor from '../features/settings/HoursEditor'
import SalonForm from '../features/settings/SalonForm'

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

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', mb: 2 }}>
        Salon settings
      </Typography>
      {readOnly && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You can view these settings. Only the owner can change them.
        </Alert>
      )}
      <QueryState query={query}>
        {query.data?.salon && (
          // key: salon badalne par form naye salon ke data se dobara banta hai
          <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: 'minmax(0, 1fr)' }}>
            <Paper sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Salon details
              </Typography>
              <SalonForm key={activeSalonId} initial={query.data.salon} readOnly={readOnly} submitLabel="Save changes" onSubmit={saveDetails} />
            </Paper>

            <Paper sx={{ p: { xs: 2, md: 3 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
                <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                  Services offered
                </Typography>
                <Button component={RouterLink} to="/services" variant="outlined" size="small">
                  Manage services
                </Button>
              </Box>
              <QueryState query={servicesQuery}>
                {activeServices.length === 0 ? (
                  <Typography color="text.secondary">No services yet. Add your first service so customers can book.</Typography>
                ) : (
                  <Box sx={{ display: 'grid', gap: 1 }}>
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
            </Paper>

            <Paper sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                Opening hours and holidays
              </Typography>
              <HoursEditor key={`hours-${activeSalonId}`} initial={query.data.salon} readOnly={readOnly} onSave={saveSalonHours} />
            </Paper>

            <Paper sx={{ p: { xs: 2, md: 3 } }}>
              <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                Public booking page
              </Typography>
              <FormControlLabel
                control={<Switch checked={query.data.salon.publicBookingEnabled} disabled={readOnly || publish.isPending} onChange={(e) => publish.mutate(e.target.checked)} />}
                label={query.data.salon.publicBookingEnabled ? 'Published' : 'Not published'}
              />
              {(publishBlockers.length > 0 ? publishBlockers : query.data.publishBlockers).length > 0 && !query.data.salon.publicBookingEnabled && (
                <Alert severity={publishBlockers.length > 0 ? 'warning' : 'info'} sx={{ mt: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Before you can publish:
                  </Typography>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 20 }}>
                    {(publishBlockers.length > 0 ? publishBlockers : query.data.publishBlockers).map((text) => (
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
        )}
      </QueryState>
    </Box>
  )
}
