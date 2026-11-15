import { WORKLOAD_THRESHOLDS, type AvailabilityRecords, type LessonInput } from '@absolute/shared';
import type { SchedulerSnapshot } from './database.js';
import { findConflicts } from './conflicts.js';
import { evaluateAvailability } from './availability.js';
import type { Conflict } from './types.js';

export function validateLesson(candidate: LessonInput, snapshot: SchedulerSnapshot, records: AvailabilityRecords, ignoredId?: string, allowUnselectedCoach = false) {
  const conflicts = findConflicts(candidate, snapshot, ignoredId, allowUnselectedCoach);
  if (candidate.status === 'CANCELLED') return conflicts.filter(({ code }) => code === 'REFERENCE_NOT_FOUND');
  if (conflicts.some(({ code }) => code === 'REFERENCE_NOT_FOUND')) return conflicts;
  const rider = snapshot.riders.find(({ id }) => id === candidate.riderId)!;
  const horse = snapshot.horses.find(({ id }) => id === candidate.horseId)!;
  const coach = snapshot.coaches.find(({ id }) => id === candidate.coachId);
  const resources = [
    { resourceType: 'RIDER', resourceId: rider.id, name: `${rider.firstName} ${rider.lastName}` },
    { resourceType: 'HORSE', resourceId: horse.id, name: horse.name },
    ...(coach ? [{ resourceType: 'COACH' as const, resourceId: coach.id, name: `${coach.firstName} ${coach.lastName}` }] : []),
  ] as const;
  for (const resource of resources) {
    const { status, reason } = evaluateAvailability(records, resource, candidate.date, candidate);
    if (status === 'AVAILABLE') continue;
    const conflict: Conflict = status === 'UNSPECIFIED'
      ? { code: `${resource.resourceType}_AVAILABILITY_UNSPECIFIED`, severity: 'WARNING', message: `Availability has not been configured for ${resource.name} during this time.` }
      : { code: `${resource.resourceType}_UNAVAILABLE`, severity: 'ERROR', message: `${resource.name} is unavailable for ${candidate.startTime}–${candidate.endTime} on ${candidate.date}${reason ? ` (${reason.toLowerCase().replaceAll('_', ' ')})` : ''}.` };
    conflicts.push(conflict);
  }
  return conflicts;
}

export function dailySchedule(date: string, snapshot: SchedulerSnapshot, records: AvailabilityRecords) {
  const lessons = snapshot.lessons.filter((lesson) => lesson.date === date).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const enriched = lessons.map((lesson) => ({
    ...lesson,
    rider: snapshot.riders.find(({ id }) => id === lesson.riderId),
    horse: snapshot.horses.find(({ id }) => id === lesson.horseId),
    coach: snapshot.coaches.find(({ id }) => id === lesson.coachId),
  }));
  const workloads = snapshot.horses.map((horse) => ({
    horse,
    usedUnits: lessons.filter((lesson) => lesson.horseId === horse.id && lesson.status !== 'CANCELLED').reduce((sum, lesson) => sum + lesson.rideUnits, 0),
  })).filter(({ usedUnits }) => usedUnits > 0);
  const conflicts = lessons.flatMap((lesson) =>
    validateLesson(lesson, snapshot, records, lesson.id).map((conflict) => ({ ...conflict, lessonId: lesson.id, date })));
  return {
    date, lessons: enriched, workloads, conflicts,
    summary: {
      lessons: lessons.length,
      activeHorses: snapshot.horses.filter(({ active }) => active).length,
      activeCoaches: snapshot.coaches.filter(({ active }) => active).length,
      nearWorkloadLimit: workloads.filter(({ horse, usedUnits }) => usedUnits / horse.maximumDailyRideUnits >= WORKLOAD_THRESHOLDS.normal).length,
      conflicts: conflicts.length,
    },
  };
}
