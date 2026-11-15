import { addDays, barnToday, weekday, type AvailabilityRecords, type HorseRecommendation, type HorseRecommendationRequest,
  type HorseRecommendationResult, type IneligibleHorse, type LessonInput } from '@absolute/shared';
import { horseWorkload } from './conflicts.js';
import { HORSE_RECOMMENDATION_RULESET_VERSION, recommendationConfig as config } from './horse-recommendation-config.js';
import type { SchedulerSnapshot } from './database.js';
import { effectiveOn } from './part-board.js';
import { completedPartBoardConflict, partBoardEligibility, partBoardPriority, priorityContext, type PriorityContext } from './planning-service.js';
import type { PlanningRepository } from './planning-repository.js';
import { validateLesson } from './schedule.js';
import type { Lesson } from './types.js';
import { appTimeZone } from './time-zone.js';

type Context = {
  snapshot: SchedulerSnapshot;
  records: AvailabilityRecords;
  history: Lesson[];
  priority: PriorityContext;
  existing?: Lesson;
};
const byName = new Intl.Collator('en-CA', { sensitivity: 'base' });
const compareText = (first: string, second: string) => first < second ? -1 : first > second ? 1 : 0;
const displayOrder = (a: { horseName: string; horseId: string }, b: { horseName: string; horseId: string }) =>
  byName.compare(a.horseName, b.horseName) || compareText(a.horseId, b.horseId);

export function recommendHorses(request: HorseRecommendationRequest, { snapshot, records, history, priority, existing }: Context) {
  const rider = snapshot.riders.find(({ id }) => id === request.riderId);
  if (!rider) throw new Error('Recommendation requires an existing rider.');
  const partBoard = request.lessonType === 'PART_BOARD_RIDE';
  const historical = existing?.status === 'COMPLETED' && existing.lessonType === 'PART_BOARD_RIDE';
  const historyStart = addDays(request.date, -config.historyDays);
  const previous = history.filter((lesson) => lesson.id !== existing?.id && lesson.riderId === rider.id &&
    (lesson.status === 'CONFIRMED' || lesson.status === 'COMPLETED') && lesson.date >= historyStart &&
    (lesson.date < request.date || (lesson.date === request.date && lesson.endTime <= request.startTime)))
    .sort((a, b) => b.date.localeCompare(a.date) || b.endTime.localeCompare(a.endTime) || compareText(a.id, b.id));
  const preferences = new Map(rider.preferences.map(({ horseId, preferenceOrder }) => [horseId, preferenceOrder]));
  const recommendations: HorseRecommendation[] = [];
  const ineligible: IneligibleHorse[] = [];

  for (const horse of snapshot.horses) {
    const { excludeLessonId, ...details } = request;
    const candidate: LessonInput = { ...details, horseId: horse.id, status: historical ? 'COMPLETED' : 'CONFIRMED',
      consumeEntitlement: details.consumeEntitlement ?? (historical ? existing.consumeEntitlement : undefined) };
    const excluded = existing?.id ?? excludeLessonId;
    const conflicts = validateLesson(candidate, snapshot, records, excluded, true);
    const linked = priority.agreements.find((agreement) => agreement.riderId === rider.id && agreement.horseId === horse.id && effectiveOn(agreement, request.date));
    if (historical) {
      const conflict = completedPartBoardConflict(candidate, existing);
      if (conflict) conflicts.push(conflict);
    } else if (partBoard) {
      const { conflict } = partBoardEligibility(candidate, priority.agreements, priority.usage, excluded);
      if (conflict) conflicts.push(conflict);
    } else {
      const conflict = partBoardPriority(candidate, snapshot, records, priority, existing);
      if (conflict) conflicts.push(conflict);
    }
    const reasons = conflicts.filter(({ severity }) => severity === 'ERROR').map(({ code, message }) => ({ code, description: message }));
    const warnings = conflicts.filter(({ severity }) => severity === 'WARNING').map(({ code, message }) => ({ code, description: message }));
    const result = { horseId: horse.id, horseName: horse.name, warnings };
    const workload = horseWorkload(horse, candidate, snapshot.lessons, excluded);
    const utilization = workload.projected / workload.maximum;
    const contributions: HorseRecommendation['reasons'] = [];
    const add = (code: string, impact: number, description: string) => contributions.push({ code, impact, description });
    const rank = preferences.get(horse.id);
    if (rank !== undefined) {
      add(['FIRST_PREFERENCE', 'SECOND_PREFERENCE', 'THIRD_PREFERENCE'][rank - 1] ?? 'ADDITIONAL_PREFERENCE',
        config.preference[rank - 1] ?? config.additionalPreference, `Rider preference rank ${rank}.`);
    }
    if (linked) {
      add('ACTIVE_PART_BOARD_HORSE', config.partBoard, `${horse.name} is linked to this rider's active part-board agreement.`);
      if (partBoard && linked.preferredRideTimes.some((window) => window.dayOfWeek === weekday(request.date) &&
        window.startTime <= request.startTime && window.endTime >= request.endTime)) {
        add('PART_BOARD_PREFERRED_TIME', config.preferredPartBoardTime, 'The requested time fits a preferred part-board ride window.');
      }
    }
    const pairings = previous.filter((lesson) => lesson.horseId === horse.id).length;
    if (pairings) add('RECENT_PAIRING', config.recentPairing, `${pairings} prior ${pairings === 1 ? 'assignment' : 'assignments'} in the last ${config.historyDays} days.`);
    if (!partBoard && previous.length >= config.repetitionCount &&
      previous.slice(0, config.repetitionCount).every(({ horseId }) => horseId === horse.id)) {
      add('REPEATED_RECENT_ASSIGNMENT', config.repetition, `Same horse for the last ${config.repetitionCount} assignments.`);
    }
    if (utilization <= config.workload.lowThreshold) add('LOW_WORKLOAD', config.workload.low, 'Low projected workload.');
    else if (utilization < config.workload.nearThreshold) add('MODERATE_WORKLOAD', config.workload.moderate, 'Moderate projected workload.');
    else if (utilization > 1) add('ABOVE_CAPACITY', config.workload.atCapacity, 'Projected workload is above the daily limit.');
    else if (utilization === 1) add('AT_CAPACITY', config.workload.atCapacity, 'This ride would bring the horse to its daily limit.');
    else add('NEAR_CAPACITY', config.workload.near, 'Projected workload is near capacity.');

    const score = config.base + contributions.reduce((total, { impact }) => total + impact, 0);
    const scored = { ...result, workload, baseScore: config.base, score };
    if (reasons.length) ineligible.push({ ...scored, eligible: false, reasons, scoreReasons: contributions });
    else recommendations.push({ ...scored, eligible: true, rank: 0, reasons: contributions });
  }
  const preferenceRank = (horseId: string) => preferences.get(horseId) ?? Number.MAX_SAFE_INTEGER;
  recommendations.sort((a, b) => b.score - a.score || a.workload.projected / a.workload.maximum - b.workload.projected / b.workload.maximum ||
    preferenceRank(a.horseId) - preferenceRank(b.horseId) || displayOrder(a, b));
  return { recommendations: recommendations.map((horse, index) => ({ ...horse, rank: index + 1 })),
    ineligible: ineligible.sort((a, b) => b.score - a.score || displayOrder(a, b)) };
}

