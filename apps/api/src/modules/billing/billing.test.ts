import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { environmentSchema } from '../../env.js';
import { createBillingProvider } from './create-billing-provider.js';
import { BillingDisabledError, DisabledBillingProvider } from './disabled-billing-provider.js';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('deferred billing', () => {
  it('defaults to disabled and rejects invalid flag values', () => {
    expect(environmentSchema.parse({}).BILLING_ENABLED).toBe(false);
    expect(environmentSchema.safeParse({ BILLING_ENABLED: '1' }).success).toBe(false);
  });

  it('rejects every operation with the disabled provider', async () => {
    const env = environmentSchema.parse({ BILLING_ENABLED: 'false' });
    const provider = createBillingProvider({ enabled: env.BILLING_ENABLED });
    expect(provider).toBeInstanceOf(DisabledBillingProvider);
    expect(provider.enabled).toBe(false);

    await expect(provider.createCharge({
      accountId: 'account-1',
      referenceType: 'LESSON',
      referenceId: 'lesson-1',
      amountMinor: 7500,
      currency: 'CAD',
      description: 'Private lesson',
      idempotencyKey: 'lesson-1-charge',
    })).rejects.toBeInstanceOf(BillingDisabledError);
    await expect(provider.getCharge('charge-1')).rejects.toBeInstanceOf(BillingDisabledError);
    await expect(provider.cancelCharge('charge-1')).rejects.toBeInstanceOf(BillingDisabledError);
  });

  it('refuses to compose the API when billing is enabled', async () => {
    vi.stubEnv('BILLING_ENABLED', 'true');
    vi.stubEnv('DATABASE_URL', '');
    await expect(import('../../app.js')).rejects.toThrow('no billing provider has been configured');
  });

  it('exposes only the public capability and still allows lesson scheduling', async () => {
    vi.stubEnv('BILLING_ENABLED', 'false');
    vi.stubEnv('DATABASE_URL', '');
    vi.stubEnv('DIRECT_URL', 'private-database-connection');
    const { app } = await import('../../app.js');
    await request(app).get('/api/config').expect(200, { features: { billing: false } });

    const date = '2030-01-01';
    const lesson = await request(app).post('/api/lessons').send({
      date,
      startTime: '09:00',
      endTime: '10:00',
      riderId: 'rider-emma',
      horseId: 'horse-jasper',
      coachId: 'coach-sarah',
      lessonType: 'PRIVATE',
      discipline: 'FLAT',
      rideUnits: 1,
      status: 'CONFIRMED',
      notes: '',
    }).expect(201);
    const schedule = await request(app).get('/api/schedule').query({ date }).expect(200);
    expect(schedule.body.lessons.map(({ id }: { id: string }) => id)).toContain(lesson.body.lesson.id);
  });
});
