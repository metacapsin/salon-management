import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import { COLORS } from '../config/theme'
import AdminOverviewScreen from '../screens/admin/AdminOverviewScreen'
import AdminSalonDetailScreen from '../screens/admin/AdminSalonDetailScreen'
import AdminSalonsScreen from '../screens/admin/AdminSalonsScreen'
import ComingSoonScreen from '../screens/ComingSoonScreen'
import MoreScreen from '../screens/MoreScreen'
import NoSalonScreen from '../screens/NoSalonScreen'
import AppointmentsScreen from '../screens/salon/AppointmentsScreen'
import CustomersScreen from '../screens/salon/CustomersScreen'
import BillingScreen from '../screens/salon/BillingScreen'
import CreateBillScreen from '../screens/salon/CreateBillScreen'
import CustomerMembershipDetailScreen from '../screens/salon/CustomerMembershipDetailScreen'
import CustomerPackageDetailScreen from '../screens/salon/CustomerPackageDetailScreen'
import DashboardScreen from '../screens/salon/DashboardScreen'
import InvoiceDetailScreen from '../screens/salon/InvoiceDetailScreen'
import PackageFormScreen from '../screens/salon/PackageFormScreen'
import PackagesScreen from '../screens/salon/PackagesScreen'
import MembershipPlanFormScreen from '../screens/salon/MembershipPlanFormScreen'
import NewAppointmentScreen from '../screens/salon/NewAppointmentScreen'
import OfferFormScreen from '../screens/salon/OfferFormScreen'
import OffersScreen from '../screens/salon/OffersScreen'
import SellMembershipScreen from '../screens/salon/SellMembershipScreen'
import SellPackageScreen from '../screens/salon/SellPackageScreen'
import ServiceFormScreen from '../screens/salon/ServiceFormScreen'
import ServicesScreen from '../screens/salon/ServicesScreen'
import SettingsFormScreen from '../screens/salon/SettingsFormScreen'
import SettingsScreen from '../screens/salon/SettingsScreen'
import StaffFormScreen from '../screens/salon/StaffFormScreen'
import StaffScreen from '../screens/salon/StaffScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

// capability = who may see it. Screens a role may not open are never registered, so they cannot be reached at all.
// (This hides screens only. The server still checks the role on every request.)
const TAB_SCREENS = [
  { name: 'Appointments', label: 'Appointments', icon: 'calendar-outline', capability: 'appointments.read', component: AppointmentsScreen },
  { name: 'Customers', label: 'Customers', icon: 'people-outline', capability: 'customers.read', component: CustomersScreen },
]
const MORE_SCREENS = [
  { name: 'Services', label: 'Services', icon: 'cut-outline', capability: 'services.read', component: ServicesScreen },
  { name: 'Staff', label: 'Staff', icon: 'person-outline', capability: 'staff.read', component: StaffScreen },
  { name: 'Packages & Memberships', label: 'Packages & Memberships', icon: 'gift-outline', capability: 'packages.read', component: PackagesScreen },
  { name: 'Billing', label: 'Billing', icon: 'card-outline', capability: 'billing.read', component: BillingScreen },
  { name: 'Offers', label: 'Offers', icon: 'pricetag-outline', capability: 'offers.read', component: OffersScreen },
  { name: 'Settings', label: 'Settings', icon: 'settings-outline', capability: 'settings.read', component: SettingsScreen },
]

const tabIcon = (name) => ({ color, size }) => <Ionicons name={name} size={size} color={color} />

const screenOptions = {
  headerStyle: { backgroundColor: COLORS.espresso },
  headerTintColor: COLORS.gold,
  headerTitleStyle: { fontFamily: 'serif', fontWeight: '700' },
  tabBarActiveTintColor: COLORS.brown,
  tabBarInactiveTintColor: COLORS.muted,
  tabBarStyle: { backgroundColor: COLORS.cream, borderTopColor: COLORS.line, minHeight: 56 },
  tabBarLabelStyle: { fontSize: 12 },
}

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Overview" component={AdminOverviewScreen} options={{ tabBarIcon: tabIcon('stats-chart-outline') }} />
      <Tab.Screen name="Salons" component={AdminSalonsScreen} options={{ tabBarIcon: tabIcon('storefront-outline') }} />
      <Tab.Screen name="Account" options={{ tabBarIcon: tabIcon('person-circle-outline') }}>
        {(props) => <MoreScreen {...props} />}
      </Tab.Screen>
    </Tab.Navigator>
  )
}

