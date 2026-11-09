import { PrismaClient, type Coach as PrismaCoach, type Horse as PrismaHorse, type Lesson as PrismaLesson, type Rider as PrismaRider, type RiderHorsePreference } from '@prisma/client';
import type { CoachInput, HorseInput, LessonInput, RiderInput } from '@absolute/shared';
import { id, store } from './store.js';
import type { Coach, Horse, Lesson, Rider } from './types.js';

export type SchedulerSnapshot = { horses: Horse[]; riders: Rider[]; coaches: Coach[]; lessons: Lesson[] };
export type DatabaseMode = 'postgres' | 'seeded-memory';

const timestamp = (value: Date) => value.toISOString();
const dateValue = (value: Date) => value.toISOString().slice(0, 10);
const nullableText = (value: string | undefined) => value || null;
const toHorse = (horse: PrismaHorse): Horse => ({ ...horse, description: horse.description ?? '', notes: horse.notes ?? '', maximumDailyRideUnits: Number(horse.maximumDailyRideUnits), createdAt: timestamp(horse.createdAt), updatedAt: timestamp(horse.updatedAt) });
const toRider = (rider: PrismaRider & { preferences: RiderHorsePreference[] }): Rider => ({ ...rider, notes: rider.notes ?? '', preferences: rider.preferences.map((preference) => ({ horseId: preference.horseId, preferenceOrder: preference.preferenceOrder, notes: preference.notes ?? '' })), createdAt: timestamp(rider.createdAt), updatedAt: timestamp(rider.updatedAt) });
const toCoach = (coach: PrismaCoach): Coach => ({ ...coach, notes: coach.notes ?? '', createdAt: timestamp(coach.createdAt), updatedAt: timestamp(coach.updatedAt) });
const toLesson = (lesson: PrismaLesson): Lesson => ({ ...lesson, date: dateValue(lesson.date), notes: lesson.notes ?? '', rideUnits: Number(lesson.rideUnits), createdAt: timestamp(lesson.createdAt), updatedAt: timestamp(lesson.updatedAt) });

export interface SchedulerDatabase {
  mode: DatabaseMode;
  snapshot(): Promise<SchedulerSnapshot>;
  horses(): Promise<Horse[]>;
  horse(id: string): Promise<Horse | undefined>;
  createHorse(input: HorseInput): Promise<Horse>;
  updateHorse(id: string, input: HorseInput): Promise<Horse | undefined>;
  riders(): Promise<Rider[]>;
  rider(id: string): Promise<Rider | undefined>;
  createRider(input: RiderInput): Promise<Rider>;
  updateRider(id: string, input: RiderInput): Promise<Rider | undefined>;
  coaches(): Promise<Coach[]>;
  coach(id: string): Promise<Coach | undefined>;
  createCoach(input: CoachInput): Promise<Coach>;
  updateCoach(id: string, input: CoachInput): Promise<Coach | undefined>;
  lessons(date?: string): Promise<Lesson[]>;
  lesson(id: string): Promise<Lesson | undefined>;
  createLesson(input: LessonInput): Promise<Lesson>;
  updateLesson(id: string, input: LessonInput): Promise<Lesson | undefined>;
  disconnect(): Promise<void>;
}

