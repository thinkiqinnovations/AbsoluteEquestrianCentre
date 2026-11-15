import { barnToday, monthRange } from '@absolute/shared';
import request from 'supertest';
import { afterEach, expect, it, vi } from 'vitest';

it('seeds lessons beyond the current week in the barn month', async () => {
  vi.stubEnv('DATABASE_URL', undefined);
  vi.stubEnv('BILLING_ENABLED', 'false');
  const { appTimeZone } = await import('./time-zone.js');
  const { app } = await import('./app.js');
  const [year, month] = barnToday(appTimeZone).split('-');
  const response = await request(app).get('/api/schedule/month').query({ year, month }).expect(200);
  expect(response.body.summary.daysWithLessons).toBeGreaterThan(7);
});

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each([[2027, 2, 28], [2028, 2, 29], [2026, 11, 30], [2026, 12, 31]])(
  'calculates %i-%i with %i days', (year, month, count) => {
    const range = monthRange(year, month);
    expect(range.dates).toHaveLength(count);
    expect(range.dates.at(-1)).toBe(range.end);
  },
);

it('uses the Toronto calendar month across UTC midnight', () => {
  expect(barnToday('America/Toronto', new Date('2026-12-01T02:00:00Z'))).toBe('2026-11-30');
});

it('groups month lessons, conflicts and workload by date and returns empty dates', async () => {
  vi.stubEnv('DATABASE_URL', undefined);
  vi.stubEnv('BILLING_ENABLED', 'false');
  const { app } = await import('./app.js');
  const { store } = await import('./store.js');
  for (let index = 0; index < 40; index++) {
    store.lessons.push({ ...store.lessons[0], id: `month-test-${index}`, date: index < 30 ? '2040-02-29' : '2040-03-01' });
  }
  const api = request(app);
  const result = await api.get('/api/schedule/month?year=2040&month=02').expect(200);
  expect(result.body.days).toHaveLength(29);
  expect(result.body.days[0]).toMatchObject({ date: '2040-02-01', lessonCount: 0, workloadWarningCount: 0, conflictCount: 0 });
  expect(result.body.days[28]).toMatchObject({ date: '2040-02-29', lessonCount: 30, workloadWarningCount: 1 });
  expect(result.body.days[28].conflictCount).toBeGreaterThan(0);
  expect(result.body.summary).toMatchObject({ lessonCount: 30, daysWithLessons: 1, horsesNearCapacityOccurrences: 1 });
  const empty = await api.get('/api/schedule/month?year=2040&month=04').expect(200);
  expect(empty.body.summary).toMatchObject({ lessonCount: 0, daysWithLessons: 0, conflictCount: 0 });
  await api.get('/api/schedule/month?year=2040&month=13').expect(400);
});
