import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { useInfiniteQuery } from '@tanstack/react-query'
import { fetchPlatformAudit } from '../../api/platformApi'
import { friendlyError } from '../../api/client'
import { Card, ErrorNote } from '../../components/Screen'
import { EmptyState, LoadingState } from '../../components/States'
import { COLORS } from '../../config/theme'

const MAX_CHANGE_LINES = 6

// "booking.status_changed" -> "booking · status changed"
const actionLabel = (action) => action.replace('.', ' · ').replace(/_/g, ' ')

const formatWhen = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

const showValue = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v))

// The changes object as short "key: value" lines (the server already hides secrets).
function changeLines(changes) {
  const entries = Object.entries(changes ?? {})
  const lines = entries.slice(0, MAX_CHANGE_LINES).map(([k, v]) => `${k}: ${showValue(v)}`)
  if (entries.length > MAX_CHANGE_LINES) lines.push(`+ ${entries.length - MAX_CHANGE_LINES} more`)
  return lines
}

// Super Admin: what happened across all salons, newest first. Read only; nothing can be edited or deleted here.
export default function AdminAuditScreen() {
  const query = useInfiniteQuery({
    queryKey: ['platform-audit'],
    queryFn: ({ pageParam }) => fetchPlatformAudit({ page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page * last.meta.pageSize < last.meta.total ? last.meta.page + 1 : undefined),
  })

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const total = query.data?.pages[0]?.meta.total

  const header = (
    <View>
      {total !== undefined ? <Text style={styles.count}>{total} {total === 1 ? 'event' : 'events'}</Text> : null}
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}
    </View>
  )

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(e) => e.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={query.refetch}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={query.isLoading ? <LoadingState /> : !query.isError ? <EmptyState title="No events yet" /> : null}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={COLORS.brown} /> : null}
      renderItem={({ item }) => {
        const lines = changeLines(item.changes)
        return (
          <Card>
            <Text style={styles.action}>{actionLabel(item.action)}</Text>
            <Text style={styles.muted}>
              {item.actorName ?? 'System'} · {formatWhen(item.createdAt)}
            </Text>
            {item.salonName ? <Text style={styles.muted}>{item.salonName}</Text> : null}
            {lines.length > 0 ? (
              <View style={styles.changes}>
                {lines.map((l, i) => (
                  <Text key={i} style={styles.change}>
                    {l}
                  </Text>
                ))}
              </View>
            ) : null}
          </Card>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  list: { padding: 16, paddingBottom: 24 },
  count: { fontSize: 13, color: COLORS.muted, marginBottom: 8 },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 32 },
  action: { fontSize: 15, fontWeight: '600', color: COLORS.ink, textTransform: 'capitalize' },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  changes: { marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: '#f6f0e8' },
  change: { fontSize: 12, color: COLORS.ink, marginTop: 1 },
})
