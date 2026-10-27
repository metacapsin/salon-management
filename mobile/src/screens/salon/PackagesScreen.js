import { useEffect, useLayoutEffect, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { fetchCustomerPackages, fetchPackages } from '../../api/packagesApi'
import { friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { roleCan } from '../../auth/permissions'
import { FilterChips, Segmented, StatusBadge } from '../../components/Chips'
import { Card, ErrorNote } from '../../components/Screen'
import { EmptyState, LoadingState } from '../../components/States'
import { COLORS, TOUCH_MIN } from '../../config/theme'
import { MembersTab, PlansTab } from './MembershipTabs'
import { formatDate, formatMoney } from '../../utils/formatMoney'

// Four short tabs. Packages/Sold are the bundles; Plans/Members are the memberships (Silver, Gold...).
const TABS = [
  { value: 'packages', label: 'Packages' },
  { value: 'sold', label: 'Sold' },
  { value: 'plans', label: 'Plans' },
  { value: 'members', label: 'Members' },
]
const TEMPLATE_VIEWS = [
  { value: 'active', label: 'Active' },
  { value: undefined, label: 'All' },
]
const SOLD_STATUS = [
  { value: 'active', label: 'Active' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'expired', label: 'Expired' },
  { value: 'exhausted', label: 'Used up' },
  { value: 'cancelled', label: 'Cancelled' },
]

function useDebounced(value, ms = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

function TemplatesTab({ navigation, canWrite, salonId }) {
  const [status, setStatus] = useState('active')
  const query = useQuery({ queryKey: ['packages', salonId, status ?? 'all'], queryFn: () => fetchPackages({ status }) })
  return (
    <FlatList
      data={query.data ?? []}
      keyExtractor={(p) => p.id}
      contentContainerStyle={styles.list}
      refreshing={query.isRefetching}
      onRefresh={query.refetch}
      ListHeaderComponent={
        <View>
          {canWrite ? <FilterChips options={TEMPLATE_VIEWS} value={status} onChange={setStatus} inset={0} /> : null}
          {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}
        </View>
      }
      ListEmptyComponent={query.isLoading ? <LoadingState /> : !query.isError ? <EmptyState title="No packages yet" /> : null}
      renderItem={({ item }) => {
        const card = (
          <Card style={!item.active && styles.stopped}>
            <View style={styles.top}>
              <Text style={styles.title}>{item.name}</Text>
              {!item.active ? <StatusBadge status="inactive" /> : null}
            </View>
            <Text style={styles.muted}>{item.items.map((i) => `${i.serviceName} × ${i.sessions}`).join(', ')}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatMoney(item.packagePrice)}</Text>
              {item.savings > 0 ? <Text style={styles.was}>{formatMoney(item.originalPrice)}</Text> : null}
              {item.savings > 0 ? <Text style={styles.save}>Save {item.savingsPercent}%</Text> : null}
            </View>
            <Text style={styles.muted}>
              Valid {item.validityDays} days after purchase
              {item.saleStartsOn || item.saleEndsOn ? ` · On sale ${item.saleStartsOn ? formatDate(item.saleStartsOn) : 'now'} to ${item.saleEndsOn ? formatDate(item.saleEndsOn) : 'open'}` : ''}
            </Text>
            {item.description ? <Text style={styles.desc}>{item.description}</Text> : null}
          </Card>
        )
        if (!canWrite) return card
        return (
          <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.name}`} onPress={() => navigation.navigate('PackageForm', { pkg: item })}>
            {card}
          </Pressable>
        )
      }}
    />
  )
}

function SoldTab({ navigation, salonId }) {
  const [status, setStatus] = useState('active')
  const [text, setText] = useState('')
  const search = useDebounced(text.trim())
  const query = useInfiniteQuery({
    queryKey: ['customer-packages', salonId, status, search],
    queryFn: ({ pageParam }) => fetchCustomerPackages({ search: search || undefined, status, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.meta.page * last.meta.pageSize < last.meta.total ? last.meta.page + 1 : undefined),
  })
  const items = query.data?.pages.flatMap((p) => p.items) ?? []
  return (
    <FlatList
      data={items}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.list}
      refreshing={query.isRefetching && !query.isFetchingNextPage}
      onRefresh={query.refetch}
      onEndReached={() => query.hasNextPage && !query.isFetchingNextPage && query.fetchNextPage()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View>
          <TextInput
            accessibilityLabel="Search customer packages"
            value={text}
            onChangeText={setText}
            placeholder="Customer name, phone or package"
            placeholderTextColor="#a8978a"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.search}
          />
          <FilterChips options={SOLD_STATUS} value={status} onChange={setStatus} inset={0} />
          {query.isError ? <ErrorNote message={friendlyError(query.error)} onRetry={query.refetch} /> : null}
        </View>
      }
      ListEmptyComponent={query.isLoading ? <LoadingState /> : !query.isError ? <EmptyState title="No packages here" /> : null}
      ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={COLORS.brown} /> : null}
      renderItem={({ item }) => (
        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.packageName} of ${item.customerName}`} onPress={() => navigation.navigate('CustomerPackageDetail', { id: item.id, title: item.packageName })}>
          <Card>
            <View style={styles.top}>
              <Text style={styles.title}>{item.packageName}</Text>
              <StatusBadge status={item.status} />
            </View>
            <Text style={styles.name}>{item.customerName}</Text>
            <Text style={styles.muted}>{item.customerPhone}</Text>
            <Text style={styles.sessions}>
              {item.remainingSessions} of {item.totalSessions} sessions left
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.muted}>Expires {formatDate(item.expiresOn)}</Text>
              <StatusBadge status={item.paymentStatus} />
            </View>
          </Card>
        </Pressable>
      )}
    />
  )
}

