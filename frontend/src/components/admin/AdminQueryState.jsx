import { Button } from '@mui/material'
import { friendlyError } from '../../api/client'
import EmptyState from '../EmptyState'
import Icon from '../Icon'

// QueryState jaisa hi (query, isEmpty, empty, children), par admin ke liye saaf-suthre 3 haal:
// loading = table jaisi skeleton rows, error = retry button ke saath card, khaali = icon + message.
// empty: koi bhi element, ya { icon, title, text } object.
export default function AdminQueryState({ query, isEmpty, empty, rows = 5, children }) {
  if (query.isPending) {
    return (
      <div className="ad-panel ad-skeleton" role="status" aria-label="Loading">
        {Array.from({ length: rows }, (_, i) => (
          <span key={i} className="ad-skeleton__row" style={{ '--w': `${92 - (i % 3) * 14}%` }} />
        ))}
      </div>
    )
  }
  if (query.isError) {
    const denied = query.error?.status === 403
    return (
      <div className={denied ? 'ad-notice ad-notice--warning' : 'ad-notice ad-notice--error'} role="alert">
        <Icon name={denied ? 'shield' : 'close'} size={20} />
        <p>{friendlyError(query.error)}</p>
        {!denied && (
          <Button size="small" variant="outlined" color="inherit" onClick={() => query.refetch()}>
            Try again
          </Button>
        )}
      </div>
    )
  }
  if (isEmpty) {
    if (empty && !empty.title) return empty
    const e = empty ?? {}
    return (
      <div className="ad-panel">
        <EmptyState icon={e.icon ?? 'sparkle'} title={e.title ?? 'Nothing here yet'} text={e.text} />
      </div>
    )
  }
  return children
}
