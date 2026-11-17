import { activitySchema, addDays, barnToday, type ActivityInput } from '@absolute/shared';
import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { demoPlans } from './plans-demo.js';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
async function setup() {
  vi.resetModules();
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('BILLING_ENABLED', 'false');
  const api = request((await import('./app.js')).app);
  return { api, memory: (await import('./plans-repository.js')).planMemory };
}
const nextDate = () => addDays(barnToday('America/Toronto'), 1);
const participant = (riderId = 'rider-emma', horseId = 'horse-charlie') => ({ riderId, horseId, overrideReason: '', relationshipOverrideReason: '' });
const privateActivity = (): ActivityInput => ({ activityType: 'PRIVATE_LESSON', date: nextDate(), startTime: '15:00', endTime: '15:30', coachId: 'coach-sarah', status: 'CONFIRMED', discipline: 'FLAT', rideUnits: 0.5,
  location: '', notes: '', cancellationAction: 'RETAIN', participants: [participant()] });

it('returns all HST-inclusive prices and data-driven cash-only and birthday rules', async () => {
  const { api } = await setup();
  const response = await api.get('/api/plans').expect(200);
  expect(response.body).toHaveLength(14);
  expect(response.body.every((plan: { hstIncluded: boolean; priceCents: number }) => plan.hstIncluded && Number.isInteger(plan.priceCents) && plan.priceCents >= 0)).toBe(true);
  for (const [quantity, amountCents] of [[6, 43000], [7, 49000], [8, 55000]]) {
    expect((await api.get(`/api/plans/plan-birthday/quote?quantity=${quantity}`).expect(200)).body).toMatchObject({ amountCents, hstIncluded: true });
  }
  expect((await api.get('/api/plans/plan-grooming/quote').expect(200)).body).toMatchObject({ amountCents: 3000, paymentMethodRule: 'CASH_ONLY', paymentInstructions: 'Cash only - exact change please.' });
  await api.get('/api/plans/plan-birthday/quote?quantity=-1').expect(400);
});

it('creates a rider enrollment, consumes a private lesson entitlement and explicitly restores it on cancellation', async () => {
  const { api } = await setup();
  const enrollment = (await api.post('/api/enrollments').send({ riderId: 'rider-emma', planId: 'plan-monthly-private', startDate: nextDate(), endDate: null, status: 'ACTIVE', notes: '' }).expect(201)).body;
  const input = privateActivity();
  input.participants[0] = { ...input.participants[0], enrollmentId: enrollment.id, entitlementId: 'entitlement-monthly-private-lesson' };
  const booking = (await api.post('/api/activities').send(input).expect(201)).body;
  expect(booking.participants[0]).toMatchObject({ amountCents: 0, enrollmentId: enrollment.id, publishedPriceCents: 25600 });
  let detail = (await api.get(`/api/enrollments?date=${nextDate()}&riderId=rider-emma`)).body.find((entry: { id: string }) => entry.id === enrollment.id);
  expect(detail.entitlements[0]).toMatchObject({ used: 1, remaining: 3 });
  const cancelled = (await api.put(`/api/activities/${booking.id}`).send({ ...input, version: booking.version, status: 'CANCELLED', cancellationAction: 'RETAIN' }).expect(200)).body;
  detail = (await api.get(`/api/enrollments?date=${nextDate()}&riderId=rider-emma`)).body.find((entry: { id: string }) => entry.id === enrollment.id);
  expect(detail.entitlements[0].used).toBe(1);
  await api.put(`/api/activities/${booking.id}`).send({ ...input, version: cancelled.version, status: 'CANCELLED', cancellationAction: 'RESTORE' }).expect(200);
  detail = (await api.get(`/api/enrollments?date=${nextDate()}&riderId=rider-emma`)).body.find((entry: { id: string }) => entry.id === enrollment.id);
  expect(detail.entitlements[0]).toMatchObject({ used: 0, remaining: 4 });
  await api.put(`/api/activities/${booking.id}`).send({ ...input, version: booking.version }).expect(409);
});

