import { z } from 'zod';

export const defaultTimeZone = 'America/Toronto';
export const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'] as const;
export const resources = ['RIDER', 'COACH', 'HORSE'] as const;
export const availabilityTypes = ['AVAILABLE', 'UNAVAILABLE'] as const;
export const overrideReasons = ['PERSONAL', 'VET', 'FARRIER', 'REST', 'COMPETITION', 'SCHOOL_EVENT', 'OTHER'] as const;
export const dateSchema = z.string().date();
export const timeSchema = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Use HH:mm time.');
export const resourceSchema = z.object({ resourceType: z.enum(resources), resourceId: z.string().min(1) });
export const intervalSchema = z.object({ startTime: timeSchema, endTime: timeSchema });
export type Interval = z.infer<typeof intervalSchema>;
export const ordered = ({ startTime, endTime }: Interval) => startTime < endTime;
const fields = intervalSchema.extend({
  availabilityType: z.enum(availabilityTypes),
  notes: z.string().trim().max(2000).nullish(),
});
export const ruleFields = fields.extend({ dayOfWeek: z.enum(weekdays) });
export const coachWeeklyAvailabilitySchema = z.array(
  intervalSchema.extend({ dayOfWeek: z.enum(weekdays) }).refine(ordered, 'End time must be after start time.'),
).max(7).refine((entries) => new Set(entries.map(({ dayOfWeek }) => dayOfWeek)).size === entries.length, 'Select each weekday once.');
export type CoachWeeklyAvailability = z.infer<typeof coachWeeklyAvailabilitySchema>;
export const overrideFields = fields.extend({ date: dateSchema, reason: z.enum(overrideReasons).nullish() });
export const ruleSchema = ruleFields.merge(resourceSchema).refine(ordered, 'End time must be after start time.');
export const overrideSchema = overrideFields.merge(resourceSchema).refine(ordered, 'End time must be after start time.');
export type Resource = z.infer<typeof resourceSchema>;
export type RuleInput = z.infer<typeof ruleSchema>;
export type OverrideInput = z.infer<typeof overrideSchema>;
type RecordMetadata = { id: string; createdAt: string; updatedAt: string };
export type AvailabilityRule = RuleInput & RecordMetadata;
export type AvailabilityOverride = OverrideInput & RecordMetadata;
export type AvailabilityRecords = { rules: AvailabilityRule[]; overrides: AvailabilityOverride[] };
export type AvailabilityStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'UNSPECIFIED';
export type AvailabilityResult = {
  status: AvailabilityStatus;
  source: 'RECURRING' | 'OVERRIDE' | 'NONE';
  reason?: string;
};

// Stored dates are barn-local calendar dates. UTC is used only for civil date arithmetic.
export const civilDate = (date: string) => new Date(`${date}T00:00:00.000Z`);
export const dateValue = (date: Date) => date.toISOString().slice(0, 10);
export function addDays(date: string, amount: number) {
  const day = civilDate(date);
  day.setUTCDate(day.getUTCDate() + amount);
  return dateValue(day);
}
export const weekday = (date: string) => weekdays[(civilDate(date).getUTCDay() + 6) % 7];
export const monday = (date: string) => addDays(date, -weekdays.indexOf(weekday(date)));
export const weekDates = (start: string) => Array.from({ length: 7 }, (_, index) => addDays(start, index));
export function barnToday(timeZone = defaultTimeZone, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}
export const weekStartSchema = dateSchema.refine((date) => weekday(date) === 'MONDAY', 'Week start must be a Monday.');
export const operatingHours = { start: 8, end: 21 };

export function monthRange(year: number, month: number) {
  const start = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
  const next = civilDate(start);
  next.setUTCMonth(next.getUTCMonth() + 1);
  next.setUTCDate(0);
  return { year, month, start, end: dateValue(next), dates: Array.from({ length: next.getUTCDate() }, (_, index) => addDays(start, index)) };
}

export function shiftMonth(date: string, amount: number) {
  const first = civilDate(date.slice(0, 7) + '-01');
  first.setUTCMonth(first.getUTCMonth() + amount);
  const range = monthRange(first.getUTCFullYear(), first.getUTCMonth() + 1);
  return range.dates[Math.min(Number(date.slice(8)), range.dates.length) - 1];
}
