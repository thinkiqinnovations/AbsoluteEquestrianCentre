import { z } from 'zod';

export const riderLevels = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] as const;
export const lessonTypes = ['PRIVATE', 'GROUP', 'PART_BOARD_RIDE'] as const;
export const disciplines = ['FLAT', 'JUMP'] as const;
export const lessonStatuses = ['DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;

export type RiderLevel = (typeof riderLevels)[number];
export type LessonType = (typeof lessonTypes)[number];
export type Discipline = (typeof disciplines)[number];
export type LessonStatus = (typeof lessonStatuses)[number];

export const WORKLOAD_THRESHOLDS = { normal: 0.75, warning: 1 } as const;
export const RIDER_LEVEL_RANK: Record<RiderLevel, number> = {
  BEGINNER: 1,
  INTERMEDIATE: 2,
  ADVANCED: 3,
};

const optionalText = z.string().trim().max(2000).optional().or(z.literal(''));

export const horseSchema = z.object({
  name: z.string().trim().min(1).max(100),
  active: z.boolean().default(true),
  description: optionalText,
  walkCapable: z.boolean().default(true),
  trotCapable: z.boolean().default(true),
  canterCapable: z.boolean().default(false),
  supportsFlat: z.boolean().default(true),
  supportsJumping: z.boolean().default(false),
  minimumRiderLevel: z.enum(riderLevels),
  maximumRiderLevel: z.enum(riderLevels),
  maximumDailyRideUnits: z.coerce.number().positive().max(10).default(1.5),
  notes: optionalText,
}).refine((value) => RIDER_LEVEL_RANK[value.minimumRiderLevel] <= RIDER_LEVEL_RANK[value.maximumRiderLevel], {
  message: 'Minimum rider level cannot exceed maximum rider level.',
  path: ['maximumRiderLevel'],
});

export const riderSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  active: z.boolean().default(true),
  overallLevel: z.enum(riderLevels),
  flatLevel: z.enum(riderLevels),
  jumpLevel: z.enum(riderLevels),
  notes: optionalText,
  preferences: z.array(z.object({ horseId: z.string().min(1), notes: optionalText })).default([]),
});

export const coachSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  active: z.boolean().default(true),
  notes: optionalText,
});

export const lessonSchema = z.object({
  date: z.string().date(),
  startTime: z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/, 'Use HH:mm time.'),
  endTime: z.string().regex(/^([01]\\d|2[0-3]):[0-5]\\d$/, 'Use HH:mm time.'),
  riderId: z.string().min(1),
  horseId: z.string().min(1),
  coachId: z.string().min(1),
  lessonType: z.enum(lessonTypes),
  discipline: z.enum(disciplines),
  rideUnits: z.coerce.number().positive().max(10),
  status: z.enum(lessonStatuses),
  notes: optionalText,
}).refine((value) => value.startTime < value.endTime, { message: 'End time must be after start time.', path: ['endTime'] });

export type HorseInput = z.infer<typeof horseSchema>;
export type RiderInput = z.infer<typeof riderSchema>;
export type CoachInput = z.infer<typeof coachSchema>;
export type LessonInput = z.infer<typeof lessonSchema>;
