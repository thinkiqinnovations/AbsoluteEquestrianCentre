import { barnToday, monday, type AvailabilityRecords, type Resource } from '@absolute/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { evaluateAvailability } from './availability.js';
import { overlaps } from './intervals.js';

it('saves a new coach and their weekly availability in the first request', async () => {
  vi.stubEnv('DATABASE_URL', undefined);
  vi.stubEnv('BILLING_ENABLED', 'false');
  const api = request((await import('./app.js')).app);
  const route = '/api/coaches/with-availability';
  const coach = { firstName: 'Taylor', lastName: 'Example' };
  await api.post(route).send(coach).expect(400);
  const weeklyAvailability = [
    { dayOfWeek: 'MONDAY', startTime: '09:00', endTime: '12:00' },
    { dayOfWeek: 'THURSDAY', startTime: '13:30', endTime: '18:00' },
  ];
  const created = await api.post(route).send({ ...coach, weeklyAvailability }).expect(201);
  const saved = await api.get(`/api/availability/COACH/${created.body.id}`).expect(200);
  expect(saved.body.rules).toHaveLength(2);
  expect(saved.body.rules).toEqual(expect.arrayContaining(weeklyAvailability.map((window) =>
    expect.objectContaining({ ...window, availabilityType: 'AVAILABLE' }))));
});

const resource: Resource = { resourceType: 'RIDER', resourceId: 'rider-emma' };
const date = '2026-11-24';
const interval = (startTime: string, endTime: string) => ({ startTime, endTime });
const metadata = { id: 'window', createdAt: '', updatedAt: '' };
const recurring: AvailabilityRecords = {
  rules: [{ ...resource, ...metadata, dayOfWeek: 'TUESDAY', availabilityType: 'AVAILABLE', ...interval('16:00', '20:00') }],
  overrides: [],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it('serves sample lessons across the current barn week and returns JSON for unknown API routes', async () => {
  vi.stubEnv('DATABASE_URL', undefined);
  vi.stubEnv('BILLING_ENABLED', 'false');
  const { app } = await import('./app.js');
  const { appTimeZone } = await import('./time-zone.js');
  const api = request(app);
  const week = await api.get('/api/schedule/week').query({ start: monday(barnToday(appTimeZone)) }).expect(200);
  expect(new Set(week.body.lessons.map((lesson: { date: string }) => lesson.date)).size).toBe(7);
  await api.get('/api/unknown').expect('Content-Type', /json/).expect(404, { error: { code: 'NOT_FOUND' } });
});

describe('effective availability', () => {
  it.each([
    ['17:00', '18:00', 'AVAILABLE'],
    ['19:00', '20:00', 'AVAILABLE'],
    ['20:00', '21:00', 'UNAVAILABLE'],
    ['15:59', '16:01', 'UNAVAILABLE'],
  ])('evaluates %s–%s as %s', (start, end, expected) => {
    expect(evaluateAvailability(recurring, resource, date, interval(start, end)).status).toBe(expected);
  });

  it('treats adjacent intervals as non-overlapping', () => {
    expect(overlaps(interval('15:00', '16:00'), interval('16:00', '17:00'))).toBe(false);
    expect(overlaps(interval('15:00', '16:01'), interval('16:00', '17:00'))).toBe(true);
  });

  it('applies a negative override inside a recurring window', () => {
    const records: AvailabilityRecords = {
      ...recurring,
      overrides: [{ ...resource, ...metadata, date, availabilityType: 'UNAVAILABLE', reason: 'PERSONAL', ...interval('17:00', '19:00') }],
    };
    expect(evaluateAvailability(records, resource, date, interval('17:30', '18:30')))
      .toEqual({ status: 'UNAVAILABLE', source: 'OVERRIDE', reason: 'PERSONAL' });
    expect(evaluateAvailability(records, resource, date, interval('19:00', '20:00')).status).toBe('AVAILABLE');
  });

  it('opens a normally closed period and spans adjacent available windows', () => {
    const records: AvailabilityRecords = {
      ...recurring,
      overrides: [{ ...resource, ...metadata, date, availabilityType: 'AVAILABLE', ...interval('14:00', '16:00') }],
    };
    expect(evaluateAvailability(records, resource, date, interval('15:00', '17:00')).status).toBe('AVAILABLE');
    expect(evaluateAvailability({ rules: [], overrides: [] }, resource, date, interval('15:00', '17:00')).status).toBe('UNSPECIFIED');
  });

  it('uses the barn date at UTC midnight', () => {
    expect(barnToday('America/Toronto', new Date('2026-11-24T02:00:00Z'))).toBe('2026-11-23');
  });
});

it('validates availability CRUD, lesson edits, and Monday-start schedules', async () => {
  vi.stubEnv('DATABASE_URL', undefined);
  vi.stubEnv('BILLING_ENABLED', 'false');
  const { app } = await import('./app.js');
  const api = request(app);
  const weekly = { ...resource, dayOfWeek: 'TUESDAY', availabilityType: 'AVAILABLE', ...interval('16:00', '20:00') };
  await api.post('/api/availability/rules').send({ ...weekly, resourceId: 'missing' }).expect(404);
  await api.post('/api/availability/rules').send({ ...weekly, ...interval('20:00', '07:00') }).expect(400);
  const rule = await api.post('/api/availability/rules').send(weekly).expect(201);
  await api.post('/api/availability/rules').send(weekly).expect(409);
  await api.patch(`/api/availability/rules/${rule.body.id}`).send({ notes: 'After school' }).expect(200);
  await api.get('/api/availability/RIDER/rider-emma/week').query({ start: '2026-11-23' }).expect(200);

  const lesson = {
    date, ...interval('17:00', '18:00'), riderId: resource.resourceId, horseId: 'horse-jasper',
    coachId: 'coach-sarah', discipline: 'FLAT', lessonType: 'PRIVATE', rideUnits: 1, status: 'CONFIRMED',
  };
  const created = await api.post('/api/lessons').send(lesson).expect(201);
  expect(created.body.conflicts).toContainEqual(expect.objectContaining({ code: 'COACH_AVAILABILITY_UNSPECIFIED' }));
  const url = `/api/lessons/${created.body.lesson.id}`;
  await api.patch(url).send({ notes: 'Updated' }).expect(200);
  const blocked = await api.patch(url).send(interval('20:00', '21:00')).expect(409);
  expect(blocked.body.conflicts).toContainEqual(expect.objectContaining({ code: 'RIDER_UNAVAILABLE' }));

  const override = await api.post('/api/availability/overrides')
    .send({ ...resource, date, ...interval('17:00', '18:00'), availabilityType: 'UNAVAILABLE' }).expect(201);
  const check = await api.get('/api/availability/check').query({ date, ...interval('17:00', '18:00') }).expect(200);
  expect(check.body.RIDER[resource.resourceId].status).toBe('UNAVAILABLE');
  const week = await api.get('/api/schedule/week').query({ start: '2026-11-23' }).expect(200);
  expect(week.body.week.end).toBe('2026-11-29');
  expect(week.body.lessons).toContainEqual(expect.objectContaining({ id: created.body.lesson.id, horse: expect.objectContaining({ name: 'Jasper' }) }));
  await api.get('/api/schedule/week').query({ start: date }).expect(400);
  await api.delete(`/api/availability/overrides/${override.body.id}`).expect(204);
  await api.delete(`/api/availability/rules/${rule.body.id}`).expect(204);
});