// Owner/Manager/Receptionist can read packages and memberships. Who may add, sell or cancel depends on the role
// (the button for each tab is shown only when the role has that permission; the server checks again).
export default function PackagesScreen({ navigation }) {
  const { role, activeSalonId } = useAuth()
  const [tab, setTab] = useState('packages')

  const ACTIONS = {
    packages: { allowed: roleCan(role, 'packages.write'), label: 'Add package', text: '+ Add', go: 'PackageForm' },
    sold: { allowed: roleCan(role, 'packages.sell'), label: 'Sell a package', text: '+ Sell', go: 'SellPackage' },
    plans: { allowed: roleCan(role, 'memberships.write'), label: 'Add plan', text: '+ Add', go: 'MembershipPlanForm' },
    members: { allowed: roleCan(role, 'memberships.sell'), label: 'Sell a membership', text: '+ Sell', go: 'SellMembership' },
  }
  const action = ACTIONS[tab]
  const tabs = TABS.filter((t) => (t.value === 'packages' || t.value === 'sold' ? roleCan(role, 'packages.read') : roleCan(role, 'memberships.read')))

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: action.allowed
        ? () => (
            <Pressable accessibilityRole="button" accessibilityLabel={action.label} onPress={() => navigation.navigate(action.go)} style={styles.add}>
              <Text style={styles.addText}>{action.text}</Text>
            </Pressable>
          )
        : undefined,
    })
  }, [navigation, tab, action.allowed, action.label, action.text, action.go])

  return (
    <View style={styles.screen}>
      <Segmented options={tabs} value={tab} onChange={setTab} />
      {tab === 'packages' ? <TemplatesTab navigation={navigation} canWrite={ACTIONS.packages.allowed} salonId={activeSalonId} /> : null}
      {tab === 'sold' ? <SoldTab navigation={navigation} salonId={activeSalonId} /> : null}
      {tab === 'plans' ? <PlansTab navigation={navigation} canWrite={ACTIONS.plans.allowed} salonId={activeSalonId} /> : null}
      {tab === 'members' ? <MembersTab navigation={navigation} salonId={activeSalonId} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  list: { padding: 16, paddingTop: 4, paddingBottom: 24 },
  loader: { marginTop: 24 },
  empty: { textAlign: 'center', color: COLORS.muted, marginTop: 32 },
  add: { minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 12 },
  addText: { color: COLORS.gold, fontSize: 16, fontWeight: '700' },
  search: { minHeight: TOUCH_MIN, borderWidth: 1, borderColor: COLORS.line, borderRadius: 10, backgroundColor: '#fff', paddingHorizontal: 14, fontSize: 16, color: COLORS.ink },
  stopped: { opacity: 0.65 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  title: { flex: 1, fontSize: 16, fontWeight: '600', color: COLORS.ink },
  name: { fontSize: 15, color: COLORS.ink, marginTop: 4 },
  muted: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  desc: { fontSize: 13, color: COLORS.ink, marginTop: 6 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, justifyContent: 'space-between' },
  price: { fontSize: 18, fontWeight: '700', color: COLORS.brown },
  was: { fontSize: 13, color: COLORS.muted, textDecorationLine: 'line-through' },
  save: { fontSize: 12, fontWeight: '700', color: COLORS.success },
  sessions: { fontSize: 15, fontWeight: '600', color: COLORS.ink, marginTop: 6 },
})
