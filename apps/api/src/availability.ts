import { weekday, type AvailabilityRecords, type AvailabilityResult, type Interval, type Resource } from '@absolute/shared';
import { overlaps } from './intervals.js';

export function effectiveAvailability(records: AvailabilityRecords, resource: Resource, date: string) {
  const matches = (entry: Resource) => entry.resourceType === resource.resourceType && entry.resourceId === resource.resourceId;
  const rules = records.rules.filter(matches);
  const recurring = rules.filter((entry) => entry.dayOfWeek === weekday(date));
  const overrides = records.overrides.filter((entry) => matches(entry) && entry.date === date);
  const boundaries = [...new Set(['00:00', '24:00', ...[...recurring, ...overrides].flatMap((entry) => [entry.startTime, entry.endTime])])].sort();
  const windows: (Interval & AvailabilityResult)[] = [];

  for (let index = 1; index < boundaries.length; index++) {
    const interval = { startTime: boundaries[index - 1], endTime: boundaries[index] };
    const exceptions = overrides.filter((entry) => overlaps(entry, interval));
    const normal = recurring.filter((entry) => overlaps(entry, interval));
    const matching = exceptions.length ? exceptions : normal;
    const rule = matching.find((entry) => entry.availabilityType === 'UNAVAILABLE') ?? matching[0];
    const status = rule?.availabilityType ?? (rules.length ? 'UNAVAILABLE' : 'UNSPECIFIED');
    const source = exceptions.length ? 'OVERRIDE' : rules.length ? 'RECURRING' : 'NONE';
    const reason = rule && 'reason' in rule ? rule.reason ?? undefined : undefined;
    const previous = windows.at(-1);
    if (previous?.status === status && previous.source === source && previous.reason === reason) {
      previous.endTime = interval.endTime;
    } else {
      windows.push({ ...interval, status, source, reason });
    }
  }
  return windows;
}

export function evaluateAvailability(records: AvailabilityRecords, resource: Resource, date: string, interval: Interval): AvailabilityResult {
  const windows = effectiveAvailability(records, resource, date).filter((window) => overlaps(window, interval));
  const selected = windows.find((window) => window.status === 'UNAVAILABLE')
    ?? windows.find((window) => window.status === 'UNSPECIFIED')
    ?? windows.find((window) => window.source === 'OVERRIDE')
    ?? windows[0];
  return { status: selected.status, source: selected.source, reason: selected.reason };
}
