import { useCallback, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { listNotifications, markAllNotificationsRead } from '../api/salonApi'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import Icon from '../components/Icon'
import useDismiss from '../hooks/useDismiss'

function timeAgo(iso) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  return new Date(iso).toLocaleDateString()
}

// Ghanti (bell) wala popup. Salon ki asli khabrein dikhta hai, jaise "A customer is looking at your salon".
// Sirf Owner/Manager ko khabrein milti hain; baaki roles ke liye khaali rehta hai. Har 30 second me khud naya check karta hai.
export default function NotificationMenu() {
  const { role, activeSalonId } = useAuth()
  const queryClient = useQueryClient()
  const boxRef = useRef(null)
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(boxRef, open, close) // bahar click ya Escape par band

  const allowed = roleCan(role, 'notifications.read')
  const key = ['salon', activeSalonId, 'notifications']
  const query = useQuery({ queryKey: key, queryFn: listNotifications, enabled: allowed && Boolean(activeSalonId), refetchInterval: 30_000 })
  const markAll = useMutation({ mutationFn: markAllNotificationsRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: key }) })

  const items = query.data?.notifications ?? []
  const unread = query.data?.unreadCount ?? 0

  return (
    <div className="gl-pop" ref={boxRef}>
      <button
        type="button"
        className="gl-iconbtn"
        onClick={() => setOpen(!open)}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Icon name="bell" />
        {unread > 0 && <span className="gl-iconbtn__dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="gl-pop__panel gl-pop__panel--wide">
          <div className="gl-pop__head">
            <strong>Notifications</strong>
            {unread > 0 && (
              <button type="button" className="gl-link" onClick={() => markAll.mutate()}>
                Mark all as read
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="gl-pop__foot">{allowed ? 'No notifications yet. You will see a note here when a customer opens your salon.' : 'Notifications are shown to the owner and managers.'}</p>
          ) : (
            <ul className="gl-notes">
              {items.map((n) => (
                <li key={n.id} className={n.unread ? 'gl-note gl-note--unread' : 'gl-note'}>
                  <p>
                    <strong>{n.title}</strong>
                    <br />
                    {n.body}
                  </p>
                  <span>{timeAgo(n.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
