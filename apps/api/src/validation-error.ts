import type { ZodError } from 'zod';

export function validationError(error: ZodError) {
  return {
    code: 'VALIDATION_ERROR',
    details: error.flatten(),
    issues: error.issues.map(({ path, message }) => ({ path, message })),
  };
}
