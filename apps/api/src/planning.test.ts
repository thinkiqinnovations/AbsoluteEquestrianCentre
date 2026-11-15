import { addDays, barnToday, weekday, type Agreement, type LessonInput } from '@absolute/shared';
import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';
import { capacityExceeded, effectiveOn, entitlement } from './part-board.js';
import { occurrenceDates } from './recurring.js';

const agreement: Agreement = {
  id: 'example', riderId: 'rider-emma', horseId: 'horse-charlie', status: 'ACTIVE',
  startDate: '2040-02-01', endDate: '2040-02-29', priority: 100, entitlementPeriod: 'WEEK',
  freeRidesPerPeriod: 1, preferredRideTimes: [],
};
const ride: LessonInput = {
  date: '2040-02-07', riderId: agreement.riderId, horseId: agreement.horseId, coachId: null,
  startTime: '10:00', endTime: '11:00', discipline: 'FLAT', lessonType: 'PART_BOARD_RIDE', status: 'CONFIRMED', rideUnits: 1,
};
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

async function seededApi() {
  vi.stubEnv('DATABASE_URL', undefined);
  vi.stubEnv('BILLING_ENABLED', 'false');
  vi.stubEnv('MAX_ACTIVE_PART_BOARDERS_PER_HORSE', '1');
  return request((await import('./app.js')).app);
}

it('uses inclusive agreement boundaries and calendar entitlement periods', () => {
  expect(effectiveOn(agreement, '2040-01-31')).toBe(false);
  expect(effectiveOn(agreement, '2040-02-01')).toBe(true);
  expect(effectiveOn(agreement, '2040-02-29')).toBe(true);
  expect(effectiveOn(agreement, '2040-03-01')).toBe(false);
  expect(effectiveOn({ ...agreement, status: 'PAUSED' }, '2040-02-01')).toBe(false);
  const usage = [{ agreementId: agreement.id, lessonId: 'ride', entitlementDate: ride.date, quantity: 1 }];
  expect(entitlement(agreement, ride.date, usage)).toMatchObject({ periodStart: '2040-02-06', periodEnd: '2040-02-12', remaining: 0 });
  expect(entitlement({ ...agreement, entitlementPeriod: 'MONTH' }, ride.date, usage)).toMatchObject({ periodStart: '2040-02-01', periodEnd: '2040-02-29', used: 1 });
  expect(entitlement(agreement, ride.date, [{ ...usage[0], reversedAt: new Date() }]).remaining).toBe(1);
});

it('checks actual concurrent capacity rather than the total historical overlap', () => {
  const peers = [
    { ...agreement, id: 'first', riderId: 'other-1', endDate: '2040-02-10' },
    { ...agreement, id: 'second', riderId: 'other-2', startDate: '2040-02-11' },
  ];
  expect(capacityExceeded(agreement, peers, 1)).toBe(true);
  expect(capacityExceeded(agreement, peers, 2)).toBe(false);
});

