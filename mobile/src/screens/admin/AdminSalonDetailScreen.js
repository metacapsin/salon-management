import { useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchPlatformSalon, setPlatformSalonStatus } from '../../api/platformApi'
import { friendlyError } from '../../api/client'
import Button from '../../components/Button'
import { StatusBadge } from '../../components/Chips'
import { Card, ErrorNote, Screen } from '../../components/Screen'
import { COLORS } from '../../config/theme'

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{children || '—'}</Text>
    </View>
  )
}

// One salon's platform-level details. Customers, billing and bookings are never shown here (private to the salon).
export default function AdminSalonDetailScreen({ route }) {
  const { id } = route.params
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['platform-salon', id], queryFn: () => fetchPlatformSalon(id) })
  const [confirming, setConfirming] = useState(false)
  const [reason, setReason] = useState('')
  const salon = query.data

  const mutation = useMutation({
    mutationFn: (status) => setPlatformSalonStatus(id, { status, reason: reason.trim() || undefined }),
    onSuccess: () => {
      setConfirming(false)
      setReason('')
      queryClient.invalidateQueries({ queryKey: ['platform-salon', id] })
      queryClient.invalidateQueries({ queryKey: ['platform-salons'] })
      queryClient.invalidateQueries({ queryKey: ['platform-overview'] })
    },
  })

  const nextStatus = salon?.status === 'suspended' ? 'active' : 'suspended'
  const suspending = nextStatus === 'suspended'
  const address = [salon?.address?.line1, salon?.address?.area, salon?.address?.city, salon?.address?.state, salon?.address?.pincode].filter(Boolean).join(', ')
  const team = Object.entries(salon?.teamByRole ?? {})
    .map(([role, n]) => `${n} ${role}`)
    .join(', ')

  return (
    <Screen onRefresh={query.refetch} refreshing={query.isRefetching}>
      {query.isLoading ? <ActivityIndicator color={COLORS.brown} style={{ marginTop: 24 }} /> : null}
      {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}

      {salon ? (
        <>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{salon.name}</Text>
            <StatusBadge status={salon.status} />
          </View>

          <Card>
            <Field label="Booking address (slug)">{salon.slug}</Field>
            <Field label="Registered on">{new Date(salon.createdAt).toLocaleString()}</Field>
            <Field label="Owner">{salon.ownerName}</Field>
            <Field label="Owner email">{salon.ownerEmail}</Field>
            <Field label="Owner phone">{salon.ownerPhone}</Field>
            <Field label="Team">{team}</Field>
            <Field label="Address">{address}</Field>
            <Field label="Timezone">{salon.timezone}</Field>
            <Field label="Audience">{salon.audience}</Field>
            <Field label="Booking page">{salon.publicBookingEnabled ? 'Published' : 'Not published'}</Field>
            <Field label="About">{salon.about}</Field>
          </Card>

          {!confirming ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={suspending ? 'Suspend salon' : 'Activate salon'}
              onPress={() => setConfirming(true)}
              style={[styles.statusButton, suspending ? styles.suspendButton : styles.activateButton]}
            >
              <Text style={[styles.statusText, { color: suspending ? COLORS.error : COLORS.success }]}>{suspending ? 'Suspend salon' : 'Activate salon'}</Text>
            </Pressable>
          ) : (
            <Card>
              <Text style={styles.confirmTitle}>{suspending ? 'Suspend this salon?' : 'Activate this salon?'}</Text>
              <Text style={styles.confirmText}>
                {suspending ? 'The salon team can still read their data, but they cannot make changes until you activate it again.' : 'The salon team can make changes again.'}
              </Text>
              <TextInput
                accessibilityLabel="Reason (optional)"
                value={reason}
                onChangeText={setReason}
                placeholder="Reason (optional)"
                placeholderTextColor="#a8978a"
                maxLength={300}
                multiline
                style={styles.reason}
              />
              {mutation.isError ? <Text style={styles.error}>{friendlyError(mutation.error)}</Text> : null}
              <View style={styles.gap} />
              <Button title={suspending ? 'Yes, suspend' : 'Yes, activate'} onPress={() => mutation.mutate(nextStatus)} loading={mutation.isPending} />
              <View style={styles.gap} />
              <Pressable accessibilityRole="button" accessibilityLabel="Keep as it is" onPress={() => setConfirming(false)} style={styles.keep}>
                <Text style={styles.keepText}>Keep as it is</Text>
              </Pressable>
            </Card>
          )}
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { flex: 1, fontSize: 22, fontWeight: '700', color: COLORS.ink, fontFamily: 'serif' },
  field: { paddingVertical: 6 },
  label: { fontSize: 12, color: COLORS.muted },
  value: { fontSize: 15, color: COLORS.ink, marginTop: 1 },
  statusButton: { minHeight: 48, borderRadius: 10, borderWidth: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  suspendButton: { borderColor: COLORS.error },
  activateButton: { borderColor: COLORS.success },
  statusText: { fontSize: 16, fontWeight: '600' },
  confirmTitle: { fontSize: 17, fontWeight: '700', color: COLORS.ink },
  confirmText: { fontSize: 14, color: COLORS.muted, marginTop: 4, marginBottom: 12 },
  reason: { minHeight: 72, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: '#fff', padding: 12, fontSize: 15, color: COLORS.ink, textAlignVertical: 'top' },
  error: { color: COLORS.error, fontSize: 13, marginTop: 8 },
  gap: { height: 10 },
  keep: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  keepText: { color: COLORS.brown, fontSize: 15, fontWeight: '600' },
})
