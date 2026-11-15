import { addDays, monthRange, monday, weekday, type Agreement, type EntitlementSummary } from '@absolute/shared';

export type Usage = { agreementId: string; lessonId: string; entitlementDate: string; quantity: number; reversedAt?: Date | null };
export const effectiveOn = (agreement: Agreement, date: string) =>
  agreement.status === 'ACTIVE' && agreement.startDate <= date && (!agreement.endDate || date <= agreement.endDate);

export function entitlement(agreement: Agreement, date: string, usage: Usage[], excludedLesson?: string): EntitlementSummary {
  const range = agreement.entitlementPeriod === 'WEEK'
    ? { start: monday(date), end: addDays(monday(date), 6) }
    : monthRange(Number(date.slice(0, 4)), Number(date.slice(5, 7)));
  const used = usage.filter((entry) => entry.agreementId === agreement.id && entry.lessonId !== excludedLesson &&
    !entry.reversedAt && entry.entitlementDate >= range.start && entry.entitlementDate <= range.end)
    .reduce((sum, entry) => sum + entry.quantity, 0);
  return { period: agreement.entitlementPeriod, periodStart: range.start, periodEnd: range.end,
    allowed: agreement.freeRidesPerPeriod, used, remaining: Math.max(0, agreement.freeRidesPerPeriod - used) };
}

export function nextPreferredWindow(agreement: Agreement, date: string) {
  const start = date < agreement.startDate ? agreement.startDate : date;
  for (let offset = 0; offset < 7; offset++) {
    const day = addDays(start, offset);
    if (!effectiveOn(agreement, day)) continue;
    const window = [...agreement.preferredRideTimes].sort((a, b) => a.startTime.localeCompare(b.startTime))
      .find((entry) => entry.dayOfWeek === weekday(day));
    if (window) return { ...window, date: day };
  }
  return null;
}

export function capacityExceeded(candidate: Agreement, agreements: Agreement[], limit: number) {
  if (candidate.status !== 'ACTIVE') return false;
  const peers = agreements.filter((peer) => peer.id !== candidate.id && peer.horseId === candidate.horseId &&
    peer.status === 'ACTIVE' && (!candidate.endDate || peer.startDate <= candidate.endDate) &&
    (!peer.endDate || candidate.startDate <= peer.endDate));
  if (peers.some((peer) => peer.riderId === candidate.riderId)) return true;
  return [candidate.startDate, ...peers.map(({ startDate }) => startDate).filter((date) => date >= candidate.startDate)]
    .some((date) => peers.filter((peer) => effectiveOn(peer, date)).length >= limit);
}
