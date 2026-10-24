import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { Box, CircularProgress } from '@mui/material'
import { AuthProvider, useAuth } from './auth/AuthContext'
import { roleCan } from './auth/permissions'
import AcceptInvitationPage from './pages/AcceptInvitationPage'
import ForgotPasswordPage from './pages/ForgotPasswordPage'
import { CustomerAuthProvider, useCustomer } from './customer/CustomerAuthContext'
import BookingPage from './pages/explore/BookingPage'
import CustomerLoginPage from './pages/explore/CustomerLoginPage'
import LandingPage from './pages/landing/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ResetPasswordPage from './pages/ResetPasswordPage'
import VerifyEmailPage from './pages/VerifyEmailPage'

// Login ke baad wale (bhaari, MUI wale) pages tabhi download hote hain jab zaroorat ho, taaki login page jaldi khule.
const DashboardLayout = lazy(() => import('./layout/DashboardLayout'))
const DashboardOverview = lazy(() => import('./pages/dashboard/DashboardOverview'))
const ComingSoonPage = lazy(() => import('./pages/dashboard/ComingSoonPage'))
const AuditPage = lazy(() => import('./pages/AuditPage'))
const OnboardingPage = lazy(() => import('./pages/OnboardingPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const TeamPage = lazy(() => import('./pages/TeamPage'))
const ServicesPage = lazy(() => import('./pages/ServicesPage'))
const PackagesPage = lazy(() => import('./pages/PackagesPage'))
const BillingPage = lazy(() => import('./pages/BillingPage'))
const CreateBillPage = lazy(() => import('./pages/CreateBillPage'))
const InvoiceDetailPage = lazy(() => import('./pages/InvoiceDetailPage'))
const OffersPage = lazy(() => import('./pages/OffersPage'))
const StaffPage = lazy(() => import('./pages/StaffPage'))
const CustomersPage = lazy(() => import('./pages/CustomersPage'))
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'))
const NewAppointmentPage = lazy(() => import('./pages/dashboard/NewAppointmentPage'))
const AdminLayout = lazy(() => import('./layout/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminOwnerRequests = lazy(() => import('./pages/admin/AdminOwnerRequests'))
const AdminSalons = lazy(() => import('./pages/admin/AdminSalons'))
const AdminSalonDetail = lazy(() => import('./pages/admin/AdminSalonDetail'))
const AdminUsers = lazy(() => import('./pages/admin/AdminUsers'))
const AdminAudit = lazy(() => import('./pages/admin/AdminAudit'))
const AdminInquiries = lazy(() => import('./pages/admin/AdminInquiries'))

function FullPageSpinner() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }} role="status" aria-label="Loading">
      <CircularProgress />
    </Box>
  )
}

// Login ke bina andar nahi jaane dete. (Ye sirf suvidha hai; asli suraksha server par hai.)
function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <FullPageSpinner />
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}

// Customer ka booking page: mobile OTP se login ke bina andar nahi jaane dete. (Salon ki list khuli hai, login salon kholne par maangte hain.)
function RequireCustomer() {
  const { status } = useCustomer()
  const location = useLocation()
  if (status === 'loading') return <FullPageSpinner />
  if (status === 'anonymous') return <Navigate to="/customer-login" replace state={{ from: location }} />
  return <Outlet />
}

// Role ko ye page dikhna chahiye? Nahi to dashboard par wapas.
function RequireCapability({ capability }) {
  const { role } = useAuth()
  if (!roleCan(role, capability)) return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// Sirf Super Admin ke liye. Salon owner yahan aaye to dashboard par wapas. (Asli rok-tok server karta hai: /api/v1/platform/* par 403.)
function RequirePlatformAdmin() {
  const { user } = useAuth()
  if (user?.platformRole !== 'admin') return <Navigate to="/dashboard" replace />
  return <Outlet />
}

// Bina-login pages. Status 'loading' ke dauran bhi dikhate hain (flash se bachne ke liye spinner).
function PublicOnly() {
  const { status } = useAuth()
  if (status === 'loading') return <FullPageSpinner />
  return <Outlet />
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CustomerAuthProvider>
        <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          {/* Website ka pehla page: sab ke liye khula (login ho ya na ho) */}
          <Route path="/" element={<LandingPage />} />
          {/* Customer: pehle mobile OTP se login, phir city/area chuno, salons dekho aur book karo */}
          <Route path="/customer-login" element={<CustomerLoginPage />} />
          {/* Purana /explore link: ab salon dhundhna landing page ke andar hi hota hai */}
          <Route path="/explore" element={<Navigate to="/#find-salon" replace />} />
          <Route element={<RequireCustomer />}>
            <Route path="/book/:salonId" element={<BookingPage />} />
          </Route>

          <Route element={<PublicOnly />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
          </Route>

          <Route element={<RequireAuth />}>
            <Route element={<RequirePlatformAdmin />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/owner-requests" element={<AdminOwnerRequests />} />
                <Route path="/admin/salons" element={<AdminSalons />} />
                <Route path="/admin/salons/:id" element={<AdminSalonDetail />} />
                <Route path="/admin/inquiries" element={<AdminInquiries />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/audit" element={<AdminAudit />} />
              </Route>
            </Route>
            <Route path="/onboarding" element={<OnboardingPage />} />
            {/* Naya dhancha: Sidebar + Header (DashboardLayout). Iske andar ke sab pages isi me dikhte hain. */}
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<DashboardOverview />} />

              {/* Jo pages abhi bane nahi: ek chhota "coming soon" page, baad me asli page se badal denge */}
              <Route element={<RequireCapability capability="appointments.read" />}>
                <Route path="/appointments" element={<AppointmentsPage />} />
              </Route>
              <Route element={<RequireCapability capability="appointments.write" />}>
                <Route path="/appointments/new" element={<NewAppointmentPage />} />
              </Route>
              <Route element={<RequireCapability capability="customers.read" />}>
                <Route path="/customers" element={<CustomersPage />} />
              </Route>
              <Route element={<RequireCapability capability="services.read" />}>
                <Route path="/services" element={<ServicesPage />} />
              </Route>
              <Route element={<RequireCapability capability="staff.read" />}>
                <Route path="/staff" element={<StaffPage />} />
              </Route>
              <Route element={<RequireCapability capability="packages.read" />}>
                <Route path="/packages" element={<PackagesPage />} />
              </Route>
              <Route element={<RequireCapability capability="billing.read" />}>
                <Route path="/billing" element={<BillingPage />} />
                <Route path="/billing/:id" element={<InvoiceDetailPage />} />
              </Route>
              <Route element={<RequireCapability capability="billing.write" />}>
                <Route path="/billing/new" element={<CreateBillPage />} />
              </Route>
              <Route element={<RequireCapability capability="offers.read" />}>
                <Route path="/offers" element={<OffersPage />} />
              </Route>

              {/* Ye pehle se bane hue pages hain (login wale kaam ke saath), ab naye dhanche ke andar khulte hain */}
              <Route element={<RequireCapability capability="users.read" />}>
                <Route path="/team" element={<TeamPage />} />
              </Route>
              <Route element={<RequireCapability capability="settings.read" />}>
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
              <Route element={<RequireCapability capability="audit.read" />}>
                <Route path="/audit" element={<AuditPage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </CustomerAuthProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
