import { addDays, barnToday, civilDate, dateValue, weekdays, overrideReasons, type AvailabilityOverride, type AvailabilityRule, type OverrideInput, type Resource, type RuleInput } from '@absolute/shared';
import { prisma } from './database.js';
import { id } from './store.js';
import { appTimeZone } from './time-zone.js';

type Input = RuleInput | OverrideInput;
type Metadata = { id: string; createdAt: string; updatedAt: string };
type Repository<T extends Input> = {
  list(resource?: Resource): Promise<(T & Metadata)[]>;
  save(input: T, existingId?: string): Promise<T & Metadata>;
  remove(existingId: string): Promise<boolean>;
};

function memory<T extends Input>(items: (T & Metadata)[]): Repository<T> {
  return {
    async list(resource) {
      return items.filter((item) => !resource || (item.resourceType === resource.resourceType && item.resourceId === resource.resourceId));
    },
    async save(input, existingId) {
      const index = items.findIndex((item) => item.id === existingId);
      const now = new Date().toISOString();
      const entry = { ...input, id: existingId ?? id('availability'), createdAt: items[index]?.createdAt ?? now, updatedAt: now };
      if (index < 0) items.push(entry);
      else items[index] = entry;
      return entry;
    },
    async remove(existingId) {
      const index = items.findIndex((item) => item.id === existingId);
      if (index < 0) return false;
      items.splice(index, 1);
      return true;
    },
  };
}

const timestamps = ({ id, createdAt, updatedAt }: { id: string; createdAt: Date; updatedAt: Date }) =>
  ({ id, createdAt: createdAt.toISOString(), updatedAt: updatedAt.toISOString() });
const seedTime = '2026-11-14T00:00:00.000Z';
const seedMetadata = (seedId: string) => ({ id: seedId, createdAt: seedTime, updatedAt: seedTime });
const sampleResources: Resource[] = [
  { resourceType: 'HORSE', resourceId: 'horse-jasper' },
  { resourceType: 'HORSE', resourceId: 'horse-willow' },
  { resourceType: 'COACH', resourceId: 'coach-james' },
  { resourceType: 'RIDER', resourceId: 'rider-noah' },
];
const sampleRules = sampleResources.flatMap((resource) => weekdays.map((dayOfWeek): AvailabilityRule => ({
  ...resource, ...seedMetadata(`rule-${resource.resourceId}-${dayOfWeek}`), dayOfWeek,
  startTime: '08:00', endTime: '20:00', availabilityType: 'AVAILABLE',
})));
const sampleOverrides: AvailabilityOverride[] = sampleResources.map((resource, index) => ({
  ...resource, ...seedMetadata(`override-${resource.resourceId}`), date: addDays(barnToday(appTimeZone), index + 1),
  startTime: '17:00', endTime: '19:00', availabilityType: 'UNAVAILABLE',
  reason: (['REST', 'VET', 'PERSONAL', 'SCHOOL_EVENT'] as const)[index],
}));

function postgresRules(client: NonNullable<typeof prisma>): Repository<RuleInput> {
  const table = client.availabilityRule;
  return {
    async list(where) {
      return (await table.findMany({ where })).map((entry) => ({ ...entry, ...timestamps(entry) }));
    },
    async save(data, existingId) {
      const entry = existingId ? await table.update({ where: { id: existingId }, data }) : await table.create({ data });
      return { ...entry, ...timestamps(entry) };
    },
    async remove(existingId) { return (await table.deleteMany({ where: { id: existingId } })).count > 0; },
  };
}

function postgresOverrides(client: NonNullable<typeof prisma>): Repository<OverrideInput> {
  const table = client.availabilityOverride;
  const serialize = (entry: Awaited<ReturnType<typeof table.create>>): AvailabilityOverride => ({
    ...entry, ...timestamps(entry), date: dateValue(entry.date),
    reason: overrideReasons.find((reason) => reason === entry.reason),
  });
  return {
    async list(where) { return (await table.findMany({ where })).map(serialize); },
    async save(input, existingId) {
      const data = { ...input, date: civilDate(input.date) };
      return serialize(existingId ? await table.update({ where: { id: existingId }, data }) : await table.create({ data }));
    },
    async remove(existingId) { return (await table.deleteMany({ where: { id: existingId } })).count > 0; },
  };
}

export const rules = prisma ? postgresRules(prisma) : memory<RuleInput>(sampleRules);
export const overrides = prisma ? postgresOverrides(prisma) : memory<OverrideInput>(sampleOverrides);
export async function availabilityRecords(resource?: Resource) {
  const [weeklyRules, dateOverrides] = await Promise.all([rules.list(resource), overrides.list(resource)]);
  return { rules: weeklyRules, overrides: dateOverrides };
}
