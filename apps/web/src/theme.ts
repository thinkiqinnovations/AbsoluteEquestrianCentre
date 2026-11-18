import { alpha, createTheme } from '@mui/material/styles';

export const brandColors = {
  navy: '#062862',
  navyDark: '#061A4D',
  gold: '#D5AC35',
  background: '#F7F5EE',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF0F3',
  textPrimary: '#061A4D',
  textSecondary: '#374151',
  border: '#D3D6DC',
  success: '#078239',
  warning: '#B98A13',
  warningText: '#805B00',
  error: '#B42318',
} as const;

const headingFont = 'Georgia, "Times New Roman", serif';
const bodyFont = 'Arial, "Helvetica Neue", sans-serif';
const cardShadow = `0 2px 8px ${alpha(brandColors.navyDark, 0.055)}`;

export const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: brandColors.navy, dark: brandColors.navyDark, contrastText: brandColors.surface },
    secondary: { main: brandColors.gold, contrastText: brandColors.navyDark },
    background: { default: brandColors.background, paper: brandColors.surface },
    text: { primary: brandColors.textPrimary, secondary: brandColors.textSecondary },
    divider: brandColors.border,
    success: { main: brandColors.success },
    warning: { main: brandColors.warning, dark: brandColors.warningText, contrastText: brandColors.navyDark },
    error: { main: brandColors.error },
    info: { main: brandColors.navy },
    action: { hover: alpha(brandColors.navy, 0.045), selected: alpha(brandColors.navy, 0.08) },
  },
  shape: { borderRadius: 10 },
  typography: {
    fontFamily: bodyFont,
    h1: { fontFamily: headingFont, fontWeight: 600 },
    h2: { fontFamily: headingFont, fontWeight: 600 },
    h3: { fontFamily: headingFont, fontWeight: 600 },
    h4: { fontFamily: headingFont, fontWeight: 600, fontSize: '2rem', lineHeight: 1.2, '@media (min-width:900px)': { fontSize: '2.75rem' } },
    h5: { fontFamily: headingFont, fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.3 },
    h6: { fontFamily: headingFont, fontWeight: 600, fontSize: '1.2rem' },
    body1: { lineHeight: 1.6 },
    body2: { lineHeight: 1.5 },
    button: { fontFamily: bodyFont, fontWeight: 600, textTransform: 'none' },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        ':root': Object.fromEntries(Object.entries(brandColors).map(([key, value]) => [`--color-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`, value])),
        html: { colorScheme: 'light' },
        body: { margin: 0, minWidth: 280 },
        '#root': { minHeight: '100dvh', minWidth: 0 },
        '*': { boxSizing: 'border-box' },
        ':focus-visible': { outline: `3px solid ${brandColors.navy}`, outlineOffset: 3 },
        '::selection': { backgroundColor: alpha(brandColors.gold, 0.35), color: brandColors.navyDark },
      },
    },
    MuiCard: { styleOverrides: { root: { minWidth: 0, border: `1px solid ${brandColors.border}`, borderRadius: 12, boxShadow: cardShadow } } },
    MuiCardContent: { styleOverrides: { root: ({ theme }) => ({ padding: theme.spacing(2), [theme.breakpoints.up('sm')]: { padding: theme.spacing(3) }, '&:last-child': { paddingBottom: theme.spacing(3) } }) } },
    MuiPaper: { styleOverrides: { outlined: { borderColor: brandColors.border } } },
    MuiButton: {
      defaultProps: { variant: 'outlined', disableElevation: true },
      styleOverrides: {
        root: { minHeight: 40, borderRadius: 9, lineHeight: 1.4, '&.Mui-focusVisible': { outline: `3px solid ${brandColors.navy}`, outlineOffset: 3, boxShadow: `0 0 0 5px ${alpha(brandColors.gold, 0.3)}` } },
        sizeSmall: { minHeight: 36 },
        containedPrimary: { border: `1px solid ${brandColors.navy}`, '&:hover': { backgroundColor: brandColors.navyDark } },
        outlined: { backgroundColor: brandColors.surface, borderColor: brandColors.border, '&:hover': { borderColor: brandColors.navy, backgroundColor: alpha(brandColors.navy, 0.04) } },
        outlinedError: { color: brandColors.error, borderColor: alpha(brandColors.error, 0.4), '&:hover': { borderColor: brandColors.error, backgroundColor: alpha(brandColors.error, 0.05) } },
        outlinedWarning: { color: brandColors.warningText },
        outlinedSecondary: { color: brandColors.navyDark },
        textWarning: { color: brandColors.warningText },
      },
    },
    MuiIconButton: { styleOverrides: { root: { color: brandColors.navy, '&.Mui-focusVisible': { outline: `3px solid ${brandColors.gold}`, outlineOffset: 2 } } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 9, backgroundColor: brandColors.surface, minWidth: 0, '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(brandColors.gold, 0.35)}` }, '& .MuiOutlinedInput-notchedOutline': { borderColor: brandColors.border } },
        input: { minWidth: 0 },
      },
    },
    MuiInputLabel: { styleOverrides: { root: { color: brandColors.textSecondary, '&.Mui-focused': { color: brandColors.navy } } } },
    MuiMenuItem: { styleOverrides: { root: { minHeight: 44, whiteSpace: 'normal', overflowWrap: 'anywhere' } } },
    MuiFormHelperText: { styleOverrides: { root: { lineHeight: 1.5 } } },
    MuiDialog: { styleOverrides: { paper: ({ theme }) => ({ borderRadius: 12, margin: 12, maxHeight: 'calc(100% - 24px)', width: 'calc(100% - 24px)', [theme.breakpoints.up('sm')]: { margin: 32, width: 'calc(100% - 64px)', maxHeight: 'calc(100% - 64px)' } }) } },
    MuiDialogTitle: { styleOverrides: { root: { fontFamily: headingFont, fontSize: '1.6rem', fontWeight: 600, borderBottom: `2px solid ${brandColors.gold}`, padding: '20px 24px' } } },
    MuiDialogContent: { styleOverrides: { root: { backgroundColor: brandColors.background, padding: 24, minWidth: 0, '& .MuiFormControl-root': { minWidth: 0, maxWidth: '100%' }, '& .MuiInputBase-root': { fontSize: '1rem' } } } },
    MuiDialogActions: { styleOverrides: { root: { padding: '16px 24px', gap: 8, flexWrap: 'wrap', borderTop: `1px solid ${brandColors.border}` } } },
    MuiAlert: { styleOverrides: { root: { borderRadius: 9, fontFamily: bodyFont }, message: { minWidth: 0, overflowWrap: 'anywhere' }, standardWarning: { color: brandColors.warningText, backgroundColor: alpha(brandColors.gold, 0.14) } } },
    MuiChip: { styleOverrides: { root: { fontFamily: bodyFont, borderRadius: 7, fontWeight: 600 }, colorWarning: { color: brandColors.navyDark } } },
    MuiTableCell: { styleOverrides: { head: { backgroundColor: brandColors.surfaceMuted, color: brandColors.navyDark, fontWeight: 700 }, root: { borderColor: brandColors.border } } },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 6, backgroundColor: brandColors.surfaceMuted } } },
    MuiCircularProgress: { defaultProps: { 'aria-label': 'Loading' } },
    MuiLink: { styleOverrides: { root: { textUnderlineOffset: 3 } } },
  },
});
