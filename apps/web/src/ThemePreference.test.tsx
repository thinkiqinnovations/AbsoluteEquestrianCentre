// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useTheme } from '@mui/material';
import { expect, it, vi } from 'vitest';
import { AppThemeProvider, ThemeToggle } from './ThemePreference';

it('defaults to light, switches both ways and restores the saved preference', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  localStorage.clear();
  const target = document.createElement('div');
  let root = createRoot(target);
  function Preview() { return <output>{useTheme().palette.mode}</output>; }
  const render = async () => { await act(async () => root.render(<AppThemeProvider><ThemeToggle /><Preview /></AppThemeProvider>)); };
  try {
    await render();
    expect(target.querySelector('output')?.textContent).toBe('light');
    expect(target.querySelector<HTMLInputElement>('[role="switch"]')?.checked).toBe(false);
    await act(async () => target.querySelector<HTMLInputElement>('[role="switch"]')!.click());
    expect(target.querySelector('output')?.textContent).toBe('dark');
    expect(localStorage.getItem('thinkiq-ui-theme')).toBe('dark');
    await act(async () => root.unmount());
    root = createRoot(target);
    await render();
    expect(target.querySelector('output')?.textContent).toBe('dark');
    expect(target.querySelector<HTMLInputElement>('[role="switch"]')?.checked).toBe(true);
    await act(async () => target.querySelector<HTMLInputElement>('[role="switch"]')!.click());
    expect(target.querySelector('output')?.textContent).toBe('light');
  } finally {
    await act(async () => root.unmount()); localStorage.clear(); vi.unstubAllGlobals();
  }
});
