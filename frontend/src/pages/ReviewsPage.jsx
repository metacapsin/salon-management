import { useState } from 'react'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, IconButton, Paper, TextField, Tooltip, Typography } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import { friendlyError } from '../api/client'
import { listReviews, removeReviewReply, replyToReview } from '../api/reviewsApi'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import QueryState from '../components/QueryState'
import RatingSummary from '../features/reviews/RatingSummary'
import Stars from '../features/reviews/Stars'

const when = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

// Ek review ka jawab likhna / badalna
function ReplyBox({ review, onDone }) {
  const [text, setText] = useState(review.reply?.text ?? '')
  const [error, setError] = useState('')
  const save = useMutation({
    mutationFn: () => replyToReview(review.id, text.trim()),
    onSuccess: onDone,
    onError: (e) => setError(friendlyError(e)),
  })
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      {error && <Alert severity="error">{error}</Alert>}
      <TextField label="Your reply" value={text} onChange={(e) => setText(e.target.value)} multiline minRows={2} maxRows={6} fullWidth autoFocus slotProps={{ htmlInput: { maxLength: 500 } }} helperText={`${text.length}/500. Everyone who opens your salon can see this reply.`} />
      <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
        <Button onClick={onDone} disabled={save.isPending} sx={{ textTransform: 'none' }}>
          Cancel
        </Button>
        <Button variant="contained" disabled={save.isPending || text.trim().length === 0} onClick={() => save.mutate()} sx={{ textTransform: 'none', fontWeight: 700 }}>
          {save.isPending ? 'Saving…' : 'Post reply'}
        </Button>
      </Box>
    </Box>
  )
}

