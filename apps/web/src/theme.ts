import { alpha, createTheme } from '@mui/material/styles';

export const brandColors = {
  navy: '#18d7f5',
  navyDark: '#020713',
  gold: '#18d7f5',
  background: '#020713',
  surface: '#0a152b',
  surfaceMuted: '#101f39',
  textPrimary: '#f7fbff',
  textSecondary: '#a8b7d2',
  border: '#304464',
  success: '#22df8c',
  warning: '#ffd451',
  warningText: '#ffd451',
  error: '#ff8a80',
} as const;

const headingFont = '"Space Grotesk", Inter, sans-serif';
const bodyFont = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';
const cardShadow = `0 2px 8px ${alpha(brandColors.navyDark, 0.055)}`;

export const lightColors = {
  ...brandColors, navy: '#075a9c', gold: '#075a9c', background: '#f3f7fc', surface: '#ffffff',
  surfaceMuted: '#e8eff8', textPrimary: '#10243c', textSecondary: '#45566d', border: '#c8d4e3',
  success: '#087f45', warning: '#a66b00', warningText: '#805200', error: '#b42318',
};

export function createAppTheme(mode: 'light' | 'dark') {
const brandColors = mode === 'light' ? lightColors : darkColors;
return createTheme({
  palette: {
    mode,
    primary: { main: brandColors.navy, dark: '#0bb7d3', contrastText: mode === 'light' ? '#ffffff' : brandColors.navyDark },
    secondary: { main: brandColors.gold, contrastText: mode === 'light' ? '#ffffff' : brandColors.navyDark },
    background: { default: brandColors.background, paper: brandColors.surface },
    text: { primary: brandColors.textPrimary, secondary: brandColors.textSecondary },
    divider: brandColors.border,
    success: { main: brandColors.success },
    warning: { main: brandColors.warning, dark: brandColors.warningText, contrastText: mode === 'light' ? '#ffffff' : brandColors.navyDark },
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
        html: { colorScheme: mode },
        body: { margin: 0, minWidth: 280, backgroundImage: mode === 'light' ? 'none' : 'radial-gradient(900px 520px at 75% 8%, rgba(57,103,255,0.16), transparent 66%), linear-gradient(180deg, #020713 0%, #081224 100%)', backgroundAttachment: 'fixed' },
        '#root': { minHeight: '100dvh', minWidth: 0 },
        '*': { boxSizing: 'border-box' },
        ':focus-visible': { outline: `3px solid ${brandColors.navy}`, outlineOffset: 3 },
        '::selection': { backgroundColor: alpha(brandColors.gold, 0.35), color: brandColors.textPrimary },
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
        containedPrimary: { border: `1px solid ${brandColors.navy}`, '&:hover': { backgroundColor: mode === 'light' ? '#064c83' : '#0bb7d3' } },
        outlined: { backgroundColor: brandColors.surface, borderColor: brandColors.border, '&:hover': { borderColor: brandColors.navy, backgroundColor: alpha(brandColors.navy, 0.04) } },
        outlinedError: { color: brandColors.error, borderColor: alpha(brandColors.error, 0.4), '&:hover': { borderColor: brandColors.error, backgroundColor: alpha(brandColors.error, 0.05) } },
        outlinedWarning: { color: brandColors.warningText },
        outlinedSecondary: { color: brandColors.navy },
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
    MuiAlert: { styleOverrides: { root: { borderRadius: 9, fontFamily: bodyFont }, message: { minWidth: 0, overflowWrap: 'anywhere' }, standardWarning: { color: brandColors.warningText, backgroundColor: alpha(brandColors.warning, 0.14) } } },
    MuiChip: { styleOverrides: { root: { fontFamily: bodyFont, borderRadius: 7, fontWeight: 600 }, colorWarning: { color: mode === 'light' ? '#ffffff' : brandColors.navyDark, '&.MuiChip-outlined': { color: brandColors.warningText, borderColor: brandColors.warningText } } } },
    MuiTableCell: { styleOverrides: { head: { backgroundColor: brandColors.surfaceMuted, color: brandColors.textPrimary, fontWeight: 700 }, root: { borderColor: brandColors.border } } },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 6, backgroundColor: brandColors.surfaceMuted } } },
    MuiCircularProgress: { defaultProps: { 'aria-label': 'Loading' } },
    MuiLink: { styleOverrides: { root: { textUnderlineOffset: 3 } } },
  },
});
}
const darkColors = brandColors;
export const theme = createAppTheme('dark');
