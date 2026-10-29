import { useEffect, useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { useQuery } from '@tanstack/react-query'
import * as Location from 'expo-location'
import { fetchCitySalons, fetchLocations, fetchMyBookings, fetchNearestSalons } from '../../api/publicApi'
import { ApiError, friendlyError } from '../../api/client'
import { useAuth } from '../../auth/AuthContext'
import { EmptyState, ErrorState, LoadingState } from '../../components/States'
import { COLORS, FONT, RADIUS, SHADOW } from '../../config/theme'
import { formatDate } from '../../utils/formatMoney'
import { todayString } from '../../utils/dates'
import SalonCard from './SalonCard'

const NEAR_ME = '__near__'

// Values are the category keys the server understands (GET /public/salons?category=...).
const CATEGORIES = [
  { value: 'haircut', label: 'Haircut', icon: 'cut-outline' },
  { value: 'hair-spa', label: 'Hair spa', icon: 'water-outline' },
  { value: 'coloring', label: 'Colour', icon: 'color-palette-outline' },
  { value: 'skincare', label: 'Skin', icon: 'flower-outline' },
  { value: 'makeup', label: 'Makeup', icon: 'brush-outline' },
  { value: 'nails', label: 'Nails', icon: 'hand-left-outline' },
  { value: 'grooming', label: 'Grooming', icon: 'man-outline' },
]

function CategoryChip({ item, selected, onPress }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={item.label} accessibilityState={{ selected }} style={styles.cat}>
      <View style={[styles.catIcon, selected && styles.catIconOn]}>
        <Ionicons name={item.icon} size={22} color={selected ? COLORS.gold : COLORS.brown} />
      </View>
      <Text style={[styles.catLabel, selected && styles.catLabelOn]} numberOfLines={1}>{item.label}</Text>
    </Pressable>
  )
}