function ReviewItem({ review, canReply, onChanged }) {
  const [replying, setReplying] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState('')
  const longComment = (review.comment?.length ?? 0) > 140
  const remove = useMutation({ mutationFn: () => removeReviewReply(review.id), onSuccess: onChanged, onError: (e) => setError(friendlyError(e)) })
  const done = () => {
    setReplying(false)
    onChanged()
  }

  return (
    <Paper component="article" variant="outlined" sx={{ px: 1.5, py: 1.25, borderRadius: 2.5, display: 'grid', gap: 0.75, bgcolor: '#fff', alignContent: 'start', breakInside: 'avoid', mb: '14px', borderColor: '#eadfd3', boxShadow: '0 1px 4px rgba(46, 27, 15, 0.06)', minWidth: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box aria-hidden sx={{ width: 28, height: 28, fontSize: 13, borderRadius: '50%', bgcolor: '#c9a24a', color: '#2e1b0f', fontWeight: 800, display: 'grid', placeItems: 'center', flex: 'none' }}>
          {review.customerName.charAt(0).toUpperCase()}
        </Box>
        <Box sx={{ minWidth: 0, flexGrow: 1, display: 'flex', alignItems: 'baseline', gap: 0.75 }}>
          <Typography sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }} noWrap>
            {review.customerName}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 'none' }}>
            · {when(review.createdAt)}
            {review.editedAt && ' · edited'}
          </Typography>
        </Box>
        <Stars value={review.rating} size={14} />
      </Box>

      {(review.services.length > 0 || review.visitDate) && (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {review.services.map((name) => (
            <Chip key={name} size="small" label={name} sx={{ height: 20, fontSize: 11, bgcolor: '#f3ead9', color: '#5b3a1e' }} />
          ))}
          {review.visitDate && <Chip size="small" variant="outlined" label={`Visit: ${when(`${review.visitDate}T00:00:00`)}`} sx={{ height: 20, fontSize: 11, borderColor: '#e3d3b4', color: '#7a5a14' }} />}
        </Box>
      )}

      {review.comment ? (
        <Box>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...(longComment && !expanded && { display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }) }}>
            {review.comment}
          </Typography>
          {longComment && (
            <Button size="small" onClick={() => setExpanded((v) => !v)} sx={{ textTransform: 'none', p: 0, minWidth: 0, fontSize: 12, fontWeight: 700 }}>
              {expanded ? 'Read less' : 'Read more'}
            </Button>
          )}
        </Box>
      ) : (
        <Typography variant="body2" color="text.secondary">
          No written feedback, rating only.
        </Typography>
      )}

      {review.helpfulCount > 0 && (
        <Typography variant="caption" color="text.secondary">
          👍 {review.helpfulCount} {review.helpfulCount === 1 ? 'person' : 'people'} found this helpful
        </Typography>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {replying ? (
        <ReplyBox review={review} onDone={done} />
      ) : review.reply ? (
        <Box sx={{ px: 1.25, py: 0.5, borderRadius: 1.5, bgcolor: '#faf6f1', borderLeft: '3px solid #c9a24a', display: 'grid', gap: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 26 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: '#7a5a14' }}>
              Your reply · {when(review.reply.repliedAt)}
            </Typography>
            {canReply && (
              <Box sx={{ display: 'flex', gap: 0.25 }}>
                <Tooltip title="Edit Reply">
                  <IconButton size="small" aria-label="Edit Reply" onClick={() => setReplying(true)} sx={{ p: 0.5, color: '#a9801f' }}>
                    <EditOutlinedIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete Reply">
                  <span>
                    <IconButton size="small" aria-label="Delete Reply" disabled={remove.isPending} onClick={() => setConfirmDelete(true)} sx={{ p: 0.5, color: '#c96a6a' }}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </span>
                </Tooltip>
              </Box>
            )}
          </Box>
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', pb: 0.25 }}>
            {review.reply.text}
          </Typography>
        </Box>
      ) : (
        canReply && (
          <Box>
            <Button size="small" variant="outlined" onClick={() => setReplying(true)} sx={{ textTransform: 'none', fontSize: 12, py: 0.25 }}>
              Reply
            </Button>
          </Box>
        )
      )}

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete reply?</DialogTitle>
        <DialogContent>
          <DialogContentText>Your reply to {review.customerName} will be removed. The review itself stays.</DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            color="error"
            variant="contained"
            disabled={remove.isPending}
            onClick={() => {
              setConfirmDelete(false)
              remove.mutate()
            }}
            sx={{ textTransform: 'none' }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

// Salon ke customers ke reviews: average, breakdown, latest reviews aur jawab dena. Server sirf isi salon ke reviews deta he.
export default function ReviewsPage() {
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const canReply = roleCan(role, 'reviews.reply')
  const [rating, setRating] = useState(null) // star filter ya null = sab
  const query = useInfiniteQuery({
    queryKey: ['salon', activeSalonId, 'reviews', rating],
    queryFn: ({ pageParam }) => listReviews({ page: pageParam, rating }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
  })
  const first = query.data?.pages[0]
  const reviews = query.data?.pages.flatMap((p) => p.reviews) ?? []
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['salon', activeSalonId, 'reviews'] })

  return (
    <Box sx={{ display: 'grid', gap: 1.5, alignContent: 'start' }}>
      <Typography variant="body2" color="text.secondary">
        What your customers say after their appointments. Reviews come only from completed appointments, so they are all real.
      </Typography>

      <QueryState query={query}>
        {first && first.summary.count === 0 && !rating && <Alert severity="info">No reviews yet. Customers get a review request after you mark an appointment as Completed.</Alert>}
        {first && (first.summary.count > 0 || rating) && (
          <>
            <RatingSummary summary={first.summary} active={rating} onPick={setRating} />
            {rating && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Chip label={`${rating} star reviews`} onDelete={() => setRating(null)} />
                <Typography variant="body2" color="text.secondary">
                  {first.total} {first.total === 1 ? 'review' : 'reviews'}
                </Typography>
              </Box>
            )}
            {reviews.length === 0 && <Alert severity="info">No {rating} star reviews.</Alert>}
            <Box sx={{ columnCount: { xs: 1, md: 2 }, columnGap: '14px' }}>
              {reviews.map((r) => (
                <ReviewItem key={r.id} review={r} canReply={canReply} onChanged={refresh} />
              ))}
            </Box>
            {query.hasNextPage && (
              <Button variant="outlined" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage} sx={{ justifySelf: 'center', textTransform: 'none' }}>
                {query.isFetchingNextPage ? 'Loading…' : 'Show more reviews'}
              </Button>
            )}
          </>
        )}
      </QueryState>
    </Box>
  )
}
