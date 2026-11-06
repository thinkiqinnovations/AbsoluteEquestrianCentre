import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: { background: { default: '#F4F0E7', paper: '#FFFDF8' }, primary: { main: '#374936' }, secondary: { main: '#65755B' }, text: { primary: '#242820' }, error: { main: '#A44B3E' }, warning: { main: '#B9822D' } },
  shape: { borderRadius: 10 },
  typography: { fontFamily: 'Georgia, "Times New Roman", serif', h4: { fontWeight: 600 }, h5: { fontWeight: 600 }, button: { fontFamily: 'Arial, sans-serif', fontWeight: 600, textTransform: 'none' }, body1: { fontFamily: 'Arial, sans-serif' }, body2: { fontFamily: 'Arial, sans-serif' } },
  components: { MuiCard: { styleOverrides: { root: { border: '1px solid #E3DBCD', boxShadow: 'none' } } }, MuiButton: { styleOverrides: { root: { borderRadius: 8 } } } },
});
