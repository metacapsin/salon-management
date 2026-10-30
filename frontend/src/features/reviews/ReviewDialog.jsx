import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, TextField, Typography, useMediaQuery } from '@mui/material'
import { friendlyError } from '../../api/client'
import { editReview, getReviewContext, submitReview } from '../../api/customerApi'
import QueryState from '../../components/QueryState'
import Stars from './Stars'

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

const when = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

// 1 se 5 star chunne wala. Keyboard se bhi chalta he (har star ek button).
function StarPicker({ value, onChange }) {
  return (
    <Box role="radiogroup" aria-label="Your rating" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <IconButton key={n} role="radio" aria-checked={value === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => onChange(n)} sx={{ p: 0.5, fontSize: { xs: '2.1rem', sm: '2.4rem' }, lineHeight: 1, color: n <= value ? '#c9a24a' : '#e3d3bd', '&:hover': { color: '#a97f2a' } }}>
          ★
        </IconButton>
      ))}
      <Typography sx={{ ml: 1, fontWeight: 700, color: '#5c3b22', minWidth: 80 }}>{LABELS[value]}</Typography>
    </Box>
  )
}

// Naya review likhna ya apna purana badalna (rating + comment)
function ReviewForm({ data, bookingId, onClose }) {
  const queryClient = useQueryClient()
  const existing = data.review
  const [rating, setRating] = useState(existing?.rating ?? 0)
  const [comment, setComment] = useState(existing?.comment ?? '')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(null)

  const save = useMutation({
    mutationFn: async () => {
      let review = existing
      if (!review) review = await submitReview(bookingId, { rating, comment })
      else if (rating !== review.rating || comment !== review.comment) review = await editReview(review.id, { rating, comment })
      return { review }
    },
    onSuccess: (result) => {
      setSaved(result)
      queryClient.invalidateQueries({ queryKey: ['public'] }) // salon ki rating, reviews aur khabrein naye ho jayein
    },
    onError: (e) => setError(friendlyError(e)),
  })

  function submit() {
    if (rating < 1) return setError('Please choose a star rating.')
    setError('')
    save.mutate()
  }

  if (saved) {
    return (
      <>
        <DialogContent sx={{ textAlign: 'center', display: 'grid', gap: 1.5, justifyItems: 'center', py: 4 }}>
          <Typography sx={{ fontSize: '3rem' }} aria-hidden>
            🎉
          </Typography>
          <Typography variant="h5" sx={{ fontWeight: 800, fontFamily: '"Playfair Display", Georgia, serif' }}>
            Thank you for your review!
          </Typography>
          <Stars value={saved.review.rating} size={26} />
          <Typography color="text.secondary">Your feedback helps others discover great salons.</Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button variant="contained" onClick={onClose} sx={{ '&&': { color: '#fff' } }}>
            Done
          </Button>
        </DialogActions>
      </>
    )
  }

  const booking = data.booking
  return (
    <>
      <DialogContent sx={{ display: 'grid', gap: 2.5, pt: 1 }}>
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#faf6f1', border: '1px solid #eadfd3' }}>
          <Typography sx={{ fontWeight: 700 }}>{booking.salonName}</Typography>
          <Typography variant="body2" color="text.secondary">
            {booking.services.join(', ')} · {when(booking.date)}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            How was your experience?
          </Typography>
          <StarPicker value={rating} onChange={setRating} />
        </Box>

        <TextField label="Write your review (optional)" placeholder="What did you like? How was the service and the staff?" value={comment} onChange={(e) => setComment(e.target.value)} multiline minRows={3} maxRows={6} fullWidth slotProps={{ htmlInput: { maxLength: 1000 } }} helperText={`${comment.length}/1000`} />

      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={onClose} disabled={save.isPending} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={submit} disabled={save.isPending} sx={{ '&&': { color: '#fff' }, textTransform: 'none', fontWeight: 700, px: 3 }}>
          {save.isPending ? 'Saving…' : existing ? 'Save changes' : 'Submit Review'}
        </Button>
      </DialogActions>
    </>
  )
}

// Review dene / badalne ka popup. bookingId se khulta he (khabar ya salon profile ke "Edit your review" se).
export default function ReviewDialog({ bookingId, onClose }) {
  const small = useMediaQuery('(max-width:599.95px)')
  const query = useQuery({ queryKey: ['public', 'review-context', bookingId], queryFn: () => getReviewContext(bookingId), staleTime: 0, gcTime: 0 })
  const data = query.data
  const blocked = data && !data.canReview && !data.review

  return (
    <Dialog open onClose={onClose} fullScreen={small} fullWidth maxWidth="sm" aria-labelledby="review-dialog-title">
      <DialogTitle id="review-dialog-title" sx={{ fontFamily: '"Playfair Display", Georgia, serif', fontWeight: 800 }}>
        {data?.review ? 'Your review' : 'Rate your visit'}
      </DialogTitle>
      <QueryState query={query}>
        {blocked && (
          <DialogContent>
            <Alert severity="info">You can review an appointment once it is completed.</Alert>
          </DialogContent>
        )}
        {data && !blocked && <ReviewForm data={data} bookingId={bookingId} onClose={onClose} />}
      </QueryState>
      {(query.isError || blocked) && (
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      )}
    </Dialog>
  )
}
