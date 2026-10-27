import { useLayoutEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { fetchBookings, updateBookingStatus } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { roleCan } from '../../auth/permissions'
import { FilterChips, StatusBadge } from '../../components/Chips'
import { Card } from '../../components/Screen'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { Ionicons } from '@expo/vector-icons'
import { COLORS } from '../../config/theme'
import { formatDate, formatMoney } from '../../utils/formatMoney'

const FILTERS = [
  { value: undefined, label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
]

// Same rules as the server (pending -> confirmed/cancelled, confirmed -> completed/cancelled).
// The server checks them again and answers 409 for a wrong move.
const ACTIONS = {
  pending: [{ to: 'confirmed', label: 'Confirm' }, { to: 'cancelled', label: 'Cancel', danger: true }],
  confirmed: [{ to: 'completed', label: 'Mark done' }, { to: 'cancelled', label: 'Cancel', danger: true }],
}

function ActionButton({ action, onPress, disabled, confirming }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={action.label}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, action.danger && styles.actionDanger, disabled && { opacity: 0.6 }]}
    >
      <Text style={[styles.actionText, action.danger && styles.actionTextDanger]}>{confirming ? 'Tap again to cancel' : action.label}</Text>
    </Pressable>
  )
}

function BookingCard({ booking, canWrite, onAction, busy, error, confirmingId, setConfirmingId }) {
  const actions = canWrite ? (ACTIONS[booking.status] ?? []) : []
  return (
    <Card>
      <View style={styles.top}>
        <Text style={styles.when}>
          {formatDate(booking.date)} · {booking.startTime}
        </Text>
        <StatusBadge status={booking.status} />
      </View>
      <View style={styles.person}>
        <Ionicons name="person-circle-outline" size={20} color={COLORS.brown} />
        <Text style={styles.name} numberOfLines={1}>{booking.customerName}</Text>
      </View>
      <Text style={styles.muted}>{booking.customerPhone}</Text>
      <Text style={styles.services}>{booking.services.map((s) => s.name).join(', ')}</Text>
      <Text style={styles.muted}>
        {booking.durationMin} min{booking.staffName ? ` · ${booking.staffName}` : ''} · {formatMoney(booking.total)}
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {actions.length > 0 ? (
        <View style={styles.actions}>
          {actions.map((a) => {
            const confirming = a.danger && confirmingId === booking.id
            return (
              <ActionButton
                key={a.to}
                action={a}
                disabled={busy}
                confirming={confirming}
                onPress={() => {
                  // Cancelling cannot be undone, so it needs a second tap.
                  if (a.danger && !confirming) return setConfirmingId(booking.id)
                  setConfirmingId(null)
                  onAction(booking.id, a.to)
                }}
              />
            )
          })}
        </View>
      ) : null}
    </Card>
  )
}

export default function AppointmentsScreen({ navigation }) {
  const { role, activeSalonId } = useAuth()
  const canWrite = roleCan(role, 'appointments.write')
  const queryClient = useQueryClient()
  const [status, setStatus] = useState(undefined)
  const [confirmingId, setConfirmingId] = useState(null)
  const [rowErrors, setRowErrors] = useState({})
  const [busyId, setBusyId] = useState(null)

  const query = useInfiniteQuery({
    queryKey: ['bookings', activeSalonId, status ?? 'all'],
    queryFn: ({ pageParam }) => fetchBookings({ status, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page * last.meta.pageSize < last.meta.total ? last.meta.page + 1 : undefined),
  })

  const mutation = useMutation({
    mutationFn: ({ id, to }) => updateBookingStatus(id, to),
    onMutate: ({ id }) => {
      setBusyId(id)
      setRowErrors((e) => ({ ...e, [id]: null }))
    },
    onError: (error, { id }) => setRowErrors((e) => ({ ...e, [id]: friendlyError(error) })),
    onSettled: () => {
      setBusyId(null)
      queryClient.invalidateQueries({ queryKey: ['bookings', activeSalonId] })
      queryClient.invalidateQueries({ queryKey: ['pending-appointments', activeSalonId] })
    },
  })

  // "+ New" opens the new appointment form (only for roles that may write appointments; the server checks too).
  useLayoutEffect(() => {
    if (!canWrite) return
    navigation.setOptions({
      headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="New appointment" onPress={() => navigation.navigate('NewAppointment')} style={styles.add}>
          <Text style={styles.addText}>+ New</Text>
        </Pressable>
      ),
    })
  }, [navigation, canWrite])

  const items = query.data?.pages.flatMap((p) => p.items) ?? []

  return (
    <View style={styles.screen}>
      <FilterChips options={FILTERS} value={status} onChange={setStatus} />
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? <ErrorState offline={query.error?.status === 0} message={friendlyError(query.error)} onRetry={query.refetch} /> : null}
      <FlatList
        data={items}
        keyExtractor={(b) => b.id}
        contentContainerStyle={styles.list}
        refreshing={query.isRefetching && !query.isFetchingNextPage}
        onRefresh={query.refetch}
        onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={!query.isLoading && !query.isError ? <EmptyState icon="calendar-outline" title="No appointments here" text={status ? 'Try another filter.' : 'New bookings will show up here.'} /> : null}
        ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={COLORS.brown} /> : null}
        renderItem={({ item }) => (
          <BookingCard
            booking={item}
            canWrite={canWrite}
            busy={busyId === item.id}
            error={rowErrors[item.id]}
            confirmingId={confirmingId}
            setConfirmingId={setConfirmingId}
            onAction={(id, to) => mutation.mutate({ id, to })}
          />
        )}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  pad: { paddingHorizontal: 16 },
  add: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 12 },
  addText: { color: COLORS.gold, fontSize: 16, fontWeight: '700' },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 32 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  when: { flex: 1, fontSize: 14, fontWeight: '700', color: COLORS.brown },
  person: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: COLORS.ink },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  services: { fontSize: 14, color: COLORS.ink, marginTop: 6 },
  error: { color: COLORS.error, fontSize: 13, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  action: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: COLORS.brown, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  actionDanger: { backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.error },
  actionText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  actionTextDanger: { color: COLORS.error },
})
