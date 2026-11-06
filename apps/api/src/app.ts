import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { coachSchema, horseSchema, lessonSchema, riderSchema } from '@absolute/shared';
import { findConflicts } from './conflicts.js';
import { id, store } from './store.js';

const stamp = <T extends object>(value: T) => ({ ...value, updatedAt: new Date().toISOString() });
const parse = <T>(schema: { safeParse: (value: unknown) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } } }, value: unknown, res: express.Response): T | undefined => {
  const result = schema.safeParse(value);
  if (!result.success) { res.status(400).json({ error: { code: 'VALIDATION_ERROR', details: result.error.flatten() } }); return undefined; }
  return result.data;
};

export const app: express.Express = express();
app.use(cors());
app.use(express.json());
app.get('/health', (_req, res) => res.json({ status: 'ok', mode: 'seeded-memory' }));

function crud<T extends { id: string }>(path: string, key: 'horses' | 'riders' | 'coaches', schema: z.ZodTypeAny) {
  app.get(`/api/${path}`, (_req, res) => res.json(store[key]));
  app.post(`/api/${path}`, (req, res) => { const input = parse(schema, req.body, res); if (!input) return; const value = { ...input, id: id(path.slice(0, -1)), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as unknown as T; (store[key] as unknown as T[]).push(value); res.status(201).json(value); });
  app.get(`/api/${path}/:id`, (req, res) => { const item = (store[key] as unknown as T[]).find((value) => value.id === req.params.id); if (!item) return res.status(404).json({ error: { code: 'NOT_FOUND' } }); return res.json(item); });
  app.put(`/api/${path}/:id`, (req, res) => { const input = parse(schema, req.body, res); if (!input) return; const values = store[key] as unknown as T[]; const index = values.findIndex((value) => value.id === req.params.id); if (index < 0) return res.status(404).json({ error: { code: 'NOT_FOUND' } }); values[index] = stamp({ ...values[index], ...input }) as T; return res.json(values[index]); });
}
crud('horses', 'horses', horseSchema);
crud('riders', 'riders', riderSchema);
crud('coaches', 'coaches', coachSchema);

app.get('/api/lessons', (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined;
  const lessons = date ? store.lessons.filter((lesson) => lesson.date === date) : store.lessons;
  res.json(lessons);
});
app.post('/api/lessons', (req, res) => {
  const input = parse(lessonSchema, req.body, res); if (!input) return;
  const conflicts = findConflicts(input, store);
  const errors = conflicts.filter((conflict) => conflict.severity === 'ERROR');
  if (errors.length) return res.status(409).json({ error: errors[0], conflicts });
  const lesson = { ...input, id: id('lesson'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  store.lessons.push(lesson);
  return res.status(201).json({ lesson, conflicts });
});
app.put('/api/lessons/:id', (req, res) => {
  const input = parse(lessonSchema, req.body, res); if (!input) return;
  const index = store.lessons.findIndex((lesson) => lesson.id === req.params.id); if (index < 0) return res.status(404).json({ error: { code: 'NOT_FOUND' } });
  const conflicts = findConflicts(input, store, req.params.id); const errors = conflicts.filter((conflict) => conflict.severity === 'ERROR');
  if (errors.length) return res.status(409).json({ error: errors[0], conflicts });
  store.lessons[index] = stamp({ ...store.lessons[index], ...input }); return res.json({ lesson: store.lessons[index], conflicts });
});
app.get('/api/schedule', (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10);
  const lessons = store.lessons.filter((lesson) => lesson.date === date);
  const enriched = lessons.map((lesson) => ({ ...lesson, rider: store.riders.find((rider) => rider.id === lesson.riderId), horse: store.horses.find((horse) => horse.id === lesson.horseId), coach: store.coaches.find((coach) => coach.id === lesson.coachId) }));
  const workloads = store.horses.map((horse) => ({ horse, usedUnits: lessons.filter((lesson) => lesson.horseId === horse.id && lesson.status !== 'CANCELLED').reduce((sum, lesson) => sum + lesson.rideUnits, 0) })).filter((entry) => entry.usedUnits > 0);
  const conflicts = lessons.flatMap((lesson) => findConflicts(lesson, store, lesson.id));
  res.json({ date, lessons: enriched, workloads, conflicts, summary: { lessons: lessons.length, activeHorses: store.horses.filter((horse) => horse.active).length, activeCoaches: store.coaches.filter((coach) => coach.active).length, nearWorkloadLimit: workloads.filter(({ horse, usedUnits }) => usedUnits / horse.maximumDailyRideUnits >= 0.75).length, conflicts: conflicts.length } });
});
