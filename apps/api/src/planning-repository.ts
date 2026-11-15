import { civilDate, dateValue, barnToday, addDays, weekday, schedulingPriority, type Agreement, type LessonInput } from '@absolute/shared';
import type { Prisma } from '@prisma/client';
import { database, PostgresDatabase, prisma, toLesson } from './database.js';
import { id, store } from './store.js';
import { appTimeZone } from './time-zone.js';
import type { Usage } from './part-board.js';
import type { Template } from './recurring.js';
import type { Lesson } from './types.js';
import { availabilityRecords } from './availability-store.js';

const today = barnToday(appTimeZone);
const demoAgreements: Agreement[] = [
  { id: 'part-board-emma', riderId: 'rider-emma', horseId: 'horse-jasper', status: 'ACTIVE', startDate: addDays(today, -30),
    endDate: null, priority: 100, freeRidesPerPeriod: 2, entitlementPeriod: 'WEEK',
    preferredRideTimes: [{ dayOfWeek: 'TUESDAY', startTime: '17:00', endTime: '19:00', preferenceRank: 1 },
      { dayOfWeek: 'SATURDAY', startTime: '10:00', endTime: '12:00', preferenceRank: 2 }] },
  { id: 'part-board-noah', riderId: 'rider-noah', horseId: 'horse-willow', status: 'ACTIVE', startDate: addDays(today, -30),
    endDate: null, priority: 100, freeRidesPerPeriod: 8, entitlementPeriod: 'MONTH', preferredRideTimes: [
      { dayOfWeek: 'THURSDAY', startTime: '17:00', endTime: '19:00', preferenceRank: 1 },
      { dayOfWeek: 'SUNDAY', startTime: '10:00', endTime: '12:00', preferenceRank: 2 },
    ] },
  { id: 'part-board-olivia', riderId: 'rider-olivia', horseId: 'horse-atlas', status: 'ACTIVE', startDate: addDays(today, -14),
    endDate: null, priority: 100, freeRidesPerPeriod: 3, entitlementPeriod: 'WEEK', preferredRideTimes: [
      { dayOfWeek: 'WEDNESDAY', startTime: '15:00', endTime: '17:00', preferenceRank: 1 },
    ] },
  { id: 'part-board-history', riderId: 'rider-emma', horseId: 'horse-charlie', status: 'ENDED', startDate: addDays(today, -90),
    endDate: addDays(today, -45), priority: 100, freeRidesPerPeriod: 2, entitlementPeriod: 'WEEK', preferredRideTimes: [] },
];
const demoUsage: Usage[] = [];
const nextDay = addDays(today, 1);
const demoTemplates: Template[] = [
  { id: 'recurring-demo-lesson', startDate: nextDay, endDate: null, status: 'ACTIVE', dayOfWeek: weekday(nextDay),
    schedulingPriority: schedulingPriority.recurringLesson,
    lesson: { date: nextDay, startTime: '12:00', endTime: '12:45', riderId: 'rider-olivia', horseId: 'horse-atlas',
      coachId: 'coach-sarah', lessonType: 'PRIVATE', discipline: 'JUMP', rideUnits: 0.75, status: 'CONFIRMED' } },
  { id: 'recurring-demo-part-board', startDate: nextDay, endDate: null, status: 'ACTIVE', dayOfWeek: weekday(nextDay),
    schedulingPriority: schedulingPriority.partBoardRecurring, partBoardAgreementId: 'part-board-emma',
    lesson: { date: nextDay, startTime: '17:00', endTime: '18:00', riderId: 'rider-emma', horseId: 'horse-jasper',
      coachId: null, lessonType: 'PART_BOARD_RIDE', discipline: 'FLAT', rideUnits: 1, status: 'CONFIRMED', consumeEntitlement: true } },
];

