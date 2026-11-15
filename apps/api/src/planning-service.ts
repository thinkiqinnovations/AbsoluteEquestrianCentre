import { barnToday, type Agreement, type AvailabilityRecords, type LessonInput } from '@absolute/shared';
import { z } from 'zod';
import { effectiveOn, entitlement, type Usage } from './part-board.js';
import type { PlanningRepository } from './planning-repository.js';
import { validateLesson } from './schedule.js';
import type { Conflict, Lesson } from './types.js';
import type { SchedulerSnapshot } from './database.js';
import { compareTemplatePriority, occurrenceDates } from './recurring.js';
import { appTimeZone } from './time-zone.js';

export const maxPartBoarders = z.coerce.number().int().min(1).max(100).parse(process.env.MAX_ACTIVE_PART_BOARDERS_PER_HORSE ?? 1);
export const generationWeeks = z.coerce.number().int().min(1).max(52).parse(process.env.RECURRING_LESSON_GENERATION_WEEKS ?? 8);

async function partBoardPriority(repository: PlanningRepository, input: LessonInput, snapshot: SchedulerSnapshot,
  records: AvailabilityRecords, existing?: Lesson): Promise<Conflict | undefined> {
  if (input.lessonType === 'PART_BOARD_RIDE' || input.status === 'CANCELLED') return;
  if (existing && existing.status !== 'CANCELLED' && existing.lessonType !== 'PART_BOARD_RIDE' &&
    existing.date === input.date && existing.startTime === input.startTime && existing.endTime === input.endTime &&
    existing.riderId === input.riderId && existing.horseId === input.horseId && existing.coachId === input.coachId &&
    existing.rideUnits === input.rideUnits) return;

  const today = barnToday(appTimeZone);
  const templates = (await repository.templates()).filter((template) => template.lesson.lessonType === 'PART_BOARD_RIDE' &&
    (template.lesson.horseId === input.horseId || template.lesson.riderId === input.riderId ||
      (input.coachId && template.lesson.coachId === input.coachId)) &&
    occurrenceDates(template, today, generationWeeks).includes(input.date)).sort(compareTemplatePriority);
  if (!templates.length) return;
  const agreements = await repository.agreements();
  const baseline = { ...snapshot, lessons: snapshot.lessons.filter(({ id }) => id !== existing?.id) };
  const proposed: Lesson = { ...input, id: 'proposed-booking', createdAt: '', updatedAt: '' };
  for (const template of templates) {
    const ride = { ...template.lesson, date: input.date };
    const agreement = agreements.find((entry) => entry.id === template.partBoardAgreementId && effectiveOn(entry, input.date));
    if (!agreement || !snapshot.horses.some((horse) => horse.id === ride.horseId && horse.active) ||
      !snapshot.riders.some((rider) => rider.id === ride.riderId && rider.active)) continue;
    if ((await repository.existingOccurrenceDates(template.id)).includes(input.date)) continue;
    if ((ride.consumeEntitlement ?? true) && !entitlement(agreement, input.date, await repository.usages(agreement.id)).remaining) continue;
    if (validateLesson(ride, baseline, records).some(({ severity }) => severity === 'ERROR')) continue;
    if (validateLesson(ride, { ...baseline, lessons: [...baseline.lessons, proposed] }, records).some(({ severity }) => severity === 'ERROR')) {
      const horse = snapshot.horses.find(({ id }) => id === ride.horseId);
      return { code: 'PART_BOARD_PRIORITY', severity: 'ERROR',
        message: `A priority part-board ride for ${horse?.name ?? 'this horse'} is planned on ${input.date} from ${ride.startTime} to ${ride.endTime}. Choose a different time or resource.` };
    }
  }
}

export async function scheduleLesson(repository: PlanningRepository, input: LessonInput, existing?: Lesson,
  occurrence?: { recurringTemplateId: string; occurrenceDate: string; agreementId?: string | null },
  batch?: { snapshot: SchedulerSnapshot; records: AvailabilityRecords; agreements: Agreement[]; usage: Usage[] }) {
  const [snapshot, records] = batch ? [batch.snapshot, batch.records] : await Promise.all([
    repository.scheduler.snapshot({ start: input.date, end: input.date }), repository.availability(),
  ]);
  const conflicts: Conflict[] = validateLesson(input, snapshot, records, existing?.id);
  let agreement: Agreement | undefined;
  let consume = false;
  const historical = existing?.status === 'COMPLETED' && existing.lessonType === 'PART_BOARD_RIDE';
  if (historical && (input.status !== 'COMPLETED' || input.lessonType !== existing.lessonType || input.date !== existing.date ||
    input.riderId !== existing.riderId || input.horseId !== existing.horseId || Boolean(input.consumeEntitlement) !== Boolean(existing.consumeEntitlement))) {
    conflicts.push({ code: 'COMPLETED_PART_BOARD_RIDE', severity: 'ERROR', message: 'The entitlement details of a completed part-board ride are locked.' });
  }
  if (input.lessonType === 'PART_BOARD_RIDE' && input.status !== 'CANCELLED' && !historical) {
    const agreements = batch?.agreements ?? await repository.agreements();
    agreement = agreements.find((entry) => entry.riderId === input.riderId && entry.horseId === input.horseId &&
      (!occurrence?.agreementId || occurrence.agreementId === entry.id) && effectiveOn(entry, input.date));
    if (!agreement) {
      conflicts.push({ code: 'PART_BOARD_AGREEMENT_REQUIRED', severity: 'ERROR', message: 'Select a rider and horse with an active part-board agreement for this date.' });
    } else if (input.consumeEntitlement ?? true) {
      consume = true;
      const balance = entitlement(agreement, input.date, batch?.usage ?? await repository.usages(agreement.id), existing?.id);
      if (!balance.remaining) conflicts.push({ code: 'PART_BOARD_ENTITLEMENT_EXHAUSTED', severity: 'ERROR',
        message: `All part-board rides have been used for ${balance.periodStart} to ${balance.periodEnd}.` });
    }
  }
  if (!conflicts.some(({ severity }) => severity === 'ERROR')) {
    const priority = await partBoardPriority(repository, input, snapshot, records, existing);
    if (priority) conflicts.push(priority);
  }
  if (conflicts.some(({ severity }) => severity === 'ERROR')) return { conflicts };
  const agreementId = agreement?.id ?? (input.lessonType === 'PART_BOARD_RIDE' ? existing?.partBoardAgreementId ?? undefined : undefined);
  const lesson = await repository.saveLesson({ ...input, consumeEntitlement: consume || Boolean((historical || input.status === 'CANCELLED') && existing?.consumeEntitlement) },
    existing, agreementId, occurrence && { occurrenceDate: occurrence.occurrenceDate, recurringTemplateId: occurrence.recurringTemplateId });
  if (!historical) await repository.recordUsage(lesson, consume ? agreementId : undefined);
  if (batch) {
    batch.snapshot.lessons.push(lesson);
    if (consume && agreementId) batch.usage.push({ agreementId, lessonId: lesson.id, entitlementDate: lesson.date, quantity: 1 });
  }
  return { lesson, conflicts };
}
