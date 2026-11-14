import cors from 'cors';
import express from 'express';
import { WORKLOAD_THRESHOLDS, barnToday, coachSchema, dateSchema, horseSchema, lessonSchema, riderSchema, weekDates, weekStartSchema } from '@absolute/shared';
import { availabilityRouter } from './availability-router.js';
import { availabilityRecords } from './availability-store.js';
import { dailySchedule, validateLesson } from './schedule.js';
import { appTimeZone } from './time-zone.js';
import { database } from './database.js';
import { environmentSchema } from './env.js';
import { createBillingProvider } from './modules/billing/create-billing-provider.js';

const parse = <T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } } }, value: unknown, res: express.Response): T | undefined => {
  const result = schema.safeParse(value);
  if (!result.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: result.error.flatten() } }); return undefined; }
  return result.data;
};
const notFound = (res: express.Response) => res.status(404).json({ error: { code: 'NOT_FOUND' } });

const env = environmentSchema.parse(process.env);
const billingProvider = createBillingProvider({ enabled: env.BILLING_ENABLED });
export const app: express.Express = express();
const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : true }));
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', mode: database.mode }));
app.get('/api/config', (_req, res) => res.json({ features: { billing: billingProvider.enabled } }));

app.get('/api/schedule/settings', (_req, res) => res.json({ timeZone: appTimeZone }));
app.use('/api/availability', availabilityRouter);
app.get('/api/horses', async (_req, res, next) => { try { res.json(await database.horses()); } catch (error) { next(error); } });
app.post('/api/horses', async (req, res, next) => { const input = parse(horseSchema, req.body, res); if (!input) return; try { res.status(201).json(await database.createHorse(input)); } catch (error) { next(error); } });
app.get('/api/horses/:id', async (req, res, next) => { try { const entity = await database.horse(req.params.id); return entity ? res.json(entity) : notFound(res); } catch (error) { next(error); } });
app.put('/api/horses/:id', async (req, res, next) => { const input = parse(horseSchema, req.body, res); if (!input) return; try { const entity = await database.updateHorse(req.params.id, input); return entity ? res.json(entity) : notFound(res); } catch (error) { next(error); } });

app.get('/api/riders', async (_req, res, next) => { try { res.json(await database.riders()); } catch (error) { next(error); } });
app.post('/api/riders', async (req, res, next) => { const input = parse(riderSchema, req.body, res); if (!input) return; try { res.status(201).json(await database.createRider(input)); } catch (error) { next(error); } });
app.get('/api/riders/:id', async (req, res, next) => { try { const entity = await database.rider(req.params.id); return entity ? res.json(entity) : notFound(res); } catch (error) { next(error); } });
app.put('/api/riders/:id', async (req, res, next) => { const input = parse(riderSchema, req.body, res); if (!input) return; try { const entity = await database.updateRider(req.params.id, input); return entity ? res.json(entity) : notFound(res); } catch (error) { next(error); } });

app.get('/api/coaches', async (_req, res, next) => { try { res.json(await database.coaches()); } catch (error) { next(error); } });
app.post('/api/coaches', async (req, res, next) => { const input = parse(coachSchema, req.body, res); if (!input) return; try { res.status(201).json(await database.createCoach(input)); } catch (error) { next(error); } });
app.get('/api/coaches/:id', async (req, res, next) => { try { const entity = await database.coach(req.params.id); return entity ? res.json(entity) : notFound(res); } catch (error) { next(error); } });
app.put('/api/coaches/:id', async (req, res, next) => { const input = parse(coachSchema, req.body, res); if (!input) return; try { const entity = await database.updateCoach(req.params.id, input); return entity ? res.json(entity) : notFound(res); } catch (error) { next(error); } });

app.get('/api/lessons', async (req, res, next) => { try { const date = typeof req.query.date === 'string' ? req.query.date : undefined; res.json(await database.lessons(date)); } catch (error) { next(error); } });
const lessonPatch = lessonSchema.innerType().partial().strict();

async function saveLesson(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    const lessonId = typeof req.params.id === 'string' ? req.params.id : undefined;
    const existing = lessonId ? await database.lesson(lessonId) : undefined;
    if (lessonId && !existing) return notFound(res);
    const patch = req.method === 'PATCH' ? parse(lessonPatch, req.body, res) : req.body;
    if (req.method === 'PATCH' && !patch) return;
    const input = parse(lessonSchema, req.method === 'PATCH' ? { ...existing, ...patch } : patch, res);
    if (!input) return;
    const [snapshot, records] = await Promise.all([database.snapshot(), availabilityRecords()]);
    const conflicts = validateLesson(input, snapshot, records, lessonId);
    const error = conflicts.find((conflict) => conflict.severity === 'ERROR');
    if (error) return res.status(409).json({ error, conflicts });
    const lesson = lessonId ? await database.updateLesson(lessonId, input) : await database.createLesson(input);
    return lesson ? res.status(lessonId ? 200 : 201).json({ lesson, conflicts }) : notFound(res);
  } catch (error) {
    next(error);
  }
}

app.post('/api/lessons', saveLesson);
app.put('/api/lessons/:id', saveLesson);
app.patch('/api/lessons/:id', saveLesson);

app.get('/api/schedule/week', async (req, res, next) => {
  const start = parse(weekStartSchema, req.query.start, res);
  if (!start) return;
  try {
    const [snapshot, records] = await Promise.all([database.snapshot(), availabilityRecords()]);
    const dates = weekDates(start);
    const days = dates.map((date) => dailySchedule(date, snapshot, records));
    const lessons = days.flatMap((day) => day.lessons);
    const conflicts = days.flatMap((day) => day.conflicts);
    const horsesNearCapacity = new Set(days.flatMap((day) => day.workloads
      .filter(({ horse, usedUnits }) => usedUnits / horse.maximumDailyRideUnits >= WORKLOAD_THRESHOLDS.normal)
      .map(({ horse }) => horse.id))).size;
    return res.json({
      week: { start, end: dates[6] },
      lessons,
      conflicts,
      summary: { lessonCount: lessons.length, conflictCount: conflicts.length, horsesNearCapacity },
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/schedule', async (req, res, next) => {
  const date = parse(dateSchema, req.query.date ?? barnToday(appTimeZone), res);
  if (!date) return;
  try {
    const [snapshot, records] = await Promise.all([database.snapshot(), availabilityRecords()]);
    return res.json(dailySchedule(date, snapshot, records));
  } catch (error) {
    next(error);
  }
});
app.use('/api', (_req, res) => { notFound(res); });

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  void _next;
  console.error(error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The server could not process this request.' } });
});