if (!prisma) {
  // Seed short completed rides so the current weekly entitlement and workload are visible.
  for (const [index, startTime, endTime] of [[1, '08:00', '08:20'], [2, '08:20', '08:40']] as const) {
    const lessonId = `part-board-demo-${index}`;
    const timestamp = new Date().toISOString();
    store.lessons.push({ ...store.lessons[0], id: lessonId, date: today, startTime, endTime, coachId: null,
      lessonType: 'PART_BOARD_RIDE', rideUnits: 0.25, status: 'COMPLETED', consumeEntitlement: true,
      partBoardAgreementId: 'part-board-emma', createdAt: timestamp, updatedAt: timestamp });
    demoUsage.push({ agreementId: 'part-board-emma', lessonId, entitlementDate: today, quantity: 1 });
  }
  const timestamp = new Date().toISOString();
  store.lessons.push({ ...store.lessons[2], id: 'part-board-demo-olivia', date: today, startTime: '15:30', endTime: '16:15',
    coachId: null, lessonType: 'PART_BOARD_RIDE', status: 'CONFIRMED', rideUnits: 0.75, consumeEntitlement: true,
    partBoardAgreementId: 'part-board-olivia', createdAt: timestamp, updatedAt: timestamp });
  demoUsage.push({ agreementId: 'part-board-olivia', lessonId: 'part-board-demo-olivia', entitlementDate: today, quantity: 1 });
}

export class PlanningRepository {
  readonly scheduler;
  constructor(private readonly client?: Prisma.TransactionClient) {
    this.scheduler = client ? new PostgresDatabase(client) : database;
  }

  availability() {
    return availabilityRecords(undefined, this.client);
  }

  async agreements(): Promise<Agreement[]> {
    if (!this.client) return [...demoAgreements];
    const entries = await this.client.partBoardAgreement.findMany({ include: { preferredRideTimes: { orderBy: { preferenceRank: 'asc' } } } });
    return entries.map(({ startDate, endDate, notes, preferredRideTimes, ...entry }) => ({
      ...entry, startDate: dateValue(startDate), endDate: endDate ? dateValue(endDate) : null, notes: notes ?? undefined,
      preferredRideTimes: preferredRideTimes.map(({ dayOfWeek, startTime, endTime, preferenceRank, notes }) =>
        ({ dayOfWeek, startTime, endTime, preferenceRank, notes: notes ?? undefined })),
    }));
  }

  async saveAgreement(entry: Agreement, existing: boolean) {
    if (!this.client) {
      if (existing) demoAgreements.splice(demoAgreements.findIndex(({ id }) => id === entry.id), 1, entry);
      else demoAgreements.push(entry);
      return;
    }
    const { id, startDate, endDate, preferredRideTimes, ...fields } = entry;
    const data = { ...fields, notes: fields.notes ?? null, startDate: civilDate(startDate), endDate: endDate ? civilDate(endDate) : null };
    if (existing) await this.client.partBoardAgreement.update({ where: { id }, data: { ...data, preferredRideTimes: { deleteMany: {}, create: preferredRideTimes } } });
    else await this.client.partBoardAgreement.create({ data: { id, ...data, preferredRideTimes: { create: preferredRideTimes } } });
  }

  async usages(agreementId?: string): Promise<Usage[]> {
    if (!this.client) return demoUsage.filter((entry) => !agreementId || entry.agreementId === agreementId);
    return (await this.client.partBoardEntitlementUsage.findMany({ where: { agreementId } }))
      .map((entry) => ({ ...entry, entitlementDate: dateValue(entry.entitlementDate) }));
  }

  async saveLesson(input: LessonInput, existing?: Lesson, agreementId?: string, occurrence?: { recurringTemplateId: string; occurrenceDate: string }) {
    const fields = { ...input, coachId: input.coachId ?? null, consumeEntitlement: input.consumeEntitlement ?? false, partBoardAgreementId: agreementId ?? null };
    if (!this.client) {
      const now = new Date().toISOString();
      const lesson = { ...existing, ...fields, ...occurrence, id: existing?.id ?? id('lesson'), createdAt: existing?.createdAt ?? now, updatedAt: now };
      if (existing) store.lessons.splice(store.lessons.findIndex(({ id }) => id === existing.id), 1, lesson);
      else store.lessons.push(lesson);
      return lesson;
    }
    const data = { ...fields, date: civilDate(input.date) };
    return toLesson(existing ? await this.client.lesson.update({ where: { id: existing.id }, data })
      : await this.client.lesson.create({ data: { ...data, ...(occurrence && { ...occurrence, occurrenceDate: civilDate(occurrence.occurrenceDate) }) } }));
  }

