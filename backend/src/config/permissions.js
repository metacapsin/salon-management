// Permission matrix (SRS section 2.2). Jo yahan likha nahi, wo mana hai (deny by default).
// Naye modules (services, billing...) apni capabilities yahin jodte jayenge.
const ROLES = ['owner', 'manager', 'receptionist', 'staff']

const CAPABILITIES = {
  'settings.read': ['owner', 'manager'],
  'settings.write': ['owner'],
  'users.read': ['owner', 'manager'],
  'users.manage': ['owner'], // invite karna, role badalna, deactivate karna
  'audit.read': ['owner', 'manager'],
  'notifications.read': ['owner', 'manager'],
  'appointments.read': ['owner', 'manager', 'receptionist'],
  'appointments.write': ['owner', 'manager', 'receptionist'],
  'customers.read': ['owner', 'manager', 'receptionist'],
  'services.read': ['owner', 'manager', 'receptionist', 'staff'],
  'services.write': ['owner', 'manager'],
  'offers.read': ['owner', 'manager', 'receptionist'],
  'offers.write': ['owner', 'manager'],
  'packages.read': ['owner', 'manager', 'receptionist'],
  'packages.write': ['owner', 'manager'], // package banana/edit/band karna
  'packages.sell': ['owner', 'manager', 'receptionist'], // customer ko dena, session use karna
  'packages.adjust': ['owner', 'manager'], // balance manually theek karna, cancel
  'memberships.read': ['owner', 'manager', 'receptionist'],
  'memberships.write': ['owner'], // plan banana/edit/band karna (sirf owner)
  'memberships.sell': ['owner', 'manager', 'receptionist'], // customer ko dena, discount lagana
  'memberships.adjust': ['owner', 'manager'], // cancel
  'billing.read': ['owner', 'manager', 'receptionist'],
  'billing.write': ['owner', 'manager', 'receptionist'], // bill banana, payment record karna
  'billing.refund': ['owner', 'manager'], // refund / correction
  'billing.void': ['owner'], // galat bill radd karna
  'staff.read': ['owner', 'manager', 'receptionist'],
  'staff.write': ['owner', 'manager'],
}

function roleCan(role, capability) {
  return Boolean(CAPABILITIES[capability]?.includes(role))
}

module.exports = { ROLES, CAPABILITIES, roleCan }
