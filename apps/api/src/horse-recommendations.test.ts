import { addDays, barnToday, weekday, type Agreement, type AvailabilityRecords, type HorseRecommendationRequest } from '@absolute/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { recommendHorses } from './horse-recommendations.js';
import type { Horse, Lesson } from './types.js';
import { store } from './store.js';

const date = '2040-02-07';
const rider = store.riders[0];
const horse = store.horses[0];
const base: HorseRecommendationRequest = { riderId: rider.id, date, startTime: '16:00', endTime: '17:00',
  lessonType: 'PRIVATE', discipline: 'FLAT', rideUnits: 0.75 };
const booking: Lesson = { ...store.lessons[0], ...base, id: 'past-or-existing', horseId: horse.id, status: 'CONFIRMED' };
const noAvailability: AvailabilityRecords = { rules: [], overrides: [] };
const agreement: Agreement = { id: 'test', horseId: horse.id, riderId: rider.id, startDate: '2040-01-01', endDate: null,
  status: 'ACTIVE', priority: 100, entitlementPeriod: 'WEEK', freeRidesPerPeriod: 2,
  preferredRideTimes: [{ dayOfWeek: weekday(date), startTime: '15:00', endTime: '18:00', preferenceRank: 1 }] };
const context = {
  snapshot: { horses: [horse], riders: [rider], coaches: store.coaches, lessons: [] as Lesson[] },
  records: noAvailability, history: [] as Lesson[], priority: { templates: [], agreements: [] as Agreement[], usage: [] },
};
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('horse recommendation rules', () => {
  it.each([
    [{ active: false }, {}, 'HORSE_INACTIVE'],
    [{ supportsFlat: false }, {}, 'FLAT_NOT_SUPPORTED'],
    [{ supportsJumping: false }, { discipline: 'JUMP' }, 'HORSE_NOT_JUMP_CAPABLE'],
    [{ minimumRiderLevel: 'INTERMEDIATE', maximumRiderLevel: 'ADVANCED' }, {}, 'RIDER_LEVEL_INCOMPATIBLE'],
  ] as [Partial<Horse>, Partial<HorseRecommendationRequest>, string][])('rejects hard horse constraints (%s)', (fields, changes, code) => {
    const result = recommendHorses({ ...base, ...changes }, { ...context, snapshot: { ...context.snapshot, horses: [{ ...horse, ...fields }] } });
    expect(result.recommendations).toEqual([]);
    const flagged = result.ineligible[0];
    expect(flagged).toMatchObject({ score: expect.any(Number), reasons: expect.arrayContaining([expect.objectContaining({ code })]) });
    expect(flagged.score).toBe(flagged.baseScore + flagged.scoreReasons.reduce((sum, { impact }) => sum + impact, 0));
  });

  it('rejects a rider above the horse limit, and preserves unspecified availability as a warning', () => {
    const advanced = { ...rider, flatLevel: 'ADVANCED' as const };
    expect(recommendHorses(base, { ...context, snapshot: { ...context.snapshot, riders: [advanced] } }).ineligible[0].reasons)
      .toContainEqual(expect.objectContaining({ code: 'RIDER_LEVEL_INCOMPATIBLE' }));
    const eligible = recommendHorses(base, context).recommendations[0];
    expect(eligible.warnings).toContainEqual(expect.objectContaining({ code: 'HORSE_AVAILABILITY_UNSPECIFIED' }));
    expect(eligible.score).toBe(85);
  });

  it('applies overrides and rejects double booking, except for half-open boundaries and the edited booking', () => {
    const override = { id: 'farrier', date, resourceType: 'HORSE' as const, resourceId: horse.id,
      startTime: '16:00', endTime: '17:00', createdAt: '', updatedAt: '', availabilityType: 'UNAVAILABLE' as const, reason: 'FARRIER' as const };
    const blocked = recommendHorses(base, { ...context, records: { rules: [], overrides: [override] } });
    expect(blocked.ineligible[0].reasons).toContainEqual(expect.objectContaining({ code: 'HORSE_UNAVAILABLE', description: expect.stringContaining('farrier') }));
    const withBooking = { ...context, snapshot: { ...context.snapshot, lessons: [booking] } };
    expect(recommendHorses(base, withBooking).ineligible[0].reasons).toContainEqual(expect.objectContaining({ code: 'HORSE_DOUBLE_BOOKED' }));
    expect(recommendHorses({ ...base, excludeLessonId: booking.id }, { ...withBooking, existing: booking }).recommendations).toHaveLength(1);
    const adjacent = recommendHorses({ ...base, startTime: '17:00', endTime: '18:00' }, withBooking).recommendations[0];
    expect(adjacent.workload).toEqual({ current: 0.75, proposed: 0.75, projected: 1.5, maximum: 1.5 });
    expect(adjacent.reasons).toContainEqual(expect.objectContaining({ code: 'AT_CAPACITY', impact: -10 }));
    expect(recommendHorses({ ...base, startTime: '17:00', endTime: '18:00', rideUnits: 1 }, withBooking).ineligible[0].reasons)
      .toContainEqual(expect.objectContaining({ code: 'HORSE_WORKLOAD_EXCEEDED' }));
  });

  it('scores all preference ranks, makes score arithmetic explicit, and orders ties consistently', () => {
    const horses = [horse, ...['horse-charlie', 'horse-willow', 'b', 'a'].map((id) => ({ ...horse, id, name: 'Same name' }))];
    const result = recommendHorses(base, { ...context, snapshot: { ...context.snapshot, horses } });
    expect(result.recommendations.map(({ horseId }) => horseId)).toEqual([horse.id, 'horse-charlie', 'horse-willow', 'a', 'b']);
    expect(result.recommendations.map(({ score }) => score)).toEqual([85, 75, 70, 60, 60]);
    for (const entry of result.recommendations) {
      expect(entry.score).toBe(entry.baseScore + entry.reasons.reduce((sum, reason) => sum + reason.impact, 0));
    }
  });

  it('uses prior assignment history and skips the repetition penalty on part-board rides', () => {
    const history = [1, 2, 3, 4].map((days): Lesson => ({ ...booking, id: String(days), date: addDays(date, -days),
      status: days === 4 ? 'CANCELLED' : 'COMPLETED' }));
    const scope = { ...context, history, priority: { ...context.priority, agreements: [agreement] } };
    const regular = recommendHorses(base, scope).recommendations[0];
    expect(regular.reasons).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'RECENT_PAIRING', impact: 8, description: expect.stringContaining('3 prior') }),
      expect.objectContaining({ code: 'REPEATED_RECENT_ASSIGNMENT', impact: -5 }),
      expect.objectContaining({ code: 'ACTIVE_PART_BOARD_HORSE', impact: 30 }),
    ]));
    const self = recommendHorses({ ...base, lessonType: 'PART_BOARD_RIDE' }, scope).recommendations[0];
    expect(self.reasons).toContainEqual(expect.objectContaining({ code: 'PART_BOARD_PREFERRED_TIME', impact: 10 }));
    expect(self.reasons.some(({ code }) => code === 'REPEATED_RECENT_ASSIGNMENT')).toBe(false);
    expect(recommendHorses({ ...base, lessonType: 'PART_BOARD_RIDE' }, context).ineligible[0].reasons)
      .toContainEqual(expect.objectContaining({ code: 'PART_BOARD_AGREEMENT_REQUIRED' }));
    expect(barnToday('America/Toronto', new Date('2040-02-08T03:00:00Z'))).toBe(date);
  });

  it('distinguishes moderate and near-capacity workloads and favors lower utilization on a score tie', () => {
    const other = { ...horse, id: 'other', name: 'Aardvark', maximumDailyRideUnits: 2 };
    const noPreferences = { ...rider, preferences: [] };
    const result = recommendHorses({ ...base, rideUnits: 0.5 }, {
      ...context, snapshot: { ...context.snapshot, riders: [noPreferences], horses: [horse, other] },
    });
    expect(result.recommendations.map(({ horseId }) => horseId)).toEqual([other.id, horse.id]);
    const differentBands = recommendHorses({ ...base, rideUnits: 1.2 }, {
      ...context, snapshot: { ...context.snapshot, riders: [noPreferences], horses: [horse, other] },
    });
    expect(differentBands.recommendations.map(({ reasons }) => reasons[0].impact)).toEqual([5, 0]);
  });
});

