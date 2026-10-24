// Contact Us inquiry ke status. Values backend/src/config/inquiry.js jaise hi hain.
export const INQUIRY_STATUSES = [
  { value: 'new', label: 'New', color: 'info' },
  { value: 'in_progress', label: 'In Progress', color: 'warning' },
  { value: 'resolved', label: 'Resolved', color: 'success' },
  { value: 'closed', label: 'Closed', color: 'default' },
]

export const statusInfo = (value) => INQUIRY_STATUSES.find((s) => s.value === value) ?? { value, label: value, color: 'default' }