it('validates agreements, serializes the last entitlement, and reverses cancelled rides', async () => {
  const api = await seededApi();
  const url = '/api/part-board';
  await api.post(url).send({ ...agreement, riderId: 'missing' }).expect(400);
  await api.post(url).send({ ...agreement, horseId: 'missing' }).expect(400);
  await api.post(url).send({ ...agreement, endDate: '2040-01-31' }).expect(400);
  const window = { dayOfWeek: 'TUESDAY', startTime: '17:00', endTime: '19:00', preferenceRank: 1 };
  await api.post(url).send({ ...agreement, preferredRideTimes: [window, window] }).expect(400)
    .expect(({ body }) => expect(body.error.issues).toContainEqual({ path: [], message: 'Preference ranks must be unique.' }));
  const created = (await api.post(url).send({ ...agreement, preferredRideTimes: [window] }).expect(201)).body;
  expect(created.preferredRideTimes).toEqual([window]);
  await api.post(url).send({ ...agreement, riderId: 'rider-noah' }).expect(409);
  const results = await Promise.all([
    api.post('/api/lessons').send(ride), api.post('/api/lessons').send({ ...ride, date: '2040-02-08' }),
  ]);
  expect(results.map(({ status }) => status).sort()).toEqual([201, 409]);
  const rejected = results.find(({ status }) => status === 409)!;
  expect(rejected.body.error.code).toBe('PART_BOARD_ENTITLEMENT_EXHAUSTED');
  const saved = results.find(({ status }) => status === 201)!.body.lesson;
  expect(saved.coachId).toBeNull();
  await api.patch(`/api/lessons/${saved.id}`).send({ notes: 'Keep entitlement' }).expect(200);
  await api.patch(`/api/lessons/${saved.id}`).send({ status: 'CANCELLED' }).expect(200);
  const balance = (await api.get(url).query({ date: ride.date, horseId: agreement.horseId }).expect(200)).body
    .find((entry: Agreement) => entry.id === created.id);
  expect(balance.entitlement.remaining).toBe(1);
  const replacement = (await api.post('/api/lessons').send({ ...ride, status: 'COMPLETED' }).expect(201)).body.lesson;
  await api.patch(`/api/lessons/${replacement.id}`).send({ status: 'CANCELLED' }).expect(409);
  for (const status of ['PAUSED', 'ENDED']) {
    await api.put(`${url}/${created.id}`).send({ ...created, status }).expect(200);
    const result = await api.post('/api/lessons').send({ ...ride, date: '2040-02-11' }).expect(409);
    expect(result.body.error.code).toBe('PART_BOARD_AGREEMENT_REQUIRED');
  }
});

it('keeps availability, rider and horse conflicts, workload, and calendar projections for self rides', async () => {
  const api = await seededApi();
  await api.post('/api/part-board').send({ ...agreement, freeRidesPerPeriod: 7 }).expect(201);
  for (const [resourceType, resourceId] of [['RIDER', ride.riderId], ['HORSE', ride.horseId]]) {
    const blocked = await api.post('/api/availability/overrides').send({ resourceType, resourceId, date: ride.date,
      startTime: '10:00', endTime: '11:00', availabilityType: 'UNAVAILABLE' }).expect(201);
    const rejected = await api.post('/api/lessons').send(ride).expect(409);
    expect(rejected.body.error.code).toBe(`${resourceType}_UNAVAILABLE`);
    await api.delete(`/api/availability/overrides/${blocked.body.id}`).expect(204);
  }
  const saved = (await api.post('/api/lessons').send(ride).expect(201)).body.lesson;
  const overlap = await api.post('/api/lessons').send(ride).expect(409);
  expect(overlap.body.conflicts.map(({ code }: { code: string }) => code)).toEqual(expect.arrayContaining(['HORSE_DOUBLE_BOOKED', 'RIDER_DOUBLE_BOOKED']));
  const overloaded = await api.post('/api/lessons').send({ ...ride, startTime: '12:00', endTime: '13:00' }).expect(409);
  expect(overloaded.body.error.code).toBe('HORSE_WORKLOAD_EXCEEDED');
  await api.get('/api/schedule').query({ date: ride.date }).expect(200).expect(({ body }) => expect(body.workloads[0].usedUnits).toBe(1));
  await api.get('/api/schedule/week?start=2040-02-06').expect(200).expect(({ body }) => expect(body.lessons[0].id).toBe(saved.id));
  await api.get('/api/schedule/month?year=2040&month=02').expect(200).expect(({ body }) => expect(body.summary.lessonCount).toBe(1));
});

