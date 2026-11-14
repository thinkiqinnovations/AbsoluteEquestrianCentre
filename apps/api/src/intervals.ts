import type { Interval } from '@absolute/shared';

export const overlaps = (a: Interval, b: Interval) => a.startTime < b.endTime && b.startTime < a.endTime;
