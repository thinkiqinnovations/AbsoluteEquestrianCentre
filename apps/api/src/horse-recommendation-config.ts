import { WORKLOAD_THRESHOLDS } from '@absolute/shared';
import { z } from 'zod';

export const HORSE_RECOMMENDATION_RULESET_VERSION = '1.1';
export const recommendationConfig = {
  base: 50,
  preference: [25, 15, 10],
  additionalPreference: 5,
  partBoard: 30,
  preferredPartBoardTime: 10,
  recentPairing: 8,
  repetition: -5,
  repetitionCount: 3,
  workload: { lowThreshold: 0.5, nearThreshold: WORKLOAD_THRESHOLDS.normal, low: 10, moderate: 5, near: 0, atCapacity: -10 },
  historyDays: z.coerce.number().int().min(1).max(365).parse(process.env.HORSE_RECOMMENDATION_HISTORY_DAYS ?? 30),
};
