import { z } from 'zod';
import { dateSchema, intervalSchema, ordered, weekdays } from './scheduling.js';

export const agreementStatuses = ['ACTIVE', 'PAUSED', 'ENDED', 'CANCELLED'] as const;
export const entitlementPeriods = ['WEEK', 'MONTH'] as const;
export const recurringStatuses = ['ACTIVE', 'PAUSED', 'ENDED'] as const;
export const schedulingPriority = { partBoardRecurring: 100, recurringLesson: 80, standardLesson: 50, flexibleRequest: 25 };
const preference = intervalSchema.extend({
  dayOfWeek: z.enum(weekdays), preferenceRank: z.number().int().positive(), notes: z.string().max(2000).optional(),
}).refine(ordered, 'End time must be after start time.');
export const agreementSchema = z.object({
  riderId: z.string().min(1),
  horseId: z.string().min(1),
  status: z.enum(agreementStatuses).default('ACTIVE'),
  startDate: dateSchema,
  endDate: dateSchema.nullable().default(null),
  priority: z.number().int().min(1).max(1000).default(schedulingPriority.partBoardRecurring),
  freeRidesPerPeriod: z.number().int().min(0).max(1000),
  entitlementPeriod: z.enum(entitlementPeriods),
  notes: z.string().max(2000).optional(),
  preferredRideTimes: z.array(preference).max(50).default([]),
}).refine((value) => !value.endDate || value.startDate <= value.endDate, 'End date must be on or after the start date.')
  .refine(({ preferredRideTimes }) => new Set(preferredRideTimes.map((entry) => entry.preferenceRank)).size === preferredRideTimes.length, 'Preference ranks must be unique.');
export type AgreementInput = z.infer<typeof agreementSchema>;
export type EntitlementSummary = { period: AgreementInput['entitlementPeriod']; periodStart: string; periodEnd: string; allowed: number; used: number; remaining: number };
export type Agreement = AgreementInput & { id: string };
export type AgreementDetails = Agreement & {
  riderName: string;
  horseName: string;
  effective: boolean;
  entitlement: EntitlementSummary;
  nextPreferredWindow: (AgreementInput['preferredRideTimes'][number] & { date: string }) | null;
};
