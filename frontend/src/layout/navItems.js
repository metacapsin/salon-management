// Sidebar ke saare links ek hi jagah. Naya page jodna ho to bas yahan ek line badhao.
// capability = kis permission wale ko dikhe (khaali ho to sabko). Asli rok-tok server karta hai, ye sirf menu chhupata hai.
export const MAIN_NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/appointments', label: 'Appointments', icon: 'calendar', capability: 'appointments.read' },
  { to: '/customers', label: 'Customers', icon: 'users', capability: 'customers.read' },
  { to: '/services', label: 'Services', icon: 'scissors', capability: 'services.read' },
  { to: '/staff', label: 'Staff', icon: 'user', capability: 'staff.read' },
  { to: '/packages', label: 'Packages & Memberships', icon: 'package', capability: 'packages.read' },
  { to: '/billing', label: 'Billing', icon: 'card', capability: 'billing.read' },
  { to: '/offers', label: 'Offers', icon: 'tag', capability: 'offers.read' },
  { to: '/reviews', label: 'Reviews', icon: 'star', capability: 'reviews.read' },
  { to: '/settings', label: 'Settings', icon: 'settings', capability: 'settings.read' },
]

// Ye 2 pages pehle se bane hue hain (login wale kaam ke saath), isliye alag "Admin" hisse me rakhe hain.
export const ADMIN_NAV = [
  { to: '/team', label: 'Team & roles', icon: 'shield', capability: 'users.read' },
  { to: '/audit', label: 'Audit history', icon: 'clock', capability: 'audit.read' },
]

export const ALL_NAV = [...MAIN_NAV, ...ADMIN_NAV]
