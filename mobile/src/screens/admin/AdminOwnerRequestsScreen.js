import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { approveOwnerRequest, fetchOwnerRequests, rejectOwnerRequest } from '../../api/platformApi'
import { friendlyError } from '../../api/client'
import Button from '../../components/Button'
import { FilterChips, StatusBadge } from '../../components/Chips'
import { Card, ErrorNote } from '../../components/Screen'
import { EmptyState, LoadingState } from '../../components/States'
import { COLORS } from '../../config/theme'
import { formatDate } from '../../utils/formatMoney'

const STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]

// One person who registered as a salon owner. Approve lets them sign in (and emails them); reject asks for a second tap.
function RequestCard({ item, onDone }) {
  const [confirmReject, setConfirmReject] = useState(false)
  const approve = useMutation({ mutationFn: () => approveOwnerRequest(item.id), onSuccess: onDone })
  const reject = useMutation({
    mutationFn: () => rejectOwnerRequest(item.id),
    onSuccess: () => {
      setConfirmReject(false)
      onDone()
    },
  })
  const error = approve.error || reject.error
  const busy = approve.isPending || reject.isPending

  return (
    <Card>
      <View style={styles.top}>
        <Text style={styles.name}>{item.name}</Text>
        <StatusBadge status={item.status} />
      </View>
      <Text style={styles.muted}>{item.email}</Text>
      <Text style={styles.muted}>Requested {formatDate(new Date(item.requestedAt).toLocaleDateString('en-CA'))}</Text>
      {error ? <Text style={styles.error}>{friendlyError(error)}</Text> : null}

      {confirmReject ? (
        <View style={styles.actions}>
          <Text style={styles.confirmText}>Reject {item.name}? They will not be able to sign in.</Text>
          <Button title="Yes, reject" onPress={() => reject.mutate()} loading={reject.isPending} />
          <Pressable accessibilityRole="button" accessibilityLabel="Keep request" onPress={() => setConfirmReject(false)} style={styles.keep}>
            <Text style={styles.keepText}>Keep request</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button title={item.status === 'approved' ? 'Resend email' : 'Approve'} onPress={() => approve.mutate()} loading={approve.isPending} disabled={busy} />
          {item.status === 'pending' ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Reject" disabled={busy} onPress={() => setConfirmReject(true)} style={styles.rejectButton}>
              <Text style={styles.rejectText}>Reject</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Card>
  )
}

// Super Admin: people waiting to become salon owners.
export default function AdminOwnerRequestsScreen() {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState('pending')

  const query = useInfiniteQuery({
    queryKey: ['platform-owner-requests', status],
    queryFn: ({ pageParam }) => fetchOwnerRequests({ status, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page * last.meta.pageSize < last.meta.total ? last.meta.page + 1 : undefined),
  })

  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  const total = query.data?.pages[0]?.meta.total

  // A request moves between the Pending / Approved / Rejected lists, so refresh them all.
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['platform-owner-requests'] })
    queryClient.invalidateQueries({ queryKey: ['platform-overview'] })
  }

  const header = (
    <View>
      <FilterChips options={STATUSES} value={status} onChange={setStatus} inset={0} />
      {total !== undefined ? (
        <Text style={styles.count}>
          {total} {status}
        </Text>
      ) : null}
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}
    </View>
  )

  return (
    <FlatList
      style={styles.screen}
      data={items}
      keyExtractor={(r) => r.id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={header}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={query.refetch}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListEmptyComponent={query.isLoading ? <LoadingState /> : !query.isError ? <EmptyState title={`No ${status} requests`} /> : null}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={COLORS.brown} /> : null}
      renderItem={({ item }) => <RequestCard item={item} onDone={refreshAll} />}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  list: { padding: 16, paddingBottom: 24 },
  count: { fontSize: 13, color: COLORS.muted, marginBottom: 8 },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 32 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.ink },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  error: { color: COLORS.error, fontSize: 13, marginTop: 8 },
  actions: { marginTop: 12, gap: 8 },
  confirmText: { fontSize: 14, color: COLORS.ink },
  rejectButton: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: COLORS.error, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  rejectText: { color: COLORS.error, fontSize: 15, fontWeight: '600' },
  keep: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  keepText: { color: COLORS.brown, fontSize: 15, fontWeight: '600' },
})
