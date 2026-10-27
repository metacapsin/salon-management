import { Ionicons } from '@expo/vector-icons'
import { DefaultTheme } from '@react-navigation/native'
import { COLORS, FONT } from '../config/theme'

// Shared look for every navigator: chocolate header with gold back arrow, cream tab bar, brown active tab.
export const navTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, background: COLORS.cream, card: COLORS.espresso, text: COLORS.cream, primary: COLORS.gold, border: COLORS.line },
}

export const stackOptions = {
  headerStyle: { backgroundColor: COLORS.espresso },
  headerTintColor: COLORS.gold,
  headerTitleStyle: { fontFamily: FONT.heading, fontWeight: '700', color: COLORS.cream },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: COLORS.cream },
}

export const tabOptions = {
  ...stackOptions,
  tabBarActiveTintColor: COLORS.brown,
  tabBarInactiveTintColor: COLORS.muted,
  tabBarStyle: { backgroundColor: COLORS.surface, borderTopColor: COLORS.line, minHeight: 60, paddingTop: 4 },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
  tabBarItemStyle: { paddingHorizontal: 0 },
}

// Tab icon: pass the outline name ('home-outline'); the focused tab shows the filled one.
export const tabIcon = (name) => ({ color, size, focused }) => <Ionicons name={focused ? name.replace('-outline', '') : name} size={size} color={color} />
