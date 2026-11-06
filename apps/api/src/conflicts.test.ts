import { describe, expect, it } from 'vitest';
import { findConflicts } from './conflicts.js';
import { store } from './store.js';

const base = { date: new Date().toISOString().slice(0, 10), startTime: '09:30', endTime: '10:30', riderId: 'rider-noah', horseId: 'horse-jasper', coachId: 'coach-james', lessonType: 'PRIVATE' as const, discipline: 'FLAT' as const, rideUnits: 1, status: 'CONFIRMED' as const, notes: '' };
describe('schedule conflict detection', () => {
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
