import { z } from 'zod';

export const recordedPaymentStatuses = ['UNRECORDED', 'UNPAID', 'PAID'] as const;
export const monthlyPaymentKinds = ['MONTHLY', 'PART_BOARD'] as const;
export const paymentMonthSchema = z.string().regex(/^[1-9][0-9]{3}-(0[1-9]|1[0-2])$/, 'Select a valid month.');
export type RecordedPaymentStatus = typeof recordedPaymentStatuses[number];
export type MonthlyPaymentKind = typeof monthlyPaymentKinds[number];
export type PaymentStatusOverview = {
  lessonStatuses: { lessonId: string; status: RecordedPaymentStatus }[];
  monthlyStatuses: { riderId: string; kind: MonthlyPaymentKind; status: RecordedPaymentStatus }[];
  lessons: { id: string; date: string; startTime: string; lessonType: string }[];
};
