import { z } from 'zod';

export const environmentSchema = z.object({
  BILLING_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
});