export async function evaluateHorseRecommendations(repository: PlanningRepository, request: HorseRecommendationRequest):
  Promise<HorseRecommendationResult | { missing: 'rider' | 'coach' | 'lesson' }> {
  const now = new Date();
  const today = barnToday(appTimeZone, now);
  const historyEnd = request.date < today ? request.date : today;
  const [snapshot, records, history, agreements, usage, existing] = await Promise.all([
    repository.scheduler.snapshot({ start: request.date, end: request.date }),
    repository.availability(),
    repository.scheduler.riderHistory(request.riderId, addDays(request.date, -config.historyDays), historyEnd),
    repository.agreements(), repository.usages(),
    request.excludeLessonId ? repository.scheduler.lesson(request.excludeLessonId) : undefined,
  ]);
  if (!snapshot.riders.some(({ id }) => id === request.riderId)) return { missing: 'rider' };
  if (request.coachId && !snapshot.coaches.some(({ id }) => id === request.coachId)) return { missing: 'coach' };
  if (request.excludeLessonId && !existing) return { missing: 'lesson' };
  const priority = request.lessonType === 'PART_BOARD_RIDE' ? { agreements, usage, templates: [] }
    : await priorityContext(repository, request.date, agreements, usage);
  return { ...recommendHorses(request, { snapshot, records, history, priority, existing }), riderId: request.riderId,
    request, rulesetVersion: HORSE_RECOMMENDATION_RULESET_VERSION, evaluatedAt: now.toISOString() };
}
