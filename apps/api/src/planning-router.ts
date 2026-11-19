import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { agreementSchema, barnToday, dateSchema, type Agreement } from '@absolute/shared';
import { capacityExceeded, effectiveOn, entitlement, nextPreferredWindow } from './part-board.js';
import { planning, planningWrite } from './planning-repository.js';
import { generationWeeks, maxPartBoarders, scheduleLesson } from './planning-service.js';
import { compareTemplatePriority, defaultPriority, occurrenceDates, recurringSchema, type Template } from './recurring.js';
import { appTimeZone } from './time-zone.js';
import { id } from './store.js';
import { validationError } from './validation-error.js';
import { PlansRepository } from './plans-repository.js';
import { PlanError, plansWrite, saveEnrollment } from './plans-service.js';
import { prisma } from './database.js';

export const planningRouter: Router = Router();
const today = () => barnToday(appTimeZone);
const fail = (res: Response, status: number, code: string, message: string) => res.status(status).json({ error: { code, message } });
const route = (handler: (req: Request, res: Response) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch((error: unknown) => {
      if (error instanceof z.ZodError) res.status(400).json({ error: validationError(error) });
      else if (error instanceof PlanError) res.status(error.status).json({ error: { code: error.code, message: error.message } });
      else next(error);
    });
  };

planningRouter.get('/part-board', route(async (req, res) => {
  const query = z.object({ date: dateSchema.optional(), horseId: z.string().optional(), riderId: z.string().optional() }).parse(req.query);
  const date = query.date ?? today();
  const [agreements, usages, riders, horses] = await Promise.all([
    planning.agreements(), planning.usages(), planning.scheduler.riders(), planning.scheduler.horses(),
  ]);
  const riderNames = new Map(riders.map(({ id, firstName, lastName }) => [id, `${firstName} ${lastName}`]));
  const horseNames = new Map(horses.map(({ id, name }) => [id, name]));
  const enrollments = await new PlansRepository(prisma).enrollments();
  res.json(agreements.filter((entry) => (!query.horseId || entry.horseId === query.horseId) && (!query.riderId || entry.riderId === query.riderId))
    .map((entry) => ({ ...entry, planId: enrollments.find((enrollment) => enrollment.agreementId === entry.id && enrollment.status !== 'ENDED')?.planId ?? entry.planId,
      riderName: riderNames.get(entry.riderId), horseName: horseNames.get(entry.horseId),
      effective: effectiveOn(entry, date), entitlement: entitlement(entry, date, usages), nextPreferredWindow: nextPreferredWindow(entry, date) })));
}));

const saveAgreement = route(async (req, res) => {
  const fields = agreementSchema.parse(req.body);
  const editId = typeof req.params.id === 'string' ? req.params.id : undefined;
  return plansWrite(async (repository, plans) => {
    const agreements = await repository.agreements();
    const existing = agreements.find((entry) => entry.id === editId);
    if (editId && !existing) return fail(res, 404, 'NOT_FOUND', 'Agreement not found.');
    const [rider, horse] = await Promise.all([repository.scheduler.rider(fields.riderId), repository.scheduler.horse(fields.horseId)]);
    if (!rider || !horse || (fields.status === 'ACTIVE' && (!rider.active || !horse.active))) {
      return fail(res, 400, 'PART_BOARD_INVALID_RESOURCES', 'Select an existing rider and horse. Both must be active for an active agreement.');
    }
    if (existing && (existing.riderId !== fields.riderId || existing.horseId !== fields.horseId) &&
      ((await repository.usages(existing.id)).length || (await repository.templates()).some((template) => template.partBoardAgreementId === existing.id) ||
        (await repository.scheduler.lessons()).some((lesson) => lesson.partBoardAgreementId === existing.id))) {
      return fail(res, 409, 'PART_BOARD_RELATIONSHIP_LOCKED', 'An agreement with linked rides or templates cannot change rider or horse.');
    }
    const entry: Agreement = { ...fields, id: existing?.id ?? id('agreement') };
    const packagePlan = fields.planId ? (await plans.plans()).find((plan) => plan.id === fields.planId && plan.category === 'PART_BOARD') : undefined;
    if (fields.planId && !packagePlan) throw new PlanError('INVALID_PART_BOARD_PLAN', 'Select a part-board package.', 400);
    if (packagePlan) {
      entry.entitlementPeriod = 'MONTH';
      entry.freeRidesPerPeriod = packagePlan.entitlements.find((entitlement) => entitlement.activityTypes.includes('PRACTICE_RIDE'))?.quantity ?? 0;
    }
    if (capacityExceeded(entry, agreements, maxPartBoarders)) return fail(res, 409, 'PART_BOARD_CAPACITY', 'This horse already has the maximum number of overlapping active agreements, or this rider is already linked.');
    await repository.saveAgreement(entry, Boolean(existing));
    const enrollments = (await plans.enrollments()).filter((enrollment) => enrollment.agreementId === entry.id && enrollment.status !== 'ENDED');
    for (const enrollment of enrollments) {
      if (enrollment.planId !== entry.planId) await plans.saveEnrollment({ ...enrollment, status: 'ENDED', endDate: entry.startDate < enrollment.startDate ? enrollment.startDate : entry.startDate });
    }
    if (packagePlan) {
      const current = enrollments.find((enrollment) => enrollment.planId === packagePlan.id);
      await saveEnrollment(repository, plans, { id: current?.id ?? id('enrollment'), planId: packagePlan.id, riderId: entry.riderId, agreementId: entry.id,
        startDate: entry.startDate, endDate: entry.endDate, status: entry.status === 'ACTIVE' ? 'ACTIVE' : entry.status === 'PAUSED' ? 'PAUSED' : 'ENDED', notes: entry.notes ?? '' }, current);
    }
    return { entry, status: existing ? 200 : 201 };
  }).then((result) => { if ('entry' in result) res.status(result.status).json(result.entry); });
});
planningRouter.post('/part-board', saveAgreement);
planningRouter.put('/part-board/:id', saveAgreement);

