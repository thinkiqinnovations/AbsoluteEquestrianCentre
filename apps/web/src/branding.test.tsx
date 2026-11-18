// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { getContrastRatio, ThemeProvider } from '@mui/material/styles';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, expect, it } from 'vitest';
import { AppShell } from './AppShell';
import { brandColors, theme } from './theme';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const container = document.createElement('div');
document.body.append(container);
let root: ReturnType<typeof createRoot> | undefined;
afterEach(async () => { await act(async () => root?.unmount()); });

it('keeps the branded palette light and key text combinations above AA contrast', () => {
  expect(theme.palette.mode).toBe('light');
  expect(theme.palette.primary.main).toBe(brandColors.navy);
  for (const [foreground, background] of [
    [brandColors.textPrimary, brandColors.background],
    [brandColors.textSecondary, brandColors.surface],
    [brandColors.surface, brandColors.navy],
    [brandColors.gold, brandColors.navy],
    [brandColors.surface, brandColors.success],
    [brandColors.error, brandColors.surface],
    [brandColors.warningText, brandColors.surface],
  ]) expect(getContrastRatio(foreground, background)).toBeGreaterThanOrEqual(4.5);
});

it('uses the supplied logo and supports labelled mobile navigation with active-page state', async () => {
  function Location() { return <output>{useLocation().pathname}</output>; }
  root = createRoot(container);
  await act(async () => root!.render(<ThemeProvider theme={theme}><MemoryRouter><AppShell><Location /></AppShell></MemoryRouter></ThemeProvider>));
  const logo = container.querySelector<HTMLImageElement>('img[alt="Absolute Equestrian Centre logo"]');
  expect(logo?.getAttribute('src')).toBe('/images/absolute-equestrian-logo.png');
  expect(logo?.getAttribute('width')).toBe(logo?.getAttribute('height'));
  expect(container.querySelector('a[href="#main-content"]')?.textContent).toBe('Skip to content');
  expect(container.querySelector('footer')?.textContent).toContain('Excellence in Equestrian Education');
  const toggle = container.querySelector<HTMLButtonElement>('button[aria-label="Open navigation"]')!;
  await act(async () => toggle.click());
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  const riders = container.querySelector<HTMLAnchorElement>('nav[aria-label="Mobile navigation"] a[href="/riders"]')!;
  await act(async () => riders.click());
  expect(container.querySelector('output')?.textContent).toBe('/riders');
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  expect(container.querySelector('nav[aria-label="Primary navigation"] a[href="/riders"]')?.getAttribute('aria-current')).toBe('page');
});
