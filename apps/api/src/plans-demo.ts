import { addDays, monthRange, type Enrollment, type Plan } from '@absolute/shared';
import { demoToday } from './store.js';

const monthly = (code: string, name: string, category: string, priceCents: number, quantity: number, activityTypes: string[], practice = 0, daysPerWeek: number | null = null): Plan => ({
  id: `plan-${code}`, code, name, category, priceCents, pricePeriod: 'MONTHLY', description: '',
  hstIncluded: true, active: true, effectiveFrom: '2020-01-01', effectiveTo: null, sortOrder: 0,
  durationMinutes: null, includedQuantity: null, additionalUnitPriceCents: null, paymentMethodRule: 'UNRESTRICTED', paymentInstructions: '', daysPerWeek,
  activityTypes: [...activityTypes, ...(practice ? ['PRACTICE_RIDE'] : [])],
  entitlements: [
    { id: `entitlement-${code}-lesson`, planId: `plan-${code}`, name: activityTypes.includes('PRIVATE_LESSON') ? 'Private Lessons' : activityTypes.includes('SEMI_PRIVATE_LESSON') ? activityTypes.length > 1 ? 'Group / Semi-Private Lessons' : 'Semi-Private Lessons' : 'Group Lessons', activityTypes, quantity, period: 'MONTH' },
    ...(practice ? [{ id: `entitlement-${code}-practice`, planId: `plan-${code}`, name: 'Practice Rides', activityTypes: ['PRACTICE_RIDE'], quantity: practice, period: 'MONTH' }] : []),
  ],
});
const service = (code: string, name: string, category: string, priceCents: number, activityTypes: string[], durationMinutes: number | null): Plan => ({
  ...monthly(code, name, category, priceCents, 0, activityTypes), entitlements: [], pricePeriod: 'ONE_TIME', durationMinutes,
});
export const demoPlans: Plan[] = [
  monthly('monthly-group', 'Monthly Group', 'LESSON_PACKAGE', 21500, 4, ['GROUP_LESSON']),
  monthly('monthly-semi-private', 'Monthly Semi-Private', 'LESSON_PACKAGE', 21500, 4, ['SEMI_PRIVATE_LESSON']),
  monthly('monthly-private', 'Monthly Private', 'LESSON_PACKAGE', 25600, 4, ['PRIVATE_LESSON']),
  monthly('pb-1-shared', '1 Day Part Board – Group / Semi-Private', 'PART_BOARD', 26900, 4, ['GROUP_LESSON', 'SEMI_PRIVATE_LESSON'], 0, 1),
  monthly('pb-1-private', '1 Day Part Board – Private', 'PART_BOARD', 31000, 4, ['PRIVATE_LESSON'], 0, 1),
  monthly('pb-2-practice', '2 Day Part Board – Lessons + Practice Rides', 'PART_BOARD', 44000, 4, ['GROUP_LESSON'], 4, 2),
  monthly('pb-2-lessons', '2 Day Part Board – 8 Lessons', 'PART_BOARD', 53800, 8, ['GROUP_LESSON'], 0, 2),
  monthly('pb-3-practice', '3 Day Part Board – Lessons + Practice Rides', 'PART_BOARD', 64500, 8, ['GROUP_LESSON'], 4, 3),
  monthly('pb-3-lessons', '3 Day Part Board – 12 Lessons', 'PART_BOARD', 80700, 12, ['GROUP_LESSON'], 0, 3),
  service('assessment', 'Half Hour Assessment', 'ASSESSMENT', 6000, ['ASSESSMENT'], 30),
  service('single', 'Single Lesson', 'SINGLE_PURCHASE', 7500, ['PRIVATE_LESSON', 'SEMI_PRIVATE_LESSON', 'GROUP_LESSON'], null),
  { ...service('grooming', 'Grooming & Tacking Session', 'SERVICE', 3000, ['GROOMING_TACKING'], 90), paymentMethodRule: 'CASH_ONLY', paymentInstructions: 'Cash only - exact change please.' },
  { ...service('birthday', 'Birthday Party', 'SERVICE', 43000, ['BIRTHDAY_PARTY'], 120), includedQuantity: 6, additionalUnitPriceCents: 6000, description: '1 hour lesson and 1 hour barn/party room. Additional riders $60 each.' },
  { ...service('camp', 'Seasonal Camp', 'CAMP', 67800, ['SEASONAL_CAMP'], null), pricePeriod: 'WEEKLY' },
].map((plan, sortOrder) => ({ ...plan, sortOrder }));
const start = monthRange(Number(demoToday.slice(0, 4)), Number(demoToday.slice(5, 7))).start;
export const demoEnrollments: Enrollment[] = [
  { id: 'enrollment-emma', riderId: 'rider-emma', planId: 'plan-pb-2-practice', agreementId: 'part-board-emma', startDate: start, endDate: null, status: 'ACTIVE', notes: 'Fictional demo enrollment.' },
  { id: 'enrollment-olivia', riderId: 'rider-olivia', planId: 'plan-monthly-group', startDate: start, endDate: null, status: 'ACTIVE', notes: '' },
  { id: 'enrollment-noah', riderId: 'rider-noah', planId: 'plan-monthly-private', startDate: start, endDate: null, status: 'ACTIVE', notes: '' },
  { id: 'enrollment-paused', riderId: 'rider-emma', planId: 'plan-monthly-private', startDate: start, endDate: null, status: 'PAUSED', notes: 'Paused example.' },
  { id: 'enrollment-ended', riderId: 'rider-olivia', planId: 'plan-monthly-private', startDate: addDays(start, -40), endDate: addDays(start, -1), status: 'ENDED', notes: 'Historical example.' },
];
