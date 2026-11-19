import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { activitySchema, barnToday, dateSchema, enrollmentSchema } from '@absolute/shared';
import { prisma } from './database.js';
import { PlansRepository } from './plans-repository.js';
import { PlanError, enrollmentDetails, plansWrite, publishedAmount, saveActivity, saveEnrollment } from './plans-service.js';
import { appTimeZone } from './time-zone.js';
import { id } from './store.js';
import { validationError } from './validation-error.js';
import { initializePlanDemo } from './plans-fixtures.js';

if (!prisma) initializePlanDemo();

const repository = new PlansRepository(prisma);
export const plansRouter: Router = Router();
const route = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch((error: unknown) => {
      if (error instanceof z.ZodError) res.status(400).json({ error: validationError(error) });
      else if (error instanceof PlanError) res.status(error.status).json({ error: { code: error.code, message: error.message } });
      else next(error);
    });
  };
plansRouter.get('/plans', route(async (_req, res) => res.json(await repository.plans())));
plansRouter.get('/plans/:id/quote', route(async (req, res) => {
  const quantity = z.coerce.number().int().positive().max(100).parse(req.query.quantity ?? 1);
  const plan = (await repository.plans()).find(({ id }) => id === req.params.id);
  if (!plan) throw new PlanError('NOT_FOUND', 'Plan not found.', 404);
  res.json({ planId: plan.id, quantity, amountCents: publishedAmount(plan, quantity), currency: 'CAD', hstIncluded: plan.hstIncluded, paymentMethodRule: plan.paymentMethodRule, paymentInstructions: plan.paymentInstructions });
}));
plansRouter.get('/enrollments', route(async (req, res) => {
  const query = z.object({ date: dateSchema.optional(), riderId: z.string().optional(), agreementId: z.string().optional() }).parse(req.query);
  res.json((await enrollmentDetails(repository, query.date ?? barnToday(appTimeZone))).filter((entry) =>
    (!query.riderId || entry.riderId === query.riderId) && (!query.agreementId || entry.agreementId === query.agreementId)));
}));
const enrollment = route(async (req, res) => {
  const input = enrollmentSchema.parse(req.body);
  const editId = req.params.id as string | undefined;
  const result = await plansWrite(async (planning, plans) => {
    const existing = editId ? (await plans.enrollments()).find(({ id }) => id === editId) : undefined;
    if (editId && !existing) throw new PlanError('NOT_FOUND', 'Enrollment not found.', 404);
    return saveEnrollment(planning, plans, { ...input, id: existing?.id ?? id('enrollment') }, existing);
  });
  res.status(editId ? 200 : 201).json(result);
});
plansRouter.post('/enrollments', enrollment);
plansRouter.put('/enrollments/:id', enrollment);
plansRouter.get('/activities', route(async (req, res) => {
  const query = z.object({ start: dateSchema.optional(), end: dateSchema.optional(), riderId: z.string().optional() }).parse(req.query);
  res.json((await repository.activities()).filter((entry) => (!query.start || (entry.endDate ?? entry.date) >= query.start) && (!query.end || entry.date <= query.end) &&
    (!query.riderId || entry.participants.some(({ riderId }) => riderId === query.riderId))));
}));
const activity = route(async (req, res) => {
  const input = activitySchema.parse(req.body);
  const editId = req.params.id as string | undefined;
  const result = await plansWrite((planning, plans) => saveActivity(planning, plans, input, editId));
  res.status(editId ? 200 : 201).json(result);
});
plansRouter.post('/activities', activity);
plansRouter.put('/activities/:id', activity);
