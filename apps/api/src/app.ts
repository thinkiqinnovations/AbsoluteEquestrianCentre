import cors from 'cors';
import express from 'express';
import { coachSchema, horseSchema, lessonSchema, riderSchema } from '@absolute/shared';
import { findConflicts } from './conflicts.js';
import { database } from './database.js';

const parse = <T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } } }, value: unknown, res: express.Response): T | undefined => {
  const result = schema.safeParse(value);
  if (!result.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: result.error.flatten() } }); return undefined; }
  return result.data;
};
const notFound = (res: express.Response) => res.status(404).json({ error: { code: 'NOT_FOUND' } });

export const app: express.Express = express();
const allowedOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()).filter(Boolean);
app.use(cors({ origin: allowedOrigins?.length ? allowedOrigins : true }));
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', mode: database.mode }));

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
app.post('/api/lessons', async (req, res, next) => {
  const input = parse(lessonSchema, req.body, res); if (!input) return;
  try { const conflicts = findConflicts(input, await database.snapshot()); const errors = conflicts.filter((conflict) => conflict.severity === 'ERROR'); if (errors.length) return res.status(409).json({ error: errors[0], conflicts }); return res.status(201).json({ lesson: await database.createLesson(input), conflicts }); } catch (error) { next(error); }
});
app.put('/api/lessons/:id', async (req, res, next) => {
  const input = parse(lessonSchema, req.body, res); if (!input) return;
  try { const conflicts = findConflicts(input, await database.snapshot(), req.params.id); const errors = conflicts.filter((conflict) => conflict.severity === 'ERROR'); if (errors.length) return res.status(409).json({ error: errors[0], conflicts }); const lesson = await database.updateLesson(req.params.id, input); return lesson ? res.json({ lesson, conflicts }) : notFound(res); } catch (error) { next(error); }
});
app.get('/api/schedule', async (req, res, next) => {
  const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
  try {
    const snapshot = await database.snapshot(); const lessons = snapshot.lessons.filter((lesson) => lesson.date === date);
    const enriched = lessons.map((lesson) => ({ ...lesson, rider: snapshot.riders.find((rider) => rider.id === lesson.riderId), horse: snapshot.horses.find((horse) => horse.id === lesson.horseId), coach: snapshot.coaches.find((coach) => coach.id === lesson.coachId) }));
    const workloads = snapshot.horses.map((horse) => ({ horse, usedUnits: lessons.filter((lesson) => lesson.horseId === horse.id && lesson.status !== 'CANCELLED').reduce((sum, lesson) => sum + lesson.rideUnits, 0) })).filter((entry) => entry.usedUnits > 0);
    const conflicts = lessons.flatMap((lesson) => findConflicts(lesson, snapshot, lesson.id));
    res.json({ date, lessons: enriched, workloads, conflicts, summary: { lessons: lessons.length, activeHorses: snapshot.horses.filter((horse) => horse.active).length, activeCoaches: snapshot.coaches.filter((coach) => coach.active).length, nearWorkloadLimit: workloads.filter(({ horse, usedUnits }) => usedUnits / horse.maximumDailyRideUnits >= 0.75).length, conflicts: conflicts.length } });
  } catch (error) { next(error); }
});

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  void _next;
  console.error(error);
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'The server could not process this request.' } });
});
