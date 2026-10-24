import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material'
import { fieldErrorsOf, friendlyError } from '../../api/client'
import { createPlatformSalon } from '../../api/platformApi'
import DialogCloseButton from '../../components/DialogCloseButton'

// Typing ke dauran spaces/galat characters apne aap '-' ban jaate hain
const cleanSlug = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 50)
const toSlug = (text) => text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)

// Server jaise hi rules, taaki galti submit se pehle hi dikh jaye
function validate(form) {
  const errors = {}
  if (form.ownerName.trim().length < 2) errors.ownerName = 'Enter the owner name (at least 2 letters).'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.ownerEmail.trim())) errors.ownerEmail = 'Enter a valid email address.'
  if (form.password.length < 12) errors.password = 'Password must be at least 12 characters.'
  if (form.name.trim().length < 2) errors.name = 'Salon name must be at least 2 characters.'
  const slug = form.slug.replace(/-+$/, '')
  if (!/^[a-z0-9-]{3,50}$/.test(slug)) errors.slug = 'Use 3 to 50 lowercase letters, digits or hyphens.'
  if (form.phone.trim() && !/^\+?[0-9 -]{7,20}$/.test(form.phone.trim())) errors.phone = 'Enter a valid phone number.'
  return errors
}

// Super Admin ka "Create salon": naya owner (naam, email, password) aur uska salon ek saath. Owner seedha approved hota he.
export default function CreateSalonDialog({ onClose, onCreated }) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({ ownerName: '', ownerEmail: '', password: '', name: '', slug: '', city: '', phone: '' })
  const [slugEdited, setSlugEdited] = useState(false)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')

  const create = useMutation({
    mutationFn: () =>
      createPlatformSalon({
        ownerName: form.ownerName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        password: form.password,
        name: form.name.trim(),
        slug: form.slug.replace(/-+$/, ''),
        ...(form.city.trim() ? { address: { city: form.city.trim() } } : {}),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform'] })
      onCreated?.({ email: form.ownerEmail.trim(), emailSent: data.emailSent })
      onClose()
    },
    onError: (error) => {
      const fields = fieldErrorsOf(error)
      setErrors(fields)
      // Field ke neeche message ho to upar generic alert nahi chahiye
      setFormError(Object.keys(fields).length > 0 ? '' : friendlyError(error))
    },
  })

  const set = (field) => (event) => {
    const value = event.target.value
    setForm((prev) => ({ ...prev, [field]: value, ...(field === 'name' && !slugEdited ? { slug: toSlug(value) } : {}) }))
    setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  return (
    <Dialog open onClose={create.isPending ? undefined : onClose} fullWidth maxWidth="sm" slotProps={{ paper: { sx: { maxWidth: 560 } } }}>
      <DialogCloseButton onClose={onClose} />
      <Box
        component="form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          setFormError('')
          const found = validate(form)
          setErrors(found)
          if (Object.keys(found).length === 0) create.mutate()
        }}
      >
        <DialogTitle sx={{ pr: 7, pb: 0.5 }}>Create salon</DialogTitle>
        <Typography variant="body2" color="text.secondary" sx={{ px: 3, pb: 1 }}>
          Creates the owner's login and their salon together. The owner can sign in right away.
        </Typography>
        <DialogContent sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, columnGap: 2, rowGap: 2, pt: '8px !important', alignContent: 'start' }}>
          {formError && (
            <Alert severity="error" sx={{ gridColumn: '1 / -1' }}>
              {formError}
            </Alert>
          )}
          <Typography variant="overline" color="text.secondary" sx={{ gridColumn: '1 / -1', lineHeight: 1.5 }}>
            Owner account
          </Typography>
          <TextField required label="Owner name" value={form.ownerName} onChange={set('ownerName')} error={Boolean(errors.ownerName)} helperText={errors.ownerName} autoComplete="off" />
          <TextField required label="Owner email" type="email" value={form.ownerEmail} onChange={set('ownerEmail')} error={Boolean(errors.ownerEmail)} helperText={errors.ownerEmail} autoComplete="off" />
          <TextField sx={{ gridColumn: '1 / -1' }} required label="Password" type="password" value={form.password} onChange={set('password')} error={Boolean(errors.password)} helperText={errors.password || 'At least 12 characters. Share it with the owner safely.'} autoComplete="new-password" />
          <Typography variant="overline" color="text.secondary" sx={{ gridColumn: '1 / -1', lineHeight: 1.5, mt: 1 }}>
            Salon
          </Typography>
          <TextField required label="Salon name" value={form.name} onChange={set('name')} error={Boolean(errors.name)} helperText={errors.name} />
          <TextField
            required
            label="Salon web address"
            value={form.slug}
            onChange={(e) => {
              setSlugEdited(true)
              e.target.value = cleanSlug(e.target.value)
              set('slug')(e)
            }}
            error={Boolean(errors.slug)}
            helperText={errors.slug || 'Auto-filled from the salon name, e.g. my-salon'}
          />
          <TextField label="City" value={form.city} onChange={set('city')} />
          <TextField label="Phone" value={form.phone} onChange={set('phone')} error={Boolean(errors.phone)} helperText={errors.phone} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create salon'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
