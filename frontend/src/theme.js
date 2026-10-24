import { createTheme } from '@mui/material/styles'

// Ek hi theme poore app me (SRS section 15). Rang login page ke brown/gold se milte hain.
// Kam se kam 44px ke buttons/inputs (SRS UX-01).
const HEADING_FONT = "'Playfair Display', Georgia, serif"
const BODY_FONT = "'Inter', system-ui, 'Segoe UI', Roboto, sans-serif"

export const COLORS = {
  espresso: '#2e1b0f', // sidebar ka gehra brown
  brown: '#8b5e3c',
  brownDark: '#6f4a2e',
  gold: '#c9a24a',
  goldSoft: '#f3e7c9',
  cream: '#faf6f1',
  line: '#eadfd3',
  ink: '#3a2415',
}

export const theme = createTheme({
  palette: {
    primary: { main: COLORS.brown, dark: COLORS.brownDark, contrastText: '#fff' },
    secondary: { main: COLORS.gold },
    background: { default: COLORS.cream, paper: '#ffffff' },
    text: { primary: COLORS.ink, secondary: '#5f4a38' },
    divider: COLORS.line,
    error: { main: '#d32f2f' },
    success: { main: '#2f6b3a' },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: BODY_FONT,
    h3: { fontFamily: HEADING_FONT, fontWeight: 700 },
    h4: { fontFamily: HEADING_FONT, fontWeight: 700 },
    h5: { fontFamily: HEADING_FONT, fontWeight: 700 },
    h6: { fontFamily: HEADING_FONT, fontWeight: 600 },
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiCard: {
      defaultProps: { variant: 'outlined' },
      styleOverrides: { root: { borderColor: COLORS.line, boxShadow: '0 1px 2px rgba(58,36,21,0.04), 0 8px 24px rgba(58,36,21,0.05)' } },
    },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: { root: { minHeight: 44, textTransform: 'none', fontWeight: 600, borderRadius: 10 } } },
    MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
    MuiTextField: { defaultProps: { fullWidth: true, size: 'medium' } },
    // Input par sirf ek border: hover par gold, focus par brown. Upar wala alag gold outline ring nahi aata.
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          minHeight: 48,
          backgroundColor: '#fff',
          '&.MuiInputBase-sizeSmall': { minHeight: 40 },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.line, transition: 'border-color .15s' },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.gold },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: COLORS.brown, borderWidth: 2 },
          '&.Mui-error .MuiOutlinedInput-notchedOutline': { borderColor: '#d32f2f' },
          '& input:focus-visible, & textarea:focus-visible': { outline: 'none' },
        },
      },
    },
    // Chhote screen par dialog poori width le, margin kam ho aur andar ka content scroll ho.
    // Kai dialogs me content+buttons <form> ke andar hote hain; form ko flex column banao taaki content scroll ho aur buttons hamesha dikhen.
    MuiDialog: { styleOverrides: { paper: { '& > form': { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden' }, margin: 16, maxWidth: 'calc(100% - 32px)', maxHeight: 'calc(100% - 32px)', '@media (max-width:599px)': { margin: 8, maxWidth: 'calc(100% - 16px)', maxHeight: 'calc(100% - 16px)', '&.MuiDialog-paperFullWidth': { width: 'calc(100% - 16px)' } }, '&.MuiDialog-paperFullScreen': { margin: 0, width: '100%', maxWidth: '100%', maxHeight: 'none', '@media (max-width:599px)': { margin: 0, width: '100%', maxWidth: '100%', maxHeight: 'none' } } } } },
    MuiDialogContent: { styleOverrides: { root: { overflowY: 'auto' } } },
    // Chhote screen par 2-3 buttons ek line me na samayen to neeche wrap hon, bahar na nikalen.
    MuiDialogActions: { styleOverrides: { root: { flexWrap: 'wrap', rowGap: 8 } } },
    MuiTab: { styleOverrides: { root: { minHeight: 44 } } },
    MuiTableCell: { styleOverrides: { head: { fontWeight: 600, color: COLORS.brownDark, backgroundColor: '#fbf7f2' } } },
    MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
  },
})
