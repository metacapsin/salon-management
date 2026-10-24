import { useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchSalonSettings, updateSalonSettings } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { roleCan } from '../../auth/permissions'
import Button from '../../components/Button'
import { StatusBadge } from '../../components/Chips'
import { SwitchRow } from '../../components/Form'
import { Card, ErrorNote, Screen, SectionTitle } from '../../components/Screen'
import { COLORS } from '../../config/theme'
import { formatDate } from '../../utils/formatMoney'
import { FACILITY_LABELS } from './SettingsFormScreen'

const DAYS = [
  ['mon', 'Monday'],
  ['tue', 'Tuesday'],
  ['wed', 'Wednesday'],
  ['thu', 'Thursday'],
  ['fri', 'Friday'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
]

function Field({ label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{children || '—'}</Text>
    </View>
  )
}

// Owner and Manager can read the salon's settings. Only the Owner can change them.
// Opening hours are shown here; changing them is done on the website for now.
export default function SettingsScreen({ navigation }) {
  const { role, activeSalonId } = useAuth()
  const canWrite = roleCan(role, 'settings.write')
  const queryClient = useQueryClient()
  const [blockers, setBlockers] = useState([])
  const [toggleError, setToggleError] = useState('')

  const query = useQuery({ queryKey: ['settings', activeSalonId], queryFn: fetchSalonSettings })
  const salon = query.data?.salon

  const toggle = useMutation({
    mutationFn: (publicBookingEnabled) => updateSalonSettings({ publicBookingEnabled }),
    onMutate: () => {
      setBlockers([])
      setToggleError('')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings', activeSalonId] })
    },
    onError: (error) => {
      // The server refuses to publish until the setup list is done, and says what is missing.
      if (error?.code === 'PUBLISH_BLOCKED') setBlockers(error.details?.blockers ?? [])
      else setToggleError(friendlyError(error))
    },
  })

  const a = salon?.address ?? {}
  const address = [a.line1, a.area, a.city, a.state, a.pincode].filter(Boolean).join(', ')
  const facilities = (salon?.facilities ?? []).map((f) => FACILITY_LABELS[f] ?? f).join(', ')

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
            <SwitchRow
              label="Booking page is live"
              value={Boolean(salon.publicBookingEnabled)}
              onValueChange={(next) => canWrite && !toggle.isPending && toggle.mutate(next)}
              hint={canWrite ? 'When on, customers can find your salon and book online.' : 'Only the owner can change this.'}
            />
            {blockers.length > 0 ? (
              <View style={styles.blockers}>
                <Text style={styles.blockersTitle}>Finish these steps first:</Text>
                {blockers.map((b) => (
                  <Text key={b} style={styles.blockerLine}>
                    • {b}
                  </Text>
                ))}
              </View>
            ) : null}
            {toggleError ? <Text style={styles.error}>{toggleError}</Text> : null}
            {query.data?.publishBlockers?.length > 0 && !salon.publicBookingEnabled ? (
              <Text style={styles.muted}>Setup still needed: {query.data.publishBlockers.join(' ')}</Text>
            ) : null}
          </Card>

          <SectionTitle>Salon details</SectionTitle>
          <Card>
            <Field label="Booking address (slug)">{salon.slug}</Field>
            <Field label="Owner">{salon.ownerContact?.name}</Field>
            <Field label="Email">{salon.ownerContact?.email}</Field>
            <Field label="Phone">{salon.ownerContact?.phone}</Field>
            <Field label="Address">{address}</Field>
            <Field label="Timezone">{salon.timezone}</Field>
            <Field label="Audience">{salon.audience}</Field>
            <Field label="Facilities">{facilities}</Field>
            <Field label="About">{salon.about}</Field>
          </Card>
          {canWrite ? <Button title="Edit details" onPress={() => navigation.navigate('SettingsForm', { salon })} /> : null}

          <SectionTitle>Opening hours</SectionTitle>
          <Card>
            {DAYS.map(([key, label]) => {
              const list = salon.weeklyHours?.[key] ?? []
              return (
                <View key={key} style={styles.hoursRow}>
                  <Text style={styles.hoursDay}>{label}</Text>
                  <Text style={styles.hoursText}>{list.length ? list.map((i) => `${i.start}-${i.end}`).join(', ') : 'Closed'}</Text>
                </View>
              )
            })}
            <Text style={styles.muted}>Changing opening hours is done on the website for now.</Text>
          </Card>

          {salon.holidays?.length ? (
            <>
              <SectionTitle>Holidays</SectionTitle>
              <Card>
                {salon.holidays.map((h) => (
                  <View key={h.date} style={styles.hoursRow}>
                    <Text style={styles.hoursDay}>{formatDate(h.date)}</Text>
                    <Text style={styles.hoursText}>{h.name || 'Closed'}</Text>
                  </View>
                ))}
              </Card>
            </>
          ) : null}
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
  muted: { fontSize: 12, color: COLORS.muted, marginTop: 6 },
  error: { color: COLORS.error, fontSize: 13, marginTop: 6 },
  blockers: { backgroundColor: COLORS.goldSoft, borderRadius: 10, padding: 12, marginTop: 8 },
  blockersTitle: { fontSize: 14, fontWeight: '700', color: COLORS.ink, marginBottom: 4 },
  blockerLine: { fontSize: 14, color: COLORS.ink },
  hoursRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 5 },
  hoursDay: { fontSize: 14, color: COLORS.ink, flexShrink: 0 },
  hoursText: { fontSize: 14, color: COLORS.muted, flex: 1, textAlign: 'right' },
})
