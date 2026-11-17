import { RIDER_LEVEL_RANK, WORKLOAD_THRESHOLDS, type LessonInput } from '@absolute/shared';
import type { Coach, Conflict, Horse, Lesson, Rider } from './types.js';
import { overlaps } from './intervals.js';

type Context = { horses: Horse[]; riders: Rider[]; coaches: Coach[]; lessons: Lesson[]; reservations?: Lesson[] };
const active = (lesson: Lesson) => lesson.status !== 'CANCELLED';

export function horseWorkload(horse: Horse, candidate: LessonInput, lessons: Lesson[], ignoredLessonId?: string) {
  const current = lessons.filter((lesson) => lesson.date === candidate.date && lesson.horseId === horse.id &&
    lesson.id !== ignoredLessonId && active(lesson)).reduce((sum, lesson) => sum + lesson.rideUnits, 0);
  return { current, proposed: candidate.rideUnits, projected: current + candidate.rideUnits, maximum: horse.maximumDailyRideUnits };
}

export function findConflicts(candidate: LessonInput, context: Context, ignoredLessonId?: string, allowUnselectedCoach = false): Conflict[] {
  const horse = context.horses.find((item) => item.id === candidate.horseId);
  const rider = context.riders.find((item) => item.id === candidate.riderId);
  const coach = context.coaches.find((item) => item.id === candidate.coachId);
  const conflicts: Conflict[] = [];
  if (!horse || !rider || (!coach && (candidate.coachId || (!allowUnselectedCoach && candidate.lessonType !== 'PART_BOARD_RIDE')))) return [{ code: 'REFERENCE_NOT_FOUND', severity: 'ERROR', message: 'Rider, horse, or coach was not found.' }];
  if (!horse.active) conflicts.push({ code: 'HORSE_INACTIVE', severity: 'ERROR', message: `${horse.name} is inactive.` });
  const sameDay = [...context.lessons, ...(context.reservations ?? [])].filter((lesson) => lesson.id !== ignoredLessonId && lesson.date === candidate.date && active(lesson));
  const doubleBooked = (field: 'horseId' | 'riderId', code: string, subject: string) => {
    if (sameDay.some((lesson) => lesson[field] === candidate[field] && overlaps(candidate, lesson))) conflicts.push({ code, severity: 'ERROR', message: `${subject} is already assigned during this time.` });
  };
  doubleBooked('horseId', 'HORSE_DOUBLE_BOOKED', horse.name);
  doubleBooked('riderId', 'RIDER_DOUBLE_BOOKED', `${rider.firstName} ${rider.lastName}`);
  const coachName = coach ? `${coach.firstName} ${coach.lastName}` : '';
  const coachBookings = coach ? sameDay.filter((lesson) => lesson.coachId === coach.id && overlaps(candidate, lesson)) : [];
  const shared = candidate.lessonType === 'SEMI_PRIVATE' || candidate.lessonType === 'GROUP';
  const differentSession = coachBookings.some((lesson) => !shared
    || lesson.lessonType !== candidate.lessonType || lesson.discipline !== candidate.discipline
    || lesson.startTime !== candidate.startTime || lesson.endTime !== candidate.endTime);
  if (differentSession) {
    conflicts.push({ code: 'COACH_DOUBLE_BOOKED', severity: 'ERROR', message: `${coachName} is already assigned to another session during this time.` });
  } else if (candidate.lessonType === 'SEMI_PRIVATE' && coachBookings.length >= 2) {
    conflicts.push({ code: 'SEMI_PRIVATE_FULL', severity: 'ERROR', message: 'This semi-private session already has two riders.' });
  }
  const level = candidate.discipline === 'JUMP' ? rider.jumpLevel : rider.flatLevel;
  if (RIDER_LEVEL_RANK[level] < RIDER_LEVEL_RANK[horse.minimumRiderLevel] || RIDER_LEVEL_RANK[level] > RIDER_LEVEL_RANK[horse.maximumRiderLevel]) conflicts.push({ code: 'RIDER_LEVEL_INCOMPATIBLE', severity: 'ERROR', message: `${rider.firstName}'s ${candidate.discipline.toLowerCase()} level is outside ${horse.name}'s supported rider level range.` });
  if (candidate.discipline === 'JUMP' && !horse.supportsJumping) conflicts.push({ code: 'HORSE_NOT_JUMP_CAPABLE', severity: 'ERROR', message: `${horse.name} does not support jumping.` });
  if (candidate.discipline === 'FLAT' && !horse.supportsFlat) conflicts.push({ code: 'FLAT_NOT_SUPPORTED', severity: 'ERROR', message: `${horse.name} does not support flat lessons.` });
  const total = horseWorkload(horse, candidate, sameDay).projected;
  const ratio = total / horse.maximumDailyRideUnits;
  if (ratio > WORKLOAD_THRESHOLDS.warning) conflicts.push({ code: 'HORSE_WORKLOAD_EXCEEDED', severity: 'ERROR', message: `${horse.name} would exceed its daily workload limit (${total} / ${horse.maximumDailyRideUnits} units).` });
  else if (ratio >= WORKLOAD_THRESHOLDS.normal) conflicts.push({ code: 'HORSE_WORKLOAD_WARNING', severity: 'WARNING', message: `${horse.name} is approaching today's workload limit (${total} / ${horse.maximumDailyRideUnits} units).` });
  return conflicts;
}
