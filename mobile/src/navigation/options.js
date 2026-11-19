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
  headerTitleStyle: { fontFamily: FONT.heading, fontWeight: '700', fontSize: 20, color: COLORS.cream, letterSpacing: 0.5 },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: COLORS.cream },
}

export const tabOptions = {
  ...stackOptions,
  tabBarActiveTintColor: COLORS.gold,
  tabBarInactiveTintColor: 'rgba(250,245,239,0.55)',
  tabBarStyle: { backgroundColor: COLORS.espresso, borderTopColor: COLORS.goldLine, borderTopWidth: 1, minHeight: 62, paddingTop: 6 },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  tabBarItemStyle: { paddingHorizontal: 0 },
}

// Tab icon: pass the outline name ('home-outline'); the focused tab shows the filled one.
export const tabIcon = (name) => ({ color, size, focused }) => <Ionicons name={focused ? name.replace('-outline', '') : name} size={size} color={color} />