  async recordUsage(lesson: Lesson, agreementId?: string) {
    if (!this.client) {
      const entry = demoUsage.find(({ lessonId }) => lessonId === lesson.id);
      if (agreementId) {
        const usage = { lessonId: lesson.id, agreementId, entitlementDate: lesson.date, quantity: 1 };
        if (entry) Object.assign(entry, usage, { reversedAt: null });
        else demoUsage.push(usage);
      } else if (entry && !entry.reversedAt) entry.reversedAt = new Date();
      return;
    }
    const table = this.client.partBoardEntitlementUsage;
    if (!agreementId) {
      await table.updateMany({ where: { lessonId: lesson.id, reversedAt: null }, data: { reversedAt: new Date() } });
      return;
    }
    const data = { agreementId, entitlementDate: civilDate(lesson.date), reversedAt: null };
    await table.upsert({ where: { lessonId: lesson.id }, create: { ...data, lessonId: lesson.id }, update: data });
  }

  async templates(): Promise<Template[]> {
    if (!this.client) return [...demoTemplates];
    return (await this.client.recurringLessonTemplate.findMany()).map((entry) => ({
      id: entry.id, status: entry.status, dayOfWeek: entry.dayOfWeek, schedulingPriority: entry.schedulingPriority,
      partBoardAgreementId: entry.partBoardAgreementId, startDate: dateValue(entry.startDate), endDate: entry.endDate ? dateValue(entry.endDate) : null,
      lesson: { date: dateValue(entry.startDate), startTime: entry.startTime, endTime: entry.endTime, riderId: entry.riderId, horseId: entry.horseId,
        coachId: entry.coachId, discipline: entry.discipline, lessonType: entry.lessonType, rideUnits: Number(entry.rideUnits),
        consumeEntitlement: entry.consumeEntitlement, notes: entry.notes ?? undefined, status: 'CONFIRMED' },
    }));
  }

  async existingOccurrenceDates(templateId: string) {
    if (!this.client) return store.lessons.filter((entry) => entry.recurringTemplateId === templateId).map((entry) => entry.occurrenceDate);
    return (await this.client.lesson.findMany({ where: { recurringTemplateId: templateId }, select: { occurrenceDate: true } }))
      .map(({ occurrenceDate }) => occurrenceDate && dateValue(occurrenceDate));
  }

  async saveTemplate(template: Template, existing: boolean) {
    if (!this.client) {
      if (existing) demoTemplates.splice(demoTemplates.findIndex(({ id }) => id === template.id), 1, template);
      else demoTemplates.push(template);
      return;
    }
    const { id, lesson, startDate, endDate, ...fields } = template;
    const { date: _date, status: _status, ...lessonFields } = lesson;
    void _date;
    void _status;
    const data = { ...fields, ...lessonFields, notes: lessonFields.notes ?? null, coachId: lessonFields.coachId ?? null,
      partBoardAgreementId: fields.partBoardAgreementId ?? null, startDate: civilDate(startDate), endDate: endDate ? civilDate(endDate) : null };
    if (existing) await this.client.recurringLessonTemplate.update({ where: { id }, data });
    else await this.client.recurringLessonTemplate.create({ data: { id, ...data } });
  }
}

export const planning = new PlanningRepository(prisma);
let pending: Promise<unknown> = Promise.resolve();

export async function planningWrite<T>(work: (repository: PlanningRepository) => Promise<T>): Promise<T> {
  if (!prisma) {
    const result = pending.then(() => work(planning));
    pending = result.catch(() => undefined);
    return result;
  }
  return prisma.$transaction(async (transaction) => {
    // Serialize schedule and agreement writes across API instances before reading capacities.
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(724168203)`;
    return work(new PlanningRepository(transaction));
  }, { isolationLevel: 'ReadCommitted', timeout: 20000 });
}
