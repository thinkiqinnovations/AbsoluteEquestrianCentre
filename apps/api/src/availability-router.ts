import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { dateSchema, intervalSchema, ordered, resourceSchema, overrideSchema, ruleSchema, overrideFields, ruleFields, weekDates, weekStartSchema, type Resource } from '@absolute/shared';
import { database } from './database.js';
import { availabilityRecords, overrides, rules } from './availability-store.js';
import { effectiveAvailability, evaluateAvailability } from './availability.js';
import { overlaps } from './intervals.js';
import { validationError } from './validation-error.js';

export const availabilityRouter: Router = Router();
const missing = (res: Response) => res.status(404).json({ error: { code: 'NOT_FOUND' } });
const resourceExists = ({ resourceType, resourceId }: Resource) =>
  ({ RIDER: () => database.rider(resourceId), HORSE: () => database.horse(resourceId), COACH: () => database.coach(resourceId) })[resourceType]();

function route(handler: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch((error: unknown) => {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: validationError(error) });
      } else if (typeof error === 'object' && error && 'code' in error && error.code === 'P2025') {
        missing(res);
      } else {
        next(error);
      }
    });
  };
}

const checkSchema = intervalSchema.extend({ date: dateSchema }).refine(ordered);
availabilityRouter.get('/check', route(async (req, res) => {
  const { date, ...interval } = checkSchema.parse(req.query);
  const [records, riders, horses, coaches] = await Promise.all([
    availabilityRecords(), database.riders(), database.horses(), database.coaches(),
  ]);
  const check = (resourceType: Resource['resourceType'], entities: { id: string }[]) =>
    Object.fromEntries(entities.map(({ id }) => [id, evaluateAvailability(records, { resourceType, resourceId: id }, date, interval)]));
  return res.json({ RIDER: check('RIDER', riders), HORSE: check('HORSE', horses), COACH: check('COACH', coaches) });
}));

availabilityRouter.get('/:resourceType/:resourceId/week', route(async (req, res) => {
  const resource = resourceSchema.parse(req.params);
  const start = weekStartSchema.parse(req.query.start);
  if (!await resourceExists(resource)) return missing(res);
  const records = await availabilityRecords(resource);
  return res.json({ days: weekDates(start).map((date) => ({ date, windows: effectiveAvailability(records, resource, date) })) });
}));

availabilityRouter.get('/:resourceType/:resourceId', route(async (req, res) => {
  const resource = resourceSchema.parse(req.params);
  if (!await resourceExists(resource)) return missing(res);
  return res.json(await availabilityRecords(resource));
}));

function overlapping(res: Response) {
  return res.status(409).json({ error: { code: 'AVAILABILITY_OVERLAP', message: 'A window of this type already overlaps these times.' } });
}

type Rule = z.infer<typeof ruleSchema>;
type Override = z.infer<typeof overrideSchema>;

function register<T extends Rule | Override>(
  path: string,
  repository: {
    list(resource?: Resource): Promise<(T & { id: string })[]>;
    save(input: T, existingId?: string): Promise<unknown>;
    remove(existingId: string): Promise<boolean>;
  },
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  patchSchema: z.ZodTypeAny,
  sameDay: (a: T, b: T) => boolean,
) {
  const hasOverlap = (input: T, entries: (T & { id: string })[], id?: string) =>
    entries.some((entry) => entry.id !== id && sameDay(entry, input)
      && entry.availabilityType === input.availabilityType && overlaps(entry, input));

  availabilityRouter.post(path, route(async (req, res) => {
    const input = schema.parse(req.body);
    if (!await resourceExists(input)) return missing(res);
    if (hasOverlap(input, await repository.list(resourceSchema.parse(input)))) return overlapping(res);
    return res.status(201).json(await repository.save(input));
  }));

  availabilityRouter.patch(`${path}/:id`, route(async (req, res) => {
    const existing = (await repository.list()).find((entry) => entry.id === req.params.id);
    if (!existing || !await resourceExists(existing)) return missing(res);
    const input = schema.parse({ ...existing, ...patchSchema.parse(req.body) });
    if (hasOverlap(input, await repository.list(resourceSchema.parse(input)), existing.id)) return overlapping(res);
    return res.json(await repository.save(input, existing.id));
  }));

  availabilityRouter.delete(`${path}/:id`, route(async (req, res) =>
    await repository.remove(z.string().min(1).parse(req.params.id)) ? res.status(204).end() : missing(res)));
}

register('/rules', rules, ruleSchema, ruleFields.partial().strict(), (a, b) => a.dayOfWeek === b.dayOfWeek);
register('/overrides', overrides, overrideSchema, overrideFields.partial().strict(), (a, b) => a.date === b.date);
