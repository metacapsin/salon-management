import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cancelMyBooking, fetchMyBookings } from '../../api/publicApi'
import { friendlyError } from '../../api/client'
import { StatusBadge } from '../../components/Chips'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { COLORS, FONT, RADIUS } from '../../config/theme'
import { formatDate, formatMoney } from '../../utils/formatMoney'

// Customer-friendly wording for the status (the server's status names stay the same).
const LABEL = { pending: 'Waiting for salon', no_show: 'Missed' }

function BookingRow({ booking, onCancel, cancelling, error }) {
  const [confirming, setConfirming] = useState(false)
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.salon} numberOfLines={1}>{booking.salonName}</Text>
        <StatusBadge status={booking.status} label={LABEL[booking.status]} />
      </View>
      <View style={styles.row}>
        <Ionicons name="calendar-outline" size={16} color={COLORS.brown} />
        <Text style={styles.when}>{formatDate(booking.date)} · {booking.startTime} · {booking.durationMin} min</Text>
      </View>
      <View style={styles.row}>
        <Ionicons name="cut-outline" size={16} color={COLORS.brown} />
        <Text style={styles.muted} numberOfLines={2}>{booking.services.join(', ')}{booking.mode === 'home' ? ' · at home' : ''}</Text>
      </View>
      <Text style={styles.total}>{formatMoney(booking.total)}</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {booking.canCancel ? (
        confirming ? (
          <View style={styles.confirmRow}>
            <Text style={styles.confirmText}>Cancel this appointment?</Text>
            <Pressable onPress={() => setConfirming(false)} accessibilityRole="button" style={styles.btn}>
              <Text style={styles.btnText}>Keep</Text>
            </Pressable>
            <Pressable onPress={onCancel} disabled={cancelling} accessibilityRole="button" accessibilityLabel="Yes, cancel" style={[styles.btn, styles.btnDanger]}>
              {cancelling ? <ActivityIndicator color="#fff" /> : <Text style={[styles.btnText, { color: '#fff' }]}>Yes, cancel</Text>}
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirming(true)} accessibilityRole="button" accessibilityLabel="Cancel appointment" style={styles.cancel}>
            <Text style={styles.cancelText}>Cancel appointment</Text>
          </Pressable>
        )
      ) : ['pending', 'confirmed'].includes(booking.status) ? (
        <Text style={styles.muted}>Too close to the start time to cancel online. Please call the salon.</Text>
      ) : null}
    </View>
  )
}

// The customer's own appointments, newest first. Cancelling is allowed only when the server says so (canCancel).
export default function MyBookingsScreen({ navigation }) {
  const queryClient = useQueryClient()
  const bookings = useQuery({ queryKey: ['public', 'my-bookings'], queryFn: fetchMyBookings })
  const [errors, setErrors] = useState({})
  const [busyId, setBusyId] = useState(null)

  const cancel = useMutation({
    mutationFn: cancelMyBooking,
    onMutate: (id) => {
      setBusyId(id)
      setErrors((e) => ({ ...e, [id]: '' }))
    },
    onError: (error, id) => setErrors((e) => ({ ...e, [id]: friendlyError(error) })),
    onSettled: () => {
      setBusyId(null)
      queryClient.invalidateQueries({ queryKey: ['public', 'my-bookings'] }) // the list always comes from the server
    },
  })

  let empty
  if (bookings.isLoading) empty = <LoadingState />
  else if (bookings.isError) empty = <ErrorState offline={bookings.error?.status === 0} message={friendlyError(bookings.error)} onRetry={bookings.refetch} />
  else empty = <EmptyState icon="calendar-outline" title="No appointments yet" text="Book your first salon visit." actionTitle="Find a salon" onAction={() => navigation.navigate('Home')} />

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={bookings.data ?? []}
      keyExtractor={(b) => String(b.id)}
      renderItem={({ item }) => <BookingRow booking={item} cancelling={busyId === item.id} error={errors[item.id]} onCancel={() => cancel.mutate(item.id)} />}
      ListEmptyComponent={empty}
      refreshControl={<RefreshControl refreshing={bookings.isRefetching} onRefresh={bookings.refetch} tintColor={COLORS.brown} />}
    />
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  content: { padding: 16, paddingBottom: 32 },
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.line, padding: 14, marginBottom: 12, gap: 6 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  salon: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  when: { flex: 1, fontSize: 14, color: COLORS.ink, fontWeight: '600' },
  muted: { flex: 1, fontSize: 13, color: COLORS.muted },
  total: { fontSize: 16, fontWeight: '700', color: COLORS.ink, marginTop: 2 },
  error: { fontSize: 13, color: COLORS.error },
  cancel: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  cancelText: { color: COLORS.error, fontWeight: '600', fontSize: 14 },
  confirmRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  confirmText: { fontSize: 14, color: COLORS.ink },
  btn: { minHeight: 44, minWidth: 72, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14, borderRadius: RADIUS.md, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.surface },
  btnDanger: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  btnText: { color: COLORS.brown, fontWeight: '600', fontSize: 14 },
})
