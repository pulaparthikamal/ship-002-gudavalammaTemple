import { refundService } from './refund.service';
import { Refund } from './refund.model';
import { financialEventService } from '../financial-event/financial-event.service';
import { claimClosureService } from '../claim/claim-closure.service';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { PatientPayment } from '../patient-payment/patient-payment.model';

jest.mock('../../../utils/mongoose-transaction.util', () => ({
  withMongoTransaction: (operation: (session?: unknown) => Promise<unknown>) => operation(undefined),
}));

jest.mock('../financial-event/financial-event.service', () => ({
  financialEventService: {
    record: jest.fn().mockResolvedValue({ _id: 'event-1' }),
  },
}));

jest.mock('../claim/claim-closure.service', () => ({
  claimClosureService: {
    syncClaimClosureStatus: jest.fn().mockResolvedValue({}),
    reopenForFinancialMutation: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../events/rcm-event-stream.service', () => ({
  publishRcmRealtimeEvent: jest.fn(),
}));

describe('refundService controlled workflow', () => {
  function queryResolved(value: any) {
    return { session: jest.fn().mockResolvedValue(value) };
  }
  function queryLeanResolved(value: any) {
    return { session: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(value) }) };
  }

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('approves a pending refund only with a recorded reason', async () => {
    const refund: any = {
      _id: 'refund-1',
      claimId: 'claim-1',
      refundStatus: 'PENDING_REVIEW',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Refund, 'findOne').mockReturnValue(queryResolved(refund) as any);

    const result = await refundService.applyAction(
      'refund-1',
      'APPROVE',
      { reason: 'Reviewed patient overpayment ledger.' },
      'en',
      'user-1',
    );

    expect(result.refundStatus).toBe('APPROVED');
    expect(result.approvedDate).toBeInstanceOf(Date);
    expect(result.approvedBy).toBe('user-1');
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalledWith('claim-1', 'user-1', undefined);
    expect(publishRcmRealtimeEvent).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'REFUND_STATUS_CHANGED',
      status: 'APPROVED',
    }));
  });

  it('records a compensating financial event when an approved refund is processed', async () => {
    const refund: any = {
      _id: 'refund-2',
      claimId: 'claim-2',
      patientPaymentId: 'payment-2',
      refundAmount: 25,
      refundStatus: 'APPROVED',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Refund, 'findOne').mockReturnValue(queryResolved(refund) as any);
    jest.spyOn(PatientPayment, 'findOne').mockReturnValue(queryResolved({ _id: 'payment-2', overpaymentAmount: 25 }) as any);
    jest.spyOn(Refund, 'find').mockReturnValue(queryLeanResolved([]) as any);

    const result = await refundService.applyAction(
      'refund-2',
      'PROCESS',
      { reason: 'ACH refund issued to patient.' },
      'en',
      'user-1',
    );

    expect(result.refundStatus).toBe('PROCESSED');
    expect(claimClosureService.reopenForFinancialMutation).toHaveBeenCalledWith(
      'claim-2',
      expect.stringContaining('Refund refund-2 processed'),
      'user-1',
      undefined,
    );
    expect(financialEventService.record).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'REFUND_PROCESSED',
      claimId: 'claim-2',
      refundId: 'refund-2',
      amount: -25,
    }));
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalledWith('claim-2', 'user-1', undefined);
  });

  it('does not allow refund workflow actions without a reason', async () => {
    const refund: any = {
      _id: 'refund-3',
      refundStatus: 'PENDING_REVIEW',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Refund, 'findOne').mockReturnValue(queryResolved(refund) as any);

    await expect(refundService.applyAction('refund-3', 'APPROVE', {}, 'en', 'user-1'))
      .rejects.toThrow('Refund approve reason is required.');
  });

  it('restores patient balance when a processed refund returns previously applied responsibility', async () => {
    const refund: any = {
      _id: 'refund-applied',
      claimId: 'claim-applied',
      patientBillingId: 'billing-applied',
      patientPaymentId: 'payment-applied',
      refundAmount: 30,
      refundStatus: 'APPROVED',
      save: jest.fn().mockResolvedValue(undefined),
    };
    const billing: any = {
      _id: 'billing-applied',
      currentBalance: 0,
      amountDue: 0,
      refundAmount: 0,
      creditBalanceAmount: 0,
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Refund, 'findOne').mockReturnValue(queryResolved(refund) as any);
    jest.spyOn(PatientPayment, 'findOne').mockReturnValue(queryResolved({ overpaymentAmount: 0, appliedAmount: 30 }) as any);
    jest.spyOn(Refund, 'find').mockReturnValue(queryLeanResolved([]) as any);
    jest.spyOn(PatientBilling, 'findOne').mockReturnValue(queryResolved(billing) as any);

    await refundService.applyAction('refund-applied', 'PROCESS', { reason: 'Payment refunded after review.' }, 'en', 'user-1');

    expect(refund.balanceImpactAmount).toBe(30);
    expect(billing.currentBalance).toBe(30);
    expect(billing.status).toBe('PARTIALLY_PAID');
    expect(financialEventService.record).toHaveBeenCalledWith(expect.objectContaining({
      amount: -30,
      metadata: expect.objectContaining({ balanceImpactAmount: 30, cashDirection: 'OUTFLOW' }),
    }));
  });

  it('blocks duplicate refund processing', async () => {
    jest.spyOn(Refund, 'findOne').mockReturnValue(queryResolved({ _id: 'refund-complete', refundStatus: 'PROCESSED' }) as any);
    await expect(refundService.applyAction(
      'refund-complete',
      'PROCESS',
      { reason: 'Duplicate run.' },
      'en',
      'user-1'
    )).rejects.toThrow('Only an approved refund can be processed');
  });
});
