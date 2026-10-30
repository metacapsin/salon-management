import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import { fetchBillingSummary, fetchPendingAppointmentCount } from '../../api/dashboardApi'
import { fetchReviews } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_LABELS, roleCan } from '../../auth/permissions'
import { Stars } from '../../components/Reviews'
import { Card, ErrorNote, Screen, SectionTitle, StatCard } from '../../components/Screen'
import { COLORS, FONT, RADIUS, SHADOW } from '../../config/theme'
import { formatPaise } from '../../utils/formatPaise'

// Local date as YYYY-MM-DD (the server reads it in the salon's own timezone).
function todayString() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}>
      <View style={styles.actionIcon}>
        <Ionicons name={icon} size={20} color={COLORS.espresso} />
      </View>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  )
}

// Salon dashboard. Each block is fetched only if the role may read it, so a receptionist or staff
// member never even asks for numbers they cannot see (and the server would answer 403 anyway).
export default function DashboardScreen({ navigation }) {
  const { user, role, activeSalon, activeSalonId } = useAuth()
  const canBilling = roleCan(role, 'billing.read')
  const canAppointments = roleCan(role, 'appointments.read')
  const canNew = roleCan(role, 'appointments.write')
  const canBill = roleCan(role, 'billing.write')
  const canReviews = roleCan(role, 'reviews.read')
  const today = todayString()

  const todayQuery = useQuery({
    queryKey: ['billing-summary', activeSalonId, today],
    queryFn: () => fetchBillingSummary({ from: today, to: today }),
    enabled: canBilling,
  })
  const allQuery = useQuery({
    queryKey: ['billing-summary', activeSalonId, 'all'],
    queryFn: () => fetchBillingSummary(),
    enabled: canBilling,
  })
  const pendingQuery = useQuery({
    queryKey: ['pending-appointments', activeSalonId],
    queryFn: fetchPendingAppointmentCount,
    enabled: canAppointments,
  })

  const reviewsQuery = useQuery({
    queryKey: ['reviews', activeSalonId, 'summary'],
    queryFn: () => fetchReviews({ page: 1, pageSize: 1 }),
    enabled: canReviews,
  })

  const queries = [todayQuery, allQuery, pendingQuery].filter((q) => q.fetchStatus !== 'idle' || q.data !== undefined)
  const refetchAll = () => Promise.all([canBilling && todayQuery.refetch(), canBilling && allQuery.refetch(), canAppointments && pendingQuery.refetch()])
  const failed = [todayQuery, allQuery, pendingQuery].find((q) => q.isError)
  const refreshing = queries.some((q) => q.isRefetching)

  return (
    <Screen onRefresh={refetchAll} refreshing={refreshing}>
      <View style={styles.hero}>
        <Text style={styles.heroHello}>Hello, {user?.name?.split(' ')[0]}</Text>
        <Text style={styles.heroSalon} numberOfLines={2}>{activeSalon?.salonName}</Text>
        <View style={styles.rolePill}>
          <Ionicons name="shield-checkmark-outline" size={14} color={COLORS.gold} />
          <Text style={styles.roleText}>{ROLE_LABELS[role] ?? role}</Text>
        </View>
      </View>

      {canNew || canBill ? (
        <View style={styles.quick}>
          {canNew ? <QuickAction icon="calendar-outline" label="New appointment" onPress={() => navigation.navigate('NewAppointment')} /> : null}
          {canBill ? <QuickAction icon="receipt-outline" label="New bill" onPress={() => navigation.navigate('CreateBill')} /> : null}
        </View>
      ) : null}

      {activeSalon?.salonStatus === 'suspended' ? (
        <Card style={styles.warning}>
          <Text style={styles.warningText}>This salon is suspended. You can view data, but changes are not allowed.</Text>
        </Card>
      ) : null}

      {failed ? <ErrorNote message={friendlyError(failed.error)} onRetry={refetchAll} /> : null}

      {canBilling ? (
        <>
          <SectionTitle>Today</SectionTitle>
          <View style={styles.grid}>
            <StatCard icon="receipt-outline" label="Bills" value={todayQuery.data?.invoices} loading={todayQuery.isLoading} />
            <StatCard icon="cash-outline" label="Billed" value={formatPaise(todayQuery.data?.billed)} loading={todayQuery.isLoading} />
            <StatCard icon="checkmark-done-outline" label="Received" value={formatPaise(todayQuery.data?.received)} loading={todayQuery.isLoading} />
          </View>
          <SectionTitle>Overall</SectionTitle>
          <View style={styles.grid}>
            <StatCard icon="hourglass-outline" label="Amount pending" value={formatPaise(allQuery.data?.pending)} loading={allQuery.isLoading} hint={allQuery.data ? `${allQuery.data.pendingCount} unpaid bills` : undefined} />
            <StatCard icon="trending-up-outline" label="Total billed" value={formatPaise(allQuery.data?.billed)} loading={allQuery.isLoading} />
          </View>
        </>
      ) : null}

      {canAppointments ? (
        <>
          <SectionTitle>Appointments</SectionTitle>
          <View style={styles.grid}>
            <StatCard icon="time-outline" label="Waiting for confirmation" value={pendingQuery.data} loading={pendingQuery.isLoading} />
          </View>
        </>
      ) : null}

      {canReviews ? (
        <>
          <SectionTitle>Customer reviews</SectionTitle>
          <Pressable accessibilityRole="button" accessibilityLabel="Open reviews" onPress={() => navigation.navigate('Reviews')} style={styles.reviews}>
            {reviewsQuery.data && reviewsQuery.data.summary.count > 0 ? (
              <>
                <Text style={styles.reviewAvg}>{reviewsQuery.data.summary.average.toFixed(1)}</Text>
                <View style={{ flex: 1 }}>
                  <Stars value={reviewsQuery.data.summary.average} size={16} />
                  <Text style={styles.muted}>{reviewsQuery.data.summary.count} {reviewsQuery.data.summary.count === 1 ? 'review' : 'reviews'} · see all and reply</Text>
                </View>
              </>
            ) : (
              <Text style={[styles.muted, { flex: 1 }]}>{reviewsQuery.isLoading ? 'Loading…' : 'No reviews yet. Customers get a review request after an appointment is completed.'}</Text>
            )}
            <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
          </Pressable>
        </>
      ) : null}

      {!canBilling && !canAppointments ? (
        <Card>
          <Text style={styles.muted}>Use the More tab to open the sections available to your role.</Text>
        </Card>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  hero: { backgroundColor: COLORS.espresso, borderRadius: RADIUS.xl, padding: 20, marginBottom: 16, ...SHADOW },
  heroHello: { color: COLORS.goldSoft, fontSize: 14 },
  heroSalon: { color: COLORS.cream, fontSize: 24, fontWeight: '700', fontFamily: FONT.heading, marginTop: 2 },
  rolePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 12, paddingHorizontal: 12, paddingVertical: 5, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: 'rgba(230,199,103,0.5)' },
  roleText: { color: COLORS.gold, fontSize: 13, fontWeight: '600' },
  quick: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  reviews: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 64, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.line, padding: 14 },
  reviewAvg: { fontSize: 30, fontWeight: '700', color: COLORS.espresso, fontFamily: FONT.heading },
  action: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 56, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.line, padding: 10 },
  actionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  actionText: { flex: 1, fontSize: 13, fontWeight: '700', color: COLORS.ink },
  muted: { fontSize: 14, color: COLORS.muted, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  warning: { borderColor: COLORS.gold, backgroundColor: COLORS.goldSoft },
  warningText: { color: COLORS.ink },
})
