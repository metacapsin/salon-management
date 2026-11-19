import { StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchPlatformOverview } from '../../api/dashboardApi'
import { friendlyError } from '../../api/client'
import { Card, ErrorNote, Screen, SectionTitle, StatCard } from '../../components/Screen'
import { COLORS, FONT, RADIUS, SHADOW } from '../../config/theme'
import { BrandMark } from '../../components/Brand'

// Super Admin dashboard: real counts from /platform/overview.
export default function AdminOverviewScreen() {
  const query = useQuery({ queryKey: ['platform-overview'], queryFn: fetchPlatformOverview })
  const stats = query.data?.stats
  const loading = query.isLoading

  return (
    <Screen onRefresh={query.refetch} refreshing={query.isRefetching}>
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}

      <View style={styles.hero}>
        <View style={styles.heroRing} pointerEvents="none" />
        <View style={{ flex: 1 }}>
          <Text style={styles.heroKicker}>Super Admin</Text>
          <Text style={styles.heroTitle}>Platform overview</Text>
          <Text style={styles.heroSub}>{loading ? '…' : `${stats?.total ?? 0} registered salons`}</Text>
        </View>
        <BrandMark size={46} />
      </View>

      <View style={styles.grid}>
        <StatCard icon="storefront-outline" label="Registered salons" value={stats?.total} loading={loading} />
        <StatCard icon="checkmark-circle-outline" label="Active" value={stats?.active} loading={loading} />
        <StatCard icon="pause-circle-outline" label="Suspended" value={stats?.suspended} loading={loading} />
        <StatCard icon="globe-outline" label="Public booking on" value={stats?.published} loading={loading} />
        <StatCard icon="sparkles-outline" label="New in 30 days" value={stats?.newLast30Days} loading={loading} />
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
  hero: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.espresso, borderRadius: RADIUS.xl, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: COLORS.goldLine, overflow: 'hidden', ...SHADOW },
  heroRing: { position: 'absolute', top: -70, right: -50, width: 200, height: 200, borderRadius: 100, borderWidth: 1, borderColor: 'rgba(230,199,103,0.22)' },
  heroKicker: { color: COLORS.gold, fontSize: 12, letterSpacing: 3, textTransform: 'uppercase' },
  heroTitle: { color: COLORS.cream, fontSize: 26, fontWeight: '700', fontFamily: FONT.heading, marginTop: 2 },
  heroSub: { color: COLORS.goldSoft, fontSize: 14, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  name: { fontSize: 16, fontWeight: '600', color: COLORS.espresso, fontFamily: FONT.heading },
  muted: { fontSize: 14, color: COLORS.muted },
})
