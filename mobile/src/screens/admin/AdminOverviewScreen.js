import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchPlatformOverview } from '../../api/dashboardApi'
import { friendlyError } from '../../api/client'
import { Card, ErrorNote, Screen, SectionTitle, StatCard } from '../../components/Screen'
import { COLORS } from '../../config/theme'

// Super Admin dashboard: real counts from /platform/overview.
export default function AdminOverviewScreen() {
  const query = useQuery({ queryKey: ['platform-overview'], queryFn: fetchPlatformOverview })
  const stats = query.data?.stats
  const loading = query.isLoading

  return (
    <Screen onRefresh={query.refetch} refreshing={query.isRefetching}>
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}

      <View style={styles.grid}>
        <StatCard label="Registered salons" value={stats?.total} loading={loading} />
        <StatCard label="Active" value={stats?.active} loading={loading} />
        <StatCard label="Suspended" value={stats?.suspended} loading={loading} />
        <StatCard label="Public booking on" value={stats?.published} loading={loading} />
        <StatCard label="New in 30 days" value={stats?.newLast30Days} loading={loading} />
      </View>

      <SectionTitle>Recently registered</SectionTitle>
      {query.data?.recentSalons.length === 0 ? <Text style={styles.muted}>No salons yet.</Text> : null}
      {query.data?.recentSalons.map((s) => (
        <Card key={s.id}>
          <Text style={styles.name}>{s.name}</Text>
          <Text style={styles.muted}>
            {s.city || 'City not set'} · {s.status}
          </Text>
        </Card>
      ))}
    </Screen>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.ink },
  muted: { fontSize: 14, color: COLORS.muted },
})
