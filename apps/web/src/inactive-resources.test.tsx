// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { expect, it, vi } from 'vitest';
import { usePlanningResources } from './planning-controls';
import { WeeklyCalendar } from './WeeklyCalendar';
import { emptyFilters } from './ScheduleFilters';

it('excludes inactive choices for new activities while retaining management resources', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  const client = new QueryClient();
  for (const key of ['riders', 'coaches', 'horses']) client.setQueryData([key], [
    { id: 'active', firstName: 'Active', lastName: 'Demo', name: 'Active', active: true },
    { id: 'inactive', firstName: 'Inactive', lastName: 'Demo', name: 'Inactive', active: false },
  ]);
  const target = document.createElement('div');
  const root = createRoot(target);
  function Preview() {
    const choices = usePlanningResources(true);
    return <output>{JSON.stringify(choices)}</output>;
  }
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><Preview /></QueryClientProvider>));
    for (const choices of Object.values(JSON.parse(target.textContent!)) as { id: string }[][]) expect(choices.map(({ id }) => id)).toEqual(['active']);
    expect(client.getQueryData(['horses'])).toHaveLength(2);
  } finally {
    await act(async () => root.unmount()); client.clear(); vi.unstubAllGlobals();
  }
});

it('marks affected lessons in both the weekly grid and mobile agenda', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('fetch', async () => ({ ok: true, json: async () => [] }));
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  client.setQueryData(['schedule', 'week', '2040-02-27'], {
    lessons: [{ id: 'lesson', date: '2040-02-29', startTime: '09:00', endTime: '09:30', status: 'CONFIRMED', lessonType: 'PRIVATE', discipline: 'FLAT', rider: { id: 'rider', firstName: 'Demo', lastName: 'Rider' }, horse: { id: 'horse', name: 'Demo Horse' } }],
    summary: { lessonCount: 1, conflictCount: 1, horsesNearCapacity: 0 },
    conflicts: [{ lessonId: 'lesson', severity: 'ERROR', message: 'Demo Horse is inactive.' }],
  });
  const target = document.createElement('div');
  const root = createRoot(target);
  try {
    await act(async () => root.render(<QueryClientProvider client={client}><WeeklyCalendar start="2040-02-27" filters={emptyFilters} onFilter={() => {}} onAdd={() => {}} onEdit={() => {}} /></QueryClientProvider>));
    expect(target.querySelectorAll('[title="Demo Horse is inactive."]')).toHaveLength(2);
    expect(target.textContent).toContain('Demo Horse is inactive.');
  } finally {
    await act(async () => root.unmount()); client.clear(); vi.unstubAllGlobals();
  }
});
