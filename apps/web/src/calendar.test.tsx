// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { barnToday, monthRange } from '@absolute/shared';
import { App } from './App';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const container = document.createElement('div');
document.body.append(container);
let root: ReturnType<typeof createRoot> | undefined;
let client: QueryClient | undefined;
const date = '2026-11-18';
const person = { id: 'emma', firstName: 'Emma', lastName: 'Roberts' };
const lesson = { id: 'lesson', date, startTime: '15:30', endTime: '16:30', riderId: 'emma', horseId: 'jasper', coachId: 'sarah',
  lessonType: 'GROUP', discipline: 'FLAT', status: 'CONFIRMED', rideUnits: 1, rider: person,
  horse: { id: 'jasper', name: 'Jasper' }, coach: { id: 'sarah', firstName: 'Sarah', lastName: 'Bennett' } };
const lessons = Array.from({ length: 5 }, (_, index) => ({ ...lesson, id: `lesson-${index}` }));
const button = (name: string) => [...document.querySelectorAll('button')].find((item) => item.textContent?.trim() === name || item.getAttribute('aria-label') === name);
async function click(name: string) {
  const element = button(name);
  expect(element, name).toBeDefined();
  await act(async () => { element!.click(); });
}
async function waitFor(check: () => void) {
  await vi.waitFor(async () => {
    await act(async () => {});
    check();
  });
}

function Location() {
  const { search } = useLocation();
  return <output>{search}</output>;
}

afterEach(async () => {
  await act(async () => { root?.unmount(); });
  client?.clear();
  vi.unstubAllGlobals();
});

