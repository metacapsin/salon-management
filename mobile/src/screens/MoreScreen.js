import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../auth/AuthContext'
import { ROLE_LABELS } from '../auth/permissions'
import Button from '../components/Button'
import { Card, Screen, SectionTitle } from '../components/Screen'
import { COLORS } from '../config/theme'

// Account page: the sections that did not fit in the tab bar (only the ones this role may open),
// a salon switcher when the user belongs to more than one salon, and Sign out.
export default function MoreScreen({ navigation, items = [] }) {
  const { user, role, memberships, activeSalonId, switchSalon, logout, isPlatformAdmin } = useAuth()

  return (
    <Screen>
      <Card>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.muted}>{user?.email}</Text>
        <Text style={styles.muted}>{isPlatformAdmin ? 'Super Admin' : (ROLE_LABELS[role] ?? '')}</Text>
      </Card>

      {items.length > 0 ? (
        <>
          <SectionTitle>Sections</SectionTitle>
          <View style={styles.list}>
            {items.map((item) => (
              <Pressable key={item.name} accessibilityRole="button" accessibilityLabel={item.label} style={styles.row} onPress={() => navigation.navigate(item.name)}>
                <Ionicons name={item.icon} size={22} color={COLORS.brown} />
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
            {memberships.map((m) => (
              <Pressable key={m.salonId} accessibilityRole="button" style={styles.row} onPress={() => switchSalon(m.salonId)}>
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
        <Button title="Sign out" onPress={logout} />
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  name: { fontSize: 18, fontWeight: '700', color: COLORS.ink },
  muted: { fontSize: 14, color: COLORS.muted, marginTop: 2 },
  list: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: COLORS.line, overflow: 'hidden' },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  rowText: { flex: 1, fontSize: 16, color: COLORS.ink },
  signOut: { marginTop: 24 },
})
