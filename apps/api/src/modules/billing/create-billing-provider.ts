import type { BillingProvider } from './billing-provider.js';
import { DisabledBillingProvider } from './disabled-billing-provider.js';

export function createBillingProvider({ enabled }: { enabled: boolean }): BillingProvider {
  if (!enabled) {
    return new DisabledBillingProvider();
  }

  throw new Error(
    'Billing is enabled, but no billing provider has been configured. Set BILLING_ENABLED=false.',
  );
}
