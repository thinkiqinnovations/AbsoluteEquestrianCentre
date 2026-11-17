import { afterEach, expect, it, vi } from 'vitest';
import request from 'supertest';
import { shiftMonth } from '@absolute/shared';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it('keeps manual whole-month, part-board, and single-lesson statuses independent', async () => {
  vi.stubEnv('DATABASE_URL', '');
  vi.stubEnv('BILLING_ENABLED', 'false');
  const { app } = await import('./app.js');
  const { demoToday } = await import('./store.js');
  const api = request(app);
  const month = demoToday.slice(0, 7);
  const nextMonth = shiftMonth(demoToday, 1).slice(0, 7);
  const riderId = 'rider-emma';
  const path = '/api/payment-status';
  await api.put(`${path}/lessons/missing`).send({ status: 'PAID' }).expect(404);
  await api.put(`${path}/riders/${riderId}/${month}/MONTHLY`).send({ status: 'unknown' }).expect(400);
  await api.put(`${path}/lessons/lesson-1`).send({ status: 'UNPAID' }).expect(200);
  await api.put(`${path}/riders/${riderId}/${month}/MONTHLY`).send({ status: 'PAID' }).expect(200);
  await api.put(`${path}/riders/${riderId}/${month}/PART_BOARD`).send({ status: 'UNRECORDED' }).expect(200);

  const current = await api.get(path).query({ month, riderId }).expect(200);
  expect(current.body.lessonStatuses).toContainEqual({ lessonId: 'lesson-1', status: 'UNPAID' });
  expect(current.body.monthlyStatuses).toEqual(expect.arrayContaining([
    { riderId, kind: 'MONTHLY', status: 'PAID' },
    { riderId, kind: 'PART_BOARD', status: 'UNRECORDED' },
  ]));
  expect(current.body.lessons).toContainEqual(expect.objectContaining({ id: 'lesson-1', date: demoToday }));
  const future = await api.get(path).query({ month: nextMonth, riderId }).expect(200);
  expect(future.body.monthlyStatuses).toEqual([]);
  expect(future.body.lessonStatuses).toEqual([]);
  await api.get('/api/config').expect(200, { features: { billing: false } });
});
