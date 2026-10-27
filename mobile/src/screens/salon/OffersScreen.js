import { useLayoutEffect } from 'react'
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { fetchOffers } from '../../api/salonApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { roleCan } from '../../auth/permissions'
import { StatusBadge } from '../../components/Chips'
import { Card, ErrorNote } from '../../components/Screen'
import { EmptyState, LoadingState } from '../../components/States'
import { COLORS } from '../../config/theme'
import { todayString } from '../../utils/dates'
import { formatDate } from '../../utils/formatMoney'

export const offerText = (o) => (o.discountType === 'percent' ? `${o.discountValue}% off` : `₹${o.discountValue} off`)

// running = on and today is inside the dates. The server applies the same rule when billing.
export function offerState(o, today = todayString()) {
  if (!o.active) return 'off'
  if (o.endsOn < today) return 'ended'
  if (o.startsOn > today) return 'scheduled'
  return 'running'
}

// Owner/Manager/Receptionist can read offers. Only Owner/Manager may add or change them.
export default function OffersScreen({ navigation }) {
  const { role, activeSalonId } = useAuth()
  const canWrite = roleCan(role, 'offers.write')
  const query = useQuery({ queryKey: ['offers', activeSalonId], queryFn: fetchOffers })

  useLayoutEffect(() => {
    if (!canWrite) return
    navigation.setOptions({
      headerRight: () => (
        <Pressable accessibilityRole="button" accessibilityLabel="Add offer" onPress={() => navigation.navigate('OfferForm')} style={styles.add}>
          <Text style={styles.addText}>+ Add</Text>
        </Pressable>
      ),
    })
  }, [navigation, canWrite])

  return (
    <View style={styles.screen}>
      {query.isLoading ? <LoadingState /> : null}
      {query.isError ? (
        <View style={styles.pad}>
          <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} />
        </View>
      ) : null}
      <FlatList
        data={query.data ?? []}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        refreshing={query.isRefetching}
        onRefresh={query.refetch}
        ListEmptyComponent={!query.isLoading && !query.isError ? <EmptyState title="No offers yet" /> : null}
        renderItem={({ item }) => {
          const card = (
            <Card>
              <View style={styles.top}>
                <Text style={styles.title}>{item.title}</Text>
                <StatusBadge status={offerState(item)} />
              </View>
              <Text style={styles.discount}>{offerText(item)}</Text>
              <Text style={styles.muted}>
                {formatDate(item.startsOn)} to {formatDate(item.endsOn)}
              </Text>
              <Text style={styles.muted}>
                {item.serviceIds.length ? `${item.serviceIds.length} service${item.serviceIds.length === 1 ? '' : 's'}` : 'All services'}
                {item.oncePerCustomer ? ' · once per customer' : ''}
              </Text>
              {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
            </Card>
          )
          if (!canWrite) return card
          return (
            <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.title}`} onPress={() => navigation.navigate('OfferForm', { offer: item })}>
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
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.ink },
  discount: { fontSize: 20, fontWeight: '700', color: COLORS.brown, marginTop: 4 },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  desc: { fontSize: 13, color: COLORS.ink, marginTop: 6 },
})