it('validates the API request, returns versioned rankings, and never reserves a recommended horse', async () => {
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('BILLING_ENABLED', 'false');
  const api = request((await import('./app.js')).app);
  const path = '/api/recommendations/horses';
  for (const input of [{ date: '2040-02-31' }, { endTime: '16:00' }, { rideUnits: 0 }]) {
    await api.post(path).send({ ...base, ...input }).expect(400);
  }
  await api.post(path).send({ ...base, riderId: 'missing' }).expect(404);
  await api.post(path).send({ ...base, excludeLessonId: 'missing' }).expect(404);
  const first = await api.post(path).send(base).expect(200);
  expect(first.body).toMatchObject({ rulesetVersion: '1.1', evaluatedAt: expect.any(String) });
  expect(first.body.recommendations[0].horseId).toBe(horse.id);
  expect((await api.post(path).send(base).expect(200)).body.recommendations).toEqual(first.body.recommendations);
  const jump = await api.post(path).send({ ...base, discipline: 'JUMP' }).expect(200);
  expect(jump.body.ineligible).toContainEqual(expect.objectContaining({ horseId: 'horse-charlie',
    reasons: expect.arrayContaining([expect.objectContaining({ code: 'HORSE_NOT_JUMP_CAPABLE' })]) }));
  const { demoToday } = await import('./store.js');
  const self = await api.post(path).send({ ...base, lessonType: 'PART_BOARD_RIDE', consumeEntitlement: false,
    date: addDays(demoToday, 2) }).expect(200);
  expect(self.body.recommendations).toEqual([]);
  expect(self.body.ineligible).toContainEqual(expect.objectContaining({ horseId: horse.id,
    reasons: expect.arrayContaining([expect.objectContaining({ code: 'HORSE_UNAVAILABLE' })]) }));
  await api.post('/api/lessons').send({ ...base, horseId: horse.id, riderId: 'rider-noah', coachId: 'coach-james', status: 'CONFIRMED' }).expect(201);
  const blocked = await api.post('/api/lessons').send({ ...base, horseId: horse.id, coachId: 'coach-sarah', status: 'CONFIRMED' }).expect(409);
  expect(blocked.body.error.code).toBe('HORSE_DOUBLE_BOOKED');
});
