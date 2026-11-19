import { addDays, activityDuration, type ActivityInput, type PlanUsage } from '@absolute/shared';
import { demoToday, demoTimestamp, store } from './store.js';
import { demoPlans } from './plans-demo.js';
import { planMemory, type Activity, type Participant } from './plans-repository.js';
import type { Lesson } from './types.js';

export const demoActivities: Activity[] = [];
export const demoPlanUsages: PlanUsage[] = [];
export const demoActivityLessons: Lesson[] = [];
const periodStart = `${demoToday.slice(0, 7)}-01`;
function fixture(code: string, activityType: ActivityInput['activityType'], dayOffset: number, hour: number, riders: string[], enrollmentId?: string) {
  const date = addDays(demoToday, -dayOffset) < periodStart ? periodStart : addDays(demoToday, -dayOffset);
  const startTime = `${String(hour).padStart(2, '0')}:00`;
  const endMinutes = hour * 60 + activityDuration[activityType];
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
  const mounted = ['GROUP_LESSON', 'PRIVATE_LESSON', 'PRACTICE_RIDE', 'ASSESSMENT'].includes(activityType);
  const participants: Participant[] = riders.map((riderId, index) => {
    const source = enrollmentId && index === 0 ? planMemory.enrollments.find(({ id }) => id === enrollmentId) : undefined;
    const plan = demoPlans.find((plan) => source ? plan.id === source.planId : plan.entitlements.length === 0 && plan.activityTypes.includes(activityType))!;
    const entitlement = source && plan.entitlements.find((entry) => entry.activityTypes.includes(activityType));
    const participant: Participant = { id: `participant-demo-${code}-${index}`, bookingId: `activity-demo-${code}`, riderId,
      horseId: mounted ? ({ 'rider-emma': 'horse-jasper', 'rider-noah': 'horse-willow', 'rider-olivia': 'horse-atlas' }[riderId]) : null,
      lessonId: mounted ? `lesson-activity-demo-${code}-${index}` : null, planId: plan.id, publishedPriceCents: plan.priceCents,
      amountCents: source ? 0 : plan.priceCents, hstIncluded: true, paymentMethodRule: plan.paymentMethodRule, paymentInstructions: plan.paymentInstructions,
      enrollmentId: source?.id, entitlementId: entitlement ? entitlement.id : undefined, overrideReason: '', relationshipOverrideReason: '' };
    if (source && entitlement) demoPlanUsages.push({ id: `usage-demo-${code}-${index}`, participantId: participant.id, enrollmentId: source.id, entitlementId: entitlement.id, serviceDate: date, quantity: 1, status: 'USED', overrideReason: '' });
    if (mounted) demoActivityLessons.push({ id: participant.lessonId!, activityId: participant.bookingId, date, startTime, endTime, riderId, horseId: participant.horseId!,
      coachId: activityType === 'PRACTICE_RIDE' ? null : 'coach-sarah', lessonType: activityType === 'GROUP_LESSON' ? 'GROUP' : activityType === 'PRACTICE_RIDE' ? 'PART_BOARD_RIDE' : 'PRIVATE',
      discipline: 'FLAT', rideUnits: 0.25, status: 'COMPLETED', consumeEntitlement: false, notes: 'Fictional Iteration 5 activity.', createdAt: demoTimestamp, updatedAt: demoTimestamp });
    return participant;
  });
  demoActivities.push({ id: `activity-demo-${code}`, version: 1, activityType, date, startTime, endTime, coachId: activityType === 'PRACTICE_RIDE' ? null : 'coach-sarah', status: 'COMPLETED',
    discipline: 'FLAT', rideUnits: 0.25, notes: 'Fictional Iteration 5 activity.', location: '', cancellationAction: 'RETAIN', participants });
}
for (let index = 1; index <= 3; index++) fixture(`emma-group-${index}`, 'GROUP_LESSON', index * 2, 16 + index, ['rider-emma', 'rider-noah', 'rider-olivia'], 'enrollment-emma');
// Olivia's first group booking uses her own monthly entitlement.
const oliviaParticipant = demoActivities[0].participants[2];
oliviaParticipant.enrollmentId = 'enrollment-olivia'; oliviaParticipant.entitlementId = 'entitlement-monthly-group-lesson'; oliviaParticipant.amountCents = 0;
oliviaParticipant.planId = 'plan-monthly-group'; oliviaParticipant.publishedPriceCents = 21500;
demoPlanUsages.push({ id: 'usage-demo-olivia-group', participantId: oliviaParticipant.id, enrollmentId: 'enrollment-olivia', entitlementId: 'entitlement-monthly-group-lesson', serviceDate: demoActivities[0].date, quantity: 1, status: 'USED', overrideReason: '' });
for (let index = 1; index <= 2; index++) fixture(`emma-practice-${index}`, 'PRACTICE_RIDE', index, 20, ['rider-emma'], 'enrollment-emma');
for (let index = 1; index <= 4; index++) fixture(`noah-private-${index}`, 'PRIVATE_LESSON', index, 15, ['rider-noah'], 'enrollment-noah');
fixture('assessment', 'ASSESSMENT', 0, 16, ['rider-olivia']);
fixture('grooming', 'GROOMING_TACKING', 0, 18, ['rider-noah']);
fixture('individual', 'PRIVATE_LESSON', 0, 17, ['rider-olivia']);

export function initializePlanDemo() {
  planMemory.activities = structuredClone(demoActivities);
  planMemory.usages = structuredClone(demoPlanUsages);
  for (const lesson of demoActivityLessons) if (!store.lessons.some(({ id }) => id === lesson.id)) store.lessons.push(structuredClone(lesson));
}
