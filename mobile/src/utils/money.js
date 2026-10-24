// "1316.50" -> 131650 (paise). Returns null when the text is not a valid amount.
// Done with string math (no floating point), because money must never be off by one paisa.
export function rupeesTextToPaise(text) {
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(String(text).trim())
  if (!match) return null
  const paise = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || 0)
  return paise > 0 ? paise : null
}

// 131650 -> "1316.5", 131600 -> "1316" (to prefill an amount box)
export function paiseToRupeesText(paise) {
  const rupees = Math.floor(paise / 100)
  const rest = paise % 100
  return rest === 0 ? String(rupees) : `${rupees}.${String(rest).padStart(2, '0')}`
}

// A fresh id for one "record payment" attempt. If the network drops and the user presses the button again,
// the SAME key is sent and the server will not take the money twice (it is not a secret, only a duplicate guard).
export function newRequestKey() {
  return `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
