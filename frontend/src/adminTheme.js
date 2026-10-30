import { createTheme } from '@mui/material/styles'
import { theme as baseTheme } from './theme'

// Platform admin ka apna look. Sirf AdminLayout ke andar lagta he (ThemeProvider), isliye salon owner ke screens par koi asar nahi.
// Dialog aur dropdown menu portal se body me jaate hain, par ThemeProvider ka theme unhe bhi milta he.
export const ADMIN = {
  espresso: '#2e1b0f',
  espressoHover: '#46291a',
  gold: '#e6c767',
  goldDeep: '#8a6a1f', // gold ka gehra roop: cream/white par text ke liye (contrast theek rehta he)
  cream: '#faf6f0',
  head: '#f5eee2', // table header
  line: '#e9e0d4',
  ink: '#2e1b0f',
  muted: '#6f5a47',
  disabled: '#d9cfc2',
}

const focusRing = `0 0 0 3px ${ADMIN.gold}`

export const adminTheme = createTheme(baseTheme, {
  palette: {
    primary: { main: ADMIN.espresso, dark: ADMIN.espressoHover, contrastText: '#fff' },
    secondary: { main: ADMIN.gold, contrastText: ADMIN.espresso },
    text: { primary: ADMIN.ink, secondary: ADMIN.muted },
    divider: ADMIN.line,
    success: { main: '#2f6b3a' },
    warning: { main: '#9a6700' },
    error: { main: '#a4262c' },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 40,
          borderRadius: 8,
          padding: '0 16px',
          fontSize: '0.875rem',
          '@media (pointer: coarse)': { minHeight: 44 },
          '&.Mui-focusVisible': { boxShadow: focusRing },
          '&.Mui-disabled': { opacity: 1 },
        },
        sizeSmall: { minHeight: 34, padding: '0 12px', fontSize: '0.8125rem', '@media (pointer: coarse)': { minHeight: 40 } },
        containedPrimary: { '&:hover': { backgroundColor: ADMIN.espressoHover }, '&.Mui-disabled': { backgroundColor: ADMIN.disabled, color: '#8a7a6a' } },
        outlined: { borderColor: '#d6c9b6', color: ADMIN.ink, '&:hover': { borderColor: ADMIN.espresso, backgroundColor: ADMIN.head }, '&.Mui-disabled': { borderColor: ADMIN.line, color: '#a89a8a' } },
        outlinedError: { borderColor: '#e0b4b6', color: '#a4262c', '&:hover': { borderColor: '#a4262c', backgroundColor: '#fbeeee' } },
        outlinedSuccess: { borderColor: '#b9d5bf', color: '#2f6b3a', '&:hover': { borderColor: '#2f6b3a', backgroundColor: '#eef6ef' } },
        text: { color: ADMIN.ink, '&:hover': { backgroundColor: ADMIN.head } },
        textError: { color: '#a4262c', '&:hover': { backgroundColor: '#fbeeee' } },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 44,
          borderRadius: 8,
          fontSize: '0.9375rem',
          '&.MuiInputBase-sizeSmall': { minHeight: 40, fontSize: '0.875rem' },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: '#d6c9b6' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: ADMIN.goldDeep },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ADMIN.espresso, borderWidth: 2 },
          '&.Mui-disabled': { backgroundColor: ADMIN.head },
        },
        input: { '&.MuiInputBase-inputSizeSmall': { paddingTop: 8, paddingBottom: 8 } },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { fontSize: '0.9rem', '&.Mui-focused': { color: ADMIN.espresso } } } },
    MuiFormHelperText: { styleOverrides: { root: { marginLeft: 2, fontSize: '0.78rem' } } },
    MuiTableContainer: { styleOverrides: { root: { '&.MuiPaper-root': { borderRadius: 10, border: `1px solid ${ADMIN.line}`, boxShadow: 'none' } } } },
    MuiTableCell: {
      styleOverrides: {
        root: { padding: '14px 16px', fontSize: '0.875rem', borderBottomColor: ADMIN.line },
        head: { padding: '12px 16px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.06em', color: ADMIN.muted, backgroundColor: ADMIN.head, borderBottom: `1px solid ${ADMIN.line}` },
      },
    },
    MuiTableRow: { styleOverrides: { root: { '&:hover:not(.MuiTableRow-head)': { backgroundColor: '#fbf8f2' }, '&.Mui-selected, &:focus-visible': { backgroundColor: '#fbf8f2' } } } },
    MuiPaginationItem: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 8, '&.Mui-selected': { backgroundColor: ADMIN.espresso, color: '#fff', '&:hover': { backgroundColor: ADMIN.espressoHover } } },
      },
    },
    MuiAlert: { styleOverrides: { root: { borderRadius: 8, alignItems: 'center' } } },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 12, boxShadow: '0 24px 60px rgba(46,27,15,0.25)' },
      },
    },
    MuiDialogTitle: { styleOverrides: { root: { fontFamily: "'Playfair Display', Georgia, serif", fontWeight: 700, fontSize: '1.35rem', color: ADMIN.espresso, padding: '20px 24px 8px' } } },
    MuiDialogContent: { styleOverrides: { root: { padding: '8px 24px 16px' } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '12px 24px 20px', gap: 4 } } },
    MuiMenuItem: { styleOverrides: { root: { fontSize: '0.875rem', minHeight: 40, '&.Mui-selected': { backgroundColor: ADMIN.head } } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } } },
  },
})