planningRouter.get('/recurring-lessons', route(async (_req, res) => {
  res.json((await planning.templates()).sort(compareTemplatePriority));
}));

const saveTemplate = route(async (req, res) => {
  const input = recurringSchema.parse(req.body);
  const templateId = typeof req.params.id === 'string' ? req.params.id : undefined;
  const result = await planningWrite(async (repository) => {
    if (templateId && !(await repository.templates()).some((template) => template.id === templateId)) return undefined;
    const { lesson } = input;
    const [rider, horse, coach, agreements] = await Promise.all([
      repository.scheduler.rider(lesson.riderId), repository.scheduler.horse(lesson.horseId),
      lesson.coachId ? repository.scheduler.coach(lesson.coachId) : undefined, repository.agreements(),
    ]);
    if (!rider || !horse || (lesson.coachId && !coach)) return false;
    const partBoard = lesson.lessonType === 'PART_BOARD_RIDE';
    const linked = partBoard && agreements.find((entry) => entry.id === input.partBoardAgreementId &&
      entry.riderId === lesson.riderId && entry.horseId === lesson.horseId);
    if (partBoard && !linked) return false;
    const template: Template = { ...input, partBoardAgreementId: linked ? linked.id : null, id: templateId ?? id('recurring'),
      lesson: { ...lesson, date: input.startDate, status: 'CONFIRMED', consumeEntitlement: partBoard && (lesson.consumeEntitlement ?? true) },
      schedulingPriority: input.schedulingPriority ?? defaultPriority(lesson.lessonType) };
    await repository.saveTemplate(template, Boolean(templateId));
    return template;
  });
  if (result === undefined) return fail(res, 404, 'NOT_FOUND', 'Recurring template not found.');
  if (!result) return fail(res, 400, 'INVALID_TEMPLATE_RESOURCES', 'Select valid resources and a matching agreement for a part-board template.');
  res.status(templateId ? 200 : 201).json(result);
});
planningRouter.post('/recurring-lessons', saveTemplate);
planningRouter.put('/recurring-lessons/:id', saveTemplate);

planningRouter.post('/recurring-lessons/:id/generate', route(async (req, res) => {
  const templateId = req.params.id;
  const result = await planningWrite(async (repository) => {
    const template = (await repository.templates()).find((entry) => entry.id === templateId);
    if (!template) return undefined;
    const dates = occurrenceDates(template, today(), generationWeeks);
    const generated = [];
    const failures = [];
    let skipped = 0;
    if (dates.length) {
      const [snapshot, records, agreements, usage, existing] = await Promise.all([
        repository.scheduler.snapshot({ start: dates[0], end: dates[dates.length - 1] }), repository.availability(),
        repository.agreements(), repository.usages(), repository.existingOccurrenceDates(template.id),
      ]);
      const existingDates = new Set(existing);
      const batch = { snapshot, records, agreements, usage };
      for (const date of dates) {
        if (existingDates.has(date)) { skipped++; continue; }
        const result = await scheduleLesson(repository, { ...template.lesson, date }, undefined,
          { recurringTemplateId: template.id, occurrenceDate: date, agreementId: template.partBoardAgreementId }, batch);
        if (result.lesson) generated.push(result.lesson);
        else failures.push({ date, conflicts: result.conflicts });
      }
    }
    return { generated, failures, skipped };
  });
  if (!result) return fail(res, 404, 'NOT_FOUND', 'Recurring template not found.');
  res.json(result);
}));
