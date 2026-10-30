import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Alert, Box, Button, IconButton, Typography } from '@mui/material'
import { friendlyError } from '../../api/client'
import { makeCoverPhoto, removeSalonPhoto, uploadSalonPhoto } from '../../api/salonApi'

const MAX_PHOTOS = 5
const MAX_BYTES = 3 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Owner apne salon ki 5 tak photos lagata / hatata / cover badalta hai. Pehli photo customer ko card par sabse pehle dikhti hai.
export default function SalonPhotos({ images, readOnly, onChanged }) {
  const input = useRef(null)
  const [error, setError] = useState('')
  const fail = (e) => setError(friendlyError(e))
  const done = () => {
    setError('')
    onChanged()
  }

  const upload = useMutation({
    mutationFn: async (files) => {
      for (const file of files) await uploadSalonPhoto(file)
    },
    onSuccess: done,
    onError: (e) => {
      fail(e)
      onChanged() // jo upload ho gayi wo dikh jaye
    },
  })
  const remove = useMutation({ mutationFn: removeSalonPhoto, onSuccess: done, onError: fail })
  const cover = useMutation({ mutationFn: makeCoverPhoto, onSuccess: done, onError: fail })
  const busy = upload.isPending || remove.isPending || cover.isPending

  function pick(event) {
    const chosen = Array.from(event.target.files ?? [])
    event.target.value = ''
    const room = MAX_PHOTOS - images.length
    const ok = chosen.filter((f) => TYPES.includes(f.type) && f.size <= MAX_BYTES)
    if (ok.length < chosen.length) setError('Only JPG, PNG or WebP photos up to 3 MB are allowed.')
    else if (chosen.length > room) setError(`You can have at most ${MAX_PHOTOS} photos.`)
    else setError('')
    if (ok.length > 0 && room > 0) upload.mutate(ok.slice(0, room))
  }

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Add up to {MAX_PHOTOS} photos (JPG, PNG or WebP, at most 3 MB each). Customers see them as a slideshow on your salon card and profile (one photo stays still). The first photo is the cover.
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        {images.map((url, i) => (
          <Box key={url} sx={{ width: 150 }}>
            <Box sx={{ position: 'relative', width: 150, height: 110, borderRadius: 2, overflow: 'hidden', border: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
              <Box component="img" src={url} alt={`Salon photo ${i + 1}`} sx={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              {i === 0 && (
                <Typography variant="caption" sx={{ position: 'absolute', left: 0, bottom: 0, right: 0, textAlign: 'center', bgcolor: 'rgba(59,42,31,.78)', color: '#fff' }}>
                  Cover
                </Typography>
              )}
              {!readOnly && (
                <IconButton size="small" aria-label={`Remove photo ${i + 1}`} disabled={busy} onClick={() => remove.mutate(url)} sx={{ position: 'absolute', top: 4, right: 4, width: 26, height: 26, bgcolor: 'rgba(255,255,255,.92)', '&:hover': { bgcolor: '#fff' } }}>
                  ✕
                </IconButton>
              )}
            </Box>
            {!readOnly && i > 0 && (
              <Button size="small" disabled={busy} onClick={() => cover.mutate(url)} sx={{ mt: 0.5, textTransform: 'none' }}>
                Make cover
              </Button>
            )}
          </Box>
        ))}
        {!readOnly && images.length < MAX_PHOTOS && (
          <Button variant="outlined" disabled={busy} onClick={() => input.current?.click()} sx={{ width: 150, height: 110, borderStyle: 'dashed', flexDirection: 'column', textTransform: 'none' }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>+</span>
            <span style={{ fontSize: 13 }}>{upload.isPending ? 'Uploading…' : 'Add photo'}</span>
          </Button>
        )}
      </Box>
      {images.length === 0 && readOnly && <Typography color="text.secondary">No photos yet.</Typography>}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={pick} />
    </Box>
  )
}
