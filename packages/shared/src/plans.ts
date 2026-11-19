import { z } from 'zod';
import { dateSchema, intervalSchema, ordered } from './scheduling.js';

export const activityTypes = ['ASSESSMENT', 'GROUP_LESSON', 'SEMI_PRIVATE_LESSON', 'PRIVATE_LESSON', 'PRACTICE_RIDE', 'GROOMING_TACKING', 'BIRTHDAY_PARTY', 'SEASONAL_CAMP'] as const;
export type ActivityType = typeof activityTypes[number];
export const activityLabels: Record<ActivityType, string> = {
  ASSESSMENT: 'Assessment', GROUP_LESSON: 'Group Lesson', SEMI_PRIVATE_LESSON: 'Semi-Private Lesson',
  PRIVATE_LESSON: 'Private Lesson', PRACTICE_RIDE: 'Practice Ride', GROOMING_TACKING: 'Grooming & Tacking',
  BIRTHDAY_PARTY: 'Birthday Party', SEASONAL_CAMP: 'Seasonal Camp',
};
export const activityDuration: Record<ActivityType, number> = {
  ASSESSMENT: 30, GROUP_LESSON: 60, SEMI_PRIVATE_LESSON: 30, PRIVATE_LESSON: 30,
  PRACTICE_RIDE: 60, GROOMING_TACKING: 90, BIRTHDAY_PARTY: 120, SEASONAL_CAMP: 480,
};
export const enrollmentSchema = z.object({
  riderId: z.string().min(1), planId: z.string().min(1), agreementId: z.string().nullish(),
  startDate: dateSchema, endDate: dateSchema.nullable().default(null),
  status: z.enum(['ACTIVE', 'PAUSED', 'ENDED']).default('ACTIVE'), notes: z.string().max(2000).default(''),
}).refine((entry) => !entry.endDate || entry.endDate >= entry.startDate, 'End date must be on or after start date.');
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;
export const activitySchema = z.object({
  activityType: z.enum(activityTypes), date: dateSchema, endDate: dateSchema.nullish(), ...intervalSchema.shape,
  coachId: z.string().min(1).nullish(), location: z.string().max(100).default(''),
  capacity: z.number().int().positive().max(100).nullish(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED']),
  discipline: z.enum(['FLAT', 'JUMP']).default('FLAT'), rideUnits: z.number().min(0.25).max(10).default(0.5),
  notes: z.string().max(2000).default(''), version: z.number().int().positive().optional(),
  cancellationAction: z.enum(['RETAIN', 'RESTORE']).default('RETAIN'),
  participants: z.array(z.object({
    riderId: z.string().min(1), horseId: z.string().min(1).nullish(),
    enrollmentId: z.string().min(1).nullish(), entitlementId: z.string().min(1).nullish(),
    overrideReason: z.string().trim().max(2000).default(''),
    relationshipOverrideReason: z.string().trim().max(2000).default(''),
  })).min(1).max(100),
}).superRefine((entry, context) => {
  const issue = (message: string) => context.addIssue({ code: 'custom', message });
  if (!ordered(entry)) issue('End time must be after start time.');
  if (entry.endDate && entry.endDate < entry.date) issue('End date must be on or after start date.');
  if (entry.activityType !== 'SEASONAL_CAMP' && entry.endDate && entry.endDate !== entry.date) issue('Only camps can span multiple days.');
  if (new Set(entry.participants.map(({ riderId }) => riderId)).size !== entry.participants.length) issue('Select each rider once.');
  const count = entry.participants.length;
  if (['PRIVATE_LESSON', 'ASSESSMENT', 'PRACTICE_RIDE'].includes(entry.activityType) && count !== 1) issue('This activity requires exactly one rider.');
  if (entry.activityType === 'SEMI_PRIVATE_LESSON' && count !== 2) issue('Semi-private lessons require exactly two riders.');
  if (entry.activityType === 'GROUP_LESSON' && (count < 3 || count > 6)) issue('Group lessons require three to six riders.');
  if (entry.capacity && count > entry.capacity) issue('Activity capacity exceeded.');
  for (const participant of entry.participants) {
    if (Boolean(participant.enrollmentId) !== Boolean(participant.entitlementId)) issue('Select both an enrollment and its entitlement.');
  }
});
export type ActivityInput = z.infer<typeof activitySchema>;
export type PlanEntitlement = { id: string; planId: string; name: string; activityTypes: string[]; quantity: number; period: string };
export type Plan = {
  id: string; code: string; name: string; category: string; description: string; priceCents: number;
  pricePeriod: string; hstIncluded: boolean; active: boolean; effectiveFrom: string; effectiveTo: string | null;
  sortOrder: number; durationMinutes: number | null; includedQuantity: number | null; additionalUnitPriceCents: number | null;
  paymentMethodRule: string; paymentInstructions: string; daysPerWeek: number | null; activityTypes: string[];
  entitlements: PlanEntitlement[];
};
export type Enrollment = EnrollmentInput & { id: string };
export type PlanUsage = { id: string; participantId: string; enrollmentId: string; entitlementId: string; serviceDate: string; quantity: number; status: 'USED' | 'CANCELLED' | 'RESTORED'; overrideReason: string };
export type EntitlementBalance = PlanEntitlement & { allocated: number; used: number; remaining: number; periodStart: string; periodEnd: string };
export type EnrollmentDetails = Enrollment & { plan: Plan; effective: boolean; entitlements: EntitlementBalance[] };
export const money = (cents: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
export const planPrice = (plan: Plan) => `${money(plan.priceCents)}${plan.pricePeriod === 'MONTHLY' ? '/month' : plan.pricePeriod === 'WEEKLY' ? '/week' : ''}`;
