import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getBillingSummary } from '../../api/billingApi'
import { listBookings, listCustomers, listNotifications, listStaff } from '../../api/salonApi'
import { useAuth } from '../../auth/AuthContext'
import ActivityList from '../../components/ActivityList'
import AppointmentTable from '../../components/AppointmentTable'
import Icon from '../../components/Icon'
import ScheduleSummary from '../../components/ScheduleSummary'
import StaffAvailability from '../../components/StaffAvailability'
import StatCard from '../../components/StatCard'
import { formatPaise } from '../../utils/formatMoney'

// "Good morning" / "Good afternoon" / "Good evening"
function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function todayISO() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// Server ke status ko dashboard ke badge-naam me badalna
const STATUS_LABEL = { pending: 'Waiting', confirmed: 'Confirmed', completed: 'Completed' }

// "14:30" -> "02:30 PM"
function clock12(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

// Asli bookings ko table ki row me badalna
function toRow(b) {
  return {
    id: b.id,
    date: b.date === todayISO() ? 'today' : b.date,
    sort: `${b.date}-${b.startTime}`,
    time: clock12(b.startTime),
    customer: b.customerName,
    service: b.services.map((s) => s.name).join(', '),
    staff: b.staffName || 'Any staff',
    status: STATUS_LABEL[b.status] ?? b.status,
  }
}

const ago = (iso) => {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (mins < 60) return `${mins} min ago`
  if (mins < 1440) return `${Math.round(mins / 60)} hr ago`
  return `${Math.round(mins / 1440)} d ago`
}

// Dashboard page. Saara data asli API se aata hai; kuch bhi jhootha nahi.
export default function DashboardOverview() {
  const { user, activeSalonId } = useAuth()
  const [params, setParams] = useSearchParams() // URL ke "?q=..." wala hissa. Header ka search yahin likhta hai.
  const searchText = (params.get('q') ?? '').trim()
  const navigate = useNavigate()
  const today = todayISO()
  const key = ['salon', activeSalonId]

  const bookingsQ = useQuery({ queryKey: [...key, 'dash-bookings'], queryFn: () => listBookings(1, undefined, 100) })
  const staffQ = useQuery({ queryKey: [...key, 'staff'], queryFn: listStaff })
  const customersQ = useQuery({ queryKey: [...key, 'dash-customers'], queryFn: () => listCustomers({ page: 1 }) })
  const revenueQ = useQuery({ queryKey: [...key, 'dash-revenue', today], queryFn: () => getBillingSummary({ from: today, to: today }) })
  const notificationsQ = useQuery({ queryKey: [...key, 'notifications'], queryFn: listNotifications })

  const bookings = bookingsQ.data?.data?.bookings ?? []
  const todays = bookings.filter((b) => b.date === today && b.status !== 'cancelled')
  const staff = staffQ.data?.staff ?? []
  const activeStaff = staff.filter((p) => p.active)
  const received = revenueQ.data?.summary?.received

  const stats = [
    { id: 'appointments', icon: 'calendar', label: "Today's appointments", value: bookingsQ.isSuccess ? String(todays.length) : '—', note: `${todays.filter((b) => b.status === 'pending').length} waiting for confirmation` },
    { id: 'customers', icon: 'users', label: 'Total customers', value: customersQ.isSuccess ? String(customersQ.data.meta?.total ?? 0) : '—', note: 'In your customer list' },
    { id: 'revenue', icon: 'rupee', label: "Today's revenue", value: revenueQ.isSuccess ? formatPaise(received) : '—', note: 'Received after refunds' },
    { id: 'staff', icon: 'user', label: 'Active staff', value: staffQ.isSuccess ? `${activeStaff.length} of ${staff.length}` : '—', note: 'Marked active' },
  ]

  const schedule = ['completed', 'confirmed', 'pending'].map((st) => ({ status: STATUS_LABEL[st], count: todays.filter((b) => b.status === st).length })).filter((x) => x.count > 0)
  const staffList = staff.map((p) => ({ id: p.id, name: p.name, role: p.title || 'Staff', status: p.active ? 'Available' : 'On leave' }))
  const activity = (notificationsQ.data?.notifications ?? []).slice(0, 5).map((n) => ({ id: n.id, type: 'booking', text: n.title, time: ago(n.createdAt) }))

  // Aane wali (aaj ya aage ki), cancelled/completed nahi. Search ho to sirf matching rows, samay ke hisaab se sort.
  const needle = searchText.toLowerCase()
  const visible = bookings
    .filter((b) => b.date >= today && (b.status === 'pending' || b.status === 'confirmed'))
    .map(toRow)
    .filter((a) => !needle || [a.customer, a.service, a.staff].some((text) => text.toLowerCase().includes(needle)))
    .sort((a, b) => a.sort.localeCompare(b.sort))

  const firstName = user?.name?.split(' ')[0]
  const dateLabel = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  const newButton = (
    <button type="button" className="gl-btn gl-btn--gold" onClick={() => navigate('/appointments/new')}>
      <Icon name="plus" size={18} />
      New appointment
    </button>
  )

  return (
    <div className="gl-dashboard">
      <section className="gl-hero gl-fade-up">
        <div>
          <p className="gl-hero__date">{dateLabel}</p>
          <h2>
            {greeting()}, {firstName}
          </h2>
          <p className="gl-hero__text">Here is how your salon is doing today.</p>
        </div>
        <div className="gl-hero__action">{newButton}</div>
      </section>

      <section className="gl-stats" aria-label="Today at a glance">
        {stats.map((stat, index) => (
          <StatCard key={stat.id} {...stat} delay={index * 70} />
        ))}
      </section>

      <div className="gl-grid">
        <section className="gl-card gl-panel gl-panel--main gl-fade-up" style={{ '--delay': '260ms' }} aria-labelledby="gl-upcoming-title">
          <div className="gl-panel__head">
            <div>
              <h3 id="gl-upcoming-title">Upcoming appointments</h3>
              {searchText && (
                <p className="gl-panel__sub">
                  Showing results for “{searchText}”{' '}
                  <button type="button" className="gl-link" onClick={() => setParams({})}>
                    Clear
                  </button>
                </p>
              )}
            </div>
            {newButton}
          </div>
          <AppointmentTable items={visible} searchText={searchText} onClearSearch={() => setParams({})} action={newButton} />
        </section>

        <div className="gl-side">
          <section className="gl-card gl-panel gl-fade-up" style={{ '--delay': '320ms' }} aria-labelledby="gl-schedule-title">
            <h3 id="gl-schedule-title">Today&apos;s schedule</h3>
            {schedule.length ? <ScheduleSummary data={schedule} /> : <p className="gl-empty">No appointments today.</p>}
          </section>

          <section className="gl-card gl-panel gl-fade-up" style={{ '--delay': '380ms' }} aria-labelledby="gl-activity-title">
            <h3 id="gl-activity-title">Recent activity</h3>
            <ActivityList items={activity} />
          </section>
        </div>

        <section className="gl-card gl-panel gl-fade-up" style={{ '--delay': '500ms' }} aria-labelledby="gl-staff-title">
          <h3 id="gl-staff-title">Staff</h3>
          {staffList.length ? <StaffAvailability staff={staffList} /> : <p className="gl-empty">No staff added yet.</p>}
        </section>
      </div>
    </div>
  )
}
