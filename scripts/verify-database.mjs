import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// Create and remove only a new isolated schema. Existing development records stay in their schema.
const schema = `aec_verify_${randomUUID().replaceAll('-', '')}`;
const url = new URL(process.env.DATABASE_URL);
url.searchParams.set('schema', schema);
url.searchParams.set('connection_limit', '2');
const environment = { ...process.env, DATABASE_URL: url.toString(), DIRECT_URL: url.toString(), DEMO_SEED: '1', BILLING_ENABLED: 'false', NODE_ENV: 'development' };
const db = new PrismaClient({ datasourceUrl: url.toString() });
function run(args) {
  const result = spawnSync('pnpm', args, { env: environment, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error || result.status !== 0) throw new Error(`Verification command failed: pnpm ${args.join(' ')}`);
}
let created = false;
let server;
let apiDatabase;
try {
  if (!/^aec_verify_[a-f0-9]{32}$/.test(schema)) throw new Error('Unexpected verification schema name.');
  await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  run(['prisma:migrate:deploy']);
  run(['db:seed']);
  const counts = async () => Promise.all([db.horse.count(), db.rider.count(), db.coach.count(), db.lesson.count(), db.plan.count(), db.riderPlanEnrollment.count(), db.activityBooking.count(), db.activityParticipant.count(), db.planUsage.count()]);
  const first = await counts();
  run(['db:seed']);
  const second = await counts();
  if (JSON.stringify(first) !== JSON.stringify(second)) throw new Error('Reseeding created duplicate records.');
  if (second[4] !== 14 || second[8] < 10) throw new Error('Plan or entitlement fixtures are incomplete.');
  Object.assign(process.env, environment);
  const { app } = await import('../apps/api/dist/app.js');
  apiDatabase = (await import('../apps/api/dist/database.js')).prisma;
  server = await new Promise((resolve) => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  async function api(path, method = 'GET', body, status = 200) {
    const response = await fetch(`${base}/api/${path}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body && { body: JSON.stringify(body) }) });
    const data = await response.json();
    if (response.status !== status) throw new Error(`API ${path} expected ${status}, received ${response.status}: ${data.error?.code ?? 'unknown'}`);
    return data;
  }
  const { addDays, barnToday, monday } = await import('../packages/shared/dist/index.js');
  const date = addDays(barnToday('America/Toronto'), 1);
  await api('horses'); await api('riders'); await api('coaches');
  await api(`schedule?date=${date}`); await api(`schedule/week?start=${monday(date)}`); await api(`schedule/month?year=${date.slice(0, 4)}&month=${date.slice(5, 7)}`);
  const enrollment = await api('enrollments', 'POST', { riderId: 'rider-emma', planId: 'plan-monthly-private', startDate: date, endDate: null, status: 'ACTIVE', notes: 'Disposable verification.' }, 201);
  const input = { activityType: 'PRIVATE_LESSON', date, startTime: '15:00', endTime: '15:30', coachId: 'coach-sarah', status: 'CONFIRMED', discipline: 'FLAT', rideUnits: 0.5, location: '', notes: '', cancellationAction: 'RETAIN',
    participants: [{ riderId: 'rider-emma', horseId: 'horse-charlie', enrollmentId: enrollment.id, entitlementId: 'entitlement-monthly-private-lesson', overrideReason: '', relationshipOverrideReason: '' }] };
  const booking = await api('activities', 'POST', input, 201);
  const details = (await api(`enrollments?date=${date}`)).find((entry) => entry.id === enrollment.id);
  if (details.entitlements[0].used !== 1) throw new Error('Database usage was not consumed.');
  const day = await api(`schedule?date=${date}`);
  if (!day.lessons.some((lesson) => lesson.activityId === booking.id)) throw new Error('Calendar activity edit reference missing.');
  await api(`activities/${booking.id}`, 'PUT', { ...input, version: booking.version, status: 'CANCELLED', cancellationAction: 'RESTORE' });
  const restored = (await api(`enrollments?date=${date}`)).find((entry) => entry.id === enrollment.id);
  if (restored.entitlements[0].used !== 0) throw new Error('Database usage was not restored.');
  await api('activities', 'POST', { ...input, activityType: 'GROOMING_TACKING', startTime: '16:00', endTime: '17:30', participants: [{ riderId: 'rider-emma', overrideReason: '', relationshipOverrideReason: '' }] }, 201);
  await api('recommendations/horses', 'POST', { riderId: 'rider-emma', date, startTime: '15:00', endTime: '15:30', discipline: 'FLAT', lessonType: 'PRIVATE', rideUnits: 0.5 });
  const agreement = await api('part-board', 'POST', { riderId: 'rider-emma', horseId: 'horse-charlie', planId: 'plan-pb-1-private', startDate: date, endDate: null, status: 'ACTIVE', priority: 100, freeRidesPerPeriod: 0, entitlementPeriod: 'MONTH', preferredRideTimes: [], notes: '' }, 201);
  await api(`part-board/${agreement.id}`, 'PUT', { ...agreement, notes: 'Verified edit.' });
  console.log('PostgreSQL API verification passed for resources, calendars, activity saving, restoration, services, recommendations, and package agreements.');
  console.log(JSON.stringify({ verification: 'passed', counts: second, reseedDuplicates: 0 }));
} catch (error) {
  console.error(error instanceof Error && !error.message.includes('prisma') ? error.message : 'Database verification failed.');
  process.exitCode = 1;
} finally {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (apiDatabase) await apiDatabase.$disconnect();
  if (created) await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await db.$disconnect();
}