it('records individual purchases at $75, enforces duration and all lesson capacities', async () => {
  const { api } = await setup();
  const saved = (await api.post('/api/activities').send(privateActivity()).expect(201)).body;
  expect(saved.participants[0]).toMatchObject({ planId: 'plan-single', amountCents: 7500, hstIncluded: true });
  await api.post('/api/activities').send({ ...privateActivity(), endTime: '16:00' }).expect(400);
  await api.post('/api/activities').send({ ...privateActivity(), participants: [participant(), participant('rider-noah', 'horse-willow')] }).expect(400);
  await api.post('/api/activities').send({ ...privateActivity(), activityType: 'SEMI_PRIVATE_LESSON' }).expect(400);
  await api.post('/api/activities').send({ ...privateActivity(), activityType: 'SEMI_PRIVATE_LESSON', participants: [participant(), participant('rider-noah', 'horse-willow'), participant('rider-olivia', 'horse-atlas')] }).expect(400);
  await api.post('/api/activities').send({ ...privateActivity(), activityType: 'GROUP_LESSON', endTime: '16:00', participants: [participant(), participant('rider-noah', 'horse-willow')] }).expect(400);
});

it('saves group and semi-private participants atomically and keeps horse conflict and recommendation rules', async () => {
  const { api, memory } = await setup();
  const group = { ...privateActivity(), activityType: 'GROUP_LESSON', endTime: '16:00', participants: [participant(), participant('rider-noah', 'horse-willow'), participant('rider-olivia', 'horse-atlas')] };
  const saved = (await api.post('/api/activities').send(group).expect(201)).body;
  expect(saved.participants).toHaveLength(3);
  expect(saved.participants.every((p: { lessonId: string }) => Boolean(p.lessonId))).toBe(true);
  const before = memory.activities.length;
  await api.post('/api/activities').send(group).expect(409);
  expect(memory.activities).toHaveLength(before);
  await api.post('/api/activities').send({ ...privateActivity(), startTime: '16:00', endTime: '16:30', activityType: 'SEMI_PRIVATE_LESSON', participants: [participant(), participant('rider-noah', 'horse-charlie')] }).expect(409);
  expect(memory.activities).toHaveLength(before);
  const recommendation = await api.post('/api/recommendations/horses').send({ riderId: 'rider-emma', date: nextDate(), startTime: '15:00', endTime: '15:30', lessonType: 'PRIVATE', discipline: 'FLAT', rideUnits: 0.5 }).expect(200);
  expect(recommendation.body.ineligible.some((entry: { horseId: string }) => entry.horseId === 'horse-charlie')).toBe(true);
});

it('blocks exhausted, inactive, expired and mismatched entitlements and accepts a reasoned exhaustion override', async () => {
  const { api, memory } = await setup();
  const input = { ...privateActivity(), participants: [{ ...participant('rider-noah', 'horse-willow'), enrollmentId: 'enrollment-noah', entitlementId: 'entitlement-monthly-private-lesson' }] };
  // Keep this test in the same period as the exhausted fixture even on month boundaries.
  input.date = barnToday('America/Toronto'); input.startTime = '12:00'; input.endTime = '12:30';
  expect((await api.post('/api/activities').send(input).expect(409)).body.error.code).toBe('ENTITLEMENT_EXHAUSTED');
  await api.post('/api/activities').send({ ...input, participants: [{ ...input.participants[0], overrideReason: 'Manager approved additional practice lesson.' }] }).expect(201);
  memory.activities = memory.activities.filter((entry) => entry.date !== input.date || entry.startTime !== input.startTime);
  (await import('./store.js')).store.lessons = (await import('./store.js')).store.lessons.filter((entry) => entry.date !== input.date || entry.startTime !== input.startTime);
  memory.enrollments.find(({ id }) => id === 'enrollment-noah')!.status = 'PAUSED';
  expect((await api.post('/api/activities').send(input).expect(409)).body.error.code).toBe('ENTITLEMENT_INACTIVE');
  memory.enrollments.find(({ id }) => id === 'enrollment-noah')!.status = 'ACTIVE';
  memory.plans.find(({ id }) => id === 'plan-monthly-private')!.effectiveTo = '2000-01-01';
  expect((await api.post('/api/activities').send(input).expect(409)).body.error.code).toBe('ENTITLEMENT_INACTIVE');
});