it('creates a part-board agreement, manages its status, and reports recurring generation', async () => {
  type Entry = Record<string, unknown> & { id: string; status: string };
  let agreements: Entry[] = [];
  const templates = [{
    id: 'demo-template', startDate: date, endDate: null, dayOfWeek: 'WEDNESDAY', status: 'ACTIVE',
    schedulingPriority: 80, lesson,
  }];
  vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => {
    const { pathname } = new URL(path, 'http://localhost');
    let body: unknown = [];
    if (pathname === '/api/riders') body = [person];
    if (pathname === '/api/horses') body = [lesson.horse];
    if (pathname === '/api/coaches') body = [lesson.coach];
    if (pathname.endsWith('/settings')) body = { timeZone: 'America/Toronto' };
    if (pathname.startsWith('/api/part-board')) {
      if (options?.body) {
        const input = JSON.parse(String(options.body));
        const entry = { ...input, id: 'demo', riderName: 'Emma Roberts', horseName: 'Jasper',
          entitlement: { allowed: 2, used: 1, remaining: 1, period: input.entitlementPeriod, periodStart: '2026-11-01', periodEnd: '2026-11-30' } };
        agreements = [entry];
        body = entry;
      } else body = agreements;
    }
    if (pathname === '/api/recurring-lessons') body = templates;
    if (pathname.endsWith('/generate')) body = { generated: [{ id: 'new-lesson' }], skipped: 1, failures: [{ date, conflicts: [{ severity: 'ERROR', message: 'Horse unavailable' }] }] };
    return { ok: true, json: async () => body };
  }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root = createRoot(container);
  await act(async () => root!.render(<MemoryRouter initialEntries={['/part-board']}>
    <QueryClientProvider client={client!}><App /></QueryClientProvider>
  </MemoryRouter>));
  async function select(label: string, text: string, parent: ParentNode = document) {
    const field = [...parent.querySelectorAll('[role="combobox"]')].find((control) =>
      control.parentElement?.parentElement?.querySelector('label')?.textContent === label);
    expect(field, label).toBeDefined();
    await act(async () => field!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
    const choice = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find((option) => option.textContent === text);
    expect(choice, text).toBeDefined();
    await act(async () => choice!.click());
  }
  await waitFor(() => expect(button('Generate lessons')).toBeDefined());
  await click('New agreement');
  const dialog = document.querySelector('[role="dialog"]')!;
  await select('Rider', 'Emma Roberts', dialog);
  await select('Horse', 'Jasper', dialog);
  await select('Entitlement period', 'Month', dialog);
  await click('Add preferred time');
  await click('Save agreement');
  await waitFor(() => expect(document.body.textContent).toContain('2 rides per month'));
  expect(document.body.textContent).toContain('1 remaining');
  expect(document.body.textContent).toContain('Preferred times');
  await click('Edit agreement');
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Schedule Preferences');
  await click('Cancel');
  await click('Pause');
  await waitFor(() => expect(button('Edit agreement')).toBeUndefined());
  await select('Status', 'Paused');
  await click('End');
  await waitFor(() => expect(button('Edit agreement')).toBeUndefined());
  await select('Status', 'Ended');
  expect(button('Edit agreement')).toBeDefined();
  await click('Generate lessons');
  await waitFor(() => expect(document.body.textContent).toContain('1 generated · 1 already scheduled · 1 failed'));
  expect(document.body.textContent).toContain('Horse unavailable');
}, 15000);

it('navigates views, filters and opens month results in the shared lesson workflow', async () => {
  const calls: string[] = [];
  const previews: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => {
    const url = new URL(path, 'http://localhost');
    calls.push(url.pathname);
    let body: unknown = [];
    if (url.pathname.endsWith('/settings')) body = { timeZone: 'America/Toronto' };
    if (url.pathname.endsWith('/week')) body = { lessons: [], summary: { lessonCount: 0, conflictCount: 0, horsesNearCapacity: 0 }, conflicts: [] };
    if (url.pathname === '/api/schedule') body = { lessons: [], workloads: [], conflicts: [], summary: { lessons: 0 } };
    if (url.pathname.endsWith('/month')) {
      const { dates, ...month } = monthRange(Number(url.searchParams.get('year')), Number(url.searchParams.get('month')));
      body = { month, days: dates.map((day) => ({
        date: day, lessons: day === date ? lessons : [], horsesNearCapacity: day === date ? ['jasper'] : [],
        conflicts: day === date ? [{ lessonId: 'lesson-0', severity: 'ERROR', code: 'HORSE_UNAVAILABLE' }] : [],
      })) };
    }
    if (url.pathname === '/api/availability/check') body = { RIDER: {}, HORSE: {}, COACH: {} };
    if (url.pathname === '/api/riders') body = [{ ...person, active: true }];
    if (url.pathname === '/api/horses') body = [{ ...lesson.horse, active: true }];
    if (url.pathname === '/api/coaches') body = [{ ...lesson.coach, active: true }];
    if (url.pathname === '/api/recommendations/horses') {
      previews.push(JSON.parse(String(options?.body)));
      const recommendation = { eligible: true, workload: { current: 0, proposed: 1, projected: 1, maximum: 1.5 },
        baseScore: 50, reasons: [{ code: 'FIRST_PREFERENCE', impact: 25, description: 'Rider preference rank 1.' }], warnings: [] };
      body = { recommendations: [
        { ...recommendation, rank: 1, horseId: 'jasper', horseName: 'Sassy', score: 75 },
        { ...recommendation, rank: 2, horseId: 'lindon', horseName: 'Lindon', score: 50, reasons: [] },
      ], ineligible: [{ ...recommendation, horseId: 'atlas', horseName: 'Atlas', eligible: false, score: 50, scoreReasons: [],
        reasons: [{ code: 'RIDER_LEVEL_INCOMPATIBLE', description: 'Rider level is incompatible.' }] }] };
    }
    return { ok: true, json: async () => body };
  }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  root = createRoot(container);
  await act(async () => root!.render(<MemoryRouter initialEntries={[`/schedule?view=day&date=${date}`]}>
    <QueryClientProvider client={client!}><App /><Location /></QueryClientProvider>
  </MemoryRouter>));
  const location = () => document.querySelector('output')?.textContent;
  await click('Next day');
  expect(location()).toContain('2026-11-19');
  await click('Previous day');
  await click('Month');
  await waitFor(() => expect(button('+2 more')).toBeDefined());
  expect(document.body.textContent).toContain('November 2026');
  expect(button('Conflicts · 1')).toBeDefined();
  expect(button('Near capacity · 1')).toBeDefined();
  expect(document.querySelector('[aria-label="Monthly agenda"]')).toBeTruthy();
  expect(calls.filter((call) => call.endsWith('/month'))).toHaveLength(1);

  const filters = [...container.querySelectorAll('[role="combobox"]')];
  for (const [index, label] of ['Sarah Bennett', 'Jasper', 'Emma Roberts', 'Jump'].entries()) {
    await act(async () => filters[index].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 })));
    const option = [...document.querySelectorAll('[role="option"]')].find((item) => item.textContent === label) as HTMLElement;
    expect(option).toBeDefined();
    await act(async () => option.click());
  }
  expect(document.body.textContent).toContain('No lessons match this month.');
  await click('Clear filters');
  await click('Edit Emma Roberts on 2026-11-18 at 15:30');
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('Edit Lesson');
  for (const label of ['Rider', 'Lesson type', 'Discipline', 'Coach', 'Status']) {
    expect(document.querySelector(`[role="dialog"] [role="combobox"][aria-label="${label}"]`), label).toBeTruthy();
  }
  await waitFor(() => expect(button('Select Lindon')).toBeDefined());
  expect(previews.at(-1)).toMatchObject({ excludeLessonId: 'lesson-0', riderId: 'emma', date });
  expect(document.querySelector('[role="dialog"]')?.textContent).toMatch(/#1 Sassy.*75 points.*Projected workload.*Rider preference rank 1.*#2 Lindon/);
  expect(document.querySelector('[role="dialog"] details')?.textContent).toContain('Rider level is incompatible.');
  expect(document.querySelector('[role="dialog"] details')?.textContent).toContain('Atlas · 50 points');
  await click('Select Atlas');
  expect(button('Atlas selected')?.disabled).toBe(true);
  await click('Select Lindon');
  expect(button('Lindon selected')?.disabled).toBe(true);
  await click('Select Sassy');
  expect(button('Sassy selected')?.disabled).toBe(true);
  await click('Cancel');
  await click('+2 more');
  expect(location()).toBe(`?view=day&date=${date}`);
  await click('Week');
  await click('Next week');
  expect(location()).toContain('2026-11-25');
  await click('Previous week');
  await click('Month');
  await click('Previous month');
  expect(document.body.textContent).toContain('October 2026');
  await click('Next month');
  await click('Add Lesson');
  expect(document.querySelector<HTMLInputElement>('[role="dialog"] input[type="date"]')?.value).toBe(date);
  await click('Cancel');
  await waitFor(() => expect(button('Open day 2026-10-26')).toBeDefined());
  await click('Open day 2026-10-26');
  expect(location()).toBe('?view=day&date=2026-10-26');
  for (const mode of ['Day', 'Week', 'Month']) {
    await click(mode);
    await click('Today');
    expect(location()).toBe(`?view=${mode.toLowerCase()}&date=${barnToday()}`);
  }
}, 15000);
