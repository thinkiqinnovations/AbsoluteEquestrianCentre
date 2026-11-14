export type BillingReferenceType = 'LESSON' | 'PART_BOARD_AGREEMENT' | 'OTHER';
export type BillingCurrency = 'CAD';

export interface CreateChargeRequest {
  accountId: string;
  referenceType: BillingReferenceType;
  referenceId: string;
  amountMinor: number;
  currency: BillingCurrency;
  description: string;
  idempotencyKey: string;
}

export interface BillingCharge {
  id: string;
  accountId: string;
  referenceType: BillingReferenceType;
  referenceId: string;
  amountMinor: number;
  currency: BillingCurrency;
  status: 'PENDING' | 'REQUIRES_ACTION' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  providerReference?: string;
  createdAt: Date;
}

export interface BillingProvider {
  readonly providerName: string;
  readonly enabled: boolean;

  createCharge(request: CreateChargeRequest): Promise<BillingCharge>;
  getCharge(chargeId: string): Promise<BillingCharge | null>;
  cancelCharge(chargeId: string): Promise<BillingCharge>;
}
