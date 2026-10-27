import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { navTheme, stackOptions, tabIcon, tabOptions } from './options'
import LoginScreen from '../screens/auth/LoginScreen'
import { useAuth } from '../auth/AuthContext'
import { roleCan } from '../auth/permissions'
import AdminAuditScreen from '../screens/admin/AdminAuditScreen'
import AdminInquiriesScreen from '../screens/admin/AdminInquiriesScreen'
import AdminInquiryDetailScreen from '../screens/admin/AdminInquiryDetailScreen'
import AdminOverviewScreen from '../screens/admin/AdminOverviewScreen'
import AdminOwnerRequestsScreen from '../screens/admin/AdminOwnerRequestsScreen'
import AdminSalonDetailScreen from '../screens/admin/AdminSalonDetailScreen'
import AdminSalonsScreen from '../screens/admin/AdminSalonsScreen'
import AdminUsersScreen from '../screens/admin/AdminUsersScreen'
import BookScreen from '../screens/customer/BookScreen'
import FindSalonScreen from '../screens/customer/FindSalonScreen'
import MyBookingsScreen from '../screens/customer/MyBookingsScreen'
import ProfileScreen from '../screens/customer/ProfileScreen'
import SalonDetailScreen from '../screens/customer/SalonDetailScreen'
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
  { name: 'Appointments', label: 'Appointments', tabLabel: 'Bookings', icon: 'calendar-outline', capability: 'appointments.read', component: AppointmentsScreen },
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

// Super Admin sections that live in the Account page (the tab bar has no room for more).
const ADMIN_MORE_SCREENS = [
  { name: 'Users', label: 'Users', icon: 'people-outline', component: AdminUsersScreen },
  { name: 'Inquiries', label: 'Contact inquiries', icon: 'mail-outline', component: AdminInquiriesScreen },
  { name: 'Audit', label: 'Audit history', icon: 'list-outline', component: AdminAuditScreen },
]

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Overview" component={AdminOverviewScreen} options={{ tabBarIcon: tabIcon('stats-chart-outline') }} />
      <Tab.Screen name="Salons" component={AdminSalonsScreen} options={{ tabBarIcon: tabIcon('storefront-outline') }} />
      <Tab.Screen name="Requests" component={AdminOwnerRequestsScreen} options={{ title: 'Owner requests', tabBarLabel: 'Requests', tabBarIcon: tabIcon('person-add-outline') }} />
      <Tab.Screen name="Account" options={{ tabBarIcon: tabIcon('person-circle-outline') }}>
        {(props) => <MoreScreen {...props} items={ADMIN_MORE_SCREENS} />}
      </Tab.Screen>
    </Tab.Navigator>
  )
}

// Super Admin app: the tabs plus a salon detail page that opens on top of them.
function AdminStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="AdminHome" component={AdminTabs} options={{ headerShown: false }} />
      <Stack.Screen name="SalonDetail" component={AdminSalonDetailScreen} options={({ route }) => ({ title: route.params?.name ?? 'Salon' })} />
      <Stack.Screen name="InquiryDetail" component={AdminInquiryDetailScreen} options={({ route }) => ({ title: route.params?.name ?? 'Inquiry' })} />
      {ADMIN_MORE_SCREENS.map((s) => (
        <Stack.Screen key={s.name} name={s.name} component={s.component} />
      ))}
    </Stack.Navigator>
  )
}

// Customer app: Home (Find a Salon), Bookings and Profile as tabs; salon details and booking open on top of them.
function CustomerTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Home" component={FindSalonScreen} options={{ headerShown: false, tabBarLabel: 'Home', tabBarIcon: tabIcon('home-outline') }} />
      <Tab.Screen name="Bookings" component={MyBookingsScreen} options={{ title: 'My appointments', tabBarLabel: 'Bookings', tabBarIcon: tabIcon('calendar-outline') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: tabIcon('person-outline') }} />
    </Tab.Navigator>
  )
}

function CustomerStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="CustomerHome" component={CustomerTabs} options={{ headerShown: false }} />
      <Stack.Screen name="SalonDetail" component={SalonDetailScreen} options={({ route }) => ({ title: route.params?.name ?? 'Salon' })} />
      <Stack.Screen name="Book" component={BookScreen} options={{ title: 'Book appointment' }} />
    </Stack.Navigator>
  )
}

function SalonTabs() {
  const { role } = useAuth()
  const tabs = TAB_SCREENS.filter((s) => roleCan(role, s.capability))
  const more = MORE_SCREENS.filter((s) => roleCan(role, s.capability))
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarIcon: tabIcon('home-outline') }} />
      {tabs.map((s) => (
        <Tab.Screen key={s.name} name={s.name} component={s.component} options={{ tabBarLabel: s.tabLabel ?? s.label, tabBarIcon: tabIcon(s.icon) }} />
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
    <Stack.Navigator screenOptions={stackOptions}>
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

// Login page opened from the guest app. route.params.mode: 'customer' (default) or 'team' (salon owner / staff / admin).
// Which app opens afterwards is decided by the server's answer (AuthContext), not by this screen.
function LoginRoute({ navigation, route }) {
  const { login, requestOtp, verifyOtp } = useAuth()
  return (
    <LoginScreen
      initialMode={route.params?.mode}
      onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
      onSubmit={({ email, password }) => login(email, password)}
      onRequestOtp={requestOtp}
      onVerifyOtp={verifyOtp}
    />
  )
}

// Not signed in: the first page is Find a Salon, which anyone may browse. Opening a salon asks for the customer login.
export function GuestNavigator() {
  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator screenOptions={{ ...stackOptions, headerShown: false }}>
        <Stack.Screen name="FindSalon" component={FindSalonScreen} />
        <Stack.Screen name="Login" component={LoginRoute} />
      </Stack.Navigator>
    </NavigationContainer>
  )
}

// Which app a signed-in user gets: Super Admin, a salon member, or nobody.
// The kind of account comes from the server's answer (AuthContext.accountType). A customer never gets a salon or admin screen registered.
export default function RootNavigator() {
  const { accountType, activeSalonId } = useAuth()
  let content
  if (accountType === 'customer') content = <CustomerStack />
  else if (accountType === 'admin') content = <AdminStack />
  else if (accountType === 'salon') content = <AppStack key={activeSalonId} />
  else return <NoSalonScreen />
  return <NavigationContainer theme={navTheme}>{content}</NavigationContainer>
}
