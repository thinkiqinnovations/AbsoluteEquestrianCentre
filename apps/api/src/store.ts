import type { Coach, Horse, Lesson, Rider } from './types.js';

const now = () => new Date().toISOString();
const make = <T extends object>(id: string, input: T) => ({ ...input, id, createdAt: now(), updatedAt: now() });
const today = new Date().toISOString().slice(0, 10);

export const store: { horses: Horse[]; riders: Rider[]; coaches: Coach[]; lessons: Lesson[] } = {
  horses: [
    make('horse-jasper', { name: 'Jasper', active: true, description: 'Steady schoolmaster', walkCapable: true, trotCapable: true, canterCapable: true, supportsFlat: true, supportsJumping: true, minimumRiderLevel: 'BEGINNER', maximumRiderLevel: 'INTERMEDIATE', maximumDailyRideUnits: 1.5, notes: '' }),
    make('horse-willow', { name: 'Willow', active: true, description: 'Responsive all-rounder', walkCapable: true, trotCapable: true, canterCapable: true, supportsFlat: true, supportsJumping: true, minimumRiderLevel: 'INTERMEDIATE', maximumRiderLevel: 'ADVANCED', maximumDailyRideUnits: 1.5, notes: '' }),
    make('horse-charlie', { name: 'Charlie', active: true, description: 'Patient flat partner', walkCapable: true, trotCapable: true, canterCapable: false, supportsFlat: true, supportsJumping: false, minimumRiderLevel: 'BEGINNER', maximumRiderLevel: 'INTERMEDIATE', maximumDailyRideUnits: 1.5, notes: '' }),
    make('horse-atlas', { name: 'Atlas', active: true, description: 'Advanced jumping horse', walkCapable: true, trotCapable: true, canterCapable: true, supportsFlat: true, supportsJumping: true, minimumRiderLevel: 'ADVANCED', maximumRiderLevel: 'ADVANCED', maximumDailyRideUnits: 1.75, notes: '' }),
  ],
  riders: [
    make('rider-emma', { firstName: 'Emma', lastName: 'Roberts', active: true, overallLevel: 'BEGINNER', flatLevel: 'BEGINNER', jumpLevel: 'BEGINNER', notes: '', preferences: [{ horseId: 'horse-jasper', preferenceOrder: 1, notes: '' }, { horseId: 'horse-charlie', preferenceOrder: 2, notes: '' }, { horseId: 'horse-willow', preferenceOrder: 3, notes: '' }] }),
    make('rider-noah', { firstName: 'Noah', lastName: 'Martin', active: true, overallLevel: 'INTERMEDIATE', flatLevel: 'INTERMEDIATE', jumpLevel: 'BEGINNER', notes: '', preferences: [{ horseId: 'horse-willow', preferenceOrder: 1, notes: '' }] }),
    make('rider-olivia', { firstName: 'Olivia', lastName: 'Chen', active: true, overallLevel: 'ADVANCED', flatLevel: 'ADVANCED', jumpLevel: 'ADVANCED', notes: '', preferences: [{ horseId: 'horse-atlas', preferenceOrder: 1, notes: '' }] }),
  ],
  coaches: [
    make('coach-sarah', { firstName: 'Sarah', lastName: 'Bennett', active: true, notes: '' }),
    make('coach-james', { firstName: 'James', lastName: 'Wilson', active: true, notes: '' }),
  ],
  lessons: [
    make('lesson-1', { date: today, startTime: '09:00', endTime: '10:00', riderId: 'rider-emma', horseId: 'horse-jasper', coachId: 'coach-sarah', lessonType: 'PRIVATE', discipline: 'FLAT', rideUnits: 1, status: 'CONFIRMED', notes: '' }),
    make('lesson-2', { date: today, startTime: '10:30', endTime: '11:15', riderId: 'rider-noah', horseId: 'horse-willow', coachId: 'coach-james', lessonType: 'PRIVATE', discipline: 'FLAT', rideUnits: 0.75, status: 'CONFIRMED', notes: '' }),
    make('lesson-3', { date: today, startTime: '14:00', endTime: '15:00', riderId: 'rider-olivia', horseId: 'horse-atlas', coachId: 'coach-sarah', lessonType: 'PRIVATE', discipline: 'JUMP', rideUnits: 1, status: 'DRAFT', notes: '' }),
  ],
};

export const id = (kind: string) => `${kind}-${crypto.randomUUID()}`;