// Pick a city or use the phone's location.
function PlaceSheet({ visible, cities, activeCity, locating, onClose, onCity, onNearMe }) {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: 20 + insets.bottom }]}>
        <View style={styles.grab} />
        <Text style={styles.sheetTitle}>Choose your location</Text>
        <Pressable onPress={onNearMe} accessibilityRole="button" style={styles.sheetRow}>
          <Ionicons name="navigate-outline" size={20} color={COLORS.brown} />
          <Text style={styles.sheetText}>{locating ? 'Locating…' : 'Use my current location'}</Text>
        </Pressable>
        <ScrollView style={{ maxHeight: 320 }}>
          {cities.map((c) => (
            <Pressable key={c.city} onPress={() => onCity(c.city)} accessibilityRole="button" style={styles.sheetRow}>
              <Ionicons name={c.city === activeCity ? 'radio-button-on' : 'radio-button-off'} size={20} color={COLORS.brown} />
              <Text style={styles.sheetText}>{c.city}</Text>
              <Text style={styles.sheetCount}>{c.salonCount} {c.salonCount === 1 ? 'salon' : 'salons'}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  )
}

// Customer home ("Find a Salon"): location, search, categories, the next appointment and the salons list.
export default function FindSalonScreen({ navigation }) {
  const { customer, pendingSalon, setPendingSalon } = useAuth()
  const guest = !customer // not signed in: browsing is free, a salon page needs the customer login
  const insets = useSafeAreaInsets()
  const [city, setCity] = useState(null) // a city name, NEAR_ME, or null = the city with most salons
  const [category, setCategory] = useState(null)
  const [text, setText] = useState('')
  const [q, setQ] = useState('')
  const [coords, setCoords] = useState(null)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState('')
  const [sheet, setSheet] = useState(false)

  // search as the customer types, but not on every key
  useEffect(() => {
    const id = setTimeout(() => setQ(text.trim()), 400)
    return () => clearTimeout(id)
  }, [text])

  const locations = useQuery({ queryKey: ['public', 'locations'], queryFn: fetchLocations })
  const cities = locations.data ?? []
  const activeCity = city ?? cities[0]?.city ?? null
  const nearMe = city === NEAR_ME && coords

  const salons = useQuery({
    queryKey: ['public', 'salons', nearMe ? coords : activeCity, nearMe ? '' : q, nearMe ? null : category],
    queryFn: () => (nearMe ? fetchNearestSalons(coords) : fetchCitySalons({ city: activeCity, q, category })),
    enabled: Boolean(nearMe || (city !== NEAR_ME && activeCity)),
  })

  // The customer's next appointment (real data from /public/my-bookings).
  const bookings = useQuery({ queryKey: ['public', 'my-bookings'], queryFn: fetchMyBookings, enabled: !guest })
  const upcoming = useMemo(() => {
    const today = todayString()
    return (bookings.data ?? [])
      .filter((b) => ['pending', 'confirmed'].includes(b.status) && b.date >= today)
      .sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))[0]
  }, [bookings.data])

  // A guest tapped a salon and signed in: open that salon now.
  useEffect(() => {
    if (customer && pendingSalon) {
      navigation.navigate('SalonDetail', { id: pendingSalon.id, name: pendingSalon.name })
      setPendingSalon(null)
    }
  }, [customer, pendingSalon, navigation, setPendingSalon])

  function openSalon(salon) {
    if (guest) {
      setPendingSalon({ id: salon.id, name: salon.name })
      navigation.navigate('Login', { mode: 'customer' })
    } else {
      navigation.navigate('SalonDetail', { id: salon.id, name: salon.name })
    }
  }

  // Typing a city name offers a shortcut to that city (the server searches salon names only).
  const cityMatch = q.length >= 2 && !nearMe ? cities.find((c) => c.city.toLowerCase().startsWith(q.toLowerCase()) && c.city !== activeCity) : null

  async function chooseNearMe() {
    setLocationError('')
    setLocating(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (permission.status !== 'granted') {
        setLocationError('Location permission is off. Allow it in settings, or pick a city.')
        return
      }
      const here = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      setCoords({ lat: here.coords.latitude, lng: here.coords.longitude })
      setCity(NEAR_ME)
      setSheet(false)
    } catch {
      setLocationError('Could not find your location. Pick a city instead.')
    } finally {
      setLocating(false)
    }
  }

  const pickCity = (name) => {
    setCity(name)
    setSheet(false)
  }

  const placeLabel = city === NEAR_ME ? 'Near me' : (activeCity ?? 'Choose city')
  const initial = customer?.name?.[0]?.toUpperCase() ?? 'G'
  const firstName = customer?.name?.split(' ')[0]

  const header = (
    <View>
      <View style={[styles.hero, { paddingTop: 14 + insets.top }]}>
        <View style={styles.heroTop}>
          <Text style={styles.brand}>Galora</Text>
          <View style={styles.heroActions}>
            <Pressable onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel={`Location: ${placeLabel}`} style={styles.place}>
              <Ionicons name="location" size={14} color={COLORS.gold} />
              <Text style={styles.placeText} numberOfLines={1}>{placeLabel}</Text>
              <Ionicons name="chevron-down" size={14} color={COLORS.gold} />
            </Pressable>
            {guest ? (
              <Pressable onPress={() => navigation.navigate('Login', { mode: 'team' })} accessibilityRole="button" accessibilityLabel="Salon login" style={styles.salonBtn}>
                <Ionicons name="storefront" size={15} color={COLORS.espresso} />
                <Text style={styles.salonBtnText}>Salon login</Text>
              </Pressable>
            ) : (
              <Pressable onPress={() => navigation.navigate('Profile')} accessibilityRole="button" accessibilityLabel="Profile" style={styles.avatar}>
                <Text style={styles.avatarText}>{initial}</Text>
              </Pressable>
            )}
          </View>
        </View>
        <Text style={styles.welcome}>{guest ? 'Welcome to Galora' : `Hello, ${firstName}`}</Text>
        <Text style={styles.headline}>Find your perfect salon</Text>
        <View style={styles.search}>
          <Ionicons name="search" size={20} color={COLORS.muted} />
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Search salons by name"
            placeholderTextColor="#a8978a"
            accessibilityLabel="Search salons by name"
            returnKeyType="search"
            style={styles.searchInput}
          />
          {text ? (
            <Pressable onPress={() => setText('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
              <Ionicons name="close-circle" size={20} color={COLORS.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={styles.pad}>
        {cityMatch ? (
          <Pressable onPress={() => { setText(''); setCity(cityMatch.city) }} accessibilityRole="button" style={styles.suggest}>
            <Ionicons name="location-outline" size={18} color={COLORS.brown} />
            <Text style={styles.suggestText}>Show salons in {cityMatch.city}</Text>
          </Pressable>
        ) : null}

        {upcoming ? (
          <Pressable onPress={() => navigation.navigate('Bookings')} accessibilityRole="button" accessibilityLabel="Next appointment" style={styles.next}>
            <View style={styles.nextIcon}>
              <Ionicons name="calendar" size={20} color={COLORS.espresso} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextLabel}>Your next appointment</Text>
              <Text style={styles.nextTitle} numberOfLines={1}>{upcoming.salonName}</Text>
              <Text style={styles.nextWhen}>{formatDate(upcoming.date)} · {upcoming.startTime}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.gold} />
          </Pressable>
        ) : null}

        {city !== NEAR_ME ? (
          <>
            <Text style={styles.section}>Categories</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.cats}>
              {CATEGORIES.map((c) => (
                <CategoryChip key={c.value} item={c} selected={category === c.value} onPress={() => setCategory(category === c.value ? null : c.value)} />
              ))}
            </ScrollView>
          </>
        ) : null}

        {locationError ? <Text style={styles.error}>{locationError}</Text> : null}
        <Text style={styles.section}>{city === NEAR_ME ? 'Salons near you' : `Salons in ${activeCity ?? '…'}`}{salons.data ? `  ·  ${salons.data.total}` : ''}</Text>
      </View>
    </View>
  )

  const offline = salons.error instanceof ApiError && salons.error.status === 0
  let empty
  if (locations.isError) empty = <ErrorState offline={locations.error?.status === 0} message={friendlyError(locations.error)} onRetry={locations.refetch} />
  else if (locations.isLoading || salons.isLoading) empty = <LoadingState label="Finding salons" />
  else if (salons.isError) empty = <ErrorState offline={offline} message={friendlyError(salons.error)} onRetry={salons.refetch} />
  else if (nearMe) empty = <EmptyState icon="location-outline" title="No salons near you yet" text="Pick a city to see salons there." actionTitle="Choose a city" onAction={() => setSheet(true)} />
  else if (cities.length === 0) empty = <EmptyState icon="storefront-outline" title="No salons yet" text="Salons open for booking will appear here." />
  else if (q || category) empty = <EmptyState icon="search-outline" title="No salons found" text="Try another name or category." actionTitle="Clear filters" onAction={() => { setText(''); setCategory(null) }} />
  else empty = <EmptyState icon="storefront-outline" title="No salons here yet" text="Try another city." actionTitle="Choose a city" onAction={() => setSheet(true)} />

  return (
    <>
      <FlatList
        style={styles.screen}
        contentContainerStyle={{ paddingBottom: 24 }}
        data={salons.data?.salons ?? []}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <View style={styles.pad}>
            <SalonCard salon={item} onPress={() => openSalon(item)} />
          </View>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={salons.isRefetching} onRefresh={() => { locations.refetch(); salons.refetch(); bookings.refetch() }} tintColor={COLORS.brown} />}
      />
      <PlaceSheet visible={sheet} cities={cities} activeCity={city === NEAR_ME ? null : activeCity} locating={locating} onClose={() => setSheet(false)} onCity={pickCity} onNearMe={chooseNearMe} />
    </>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.cream },
  pad: { paddingHorizontal: 16 },
  hero: { backgroundColor: COLORS.espresso, paddingHorizontal: 16, paddingBottom: 24, borderBottomLeftRadius: RADIUS.xl, borderBottomRightRadius: RADIUS.xl },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  brand: { fontSize: 26, fontWeight: '700', color: COLORS.gold, fontFamily: FONT.heading },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  salonBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: RADIUS.pill, backgroundColor: COLORS.gold },
  salonBtnText: { color: COLORS.espresso, fontSize: 12, fontWeight: '800' },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: 120, minHeight: 36, paddingHorizontal: 12, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: 'rgba(230,199,103,0.5)' },
  placeText: { color: COLORS.cream, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.espresso, fontWeight: '800', fontSize: 16 },
  welcome: { color: COLORS.goldSoft, fontSize: 14 },
  headline: { color: COLORS.cream, fontSize: 28, fontWeight: '700', fontFamily: FONT.heading, marginTop: 2, marginBottom: 16 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 50, backgroundColor: COLORS.surface, borderRadius: RADIUS.md, paddingHorizontal: 14 },
  searchInput: { flex: 1, minHeight: 48, fontSize: 16, color: COLORS.ink, paddingVertical: 0, outlineStyle: 'none' },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, marginTop: 14, paddingHorizontal: 14, backgroundColor: COLORS.goldSoft, borderRadius: RADIUS.md },
  suggestText: { color: COLORS.ink, fontWeight: '600' },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 18, backgroundColor: COLORS.espresso, borderRadius: RADIUS.lg, padding: 14, ...SHADOW },
  nextIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  nextLabel: { color: COLORS.goldSoft, fontSize: 12 },
  nextTitle: { color: COLORS.cream, fontSize: 16, fontWeight: '700', fontFamily: FONT.heading },
  nextWhen: { color: COLORS.gold, fontSize: 13, fontWeight: '600' },
  section: { fontSize: 18, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading, marginTop: 22, marginBottom: 12 },
  cats: { gap: 14, paddingRight: 16 },
  cat: { alignItems: 'center', width: 68 },
  catIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.line, alignItems: 'center', justifyContent: 'center' },
  catIconOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  catLabel: { marginTop: 6, fontSize: 12, color: COLORS.muted, fontWeight: '600' },
  catLabelOn: { color: COLORS.ink, fontWeight: '800' },
  error: { color: COLORS.error, fontSize: 13, marginTop: 10 },
  backdrop: { flex: 1, backgroundColor: 'rgba(46,27,15,0.5)' },
  sheet: { backgroundColor: COLORS.cream, borderTopLeftRadius: RADIUS.xl, borderTopRightRadius: RADIUS.xl, padding: 20 },
  grab: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: COLORS.line, marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: COLORS.ink, fontFamily: FONT.heading, marginBottom: 8 },
  sheetRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  sheetText: { flex: 1, fontSize: 16, color: COLORS.ink },
  sheetCount: { fontSize: 13, color: COLORS.muted },
})
