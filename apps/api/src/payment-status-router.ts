import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { civilDate, dateValue, monthRange, monthlyPaymentKinds, paymentMonthSchema, recordedPaymentStatuses, type PaymentStatusOverview } from '@absolute/shared';
import { database, prisma } from './database.js';
import { demoLessonPayments, demoMonthlyPayments } from './payment-demo.js';
import { validationError } from './validation-error.js';

export const paymentStatusRouter: Router = Router();
const lessonPayments = new Map(demoLessonPayments.map(({ lessonId, status }) => [lessonId, status]));
const monthlyKey = ({ riderId, month, kind }: { riderId: string; month: string; kind: string }) => JSON.stringify([riderId, month, kind]);
const monthlyPayments = new Map(demoMonthlyPayments.map((entry) => [monthlyKey(entry), { ...entry }]));
const identifier = z.string().min(1);
const statusBody = z.object({ status: z.enum(recordedPaymentStatuses) });
const monthlyParams = z.object({ riderId: identifier, month: paymentMonthSchema, kind: z.enum(monthlyPaymentKinds) });
const missing = (res: Response, record: string) => res.status(404).json({ error: { code: 'NOT_FOUND', message: `The ${record} could not be found.` } });

function route(handler: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res).catch((error: unknown) => {
      if (error instanceof z.ZodError) res.status(400).json({ error: validationError(error) });
      else next(error);
    });
  };
}

paymentStatusRouter.get('/', route(async (req, res) => {
  const { month, riderId } = z.object({ month: paymentMonthSchema, riderId: identifier.optional() }).parse(req.query);
  if (riderId && !await database.rider(riderId)) return missing(res, 'rider');
  if (prisma) {
    const { start, end } = monthRange(Number(month.slice(0, 4)), Number(month.slice(5)));
    const where = { date: { gte: civilDate(start), lte: civilDate(end) }, riderId };
    const [lessonStatuses, monthlyStatuses, lessons] = await Promise.all([
      prisma.lessonPaymentStatus.findMany({ where: { lesson: where }, select: { lessonId: true, status: true } }),
      prisma.riderMonthlyPaymentStatus.findMany({ where: { month, riderId }, select: { riderId: true, kind: true, status: true } }),
      riderId ? prisma.lesson.findMany({ where, select: { id: true, date: true, startTime: true, lessonType: true },
        orderBy: [{ date: 'asc' }, { startTime: 'asc' }] }) : [],
    ]);
    return res.json({ lessonStatuses, monthlyStatuses, lessons: lessons.map((lesson) => ({ ...lesson, date: dateValue(lesson.date) })) } satisfies PaymentStatusOverview);
  }
  const lessons = (await database.lessons()).filter((lesson) => lesson.date.startsWith(month) && (!riderId || riderId === lesson.riderId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
  const lessonStatuses = lessons.flatMap(({ id }) => {
    const status = lessonPayments.get(id);
    return status ? [{ lessonId: id, status }] : [];
  });
  const monthlyStatuses = [...monthlyPayments.values()].filter((entry) => entry.month === month && (!riderId || riderId === entry.riderId))
    .map(({ riderId, kind, status }) => ({ riderId, kind, status }));
  return res.json({ lessonStatuses, monthlyStatuses, lessons: riderId ? lessons.map(({ id, date, startTime, lessonType }) => ({ id, date, startTime, lessonType })) : [] } satisfies PaymentStatusOverview);
}));

paymentStatusRouter.put('/lessons/:lessonId', route(async (req, res) => {
  const lessonId = identifier.parse(req.params.lessonId);
  const { status } = statusBody.parse(req.body);
  if (!await database.lesson(lessonId)) return missing(res, 'lesson');
  if (prisma) await prisma.lessonPaymentStatus.upsert({ where: { lessonId }, create: { lessonId, status }, update: { status } });
  else lessonPayments.set(lessonId, status);
  return res.json({ lessonId, status });
}));

paymentStatusRouter.put('/riders/:riderId/:month/:kind', route(async (req, res) => {
  const key = monthlyParams.parse(req.params);
  const { status } = statusBody.parse(req.body);
  if (!await database.rider(key.riderId)) return missing(res, 'rider');
  if (prisma) await prisma.riderMonthlyPaymentStatus.upsert({
    where: { riderId_month_kind: key }, create: { ...key, status }, update: { status },
  });
  else monthlyPayments.set(monthlyKey(key), { ...key, status });
  return res.json({ ...key, status });
}));
