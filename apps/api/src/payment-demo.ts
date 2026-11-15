import type { MonthlyPaymentKind, RecordedPaymentStatus } from '@absolute/shared';
import { demoToday } from './store.js';

export const demoLessonPayments: { lessonId: string; status: RecordedPaymentStatus }[] = [
  { lessonId: 'lesson-1', status: 'PAID' },
  { lessonId: 'lesson-2', status: 'UNPAID' },
];
export const demoMonthlyPayments: { riderId: string; month: string; kind: MonthlyPaymentKind; status: RecordedPaymentStatus }[] = [
  { riderId: 'rider-noah', month: demoToday.slice(0, 7), kind: 'MONTHLY', status: 'PAID' },
  { riderId: 'rider-emma', month: demoToday.slice(0, 7), kind: 'PART_BOARD', status: 'PAID' },
  { riderId: 'rider-olivia', month: demoToday.slice(0, 7), kind: 'PART_BOARD', status: 'UNPAID' },
];
