// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { PlanTerms } from './PlansPricing';
import { ActivityDialog } from './ActivityDialog';
import type { Plan } from '@absolute/shared';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const container = document.createElement('div');
document.body.append(container);
let root: ReturnType<typeof createRoot> | undefined;
let client: QueryClient | undefined;
const plan: Plan = { id: 'monthly', code: 'monthly-group', name: 'Monthly Group', category: 'LESSON_PACKAGE', description: '', priceCents: 21500, pricePeriod: 'MONTHLY', hstIncluded: true, active: true, effectiveFrom: '2020-01-01', effectiveTo: null, sortOrder: 0, durationMinutes: null, includedQuantity: null, additionalUnitPriceCents: null, paymentMethodRule: 'UNRESTRICTED', paymentInstructions: '', daysPerWeek: null, activityTypes: ['GROUP_LESSON'], entitlements: [{ id: 'group', planId: 'monthly', name: 'Group Lessons', quantity: 4, period: 'MONTH', activityTypes: ['GROUP_LESSON'] }] };
afterEach(async () => { await act(async () => root?.unmount()); client?.clear(); vi.unstubAllGlobals(); });
it('shows configured prices as HST included and displays package quantities', async () => {
  root = createRoot(container);
  await act(async () => root!.render(<PlanTerms plan={plan} />));
  expect(container.textContent).toContain('$215/month');
  expect(container.textContent).toContain('HST included');
  expect(container.textContent).toContain('4 Group Lessons / month');
});
it('saves all group participants with explicit enrollment and entitlement identifiers', async () => {
  let payload: Record<string, unknown> | undefined;
  const initial = { id: 'activity', version: 1, activityType: 'GROUP_LESSON', date: '2026-11-17', startTime: '15:00', endTime: '16:00', coachId: 'coach', status: 'CONFIRMED', discipline: 'FLAT', rideUnits: 1, notes: '', location: '', cancellationAction: 'RETAIN', participants: ['emma', 'olivia', 'noah'].map((riderId) => ({ id: riderId, riderId, horseId: `horse-${riderId}`, lessonId: `lesson-${riderId}`, enrollmentId: `enrollment-${riderId}`, entitlementId: 'group', overrideReason: '', relationshipOverrideReason: '', publishedPriceCents: 21500, amountCents: 0 })) };
  vi.stubGlobal('fetch', vi.fn(async (path: string, options?: RequestInit) => {
    const url = new URL(path, 'http://localhost');
    let body: unknown = [];
    if (url.pathname === '/api/activities') body = [initial];
    if (url.pathname === '/api/plans') body = [plan];
    if (url.pathname === '/api/enrollments') body = initial.participants.map((p) => ({ id: p.enrollmentId, riderId: p.riderId, plan, effective: true, entitlements: [{ ...plan.entitlements[0], used: 2, remaining: 2, allocated: 4, periodStart: '2026-11-01', periodEnd: '2026-11-30' }] }));
    if (url.pathname === '/api/riders') body = initial.participants.map(({ riderId }) => ({ id: riderId, firstName: riderId, lastName: 'Demo' }));
    if (url.pathname === '/api/coaches') body = [{ id: 'coach', firstName: 'Sarah', lastName: 'Demo' }];
    if (url.pathname === '/api/horses') body = initial.participants.map(({ horseId }) => ({ id: horseId, name: horseId }));
    if (url.pathname === '/api/recommendations/horses') body = { recommendations: [], ineligible: [] };
    if (options?.method === 'PUT') { payload = JSON.parse(String(options.body)); body = initial; }
    return { ok: true, json: async () => body };
  }));
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  root = createRoot(container);
  await act(async () => root!.render(<QueryClientProvider client={client!}><ActivityDialog activityId="activity" date="2026-11-17" onClose={() => {}} onSaved={() => {}} /></QueryClientProvider>));
  await vi.waitFor(async () => { await act(async () => {}); expect(document.body.textContent).toContain('2 / 4 used'); });
  const button = [...document.querySelectorAll('button')].find((button) => button.textContent === 'Save activity');
  await act(async () => button!.click());
  await vi.waitFor(() => expect(payload?.participants).toHaveLength(3));
  expect(payload).toMatchObject({ version: 1, activityType: 'GROUP_LESSON', participants: [{ enrollmentId: 'enrollment-emma', entitlementId: 'group' }, { enrollmentId: 'enrollment-olivia', entitlementId: 'group' }, { enrollmentId: 'enrollment-noah', entitlementId: 'group' }] });
});
