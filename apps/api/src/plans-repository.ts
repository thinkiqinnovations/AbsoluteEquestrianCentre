import { addDays, civilDate, dateValue, type ActivityInput, type Enrollment, type Plan, type PlanUsage } from '@absolute/shared';
import type { Prisma } from '@prisma/client';
import { demoEnrollments, demoPlans } from './plans-demo.js';
import type { Lesson } from './types.js';

export type Participant = ActivityInput['participants'][number] & {
  id: string; bookingId: string; lessonId: string | null; planId: string | null;
  publishedPriceCents: number; amountCents: number; hstIncluded: boolean; paymentMethodRule: string; paymentInstructions: string;
};
export type Activity = Omit<ActivityInput, 'participants'> & { id: string; version: number; participants: Participant[] };
export const planMemory: { plans: Plan[]; enrollments: Enrollment[]; usages: PlanUsage[]; activities: Activity[] } = {
  plans: structuredClone(demoPlans), enrollments: structuredClone(demoEnrollments), usages: [], activities: [],
};
export class PlansRepository {
  constructor(readonly client?: Prisma.TransactionClient) {}
  async plans(): Promise<Plan[]> {
    if (!this.client) return planMemory.plans;
    return (await this.client.plan.findMany({ include: { entitlements: true }, orderBy: { sortOrder: 'asc' } }))
      .map((plan) => ({ ...plan, effectiveFrom: dateValue(plan.effectiveFrom), effectiveTo: plan.effectiveTo ? dateValue(plan.effectiveTo) : null }));
  }
  async enrollments(): Promise<Enrollment[]> {
    if (!this.client) return planMemory.enrollments;
    return (await this.client.riderPlanEnrollment.findMany()).map((entry) => ({ ...entry, status: entry.status as Enrollment['status'], startDate: dateValue(entry.startDate), endDate: entry.endDate ? dateValue(entry.endDate) : null }));
  }
  async saveEnrollment(entry: Enrollment) {
    if (!this.client) { planMemory.enrollments = [...planMemory.enrollments.filter(({ id }) => id !== entry.id), entry]; return; }
    const data = { ...entry, startDate: civilDate(entry.startDate), endDate: entry.endDate ? civilDate(entry.endDate) : null };
    await this.client.riderPlanEnrollment.upsert({ where: { id: entry.id }, create: data, update: data });
  }
  async usages(): Promise<PlanUsage[]> {
    if (!this.client) return [...planMemory.usages];
    return (await this.client.planUsage.findMany()).map((entry) => ({ ...entry, serviceDate: dateValue(entry.serviceDate), status: entry.status as PlanUsage['status'] }));
  }
  async saveUsage(entry: PlanUsage) {
    if (!this.client) { planMemory.usages = [...planMemory.usages.filter(({ id }) => id !== entry.id), entry]; return; }
    const data = { ...entry, serviceDate: civilDate(entry.serviceDate) };
    await this.client.planUsage.upsert({ where: { id: entry.id }, create: data, update: data });
  }
  async activities(): Promise<Activity[]> {
    if (!this.client) return planMemory.activities;
    return (await this.client.activityBooking.findMany({ include: { participants: { include: { lesson: true, usage: true } } } })).map((entry) => ({
      ...entry, activityType: entry.activityType as ActivityInput['activityType'], date: dateValue(entry.date), endDate: entry.endDate ? dateValue(entry.endDate) : null,
      discipline: entry.participants[0]?.lesson?.discipline ?? 'FLAT', rideUnits: Number(entry.participants[0]?.lesson?.rideUnits ?? 0.5), cancellationAction: 'RETAIN',
      participants: entry.participants.map(({ usage, lesson: _lesson, ...participant }) => {
        void _lesson;
        return { ...participant, enrollmentId: usage?.enrollmentId, entitlementId: usage?.entitlementId, overrideReason: usage?.overrideReason ?? '' };
      }),
    }));
  }
  async reservations(): Promise<Lesson[]> {
    const entries: Lesson[] = [];
    for (const activity of await this.activities()) {
      if (activity.status === 'CANCELLED' || activity.participants.some(({ lessonId }) => lessonId)) continue;
      for (let date = activity.date; date <= (activity.endDate ?? activity.date); date = addDays(date, 1)) {
        for (const participant of activity.participants) entries.push({
          id: `reservation-${participant.id}-${date}`, activityId: activity.id, date, startTime: activity.startTime, endTime: activity.endTime,
          riderId: participant.riderId, horseId: participant.horseId ?? '', coachId: activity.coachId,
          lessonType: 'PRIVATE', discipline: 'FLAT', rideUnits: 0, status: activity.status, createdAt: '', updatedAt: '',
        });
      }
    }
    return entries;
  }
  async saveActivity(entry: Activity) {
    if (!this.client) { planMemory.activities = [...planMemory.activities.filter(({ id }) => id !== entry.id), entry]; return; }
    const { participants, discipline: _discipline, rideUnits: _units, cancellationAction: _action, ...booking } = entry;
    void _discipline; void _units; void _action;
    const data = { ...booking, date: civilDate(entry.date), endDate: entry.endDate ? civilDate(entry.endDate) : null };
    await this.client.activityBooking.upsert({ where: { id: entry.id }, create: data, update: data });
    for (const participant of participants) {
      const { enrollmentId: _enrollment, entitlementId: _entitlement, overrideReason: _override, ...fields } = participant;
      void _enrollment; void _entitlement; void _override;
      await this.client.activityParticipant.upsert({ where: { id: participant.id }, create: fields, update: fields });
    }
  }
}
