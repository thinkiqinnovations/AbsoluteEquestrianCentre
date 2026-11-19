import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppThemeProvider } from './ThemePreference';

createRoot(document.getElementById('root')!).render(<AppThemeProvider><QueryClientProvider client={new QueryClient()}><BrowserRouter><App /></BrowserRouter></QueryClientProvider></AppThemeProvider>);
