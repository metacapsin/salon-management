import { Link as RouterLink } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@mui/material'
import { getPlatformOverview, listOwnerRequests } from '../../api/platformApi'
import { useAuth } from '../../auth/AuthContext'
import AdminQueryState from '../../components/admin/AdminQueryState'
import PageHeader from '../../components/admin/PageHeader'
import StatTile from '../../components/admin/StatTile'
import StatusPill from '../../components/admin/StatusPill'
import Icon from '../../components/Icon'

const STAT_CARDS = [
  { key: 'total', label: 'Registered salons', icon: 'store', hint: 'All salons on Galora', to: '/admin/salons' },
  { key: 'active', label: 'Active', icon: 'check', tone: 'success', hint: 'Open for business' },
  { key: 'suspended', label: 'Suspended', icon: 'close', tone: 'warning', hint: 'Read-only for the team' },
  { key: 'published', label: 'Booking page published', icon: 'calendar', tone: 'gold', hint: 'Visible to customers' },
  { key: 'newLast30Days', label: 'New in last 30 days', icon: 'trending', hint: 'Recently registered' },
]

const firstName = (name) => (name ? name.trim().split(/\s+/)[0] : '')

// Platform ka overview. Saari ginti server ke asli database se aati hai.
export default function AdminDashboard() {
  const { user } = useAuth()
  const query = useQuery({ queryKey: ['platform', 'overview'], queryFn: getPlatformOverview })
  // Isi key se sidebar ka badge bhi bharta he, isliye ye call dobara network par nahi jaati.
  const pending = useQuery({ queryKey: ['platform', 'owner-requests', 'pending-count'], queryFn: () => listOwnerRequests({ page: 1, status: 'pending' }), staleTime: 30_000 })
  const pendingCount = pending.data?.meta?.total ?? 0
  const stats = query.data?.stats
  const recent = query.data?.recentSalons ?? []
  const name = firstName(user?.name)

  return (
    <>
      <PageHeader
        title={name ? `Welcome back, ${name}` : 'Platform overview'}
        subtitle="A live summary of every salon on Galora."
        actions={
          <Button component={RouterLink} to="/admin/salons" variant="contained">
            Manage salons
          </Button>
        }
      />
      <AdminQueryState query={query} rows={4}>
        <section className="ad-stats" aria-label="Platform summary">
          {STAT_CARDS.map((c) => (
            <StatTile key={c.key} icon={c.icon} label={c.label} value={stats?.[c.key] ?? 0} hint={c.hint} tone={c.tone} to={c.to} />
          ))}
        </section>

        <div className="ad-split">
          <section className="ad-panel" aria-labelledby="recent-salons">
            <div className="ad-panel__head">
              <div>
                <h2 id="recent-salons">Recently registered salons</h2>
                <p>The five newest salons</p>
              </div>
              <Button component={RouterLink} to="/admin/salons" size="small" variant="outlined">
                View all
              </Button>
            </div>
            {recent.length === 0 ? (
              <p className="ad-quick" style={{ margin: 0 }}>
                No salons have registered yet.
              </p>
            ) : (
              <ul className="ad-rows">
                {recent.map((s) => (
                  <li key={s.id}>
                    <div className="ad-rows__main">
                      <RouterLink className="ad-link" to={`/admin/salons/${s.id}`}>
                        {s.name}
                      </RouterLink>
                      <span className="ad-cell-sub">
                        {s.city || 'City not set'} · {new Date(s.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <StatusPill label={s.status} tone={s.status === 'active' ? 'success' : 'warning'} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ad-panel" aria-labelledby="quick-links">
            <div className="ad-panel__head">
              <h2 id="quick-links">Quick actions</h2>
            </div>
            <div className="ad-quick">
              <RouterLink to="/admin/owner-requests">
                <Icon name="userCheck" size={20} />
                Review owner requests
                {pendingCount > 0 && (
                  <span className="ad-nav__count" aria-label={`${pendingCount} pending`}>
                    {pendingCount}
                  </span>
                )}
              </RouterLink>
              <RouterLink to="/admin/inquiries">
                <Icon name="mail" size={20} />
                Contact inquiries
              </RouterLink>
              <RouterLink to="/admin/users">
                <Icon name="users" size={20} />
                Team &amp; roles
              </RouterLink>
              <RouterLink to="/admin/audit">
                <Icon name="history" size={20} />
                Audit history
              </RouterLink>
            </div>
          </section>
        </div>
      </AdminQueryState>
    </>
  )
}
