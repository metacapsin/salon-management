import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchBillingSummary, fetchPendingAppointmentCount } from '../../api/dashboardApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { ROLE_LABELS, roleCan } from '../../auth/permissions'
import { Card, ErrorNote, Screen, SectionTitle, StatCard } from '../../components/Screen'
import { COLORS } from '../../config/theme'
import { formatPaise } from '../../utils/formatPaise'

// Local date as YYYY-MM-DD (the server reads it in the salon's own timezone).
function todayString() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Salon dashboard. Each block is fetched only if the role may read it, so a receptionist or staff
// member never even asks for numbers they cannot see (and the server would answer 403 anyway).
export default function DashboardScreen() {
  const { user, role, activeSalon, activeSalonId } = useAuth()
  const canBilling = roleCan(role, 'billing.read')
  const canAppointments = roleCan(role, 'appointments.read')
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

  const queries = [todayQuery, allQuery, pendingQuery].filter((q) => q.fetchStatus !== 'idle' || q.data !== undefined)
  const refetchAll = () => Promise.all([canBilling && todayQuery.refetch(), canBilling && allQuery.refetch(), canAppointments && pendingQuery.refetch()])
  const failed = [todayQuery, allQuery, pendingQuery].find((q) => q.isError)
  const refreshing = queries.some((q) => q.isRefetching)

  return (
    <Screen onRefresh={refetchAll} refreshing={refreshing}>
      <Text style={styles.hello}>Hello, {user?.name?.split(' ')[0]}</Text>
      <Text style={styles.muted}>
        {activeSalon?.salonName} · {ROLE_LABELS[role] ?? role}
      </Text>

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
            <StatCard label="Bills" value={todayQuery.data?.invoices} loading={todayQuery.isLoading} />
            <StatCard label="Billed" value={formatPaise(todayQuery.data?.billed)} loading={todayQuery.isLoading} />
            <StatCard label="Received" value={formatPaise(todayQuery.data?.received)} loading={todayQuery.isLoading} />
          </View>
          <SectionTitle>Overall</SectionTitle>
          <View style={styles.grid}>
            <StatCard label="Amount pending" value={formatPaise(allQuery.data?.pending)} loading={allQuery.isLoading} hint={allQuery.data ? `${allQuery.data.pendingCount} unpaid bills` : undefined} />
            <StatCard label="Total billed" value={formatPaise(allQuery.data?.billed)} loading={allQuery.isLoading} />
          </View>
        </>
      ) : null}

      {canAppointments ? (
        <>
          <SectionTitle>Appointments</SectionTitle>
          <View style={styles.grid}>
            <StatCard label="Waiting for confirmation" value={pendingQuery.data} loading={pendingQuery.isLoading} />
          </View>
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
  hello: { fontSize: 24, fontWeight: '700', color: COLORS.ink, fontFamily: 'serif' },
  muted: { fontSize: 14, color: COLORS.muted, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  warning: { borderColor: COLORS.gold, backgroundColor: COLORS.goldSoft },
  warningText: { color: COLORS.ink },
})
