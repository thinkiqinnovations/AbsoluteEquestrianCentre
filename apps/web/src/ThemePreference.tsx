import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { CssBaseline, Stack, Switch, ThemeProvider, Typography } from '@mui/material';
import { createAppTheme } from './theme';

const storageKey = 'thinkiq-ui-theme';
const ThemePreference = createContext({ mode: 'light' as 'light' | 'dark', toggle: () => {} });

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    try { return localStorage.getItem(storageKey) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
  });
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const toggle = () => setMode((current) => {
    const next = current === 'light' ? 'dark' : 'light';
    try { localStorage.setItem(storageKey, next); } catch { /* Theme switching also works without storage. */ }
    return next;
  });
  return <ThemePreference.Provider value={{ mode, toggle }}><ThemeProvider theme={theme}><CssBaseline />{children}</ThemeProvider></ThemePreference.Provider>;
}

export function ThemeToggle() {
  const { mode, toggle } = useContext(ThemePreference);
  return <Stack direction="row" alignItems="center" sx={{ color: 'var(--header-text, #f7fbff)', whiteSpace: 'nowrap' }}>
    <Typography component="span" variant="caption">Light</Typography>
    <Switch checked={mode === 'dark'} onChange={toggle} inputProps={{ 'aria-label': 'Dark theme', role: 'switch' }}
      sx={{ '& .MuiSwitch-switchBase': { color: '#f7fbff' }, '& .MuiSwitch-switchBase.Mui-checked': { color: '#18d7f5' }, '& .MuiSwitch-track': { backgroundColor: '#a8b7d2', opacity: 0.6 }, '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#18d7f5', opacity: 0.5 }, '& .MuiSwitch-switchBase.Mui-focusVisible': { outline: '2px solid #18d7f5', outlineOffset: 2 } }} />
    <Typography component="span" variant="caption">Dark</Typography>
  </Stack>;
}
