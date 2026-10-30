// Mirror of backend/src/config/permissions.js (same as frontend/src/auth/permissions.js).
// This only decides which screens and buttons to SHOW. The server is the real gatekeeper and answers 403 anyway.
const CAPABILITIES = {
  'settings.read': ['owner', 'manager'],
  'settings.write': ['owner'],
  'users.read': ['owner', 'manager'],
  'users.manage': ['owner'],
  'audit.read': ['owner', 'manager'],
  'notifications.read': ['owner', 'manager'],
  'reviews.read': ['owner', 'manager'],
  'reviews.reply': ['owner', 'manager'],
  'appointments.read': ['owner', 'manager', 'receptionist'],
  'appointments.write': ['owner', 'manager', 'receptionist'],
  'customers.read': ['owner', 'manager', 'receptionist'],
  'services.read': ['owner', 'manager', 'receptionist', 'staff'],
  'services.write': ['owner', 'manager'],
  'offers.read': ['owner', 'manager', 'receptionist'],
  'offers.write': ['owner', 'manager'],
  'packages.read': ['owner', 'manager', 'receptionist'],
  'packages.write': ['owner', 'manager'],
  'packages.sell': ['owner', 'manager', 'receptionist'],
  'packages.adjust': ['owner', 'manager'],
  'memberships.read': ['owner', 'manager', 'receptionist'],
  'memberships.write': ['owner'],
  'memberships.sell': ['owner', 'manager', 'receptionist'],
  'memberships.adjust': ['owner', 'manager'],
  'billing.read': ['owner', 'manager', 'receptionist'],
  'billing.write': ['owner', 'manager', 'receptionist'],
  'billing.refund': ['owner', 'manager'],
  'billing.void': ['owner'],
  'staff.read': ['owner', 'manager', 'receptionist'],
  'staff.write': ['owner', 'manager'],
}

export function roleCan(role, capability) {
  return Boolean(CAPABILITIES[capability]?.includes(role))
}

export const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', receptionist: 'Receptionist', staff: 'Staff' }
