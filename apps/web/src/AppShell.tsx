import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { AppBar, Box, Button, Collapse, Container, IconButton, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ThemePreference';

const navigation = [['/', 'Schedule'], ['/horses', 'Horses'], ['/riders', 'Riders'], ['/coaches', 'Coaches'], ['/part-board', 'Part Board'], ['/plans', 'Plans & Pricing']];
const logo = '/images/absolute-equestrian-logo.png';

export function AppHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  const links = () => navigation.map(([to, text]) => {
    const active = to === '/' ? pathname === '/' || pathname === '/schedule' : pathname.startsWith(to);
    return <Button key={to} component={Link} to={to} variant="text" color="inherit" aria-current={active ? 'page' : undefined} onClick={() => setMenuOpen(false)}
      sx={(theme) => ({ color: 'var(--header-text)', fontWeight: active ? 700 : 500, borderBottom: '3px solid', borderColor: active ? 'var(--header-accent)' : 'transparent', borderRadius: 0, px: 1.1, minHeight: 44, whiteSpace: 'nowrap', '&:hover': { backgroundColor: alpha(theme.palette.common.white, 0.09) }, '&:focus-visible': { outlineColor: 'var(--header-accent)' } })}>{text}</Button>;
  });
  return <AppBar component="header" position="sticky" elevation={0} sx={{ '--header-background': '#020713', '--header-text': '#f7fbff', '--header-muted': '#a8b7d2', '--header-accent': '#18d7f5', backgroundColor: 'var(--header-background)', backgroundImage: 'none', color: 'var(--header-text)', borderBottom: '2px solid', borderColor: 'var(--header-accent)' }}>
    <Container maxWidth="xl">
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr) auto', lg: 'minmax(0, 1fr) auto' }, alignItems: 'center', columnGap: { xs: 1, lg: 2 }, rowGap: 1, py: { xs: 1.5, lg: 2 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: 1.25, sm: 2 }} alignItems={{ xs: 'flex-start', sm: 'center' }} minWidth={0}>
          <Box component="a" href="https://thinkiqinnovations.com/" target="_blank" rel="noreferrer" aria-label="ThinkIQ Innovations website" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, color: 'inherit', textDecoration: 'none', flexShrink: 0, '&:focus-visible': { outline: '2px solid var(--header-accent)', outlineOffset: 4 } }}>
            <Box component="img" src="/images/thinkiq-innovations-logo.png" alt="ThinkIQ Innovations logo" width={80} height={52} sx={{ width: { xs: 56, sm: 80 }, height: 'auto', objectFit: 'contain', borderRadius: 1 }} />
            <Box>
              <Typography component="span" display="block" sx={{ fontFamily: '"Space Grotesk", Inter, sans-serif', fontWeight: 700, fontSize: { xs: 23, sm: 29 }, lineHeight: 1 }}>Think<Box component="span" sx={{ color: 'var(--header-accent)' }}>IQ</Box></Typography>
              <Typography component="span" display="block" sx={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.22em', mt: 0.5 }}>INNOVATIONS</Typography>
            </Box>
          </Box>
          <Box sx={{ borderLeft: '1px solid', borderColor: 'var(--header-muted)', pl: 2, minWidth: 0 }}>
            <Typography sx={{ fontWeight: 600, fontSize: '0.75rem' }}>Absolute Equestrian Centre</Typography>
            <Typography sx={{ color: 'var(--header-muted)', fontSize: '0.65rem', mt: 0.25 }}>1795782 Ontario Inc.</Typography>
            <Typography sx={{ color: 'var(--header-muted)', fontSize: '0.65rem' }}>Stable & Lesson Management</Typography>
          </Box>        </Stack>
        <Stack direction={{ xs: 'column', xl: 'row' }} alignItems="flex-end" justifyContent="center" gap={{ xs: 0, xl: 1.5 }} sx={{ gridColumn: 2, gridRow: 1 }}>
        <Stack component="nav" aria-label="Primary navigation" direction="row" sx={{ display: { xs: 'none', lg: 'flex' }, alignItems: 'center' }}>{links()}</Stack>
        <IconButton aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)} sx={{ display: { lg: 'none' }, color: 'var(--header-text)', gridColumn: 2, gridRow: 1 }}>
          {menuOpen ? <CloseIcon /> : <MenuIcon />}
        </IconButton>
        <ThemeToggle />
        </Stack>
      </Box>
      <Collapse in={menuOpen} unmountOnExit sx={{ display: { lg: 'none' } }}>
        <Stack component="nav" id="mobile-navigation" aria-label="Mobile navigation" sx={{ pb: 2, alignItems: 'stretch' }}>{links()}</Stack>
      </Collapse>
    </Container>
  </AppBar>;
}

export function AppFooter() {
  return <Box component="footer" sx={{ mt: 5, borderTop: 1, borderColor: 'divider', backgroundColor: 'background.default' }}>
    <Container maxWidth="xl" sx={{ py: 2.5 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" gap={2}>
        <Stack direction="row" alignItems="center" gap={1.5}>
          <Box component="img" src={logo} alt="" width={44} height={44} sx={{ objectFit: 'contain' }} />
          <Typography sx={{ fontFamily: 'h6.fontFamily', fontStyle: 'italic', fontSize: '1rem' }}>Excellence in Equestrian Education</Typography>
        </Stack>
        <Stack direction="row" gap={1} alignItems="center" flexWrap="wrap">
          {['RIDE', 'LEARN', 'GROW', 'BELONG'].map((word, index) => <Box component="span" key={word} sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.1em' }}>{index > 0 && <Box component="span" aria-hidden="true" sx={{ color: 'secondary.main', mr: 1 }}>•</Box>}{word}</Box>)}
        </Stack>
      </Stack>
    </Container>
  </Box>;
}

export function AppShell({ children }: { children: ReactNode }) {
  return <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', minWidth: 0 }}>
    <Box component="a" href="#main-content" sx={{ position: 'fixed', top: -100, left: 16, zIndex: 'tooltip', p: 1.5, backgroundColor: 'background.paper', color: 'primary.main', '&:focus': { top: 8 } }}>Skip to content</Box>
    <AppHeader />
    <Container component="main" id="main-content" tabIndex={-1} maxWidth="xl" sx={{ flexGrow: 1, minWidth: 0, py: { xs: 3, md: 5 } }}>
      {children}
    </Container>
    <AppFooter />
  </Box>;
}
