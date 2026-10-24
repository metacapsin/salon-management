import { useLayoutEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchStaff } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { roleCan } from '../../auth/permissions'
import { FilterChips, StatusBadge } from '../../components/Chips'
import { Card, ErrorNote } from '../../components/Screen'
import { COLORS } from '../../config/theme'

const VIEWS = [
  { value: false, label: 'Active' },
  { value: true, label: 'All (incl. stopped)' },
]
const DAYS = [
  ['mon', 'Mon'],
  ['tue', 'Tue'],
  ['wed', 'Wed'],
  ['thu', 'Thu'],
  ['fri', 'Fri'],
  ['sat', 'Sat'],
  ['sun', 'Sun'],
]

// "Mon, Tue, Wed 09:00-18:00 · Sat 10:00-14:00". Days with the same hours are grouped. No own hours = salon hours.
export function hoursSummary(weeklyHours) {
  const groups = new Map()
  for (const [key, label] of DAYS) {
    const text = (weeklyHours?.[key] ?? []).map((i) => `${i.start}-${i.end}`).join(', ')
    if (!text) continue
    groups.set(text, [...(groups.get(text) ?? []), label])
  }
  if (groups.size === 0) return 'Follows the salon hours'
  return [...groups].map(([text, days]) => `${days.join(', ')} ${text}`).join(' · ')
}

// Owner/Manager/Receptionist can read staff. Only Owner/Manager may add or change them.
export default function StaffScreen({ navigation }) {
  const { role, activeSalonId } = useAuth()
  const canWrite = roleCan(role, 'staff.write')
  const [includeInactive, setIncludeInactive] = useState(false)

  const query = useQuery({
    queryKey: ['staff', activeSalonId, includeInactive],
    queryFn: () => fetchStaff({ includeInactive }),
  })

  useLayoutEffect(() => {
    if (!canWrite) return
    navigation.setOptions({
      headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Add staff" onPress={() => navigation.navigate('StaffForm')} style={styles.add}>
          <Text style={styles.addText}>+ Add</Text>
        </Pressable>
      ),
    })
  }, [navigation, canWrite])

  return (
    <View style={styles.screen}>
      {canWrite ? <FilterChips options={VIEWS} value={includeInactive} onChange={setIncludeInactive} /> : null}
      {query.isLoading ? <ActivityIndicator style={styles.loader} color={COLORS.brown} /> : null}
      {query.isError ? (
        <View style={styles.pad}>
          <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} />
        </View>
      ) : null}
      <FlatList
        data={query.data ?? []}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshing={query.isRefetching}
        onRefresh={query.refetch}
        ListEmptyComponent={!query.isLoading && !query.isError ? <Text style={styles.empty}>No staff yet.</Text> : null}
        renderItem={({ item }) => {
          const card = (
            <Card style={!item.active && styles.stopped}>
              <View style={styles.top}>
                <Text style={styles.name}>{item.name}</Text>
                {!item.active ? <StatusBadge status="inactive" /> : null}
              </View>
              {item.title ? <Text style={styles.muted}>{item.title}</Text> : null}
              {item.phone ? <Text style={styles.muted}>{item.phone}</Text> : null}
              {item.skills.length ? <Text style={styles.skills}>{item.skills.join(' · ')}</Text> : null}
              <Text style={styles.hours}>{hoursSummary(item.weeklyHours)}</Text>
            </Card>
          )
          if (!canWrite) return card
          return (
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} onPress={() => navigation.navigate('StaffForm', { staff: item })}>
              {card}
            </Pressable>
          )
        }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  pad: { paddingHorizontal: 16 },
  list: { padding: 16, paddingBottom: 24 },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 32 },
  add: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 12 },
  addText: { color: COLORS.gold, fontSize: 16, fontWeight: '700' },
  stopped: { opacity: 0.65 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.ink },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  skills: { fontSize: 13, color: COLORS.ink, marginTop: 6 },
  hours: { fontSize: 12, color: COLORS.muted, marginTop: 6 },
})
