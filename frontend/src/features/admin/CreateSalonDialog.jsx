import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Typography } from '@mui/material'
import { fieldErrorsOf, friendlyError } from '../../api/client'
import { createPlatformSalon, uploadSalonImage } from '../../api/platformApi'
import DialogCloseButton from '../../components/DialogCloseButton'

const MAX_PHOTOS = 5
const MAX_PHOTO_BYTES = 3 * 1024 * 1024
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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
  const [photos, setPhotos] = useState([]) // [{ file, url (preview) }]
  const [photoError, setPhotoError] = useState('')
  const fileInput = useRef(null)
  const photosRef = useRef(photos)
  photosRef.current = photos
  // Dialog band hone par preview ke temporary links chhod do
  useEffect(() => () => photosRef.current.forEach((p) => URL.revokeObjectURL(p.url)), [])

  const create = useMutation({
    mutationFn: async () => {
      const data = await createPlatformSalon({
        ownerName: form.ownerName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        password: form.password,
        name: form.name.trim(),
        slug: form.slug.replace(/-+$/, ''),
        ...(form.city.trim() ? { address: { city: form.city.trim() } } : {}),
        ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      })
      // Salon ban gaya; ab photos ek-ek karke. Koi fail ho to salon phir bhi bana rehta he (photo baad me bhi lag sakti he).
      let photosFailed = 0
      for (const photo of photos) {
        try {
          await uploadSalonImage(data.salon.id, photo.file)
        } catch {
          photosFailed += 1
        }
      }
      return { ...data, photosFailed }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['platform'] })
      onCreated?.({ email: form.ownerEmail.trim(), emailSent: data.emailSent, photosFailed: data.photosFailed })
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

  function addPhotos(event) {
    const chosen = Array.from(event.target.files ?? [])
    event.target.value = '' // wahi file dobara chunne par bhi chale
    setPhotoError('')
    const next = [...photos]
    for (const file of chosen) {
      if (next.length >= MAX_PHOTOS) {
        setPhotoError(`You can add up to ${MAX_PHOTOS} photos.`)
        break
      }
      if (!PHOTO_TYPES.includes(file.type)) {
        setPhotoError('Only JPG, PNG or WebP photos are allowed.')
        continue
      }
      if (file.size > MAX_PHOTO_BYTES) {
        setPhotoError('Each photo can be at most 3 MB.')
        continue
      }
      next.push({ file, url: URL.createObjectURL(file) })
    }
    setPhotos(next)
  }

  function removePhoto(index) {
    URL.revokeObjectURL(photos[index].url)
    setPhotos(photos.filter((_, i) => i !== index))
    setPhotoError('')
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
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              Salon photos (optional, up to {MAX_PHOTOS})
            </Typography>
            <Typography variant="caption" color={photoError ? 'error' : 'text.secondary'} component="p" sx={{ mb: 1 }}>
              {photoError || 'JPG, PNG or WebP, at most 3 MB each. The first photo is the cover customers see.'}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
              {photos.map((p, i) => (
                <Box key={p.url} sx={{ position: 'relative', width: 92, height: 92, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider' }}>
                  <Box component="img" src={p.url} alt={`Salon photo ${i + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  {i === 0 && (
                    <Typography variant="caption" sx={{ position: 'absolute', left: 0, bottom: 0, right: 0, textAlign: 'center', bgcolor: 'rgba(59,42,31,.75)', color: '#fff', fontSize: 11 }}>
                      Cover
                    </Typography>
                  )}
                  <IconButton size="small" aria-label={`Remove photo ${i + 1}`} onClick={() => removePhoto(i)} disabled={create.isPending} sx={{ position: 'absolute', top: 2, right: 2, width: 24, height: 24, bgcolor: 'rgba(255,255,255,.9)', '&:hover': { bgcolor: '#fff' } }}>
                    ✕
                  </IconButton>
                </Box>
              ))}
              {photos.length < MAX_PHOTOS && (
                <Button variant="outlined" onClick={() => fileInput.current?.click()} disabled={create.isPending} sx={{ width: 92, height: 92, borderStyle: 'dashed', flexDirection: 'column', textTransform: 'none' }}>
                  <span style={{ fontSize: 24, lineHeight: 1 }}>+</span>
                  <span style={{ fontSize: 12 }}>Add photo</span>
                </Button>
              )}
            </Box>
            <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={addPhotos} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1 }}>
          <Button onClick={onClose} disabled={create.isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={create.isPending}>
            {create.isPending ? (photos.length ? 'Creating & uploading…' : 'Creating…') : 'Create salon'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  )
}
