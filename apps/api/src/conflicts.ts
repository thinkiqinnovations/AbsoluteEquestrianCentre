import { RIDER_LEVEL_RANK, WORKLOAD_THRESHOLDS, type LessonInput } from '@absolute/shared';
import type { Coach, Conflict, Horse, Lesson, Rider } from './types.js';

type Context = { horses: Horse[]; riders: Rider[]; coaches: Coach[]; lessons: Lesson[] };
const overlaps = (a: LessonInput, b: LessonInput) => a.startTime < b.endTime && b.startTime < a.endTime;
const active = (lesson: Lesson) => lesson.status !== 'CANCELLED';

export function findConflicts(candidate: LessonInput, context: Context, ignoredLessonId?: string): Conflict[] {
  const horse = context.horses.find((item) => item.id === candidate.horseId);
  const rider = context.riders.find((item) => item.id === candidate.riderId);
  const coach = context.coaches.find((item) => item.id === candidate.coachId);
  const conflicts: Conflict[] = [];
  if (!horse || !rider || !coach) return [{ code: 'REFERENCE_NOT_FOUND', severity: 'ERROR', message: 'Rider, horse, or coach was not found.' }];
  const sameDay = context.lessons.filter((lesson) => lesson.id !== ignoredLessonId && lesson.date === candidate.date && active(lesson));
  const doubleBooked = (field: 'horseId' | 'riderId' | 'coachId', code: string, subject: string) => {
    if (sameDay.some((lesson) => lesson[field] === candidate[field] && overlaps(candidate, lesson))) conflicts.push({ code, severity: 'ERROR', message: `${subject} is already assigned during this time.` });
  };
  doubleBooked('horseId', 'HORSE_DOUBLE_BOOKED', horse.name);
  doubleBooked('riderId', 'RIDER_DOUBLE_BOOKED', `${rider.firstName} ${rider.lastName}`);
  doubleBooked('coachId', 'COACH_DOUBLE_BOOKED', `${coach.firstName} ${coach.lastName}`);
  const level = candidate.discipline === 'JUMP' ? rider.jumpLevel : rider.flatLevel;
  if (RIDER_LEVEL_RANK[level] < RIDER_LEVEL_RANK[horse.minimumRiderLevel] || RIDER_LEVEL_RANK[level] > RIDER_LEVEL_RANK[horse.maximumRiderLevel]) conflicts.push({ code: 'RIDER_LEVEL_INCOMPATIBLE', severity: 'ERROR', message: `${rider.firstName}'s ${candidate.discipline.toLowerCase()} level is outside ${horse.name}'s supported rider level range.` });
  if (candidate.discipline === 'JUMP' && !horse.supportsJumping) conflicts.push({ code: 'HORSE_NOT_JUMP_CAPABLE', severity: 'ERROR', message: `${horse.name} does not support jumping.` });
  const total = sameDay.filter((lesson) => lesson.horseId === horse.id).reduce((sum, lesson) => sum + lesson.rideUnits, candidate.rideUnits);
  const ratio = total / horse.maximumDailyRideUnits;
  if (ratio > WORKLOAD_THRESHOLDS.warning) conflicts.push({ code: 'HORSE_WORKLOAD_EXCEEDED', severity: 'ERROR', message: `${horse.name} would exceed its daily workload limit (${total} / ${horse.maximumDailyRideUnits} units).` });
  else if (ratio >= WORKLOAD_THRESHOLDS.normal) conflicts.push({ code: 'HORSE_WORKLOAD_WARNING', severity: 'WARNING', message: `${horse.name} is approaching today's workload limit (${total} / ${horse.maximumDailyRideUnits} units).` });
  return conflicts;
}