it('schedules package practice rides against the mapped horse and includes horse workload', async () => {
  const { api } = await setup();
  const input = { ...privateActivity(), activityType: 'PRACTICE_RIDE', coachId: null, endTime: '16:00', participants: [{ ...participant('rider-emma', 'horse-jasper'), enrollmentId: 'enrollment-emma', entitlementId: 'entitlement-pb-2-practice-practice' }] };
  const saved = (await api.post('/api/activities').send(input).expect(201)).body;
  const schedule = (await api.get(`/api/schedule?date=${nextDate()}`).expect(200)).body;
  expect(schedule.lessons.some((lesson: { id: string }) => lesson.id === saved.participants[0].lessonId)).toBe(true);
  expect(schedule.workloads.find((entry: { horse: { id: string } }) => entry.horse.id === 'horse-jasper').usedUnits).toBeGreaterThanOrEqual(0.5);
  await api.post('/api/activities').send({ ...input, participants: [{ ...input.participants[0], horseId: 'horse-charlie' }] }).expect(409);
});

it('reserves service resources, stores cash-only classification and validates camp and birthday quantities', async () => {
  const { api } = await setup();
  const grooming = { ...privateActivity(), activityType: 'GROOMING_TACKING', endTime: '16:30', participants: [{ ...participant(), horseId: null }] };
  const saved = (await api.post('/api/activities').send(grooming).expect(201)).body;
  expect(saved.participants[0]).toMatchObject({ amountCents: 3000, paymentMethodRule: 'CASH_ONLY', lessonId: null });
  await api.post('/api/activities').send(privateActivity()).expect(409);
  await api.post('/api/lessons').send({ date: nextDate(), startTime: '15:00', endTime: '15:30', riderId: 'rider-emma', horseId: 'horse-charlie', coachId: 'coach-sarah', lessonType: 'PRIVATE', discipline: 'FLAT', rideUnits: 0.5, status: 'CONFIRMED' }).expect(409);
  await api.post('/api/activities').send({ ...grooming, activityType: 'SEASONAL_CAMP', date: nextDate(), endDate: addDays(nextDate(), 8) }).expect(400);
});

it('calculates usage only from explicit records in the selected month and rejects negative currency', async () => {
  await setup();
  const { balance, publishedAmount } = await import('./plans-service.js');
  const entitlement = demoPlans[0].entitlements[0];
  expect(balance(entitlement, 'enrollment', '2026-11-17', [
    { id: 'one', participantId: 'p', enrollmentId: 'enrollment', entitlementId: entitlement.id, serviceDate: '2026-11-01', quantity: 1, status: 'USED', overrideReason: '' },
    { id: 'two', participantId: 'p2', enrollmentId: 'enrollment', entitlementId: entitlement.id, serviceDate: '2026-11-02', quantity: 1, status: 'RESTORED', overrideReason: '' },
  ])).toMatchObject({ allocated: 4, used: 1, remaining: 3, periodStart: '2026-11-01', periodEnd: '2026-11-30' });
  expect(() => publishedAmount({ ...demoPlans[0], priceCents: -1 }, 1)).toThrow();
  const group = { ...privateActivity(), activityType: 'GROUP_LESSON', endTime: '16:00', participants: Array.from({ length: 6 }, (_, index) => participant(`rider-${index}`, `horse-${index}`)) };
  expect(activitySchema.safeParse(group).success).toBe(true);
  expect(activitySchema.safeParse({ ...group, participants: [...group.participants, participant('seventh', 'seventh')] }).success).toBe(false);
});
