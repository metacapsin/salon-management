import { useLayoutEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchServices } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { roleCan } from '../../auth/permissions'
import { FilterChips, StatusBadge } from '../../components/Chips'
import { Card, ErrorNote } from '../../components/Screen'
import { COLORS } from '../../config/theme'
import { formatMoney } from '../../utils/formatMoney'

const VIEWS = [
  { value: false, label: 'Active' },
  { value: true, label: 'All (incl. stopped)' },
]

const places = (s) => [s.atSalon ? 'At salon' : null, s.atHome ? 'At home' : null].filter(Boolean).join(' · ')

// Every role can read services (they are needed to book). Only Owner/Manager may add or change them.
export default function ServicesScreen({ navigation }) {
  const { role, activeSalonId } = useAuth()
  const canWrite = roleCan(role, 'services.write')
  const [includeInactive, setIncludeInactive] = useState(false)

  const query = useQuery({
    queryKey: ['services', activeSalonId, includeInactive],
    queryFn: () => fetchServices({ includeInactive }),
  })

  useLayoutEffect(() => {
    if (!canWrite) return
    navigation.setOptions({
      headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Add service" onPress={() => navigation.navigate('ServiceForm')} style={styles.add}>
          <Text style={styles.addText}>+ Add</Text>
        </Pressable>
      ),
    })
  }, [navigation, canWrite])

  const items = query.data ?? []

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
        data={items}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        refreshing={query.isRefetching}
        onRefresh={query.refetch}
        ListEmptyComponent={!query.isLoading && !query.isError ? <Text style={styles.empty}>No services yet.</Text> : null}
        renderItem={({ item }) => {
          const card = (
            <Card style={!item.active && styles.stopped}>
              <View style={styles.top}>
                <Text style={styles.name}>{item.name}</Text>
                {!item.active ? <StatusBadge status="inactive" /> : null}
              </View>
              <Text style={styles.muted}>{item.category}</Text>
              <Text style={styles.price}>
                {formatMoney(item.price)} · {item.durationMin} min
              </Text>
              <Text style={styles.muted}>{places(item)}</Text>
              {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
            </Card>
          )
          if (!canWrite) return card
          return (
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} onPress={() => navigation.navigate('ServiceForm', { service: item })}>
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
  price: { fontSize: 15, fontWeight: '600', color: COLORS.ink, marginTop: 6 },
  desc: { fontSize: 13, color: COLORS.ink, marginTop: 6 },
})
