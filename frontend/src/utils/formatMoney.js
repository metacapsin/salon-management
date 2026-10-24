// 18450 -> "₹18,450". Poore app me paise hamesha isi tarah dikhte hain (INR, Indian style commas).
const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })

export function formatMoney(amount) {
  return rupees.format(amount)
}

// Billing ka paisa paise (integer) me hota hai: 118000 -> "₹1,180.00". Paise tak dikhate hain, kyunki GST me paise aate hain.
const rupeesWithPaise = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
export function formatPaise(paise) {
  return rupeesWithPaise.format(paise / 100)
}
