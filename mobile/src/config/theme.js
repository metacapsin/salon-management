// Galora design tokens: chocolate brown, gold and warm cream (same family as the website's frontend/src/theme.js).
// Use gold only as an accent on dark brown; on cream or white use brown or goldDeep, because pale gold text is hard to read there.
export const COLORS = {
  espresso: '#2e1b0f', // chocolate brown: headers, hero areas
  brown: '#8b5e3c', // primary buttons, links, selected states
  brownDark: '#6f4a2e', // pressed state
  gold: '#e6c767', // accent on dark brown
  goldDeep: '#9a7424', // gold-ish text that must be readable on cream/white
  goldSoft: '#f6ecd0', // soft highlight background
  cream: '#faf5ef', // screen background
  surface: '#ffffff', // cards
  line: '#eadfd3', // card and input borders
  ink: '#3a2415', // dark brown text
  muted: '#6d5846', // secondary text
  error: '#c62828',
  errorSoft: '#fbe9e7',
  success: '#2f6b3a',
  successSoft: '#e4f1e6',
  info: '#1d4f91',
  infoSoft: '#e4eefa',
  warn: '#8a6100',
  warnSoft: '#fff3d1',
}

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 }
export const RADIUS = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 }

// One serif for headings (brand feel), the system font for everything else.
export const FONT = { heading: 'serif' }

// One soft shadow, used only on floating things (hero cards, selected segment). Cards use borders, not shadows.
export const SHADOW = { shadowColor: '#2e1b0f', shadowOpacity: 0.12, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 3 }

// Minimum touch target for buttons and inputs.
export const TOUCH_MIN = 48
