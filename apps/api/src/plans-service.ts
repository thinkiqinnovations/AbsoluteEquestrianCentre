import { addDays, monthRange, type ActivityInput, type Enrollment, type EnrollmentDetails, type Plan, type PlanEntitlement, type PlanUsage } from '@absolute/shared';
import { PlanningRepository, demoAgreements, demoUsage, planningWrite } from './planning-repository.js';
import { PlansRepository, planMemory, type Activity, type Participant } from './plans-repository.js';
import { id, store } from './store.js';
import { effectiveOn } from './part-board.js';
import { validateLesson } from './schedule.js';
import { partBoardPriority, priorityContext } from './planning-service.js';
import { evaluateAvailability } from './availability.js';
import { overlaps } from './intervals.js';
import type { Lesson } from './types.js';

export class PlanError extends Error {
  constructor(readonly code: string, message: string, readonly status = 409) { super(message); }
}
export const planEffective = (plan: Plan, date: string) => plan.active && plan.effectiveFrom <= date && (!plan.effectiveTo || plan.effectiveTo >= date);
export const enrollmentEffective = (entry: Enrollment, plan: Plan, date: string) => entry.status === 'ACTIVE' && entry.startDate <= date && (!entry.endDate || entry.endDate >= date) && planEffective(plan, date);
export function balance(entitlement: PlanEntitlement, enrollmentId: string, date: string, usages: PlanUsage[], excludedParticipants: string[] = []) {
  const range = monthRange(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
  const used = usages.filter((usage) => usage.enrollmentId === enrollmentId && usage.entitlementId === entitlement.id &&
    usage.status !== 'RESTORED' && !excludedParticipants.includes(usage.participantId) && usage.serviceDate >= range.start && usage.serviceDate <= range.end)
    .reduce((sum, usage) => sum + usage.quantity, 0);
  return { ...entitlement, allocated: entitlement.quantity, used, remaining: Math.max(0, entitlement.quantity - used), periodStart: range.start, periodEnd: range.end };
}
export function publishedAmount(plan: Plan, count: number) {
  if (!Number.isSafeInteger(count) || count < 1 || plan.priceCents < 0 || (plan.additionalUnitPriceCents ?? 0) < 0) throw new PlanError('INVALID_PRICE', 'Price and rider quantity must be non-negative whole values.', 400);
  const amount = plan.priceCents + Math.max(0, count - (plan.includedQuantity ?? count)) * (plan.additionalUnitPriceCents ?? 0);
  if (!Number.isSafeInteger(amount)) throw new PlanError('INVALID_PRICE', 'Price exceeds the supported amount.', 400);
  return amount;
}
export async function enrollmentDetails(repository: PlansRepository, date: string): Promise<EnrollmentDetails[]> {
  const [plans, enrollments, usages] = await Promise.all([repository.plans(), repository.enrollments(), repository.usages()]);
  return enrollments.flatMap((entry) => {
    const plan = plans.find(({ id }) => id === entry.planId);
    return plan ? [{ ...entry, plan, effective: enrollmentEffective(entry, plan, date), entitlements: plan.entitlements.map((entitlement) => balance(entitlement, entry.id, date, usages)) }] : [];
  });
}

// Use the scheduler's transaction and lock for enrollment, activity, and usage changes.
// Memory mode restores the same state on failure so multi-rider bookings are atomic there too.
export async function plansWrite<T>(work: (planning: PlanningRepository, plans: PlansRepository) => Promise<T>): Promise<T> {
  return planningWrite(async (planning) => {
    const before = planning.client ? undefined : structuredClone({ store, planMemory, demoAgreements, demoUsage });
    try { return await work(planning, new PlansRepository(planning.client)); }
    catch (error) {
      if (before) {
        Object.assign(store, before.store); Object.assign(planMemory, before.planMemory);
        demoAgreements.splice(0, demoAgreements.length, ...before.demoAgreements);
        demoUsage.splice(0, demoUsage.length, ...before.demoUsage);
      }
      throw error;
    }
  });
}

export async function saveEnrollment(planning: PlanningRepository, repository: PlansRepository, input: Enrollment, existing?: Enrollment) {
  const plan = (await repository.plans()).find(({ id }) => id === input.planId);
  const rider = await planning.scheduler.rider(input.riderId);
  if (!plan || !rider || !rider.active) throw new PlanError('INVALID_ENROLLMENT', 'Select an active rider and an existing plan.', 400);
  if (!plan.entitlements.length) throw new PlanError('INVALID_ENROLLMENT', 'Enrollments require a package with entitlements.', 400);
  if (input.status === 'ACTIVE' && !planEffective(plan, input.startDate)) throw new PlanError('PLAN_INACTIVE', 'This plan is inactive or outside its effective dates.');
  if (existing && (existing.riderId !== input.riderId || existing.planId !== input.planId || existing.agreementId !== input.agreementId) &&
    (await repository.usages()).some((usage) => usage.enrollmentId === existing.id)) throw new PlanError('ENROLLMENT_HISTORY_LOCKED', 'End this enrollment and create a new one to change a used package or rider.');
  if (plan.category === 'PART_BOARD') {
    const agreement = (await planning.agreements()).find((entry) => entry.id === input.agreementId && entry.riderId === input.riderId);
    if (!agreement || (input.status === 'ACTIVE' && !effectiveOn(agreement, input.startDate))) throw new PlanError('AGREEMENT_REQUIRED', 'Select a matching effective part-board agreement.');
  } else if (input.agreementId) throw new PlanError('INVALID_AGREEMENT', 'Only part-board packages can link an agreement.', 400);
  await repository.saveEnrollment(input);
  return input;
}

const mountedTypes = ['ASSESSMENT', 'GROUP_LESSON', 'SEMI_PRIVATE_LESSON', 'PRIVATE_LESSON', 'PRACTICE_RIDE'];
const lessonType = (type: ActivityInput['activityType']) => type === 'GROUP_LESSON' ? 'GROUP' as const : type === 'SEMI_PRIVATE_LESSON' ? 'SEMI_PRIVATE' as const : type === 'PRACTICE_RIDE' ? 'PART_BOARD_RIDE' as const : 'PRIVATE' as const;

export async function saveActivity(planning: PlanningRepository, repository: PlansRepository, input: ActivityInput, bookingId?: string): Promise<Activity> {
  const [activities, plans, enrollments, usages, snapshot, records, agreements] = await Promise.all([
    repository.activities(), repository.plans(), repository.enrollments(), repository.usages(), planning.scheduler.snapshot(), planning.availability(), planning.agreements(),
  ]);
  const existing = activities.find(({ id }) => id === bookingId);
  if (bookingId && !existing) throw new PlanError('NOT_FOUND', 'Activity not found.', 404);
  if (existing && input.version !== existing.version) throw new PlanError('ACTIVITY_CHANGED', 'This activity changed. Refresh it before saving.');
  if (existing?.status === 'COMPLETED') throw new PlanError('COMPLETED_ACTIVITY', 'Completed activity records retain their financial and entitlement history.');
  if (existing && input.status === 'CANCELLED') {
    for (const participant of existing.participants) {
      if (participant.lessonId) {
        const lesson = await planning.scheduler.lesson(participant.lessonId);
        if (lesson) await planning.scheduler.updateLesson(lesson.id, { ...lesson, status: 'CANCELLED' });
      }
      const usage = usages.find((entry) => entry.participantId === participant.id);
      if (usage) await repository.saveUsage({ ...usage, status: input.cancellationAction === 'RESTORE' ? 'RESTORED' : usage.status === 'RESTORED' ? 'RESTORED' : 'CANCELLED' });
    }
    const cancelled = { ...existing, status: 'CANCELLED' as const, version: existing.version + 1 };
    await repository.saveActivity(cancelled);
    return cancelled;
  }
  if (existing && (input.activityType !== existing.activityType || input.participants.map(({ riderId }) => riderId).sort().join() !== existing.participants.map(({ riderId }) => riderId).sort().join())) {
    throw new PlanError('ACTIVITY_PARTICIPANTS_LOCKED', 'Cancel this activity and create a new booking to change activity type or participants.');
  }
  const mounted = mountedTypes.includes(input.activityType);
  const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
  const duration = minutes(input.endTime) - minutes(input.startTime);
  if (input.endDate && input.endDate > addDays(input.date, 6)) throw new PlanError('CAMP_DURATION', 'Camp reservations support a maximum of seven days.', 400);
  const required = input.activityType === 'GROUP_LESSON' ? 60 : ['ASSESSMENT', 'PRIVATE_LESSON', 'SEMI_PRIVATE_LESSON'].includes(input.activityType) ? 30 : input.activityType === 'GROOMING_TACKING' ? 90 : input.activityType === 'BIRTHDAY_PARTY' ? 120 : undefined;
  if (required && duration !== required) throw new PlanError('ACTIVITY_DURATION', `This activity requires ${required} minutes.`, 400);
  if (input.activityType !== 'PRACTICE_RIDE' && !input.coachId) throw new PlanError('COACH_REQUIRED', 'Select a coach.', 400);
  if (input.coachId && !snapshot.coaches.some((coach) => coach.id === input.coachId && coach.active)) throw new PlanError('INVALID_COACH', 'Select an active coach.', 400);
  const removedIds = existing?.participants.flatMap(({ lessonId }) => lessonId ? [lessonId] : []) ?? [];
  snapshot.lessons = snapshot.lessons.filter(({ id }) => !removedIds.includes(id));
  snapshot.reservations = snapshot.reservations?.filter(({ activityId }) => activityId !== existing?.id);
  const excludedParticipants = existing?.participants.map(({ id }) => id) ?? [];
  const booking: Activity = { ...input, id: existing?.id ?? id('activity'), version: (existing?.version ?? 0) + 1, participants: [] };
  const priority = await priorityContext(planning, input.date);
  for (let day = input.date; day <= (input.endDate ?? input.date); day = addDays(day, 1)) {
    if (day > addDays(input.date, 6)) throw new PlanError('CAMP_DURATION', 'Camp reservations support a maximum of seven days.', 400);
    if (input.status === 'CANCELLED') continue;
    const otherBookings = activities.filter((entry) => entry.id !== existing?.id && entry.status !== 'CANCELLED' && entry.date <= day && (entry.endDate ?? entry.date) >= day && overlaps(input, entry));
    const conflicts = otherBookings.some((entry) => (input.coachId && entry.coachId === input.coachId) ||
      (input.location && entry.location === input.location) || entry.participants.some((p) => input.participants.some((candidate) => candidate.riderId === p.riderId || (candidate.horseId && candidate.horseId === p.horseId))));
    if (conflicts) throw new PlanError('ACTIVITY_CONFLICT', 'A selected rider, horse, coach, or location already has an overlapping activity.');
    const lessons = snapshot.lessons.filter((lesson) => lesson.date === day && lesson.status !== 'CANCELLED' && overlaps(input, lesson));
    if (lessons.some((lesson) => (input.coachId && lesson.coachId === input.coachId) || input.participants.some((p) => p.riderId === lesson.riderId || (p.horseId && p.horseId === lesson.horseId)))) throw new PlanError('ACTIVITY_CONFLICT', 'A rider, horse, or coach is already scheduled during this time.');
    for (const resource of [
      ...(input.coachId ? [{ resourceType: 'COACH' as const, resourceId: input.coachId }] : []),
      ...input.participants.map(({ riderId }) => ({ resourceType: 'RIDER' as const, resourceId: riderId })),
      ...input.participants.flatMap(({ horseId }) => horseId ? [{ resourceType: 'HORSE' as const, resourceId: horseId }] : []),
    ]) {
      if (evaluateAvailability(records, resource, day, input).status === 'UNAVAILABLE') throw new PlanError(`${resource.resourceType}_UNAVAILABLE`, `A selected ${resource.resourceType.toLowerCase()} is unavailable on ${day}.`);
    }
  }
  const lessonsToSave: { participant: Participant; lesson: Lesson; agreementId?: string }[] = [];
  for (const [index, candidate] of input.participants.entries()) {
    const previous = existing?.participants.find(({ riderId }) => riderId === candidate.riderId);
    if (previous && ((previous.enrollmentId ?? null) !== (candidate.enrollmentId ?? null) || (previous.entitlementId ?? null) !== (candidate.entitlementId ?? null))) {
      throw new PlanError('USAGE_SOURCE_LOCKED', 'Cancel and rebook to change an existing entitlement source.');
    }
    const rider = snapshot.riders.find(({ id }) => id === candidate.riderId);
    if (!rider || !rider.active) throw new PlanError('RIDER_INACTIVE', 'Select an active rider.', 400);
    if (candidate.horseId && !snapshot.horses.some((horse) => horse.id === candidate.horseId && horse.active)) throw new PlanError('HORSE_INACTIVE', 'Select an active horse.', 400);
    let plan: Plan | undefined;
    let usage: PlanUsage | undefined;
    const participantId = previous?.id ?? id('participant');
    let agreementId: string | undefined;
    if (candidate.enrollmentId) {
      const enrollment = enrollments.find(({ id }) => id === candidate.enrollmentId);
      plan = plans.find(({ id }) => id === enrollment?.planId);
      const entitlement = plan?.entitlements.find(({ id }) => id === candidate.entitlementId);
      if (!enrollment || enrollment.riderId !== candidate.riderId || !plan || !entitlement || !enrollmentEffective(enrollment, plan, input.date)) throw new PlanError('ENTITLEMENT_INACTIVE', 'Select an active, effective enrollment and its entitlement.');
      if (!entitlement.activityTypes.includes(input.activityType)) throw new PlanError('ENTITLEMENT_MISMATCH', 'This entitlement does not cover the activity.');
      const remaining = balance(entitlement, enrollment.id, input.date, usages, excludedParticipants).remaining;
      if (!remaining && !candidate.overrideReason && input.status !== 'CANCELLED') throw new PlanError('ENTITLEMENT_EXHAUSTED', 'This entitlement is exhausted. An administrator override reason is required.');
      if (enrollment.agreementId) {
        const agreement = agreements.find((entry) => entry.id === enrollment.agreementId && effectiveOn(entry, input.date));
        if (!agreement || agreement.horseId !== candidate.horseId || agreement.riderId !== candidate.riderId) {
          if (input.activityType !== 'PRACTICE_RIDE' || !candidate.relationshipOverrideReason) throw new PlanError('PART_BOARD_MAPPING', 'Use the horse linked to this effective part-board agreement.');
        } else agreementId = agreement.id;
      }
      usage = { id: usages.find((entry) => entry.participantId === participantId)?.id ?? id('plan-usage'), participantId, enrollmentId: enrollment.id, entitlementId: entitlement.id, serviceDate: input.date, quantity: 1,
        status: input.status === 'CANCELLED' ? input.cancellationAction === 'RESTORE' ? 'RESTORED' : 'CANCELLED' : 'USED', overrideReason: candidate.overrideReason };
    } else {
      plan = plans.find((entry) => entry.entitlements.length === 0 && entry.activityTypes.includes(input.activityType) && planEffective(entry, input.date));
      if (input.activityType === 'PRACTICE_RIDE') throw new PlanError('PRACTICE_PACKAGE_REQUIRED', 'Select an eligible practice-ride package.');
      if (!plan) throw new PlanError('OFFERING_UNAVAILABLE', 'No active individual offering covers this activity.');
      if (usages.some((entry) => entry.participantId === participantId)) throw new PlanError('USAGE_SOURCE_LOCKED', 'Retain the original entitlement source when editing. Cancel and rebook to change it.');
    }
    const participant: Participant = { ...candidate, id: participantId, bookingId: booking.id, lessonId: previous?.lessonId ?? (mounted ? id('lesson') : null),
      planId: plan.id, publishedPriceCents: previous?.publishedPriceCents ?? plan.priceCents,
      amountCents: previous?.amountCents ?? (candidate.enrollmentId ? 0 : input.activityType === 'BIRTHDAY_PARTY' ? index === 0 ? publishedAmount(plan, input.participants.length) : 0 : publishedAmount(plan, 1)),
      hstIncluded: previous?.hstIncluded ?? plan.hstIncluded, paymentMethodRule: previous?.paymentMethodRule ?? plan.paymentMethodRule, paymentInstructions: previous?.paymentInstructions ?? plan.paymentInstructions };
    if (input.activityType === 'GROOMING_TACKING' && plan.paymentMethodRule !== 'CASH_ONLY') throw new PlanError('CASH_ONLY_REQUIRED', 'Grooming & Tacking must use the cash-only payment rule.', 400);
    if (mounted) {
      if (!candidate.horseId) throw new PlanError('HORSE_REQUIRED', 'Select a horse for every mounted participant.', 400);
      if (input.activityType === 'PRACTICE_RIDE' && !agreementId) {
        agreementId = agreements.find((entry) => entry.riderId === candidate.riderId && entry.horseId === candidate.horseId && effectiveOn(entry, input.date))?.id;
        if (!agreementId && !candidate.relationshipOverrideReason) throw new PlanError('PART_BOARD_MAPPING', 'A practice ride requires a matching agreement or an administrator relationship override reason.');
      }
      const lesson: Lesson = { id: participant.lessonId!, date: input.date, startTime: input.startTime, endTime: input.endTime, riderId: candidate.riderId, horseId: candidate.horseId, coachId: input.coachId,
        lessonType: lessonType(input.activityType), discipline: input.discipline, rideUnits: input.rideUnits, status: input.status, notes: input.notes, consumeEntitlement: false,
        activityId: booking.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      const conflicts = validateLesson(lesson, snapshot, records);
      const protectedRide = partBoardPriority(lesson, snapshot, records, priority);
      if (protectedRide) conflicts.push(protectedRide);
      const blocking = conflicts.find(({ severity }) => severity === 'ERROR');
      if (blocking) throw new PlanError(blocking.code, blocking.message);
      snapshot.lessons.push(lesson);
      lessonsToSave.push({ participant, lesson, agreementId });
    }
    booking.participants.push(participant);
    if (usage) {
      // Reserve the balance for subsequent participants before persisting the transaction.
      usages.push(usage);
    }
  }
  for (const { participant, lesson, agreementId } of lessonsToSave) {
    if (planning.client) {
      const { createdAt, updatedAt, activityId: _activity, ...fields } = lesson;
      void createdAt; void updatedAt; void _activity;
      const data = { ...fields, coachId: fields.coachId ?? null, date: new Date(`${lesson.date}T00:00:00Z`), partBoardAgreementId: agreementId ?? null };
      await planning.client.lesson.upsert({ where: { id: lesson.id }, create: data, update: data });
    } else {
      store.lessons = [...store.lessons.filter(({ id }) => id !== participant.lessonId), lesson];
    }
  }
  await repository.saveActivity(booking);
  for (const participant of booking.participants) {
    const usage = [...usages].reverse().find((entry) => entry.participantId === participant.id);
    if (usage) await repository.saveUsage(usage);
  }
  return booking;
}