class MemoryDatabase implements SchedulerDatabase {
  readonly mode = 'seeded-memory' as const;
  async snapshot(): Promise<SchedulerSnapshot> { return store; }
  async horses() { return store.horses; }
  async horse(entityId: string) { return store.horses.find((item) => item.id === entityId); }
  async createHorse(input: HorseInput) { const entity: Horse = { ...input, id: id('horse'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; store.horses.push(entity); return entity; }
  async updateHorse(entityId: string, input: HorseInput) { const index = store.horses.findIndex((item) => item.id === entityId); if (index < 0) return undefined; store.horses[index] = { ...store.horses[index], ...input, updatedAt: new Date().toISOString() }; return store.horses[index]; }
  async riders() { return store.riders; }
  async rider(entityId: string) { return store.riders.find((item) => item.id === entityId); }
  async createRider(input: RiderInput) { const entity: Rider = { ...input, preferences: input.preferences.map((item, index) => ({ ...item, preferenceOrder: index + 1 })), id: id('rider'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; store.riders.push(entity); return entity; }
  async updateRider(entityId: string, input: RiderInput) { const index = store.riders.findIndex((item) => item.id === entityId); if (index < 0) return undefined; store.riders[index] = { ...store.riders[index], ...input, preferences: input.preferences.map((item, preferenceOrder) => ({ ...item, preferenceOrder: preferenceOrder + 1 })), updatedAt: new Date().toISOString() }; return store.riders[index]; }
  async coaches() { return store.coaches; }
  async coach(entityId: string) { return store.coaches.find((item) => item.id === entityId); }
  async createCoach(input: CoachInput) { const entity: Coach = { ...input, id: id('coach'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; store.coaches.push(entity); return entity; }
  async updateCoach(entityId: string, input: CoachInput) { const index = store.coaches.findIndex((item) => item.id === entityId); if (index < 0) return undefined; store.coaches[index] = { ...store.coaches[index], ...input, updatedAt: new Date().toISOString() }; return store.coaches[index]; }
  async lessons(date?: string) { return date ? store.lessons.filter((item) => item.date === date) : store.lessons; }
  async lesson(entityId: string) { return store.lessons.find((item) => item.id === entityId); }
  async createLesson(input: LessonInput) { const entity: Lesson = { ...input, id: id('lesson'), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; store.lessons.push(entity); return entity; }
  async updateLesson(entityId: string, input: LessonInput) { const index = store.lessons.findIndex((item) => item.id === entityId); if (index < 0) return undefined; store.lessons[index] = { ...store.lessons[index], ...input, updatedAt: new Date().toISOString() }; return store.lessons[index]; }
  async disconnect() { /* No connection in development fallback. */ }
}

class PostgresDatabase implements SchedulerDatabase {
  readonly mode = 'postgres' as const;
  constructor(private readonly prisma: PrismaClient) {}
  async snapshot(): Promise<SchedulerSnapshot> {
    const [horses, riders, coaches, lessons] = await this.prisma.$transaction([
      this.prisma.horse.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.rider.findMany({ include: { preferences: { orderBy: { preferenceOrder: 'asc' } } }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
      this.prisma.coach.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
      this.prisma.lesson.findMany(),
    ]);
    return { horses: horses.map(toHorse), riders: riders.map(toRider), coaches: coaches.map(toCoach), lessons: lessons.map(toLesson) };
  }
  async horses() { return (await this.prisma.horse.findMany({ orderBy: { name: 'asc' } })).map(toHorse); }
  async horse(entityId: string) { const entity = await this.prisma.horse.findUnique({ where: { id: entityId } }); return entity ? toHorse(entity) : undefined; }
  async createHorse(input: HorseInput) { return toHorse(await this.prisma.horse.create({ data: { ...input, description: nullableText(input.description), notes: nullableText(input.notes) } })); }
  async updateHorse(entityId: string, input: HorseInput) { try { return toHorse(await this.prisma.horse.update({ where: { id: entityId }, data: { ...input, description: nullableText(input.description), notes: nullableText(input.notes) } })); } catch { return undefined; } }
  async riders() { return (await this.prisma.rider.findMany({ include: { preferences: { orderBy: { preferenceOrder: 'asc' } } }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] })).map(toRider); }
  async rider(entityId: string) { const entity = await this.prisma.rider.findUnique({ where: { id: entityId }, include: { preferences: { orderBy: { preferenceOrder: 'asc' } } } }); return entity ? toRider(entity) : undefined; }
  async createRider(input: RiderInput) { return toRider(await this.prisma.rider.create({ data: { firstName: input.firstName, lastName: input.lastName, active: input.active, overallLevel: input.overallLevel, flatLevel: input.flatLevel, jumpLevel: input.jumpLevel, notes: nullableText(input.notes), preferences: { create: input.preferences.map((preference, index) => ({ horseId: preference.horseId, preferenceOrder: index + 1, notes: nullableText(preference.notes) })) } }, include: { preferences: { orderBy: { preferenceOrder: 'asc' } } } })); }
  async updateRider(entityId: string, input: RiderInput) { try { return toRider(await this.prisma.rider.update({ where: { id: entityId }, data: { firstName: input.firstName, lastName: input.lastName, active: input.active, overallLevel: input.overallLevel, flatLevel: input.flatLevel, jumpLevel: input.jumpLevel, notes: nullableText(input.notes), preferences: { deleteMany: {}, create: input.preferences.map((preference, index) => ({ horseId: preference.horseId, preferenceOrder: index + 1, notes: nullableText(preference.notes) })) } }, include: { preferences: { orderBy: { preferenceOrder: 'asc' } } } })); } catch { return undefined; } }
  async coaches() { return (await this.prisma.coach.findMany({ orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] })).map(toCoach); }
  async coach(entityId: string) { const entity = await this.prisma.coach.findUnique({ where: { id: entityId } }); return entity ? toCoach(entity) : undefined; }
  async createCoach(input: CoachInput) { return toCoach(await this.prisma.coach.create({ data: { ...input, notes: nullableText(input.notes) } })); }
  async updateCoach(entityId: string, input: CoachInput) { try { return toCoach(await this.prisma.coach.update({ where: { id: entityId }, data: { ...input, notes: nullableText(input.notes) } })); } catch { return undefined; } }
  async lessons(date?: string) { return (await this.prisma.lesson.findMany({ where: date ? { date: new Date(`${date}T00:00:00.000Z`) } : undefined, orderBy: [{ date: 'asc' }, { startTime: 'asc' }] })).map(toLesson); }
  async lesson(entityId: string) { const entity = await this.prisma.lesson.findUnique({ where: { id: entityId } }); return entity ? toLesson(entity) : undefined; }
  async createLesson(input: LessonInput) { return toLesson(await this.prisma.lesson.create({ data: { ...input, date: new Date(`${input.date}T00:00:00.000Z`), notes: nullableText(input.notes) } })); }
  async updateLesson(entityId: string, input: LessonInput) { try { return toLesson(await this.prisma.lesson.update({ where: { id: entityId }, data: { ...input, date: new Date(`${input.date}T00:00:00.000Z`), notes: nullableText(input.notes) } })); } catch { return undefined; } }
  async disconnect() { await this.prisma.$disconnect(); }
}

export const database: SchedulerDatabase = process.env.DATABASE_URL ? new PostgresDatabase(new PrismaClient()) : new MemoryDatabase();
