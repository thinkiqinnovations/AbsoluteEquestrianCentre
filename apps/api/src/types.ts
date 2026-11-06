import type { CoachInput, HorseInput, LessonInput, RiderInput } from '@absolute/shared';

export type Entity<T> = T & { id: string; createdAt: string; updatedAt: string };
export type Horse = Entity<HorseInput>;
export type RiderPreference = { horseId: string; notes?: string; preferenceOrder: number };
export type Rider = Omit<Entity<RiderInput>, 'preferences'> & { preferences: RiderPreference[] };
export type Coach = Entity<CoachInput>;
export type Lesson = Entity<LessonInput>;
export type Conflict = { code: string; severity: 'ERROR' | 'WARNING'; message: string };