// Super Admin app: the tabs plus a salon detail page that opens on top of them.
function AdminStack() {
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.espresso }, headerTintColor: COLORS.gold }}>
      <Stack.Screen name="AdminHome" component={AdminTabs} options={{ headerShown: false }} />
      <Stack.Screen name="SalonDetail" component={AdminSalonDetailScreen} options={({ route }) => ({ title: route.params?.name ?? 'Salon' })} />
    </Stack.Navigator>
  )
}

function SalonTabs() {
  const { role } = useAuth()
  const tabs = TAB_SCREENS.filter((s) => roleCan(role, s.capability))
  const more = MORE_SCREENS.filter((s) => roleCan(role, s.capability))
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: tabIcon('home-outline') }} />
      {tabs.map((s) => (
        <Tab.Screen key={s.name} name={s.name} component={s.component} options={{ tabBarIcon: tabIcon(s.icon) }} />
      ))}
      <Tab.Screen name="More" options={{ tabBarIcon: tabIcon('menu-outline') }}>
        {(props) => <MoreScreen {...props} items={more} />}
      </Tab.Screen>
    </Tab.Navigator>
  )
}

function AppStack() {
  const { role } = useAuth()
  const more = MORE_SCREENS.filter((s) => roleCan(role, s.capability))
  return (
    <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: COLORS.espresso }, headerTintColor: COLORS.gold }}>
      <Stack.Screen name="Home" component={SalonTabs} options={{ headerShown: false }} />
      {more.map((s) => (
        <Stack.Screen key={s.name} name={s.name} component={s.component ?? ComingSoonScreen} />
      ))}
      {roleCan(role, 'billing.read') ? <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} options={({ route }) => ({ title: route.params?.number ?? 'Bill' })} /> : null}
      {roleCan(role, 'billing.write') ? <Stack.Screen name="CreateBill" component={CreateBillScreen} options={{ title: 'New bill' }} /> : null}
      {roleCan(role, 'offers.write') ? <Stack.Screen name="OfferForm" component={OfferFormScreen} options={({ route }) => ({ title: route.params?.offer ? 'Edit offer' : 'Add offer' })} /> : null}
      {roleCan(role, 'settings.write') ? <Stack.Screen name="SettingsForm" component={SettingsFormScreen} options={{ title: 'Edit salon details' }} /> : null}
      {roleCan(role, 'packages.read') ? <Stack.Screen name="CustomerPackageDetail" component={CustomerPackageDetailScreen} options={({ route }) => ({ title: route.params?.title ?? 'Package' })} /> : null}
      {roleCan(role, 'packages.write') ? <Stack.Screen name="PackageForm" component={PackageFormScreen} options={({ route }) => ({ title: route.params?.pkg ? 'Edit package' : 'Add package' })} /> : null}
      {roleCan(role, 'packages.sell') ? <Stack.Screen name="SellPackage" component={SellPackageScreen} options={{ title: 'Sell a package' }} /> : null}
      {roleCan(role, 'appointments.write') ? <Stack.Screen name="NewAppointment" component={NewAppointmentScreen} options={{ title: 'New appointment' }} /> : null}
      {roleCan(role, 'memberships.read') ? <Stack.Screen name="CustomerMembershipDetail" component={CustomerMembershipDetailScreen} options={({ route }) => ({ title: route.params?.title ?? 'Membership' })} /> : null}
      {roleCan(role, 'memberships.write') ? <Stack.Screen name="MembershipPlanForm" component={MembershipPlanFormScreen} options={({ route }) => ({ title: route.params?.plan ? 'Edit plan' : 'Add plan' })} /> : null}
      {roleCan(role, 'memberships.sell') ? <Stack.Screen name="SellMembership" component={SellMembershipScreen} options={{ title: 'Sell a membership' }} /> : null}
      {roleCan(role, 'services.write') ? <Stack.Screen name="ServiceForm" component={ServiceFormScreen} options={({ route }) => ({ title: route.params?.service ? 'Edit service' : 'Add service' })} /> : null}
      {roleCan(role, 'staff.write') ? <Stack.Screen name="StaffForm" component={StaffFormScreen} options={({ route }) => ({ title: route.params?.staff ? 'Edit staff' : 'Add staff' })} /> : null}
    </Stack.Navigator>
  )
}

// Which app a signed-in user gets: Super Admin, a salon member, or nobody.
export default function RootNavigator() {
  const { isPlatformAdmin, memberships, activeSalonId } = useAuth()
  let content
  if (isPlatformAdmin) content = <AdminStack />
  else if (memberships.length > 0) content = <AppStack key={activeSalonId} />
  else return <NoSalonScreen />
  return <NavigationContainer>{content}</NavigationContainer>
}
