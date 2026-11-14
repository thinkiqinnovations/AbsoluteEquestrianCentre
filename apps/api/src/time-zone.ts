import { defaultTimeZone } from '@absolute/shared';
import { z } from 'zod';

export const appTimeZone = z.string().refine((value) => {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'APP_TIME_ZONE must be a valid time zone.').parse(process.env.APP_TIME_ZONE ?? defaultTimeZone);
