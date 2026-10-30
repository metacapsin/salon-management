import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Box, Button, ButtonBase, Popover, Typography } from '@mui/material'
import { getMyNotifications, markAllNotificationsRead, markNotificationRead } from '../../api/customerApi'
import Icon from '../../components/Icon'
import ReviewDialog from './ReviewDialog'

function timeAgo(iso) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// Customer ki ghanti: review request aur "thanks" jaisi apni khabrein, read/unread ke saath. Har minute khud check karti he.
// tone="dark" gehre header par (safed icon), "light" halke background par (gehra icon).
export default function CustomerBell({ tone = 'dark' }) {
  const queryClient = useQueryClient()
  const [anchor, setAnchor] = useState(null)
  const [reviewing, setReviewing] = useState(null) // bookingId
  const key = ['public', 'notifications']
  const query = useQuery({ queryKey: key, queryFn: getMyNotifications, refetchInterval: 60_000 })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const markOne = useMutation({ mutationFn: markNotificationRead, onSuccess: refresh })
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: refresh })

  const items = query.data?.notifications ?? []
  const unread = query.data?.unreadCount ?? 0
  const ink = tone === 'dark' ? '#fff' : '#2e1b0f'

  function open(n) {
    if (n.unread) markOne.mutate(n.id)
    setAnchor(null)
    setReviewing(n.bookingId)
  }

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="true"
        aria-expanded={Boolean(anchor)}
        sx={{ position: 'relative', flex: 'none', width: 44, height: 44, borderRadius: '50%', color: ink, border: `1px solid ${tone === 'dark' ? 'rgba(255,255,255,.35)' : 'rgba(46,27,15,.45)'}`, '&:hover': { bgcolor: tone === 'dark' ? 'rgba(255,255,255,.12)' : 'rgba(46,27,15,.08)' } }}
      >
        <Icon name="bell" />
        {unread > 0 && (
          <Box component="span" aria-hidden sx={{ position: 'absolute', top: -4, right: -4, minWidth: 20, height: 20, px: '5px', borderRadius: 10, bgcolor: '#c9a24a', color: '#2e1b0f', fontSize: 12, fontWeight: 800, display: 'grid', placeItems: 'center' }}>
            {unread > 9 ? '9+' : unread}
          </Box>
        )}
      </ButtonBase>

      <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }} slotProps={{ paper: { sx: { width: 'min(380px, calc(100vw - 24px))', maxHeight: '70vh', mt: 1, borderRadius: 3 } } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5, borderBottom: '1px solid #eadfd3' }}>
          <Typography sx={{ fontWeight: 800 }}>Notifications</Typography>
          {unread > 0 && (
            <Button size="small" onClick={() => markAll.mutate()} sx={{ textTransform: 'none' }}>
              Mark all as read
            </Button>
          )}
        </Box>
        {items.length === 0 ? (
          <Typography color="text.secondary" sx={{ p: 2.5 }}>
            No notifications yet. After a salon completes your appointment, you can rate your visit here.
          </Typography>
        ) : (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {items.map((n) => (
              <Box component="li" key={n.id} sx={{ px: 2, py: 1.5, borderBottom: '1px solid #f3ebe0', bgcolor: n.unread ? '#fff8e6' : 'transparent', display: 'grid', gap: 0.5 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{n.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {n.body}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {timeAgo(n.createdAt)}
                  </Typography>
                  {n.canReview && (
                    <Button size="small" variant="contained" onClick={() => open(n)} sx={{ '&&': { color: '#fff' }, textTransform: 'none', fontWeight: 700 }}>
                      Write a review
                    </Button>
                  )}
                  {n.type === 'review_submitted' && (
                    <Button size="small" variant="outlined" onClick={() => open(n)} sx={{ textTransform: 'none' }}>
                      View / edit
                    </Button>
                  )}
                  {n.type === 'review_request' && !n.canReview && (
                    <Typography variant="caption" sx={{ color: '#2f7d32', fontWeight: 700 }}>
                      Reviewed ✓
                    </Typography>
                  )}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Popover>

      {reviewing && <ReviewDialog bookingId={reviewing} onClose={() => setReviewing(null)} />}
    </>
  )
}
