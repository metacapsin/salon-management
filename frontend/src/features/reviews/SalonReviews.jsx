import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, Typography } from '@mui/material'
import { getSalonReviews, markReviewHelpful, unmarkReviewHelpful } from '../../api/customerApi'
import QueryState from '../../components/QueryState'
import RatingSummary from './RatingSummary'
import ReviewDialog from './ReviewDialog'
import Stars from './Stars'

const when = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

// "Helpful" button under someone else's review. Your own review only shows the count.
function HelpfulButton({ review, salonId }) {
  const queryClient = useQueryClient()
  const toggle = useMutation({
    mutationFn: () => (review.isHelpful ? unmarkReviewHelpful(review.id) : markReviewHelpful(review.id)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['public', 'reviews', salonId] }),
  })
  const count = review.helpfulCount
  if (review.isMine) {
    return count > 0 ? (
      <Typography variant="caption" color="text.secondary">
        {count} {count === 1 ? 'person' : 'people'} found this helpful
      </Typography>
    ) : null
  }
  return (
    <Box>
      <Button size="small" variant={review.isHelpful ? 'contained' : 'outlined'} aria-pressed={review.isHelpful} disabled={toggle.isPending} onClick={() => toggle.mutate()} sx={{ textTransform: 'none', borderRadius: 5, '&&': review.isHelpful ? { color: '#fff' } : {} }}>
        👍 Helpful{count > 0 ? ` (${count})` : ''}
      </Button>
    </Box>
  )
}

function ReviewCard({ review, salonId, onEdit }) {
  return (
    <Box component="article" sx={{ p: 2, borderRadius: 3, border: '1px solid #eadfd3', bgcolor: '#fff', display: 'grid', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box aria-hidden sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: '#c9a24a', color: '#2e1b0f', fontWeight: 800, display: 'grid', placeItems: 'center', flex: 'none' }}>
          {review.customerName.charAt(0).toUpperCase()}
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1 }}>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
            {review.customerName}
            {review.isMine && <Chip size="small" label="You" sx={{ ml: 1, height: 20, bgcolor: '#f3e7c9', color: '#7a5a14', fontWeight: 700 }} />}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {when(review.createdAt)}
            {review.editedAt && ' · edited'}
          </Typography>
        </Box>
        <Stars value={review.rating} size={16} />
      </Box>

      {review.comment && <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{review.comment}</Typography>}

      {review.reply && (
        <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#faf6f1', borderLeft: '3px solid #c9a24a' }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: '#7a5a14' }}>
            Reply from the salon · {when(review.reply.repliedAt)}
          </Typography>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {review.reply.text}
          </Typography>
        </Box>
      )}

      <HelpfulButton review={review} salonId={salonId} />

      {review.isMine && (
        <Box>
          <Button size="small" onClick={() => onEdit(review.bookingId)} sx={{ textTransform: 'none' }}>
            Edit your review
          </Button>
        </Box>
      )}
    </Box>
  )
}

// Salon ki public profile ka "Ratings & reviews" hissa. Sab kuch asli customer reviews se; review na ho to saaf "No reviews yet".
export default function SalonReviews({ salonId }) {
  const [editing, setEditing] = useState(null)
  const query = useInfiniteQuery({
    queryKey: ['public', 'reviews', salonId],
    queryFn: ({ pageParam }) => getSalonReviews(salonId, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  })
  const first = query.data?.pages[0]
  const reviews = query.data?.pages.flatMap((p) => p.reviews) ?? []

  return (
    <Box component="section" aria-labelledby="reviews-title">
      <Typography id="reviews-title" variant="overline" color="text.secondary">
        Ratings and reviews
      </Typography>
      <QueryState query={query}>
        {first && first.summary.count === 0 && <Alert severity="info">No reviews yet. Reviews appear here after customers complete an appointment and share their experience.</Alert>}
        {first && first.summary.count > 0 && (
          <Box sx={{ display: 'grid', gap: 1.5, mt: 0.5 }}>
            <RatingSummary summary={first.summary} />
            {reviews.map((r) => (
              <ReviewCard key={r.id} review={r} salonId={salonId} onEdit={setEditing} />
            ))}
            {query.hasNextPage && (
              <Button variant="outlined" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} sx={{ justifySelf: 'center', textTransform: 'none' }}>
                {query.isFetchingNextPage ? 'Loading…' : 'Show more reviews'}
              </Button>
            )}
          </Box>
        )}
      </QueryState>
      {editing && <ReviewDialog bookingId={editing} onClose={() => setEditing(null)} />}
    </Box>
  )
}
