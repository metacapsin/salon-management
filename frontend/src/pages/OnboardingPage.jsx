import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Container, List, ListItem, ListItemIcon, ListItemText, Paper, Step, StepLabel, Stepper, Typography } from '@mui/material'
import CheckIcon from '@mui/icons-material/CheckCircle'
import PendingIcon from '@mui/icons-material/RadioButtonUnchecked'
import { createSalon, getCurrentSalon, saveHours } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import HoursEditor from '../features/settings/HoursEditor'
import SalonForm from '../features/settings/SalonForm'

const STEPS = ['Salon details', 'Opening hours', 'Finish']

// Owner ka onboarding (SRS section 4.1): salon banao, hours set karo, checklist dekho.
// Services, staff aur publish baad ke modules me judte hain; abhi unhe "not yet available" nahi, sirf checklist me likha hai.
export default function OnboardingPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { reloadMemberships, activeSalonId, logout, memberships } = useAuth()
  const [step, setStep] = useState(0)
  // Sirf is page par naye bane salon ki id (header ke liye AuthContext bhi isi ko active banata hai)
  const [createdSalonId, setCreatedSalonId] = useState(null)

  const summary = useQuery({
    queryKey: ['salon', activeSalonId, 'current'],
    queryFn: getCurrentSalon,
    enabled: step >= 1 && Boolean(createdSalonId),
  })

  async function handleCreate(values) {
    const { salon } = await createSalon({
      name: values.name,
      slug: values.slug,
      timezone: values.timezone,
      ownerName: values.ownerName,
      about: values.about,
      audience: values.audience,
      facilities: values.facilities,
      ...(values.lat !== '' ? { location: { lat: Number(values.lat), lng: Number(values.lng) } } : {}),
      ...(values.phone ? { phone: values.phone } : {}),
      address: { line1: values.line1, city: values.city, area: values.area, state: values.state, pincode: values.pincode },
    })
    setCreatedSalonId(salon.id)
    await reloadMemberships(salon.id)
    setStep(1)
  }

  return (
    <Container maxWidth="md" sx={{ py: { xs: 3, md: 5 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, color: 'primary.main', flexGrow: 1 }}>
          {memberships.length > 0 && !createdSalonId ? 'Add a salon' : 'Set up your salon'}
        </Typography>
        {memberships.length === 0 && (
          <Button onClick={logout} variant="outlined">
            Sign out
          </Button>
        )}
        {memberships.length > 0 && step === 0 && (
          <Button onClick={() => navigate('/dashboard')} variant="outlined">
            Cancel
          </Button>
        )}
      </Box>

      <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        {step === 0 && <SalonForm mode="create" submitLabel="Create salon" onSubmit={handleCreate} />}

        {step === 1 && (
          <>
            <HoursEditor initial={{ weeklyHours: {}, holidays: [] }} saveLabel="Save and continue" onSave={async (values) => {
              await saveHours(values)
              // Checklist taaza data se bane, purana (hours ke bina) cache na dikhe
              await queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId, 'current'] })
              setStep(2)
            }} />
            <Button sx={{ mt: 1 }} onClick={() => setStep(2)}>
              Skip for now
            </Button>
          </>
        )}

        {step === 2 && (
          <>
            <Alert severity="success" sx={{ mb: 2 }}>
              Your salon is created. A few things are still needed before the booking page can be published.
            </Alert>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Setup checklist
            </Typography>
            <List dense>
              <ListItem>
                <ListItemIcon>
                  <CheckIcon color="success" />
                </ListItemIcon>
                <ListItemText primary="Salon created" />
              </ListItem>
              {(summary.data?.publishBlockers ?? []).map((text) => (
                <ListItem key={text}>
                  <ListItemIcon>
                    <PendingIcon />
                  </ListItemIcon>
                  <ListItemText primary={text} />
                </ListItem>
              ))}
            </List>
            <Button variant="contained" sx={{ mt: 2 }} onClick={() => navigate('/dashboard')}>
              Go to dashboard
            </Button>
          </>
        )}
      </Paper>
    </Container>
  )
}
