import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../auth/permissions'
import Button from '../components/Button'
import { Screen, SectionTitle } from '../components/Screen'
import { COLORS, FONT, RADIUS } from '../config/theme'

// Account page: who is signed in, the sections that did not fit in the tab bar (only the ones this role may open),
// a salon switcher when the user belongs to more than one salon, and Sign out.
export default function MoreScreen({ navigation, items = [] }) {
  const { user, role, memberships, activeSalonId, switchSalon, logout, isPlatformAdmin } = useAuth()

  return (
    <Screen>
      <View style={styles.profile}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() ?? 'G'}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{user?.name}</Text>
          <Text style={styles.email} numberOfLines={1}>{user?.email}</Text>
          <View style={styles.pill}>
            <Text style={styles.pillText}>{isPlatformAdmin ? 'Super Admin' : (ROLE_LABELS[role] ?? '')}</Text>
          </View>
        </View>
      </View>

      {items.length > 0 ? (
        <>
          <SectionTitle>Sections</SectionTitle>
          <View style={styles.list}>
            {items.map((item, i) => (
              <Pressable key={item.name} accessibilityRole="button" accessibilityLabel={item.label} style={[styles.row, i === items.length - 1 && styles.rowLast]} onPress={() => navigation.navigate(item.name)}>
                <View style={styles.rowIcon}>
                  <Ionicons name={item.icon} size={20} color={COLORS.brown} />
                </View>
                <Text style={styles.rowText}>{item.label}</Text>
                <Ionicons name="chevron-forward" size={20} color={COLORS.muted} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {!isPlatformAdmin && memberships.length > 1 ? (
        <>
          <SectionTitle>Switch salon</SectionTitle>
          <View style={styles.list}>
            {memberships.map((m, i) => (
              <Pressable key={m.salonId} accessibilityRole="button" style={[styles.row, i === memberships.length - 1 && styles.rowLast]} onPress={() => switchSalon(m.salonId)}>
                <Ionicons name={m.salonId === activeSalonId ? 'radio-button-on' : 'radio-button-off'} size={22} color={COLORS.brown} />
                <Text style={styles.rowText}>
                  {m.salonName} ({ROLE_LABELS[m.role] ?? m.role})
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.signOut}>
        <Button title="Sign out" icon="log-out-outline" variant="secondary" onPress={logout} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: COLORS.espresso, borderRadius: RADIUS.xl, padding: 18 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.gold, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: COLORS.espresso, fontSize: 24, fontWeight: '800' },
  name: { fontSize: 20, fontWeight: '700', color: COLORS.cream, fontFamily: FONT.heading },
  email: { fontSize: 13, color: COLORS.goldSoft, marginTop: 2 },
  pill: { alignSelf: 'flex-start', marginTop: 8, paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.pill, borderWidth: 1, borderColor: 'rgba(230,199,103,0.5)' },
  pillText: { color: COLORS.gold, fontSize: 12, fontWeight: '700' },
  list: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: COLORS.goldSoft, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, fontSize: 16, color: COLORS.ink },
  signOut: { marginTop: 24 },
})
