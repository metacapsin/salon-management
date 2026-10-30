import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listReviews } from '../api/reviewsApi'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import Stars from '../features/reviews/Stars'

// Dashboard par "Customer reviews": average, total, 5..1 breakdown aur 3 sabse naye reviews. Sab asli, owner/manager ko hi dikhta he.
export default function ReviewsPanel() {
  const { role, activeSalonId } = useAuth()
  const allowed = roleCan(role, 'reviews.read')
  const query = useQuery({ queryKey: ['salon', activeSalonId, 'reviews', 'dashboard'], queryFn: () => listReviews({ page: 1, pageSize: 3 }), enabled: allowed && Boolean(activeSalonId) })
  if (!allowed) return null
  const data = query.data

  return (
    <section className="gl-card gl-panel gl-fade-up" style={{ '--delay': '440ms' }} aria-labelledby="gl-reviews-title">
      <h3 id="gl-reviews-title">Customer reviews</h3>
      {query.isError && <p className="gl-empty">Could not load reviews.</p>}
      {data && data.summary.count === 0 && <p className="gl-empty">No reviews yet. Customers get a review request after an appointment is completed.</p>}
      {data && data.summary.count > 0 && (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '2rem', lineHeight: 1 }}>{data.summary.average.toFixed(1)}</strong>
            <div>
              <Stars value={data.summary.average} size={16} />
              <div style={{ fontSize: '0.85rem', opacity: 0.75 }}>
                {data.summary.count} {data.summary.count === 1 ? 'review' : 'reviews'}
              </div>
            </div>
          </div>
          <div style={{ display: 'grid', gap: 4 }}>
            {[5, 4, 3, 2, 1].map((star) => {
              const n = data.summary.breakdown[star] ?? 0
              return (
                <div key={star} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 24px', alignItems: 'center', gap: 8, fontSize: '0.82rem' }}>
                  <span>{star} ★</span>
                  <span style={{ height: 6, borderRadius: 3, background: '#eadfd3', overflow: 'hidden' }}>
                    <span style={{ display: 'block', height: '100%', width: `${(n / data.summary.count) * 100}%`, background: '#c9a24a' }} />
                  </span>
                  <span style={{ textAlign: 'right', opacity: 0.75 }}>{n}</span>
                </div>
              )
            })}
          </div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 10 }}>
            {data.reviews.map((r) => (
              <li key={r.id} style={{ borderTop: '1px solid #f0e6da', paddingTop: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <strong style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.customerName}</strong>
                  <Stars value={r.rating} size={14} />
                </div>
                {r.comment && <p style={{ margin: '4px 0 0', fontSize: '0.88rem', overflowWrap: 'anywhere' }}>{r.comment.length > 110 ? `${r.comment.slice(0, 110)}…` : r.comment}</p>}
              </li>
            ))}
          </ul>
          <Link to="/reviews" className="gl-link">
            See all reviews and reply
          </Link>
        </div>
      )}
    </section>
  )
}
