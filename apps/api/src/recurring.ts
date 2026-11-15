import { addDays, dateSchema, lessonSchema, recurringStatuses, schedulingPriority, weekday, weekdays, type LessonInput } from '@absolute/shared';
import { z } from 'zod';

export const recurringSchema = z.object({
  lesson: lessonSchema,
  startDate: dateSchema,
  endDate: dateSchema.nullable(),
  dayOfWeek: z.enum(weekdays),
  status: z.enum(recurringStatuses),
  schedulingPriority: z.number().int().min(1).max(1000).optional(),
  partBoardAgreementId: z.string().min(1).nullish(),
}).refine(({ startDate, endDate }) => !endDate || startDate <= endDate, 'End date must be on or after the start date.');
export type TemplateInput = z.infer<typeof recurringSchema>;
export type Template = TemplateInput & { id: string; schedulingPriority: number };

export const defaultPriority = (type: LessonInput['lessonType']) => type === 'PART_BOARD_RIDE'
  ? schedulingPriority.partBoardRecurring : schedulingPriority.recurringLesson;

export const compareTemplatePriority = (first: Template, second: Template) =>
  second.schedulingPriority - first.schedulingPriority || first.startDate.localeCompare(second.startDate);

export function occurrenceDates(template: Template, today: string, weeks: number) {
  if (template.status !== 'ACTIVE') return [];
  const horizon = addDays(today, weeks * 7);
  const dates: string[] = [];
  for (let date = template.startDate > today ? template.startDate : today;
    date < horizon && (!template.endDate || date <= template.endDate); date = addDays(date, 1)) {
    if (weekday(date) === template.dayOfWeek) dates.push(date);
  }
  return dates;
}