it('plans eight weekly occurrences across DST and clips to series boundaries', () => {
  const template = { id: 'series', lesson: ride, startDate: '2026-10-31', endDate: null, dayOfWeek: 'SUNDAY', status: 'ACTIVE', schedulingPriority: 100 } as const;
  const dates = occurrenceDates(template, barnToday('America/Toronto', new Date('2026-11-01T02:00Z')), 8);
  expect(dates).toHaveLength(8);
  expect(dates.slice(0, 2)).toEqual(['2026-11-01', '2026-11-08']);
  expect(occurrenceDates({ ...template, endDate: '2026-11-08', startDate: '2026-11-03' }, '2026-10-31', 8)).toEqual(['2026-11-08']);
  expect(occurrenceDates({ ...template, status: 'ENDED' }, '2026-10-31', 8)).toEqual([]);
});

it('persists regular and self-ride occurrences, reports conflicts, and skips duplicates on retry', async () => {
  const api = await seededApi();
  const { appTimeZone } = await import('./time-zone.js');
  const date = addDays(barnToday(appTimeZone), 1);
  const regular = { startDate: date, endDate: date, dayOfWeek: weekday(date), status: 'ACTIVE',
    lesson: { ...ride, date, horseId: 'horse-atlas', riderId: 'rider-olivia', coachId: 'coach-sarah', lessonType: 'PRIVATE', discipline: 'JUMP', startTime: '12:00', endTime: '12:45', rideUnits: 0.75 } };
  const created = (await api.post('/api/recurring-lessons').send(regular).expect(201)).body;
  const generate = (id: string) => api.post(`/api/recurring-lessons/${id}/generate`).expect(200);
  const first = await generate(created.id);
  expect(first.body.generated).toHaveLength(1);
  expect((await generate(created.id)).body).toMatchObject({ generated: [], failures: [], skipped: 1 });
  const other = (await api.post('/api/recurring-lessons').send(regular).expect(201)).body;
  expect((await generate(other.id)).body.failures[0].conflicts.map(({ code }: { code: string }) => code))
    .toEqual(expect.arrayContaining(['HORSE_DOUBLE_BOOKED', 'RIDER_DOUBLE_BOOKED', 'COACH_DOUBLE_BOOKED']));
  await api.put(`/api/recurring-lessons/${other.id}`).send({ ...other, status: 'PAUSED' }).expect(200);
  expect((await generate(other.id)).body.generated).toEqual([]);
  const selfRide = await generate('recurring-demo-part-board');
  expect(selfRide.body.failures[0].conflicts.some(({ code }: { code: string }) => code === 'HORSE_UNAVAILABLE')).toBe(true);
  expect(selfRide.body.generated[0]).toMatchObject({ lessonType: 'PART_BOARD_RIDE', coachId: null });
  expect((await generate('recurring-demo-part-board')).body.skipped).toBe(selfRide.body.generated.length);
  await api.get('/api/config').expect(200, { features: { billing: false } });
});

it('protects a bookable part-board slot and its workload ahead of ordinary lessons', async () => {
  const api = await seededApi();
  const { appTimeZone } = await import('./time-zone.js');
  const date = addDays(barnToday(appTimeZone), 3);
  const planned = { ...ride, date, startTime: '18:30', endTime: '19:30' };
  const created = (await api.post('/api/part-board').send({ ...agreement, startDate: date, endDate: null }).expect(201)).body;
  const template = (await api.post('/api/recurring-lessons').send({
    startDate: date, endDate: date, dayOfWeek: weekday(date), status: 'ACTIVE',
    partBoardAgreementId: created.id, lesson: planned,
  }).expect(201)).body;
  const ordinary = { ...planned, riderId: 'rider-noah', coachId: 'coach-sarah', lessonType: 'PRIVATE' };
  const blocked = await api.post('/api/lessons').send(ordinary).expect(409);
  expect(blocked.body.error.code).toBe('PART_BOARD_PRIORITY');
  const workload = await api.post('/api/lessons').send({ ...ordinary, startTime: '12:00', endTime: '13:00' }).expect(409);
  expect(workload.body.error.code).toBe('PART_BOARD_PRIORITY');
  await api.put(`/api/recurring-lessons/${template.id}`).send({ ...template, status: 'PAUSED' }).expect(200);
  await api.post('/api/lessons').send(ordinary).expect(201);
});
