import { describe, expect, it } from 'vitest';
import { findConflicts } from './conflicts.js';
import { store } from './store.js';
import { barnToday } from '@absolute/shared';
import { appTimeZone } from './time-zone.js';

const base = { date: barnToday(appTimeZone), startTime: '09:30', endTime: '10:30', riderId: 'rider-noah', horseId: 'horse-jasper', coachId: 'coach-james', lessonType: 'PRIVATE' as const, discipline: 'FLAT' as const, rideUnits: 1, status: 'CONFIRMED' as const, notes: '' };
describe('schedule conflict detection', () => {
  it.each(['GROUP', 'SEMI_PRIVATE'] as const)('lets one coach teach distinct riders and horses in a %s session', (lessonType) => {
    const candidate = { ...base, lessonType };
    const existing = { ...store.lessons[0], ...candidate, riderId: 'rider-emma', horseId: 'horse-charlie' };
    const codes = (lessons: typeof store.lessons, lesson = candidate) =>
      findConflicts(lesson, { ...store, lessons }).map(({ code }) => code);

    expect(codes([existing])).not.toContain('COACH_DOUBLE_BOOKED');
    expect(codes([{ ...existing, lessonType: 'PRIVATE' }])).toContain('COACH_DOUBLE_BOOKED');
    expect(codes([{ ...existing, startTime: '09:00' }])).toContain('COACH_DOUBLE_BOOKED');
    expect(codes([{ ...existing, discipline: 'JUMP' }])).toContain('COACH_DOUBLE_BOOKED');
    expect(codes([{ ...existing, horseId: candidate.horseId }])).toContain('HORSE_DOUBLE_BOOKED');
    expect(codes([{ ...existing, riderId: candidate.riderId }])).toContain('RIDER_DOUBLE_BOOKED');
    const third = codes([existing, { ...existing, id: 'second', riderId: 'rider-olivia', horseId: 'horse-atlas' }]);
    expect(third.includes('SEMI_PRIVATE_FULL')).toBe(lessonType === 'SEMI_PRIVATE');
  });
  it('detects double booking and workload violations', () => {
    const conflicts = findConflicts(base, store);
    expect(conflicts.map((item) => item.code)).toContain('HORSE_DOUBLE_BOOKED');
    expect(conflicts.map((item) => item.code)).toContain('HORSE_WORKLOAD_EXCEEDED');
  });
  it('detects unsuitable jumping assignments', () => {
    const conflicts = findConflicts({ ...base, startTime: '16:00', endTime: '17:00', horseId: 'horse-charlie', discipline: 'JUMP' }, store);
    expect(conflicts.map((item) => item.code)).toContain('HORSE_NOT_JUMP_CAPABLE');
  });
});
