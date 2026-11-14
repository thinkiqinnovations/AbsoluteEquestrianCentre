import type { BillingCharge, BillingProvider, CreateChargeRequest } from './billing-provider.js';

export class BillingDisabledError extends Error {
  readonly code = 'BILLING_DISABLED';

  constructor() {
    super('Billing is not enabled for this application.');
    this.name = 'BillingDisabledError';
  }
}

export class DisabledBillingProvider implements BillingProvider {
  readonly providerName = 'disabled';
  readonly enabled = false;

  async createCharge(request: CreateChargeRequest): Promise<BillingCharge> {
    void request;
    throw new BillingDisabledError();
  }

  async getCharge(chargeId: string): Promise<BillingCharge | null> {
    void chargeId;
    throw new BillingDisabledError();
  }

  async cancelCharge(chargeId: string): Promise<BillingCharge> {
    void chargeId;
    throw new BillingDisabledError();
  }
}
