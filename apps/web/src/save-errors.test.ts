import { expect, it } from 'vitest';
import { errorMessage } from './save-errors';

it('shows field names and nested validation details', () => {
  expect(errorMessage({ error: { issues: [
    { path: ['firstName'], message: 'String must contain at least 1 character(s)' },
    { path: ['preferredRideTimes', 0, 'endTime'], message: 'Use HH:mm time.' },
  ] } })).toBe('First Name: Required.\nPreferred Ride Times / item 1 / End Time: Use HH:mm time.');
});

it('shows booking blockers rather than unrelated warnings', () => {
  expect(errorMessage({ conflicts: [
    { severity: 'WARNING', message: 'Availability has not been configured.' },
    { severity: 'ERROR', message: 'A priority part-board ride is planned.' },
  ] })).toBe('A priority part-board ride is planned.');
});

it('supports older field errors and uses a fallback for unknown failures', () => {
  expect(errorMessage({ error: { details: { fieldErrors: { horseId: ['Required'] } } } })).toBe('Horse: Required');
  expect(errorMessage(undefined)).toBe('Unable to save. Review the fields and try again.');
});
