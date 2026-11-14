import { useQuery } from '@tanstack/react-query';
import { civilDate, defaultTimeZone } from '@absolute/shared';
import { api } from './api';

export function useBarnTimeZone() {
  const settings = useQuery({
    queryKey: ['schedule-settings'],
    queryFn: () => api<{ timeZone: string }>('/api/schedule/settings'),
    staleTime: Infinity,
  });
  return settings.data?.timeZone ?? defaultTimeZone;
}

export function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(undefined, { ...options, timeZone: 'UTC' }).format(civilDate(date));
}

export function formatTime(time: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
    .format(new Date(`2000-01-01T${time === '24:00' ? '00:00' : time}:00Z`));
}
