// The backend keeps all money as integer paise. This turns it into "₹1,234" or "₹1,234.50".
const whole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const withPaise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function formatPaise(paise) {
  const value = paise ?? 0
  return (value % 100 === 0 ? whole : withPaise).format(value / 100)
}
