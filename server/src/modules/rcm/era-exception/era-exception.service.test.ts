import { eraExceptionService } from './era-exception.service';
import { EraException } from './era-exception.model';
import { Claim } from '../claim/claim.model';
import { Denial } from '../denial/denial.model';
import { Appeal } from '../appeal/appeal.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { EraEobProcessing } from '../era-eob-processing/era-eob-processing.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { enqueueRcmJob } from '../background-job/rcm-queue.service';
import { claimClosureService } from '../claim/claim-closure.service';

jest.mock('../background-job/rcm-queue.service', () => ({
  enqueueRcmJob: jest.fn().mockResolvedValue({ duplicate: false }),
  registerRcmJobHandler: jest.fn(),
}));

jest.mock('../claim/claim-closure.service', () => ({
  claimClosureService: {
    syncClaimClosureStatus: jest.fn().mockResolvedValue({}),
  },
}));

function buildException(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'exception-1',
    exceptionType: 'POSTING_IMBALANCE',
    severity: 'HIGH',
    status: 'OPEN',
    relatedClaim: 'claim-1',
    relatedERA: 'era-1',
    relatedPaymentPosting: 'posting-1',
    actionHistory: [],
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

describe('eraExceptionService.action', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('requires a reason when resolving an ERA exception', async () => {
    jest.spyOn(EraException, 'findOne').mockResolvedValue(buildException());

    await expect(eraExceptionService.action('exception-1', 'resolve', {}, 'user-1'))
      .rejects.toThrow('ERA exception resolution reason is required');
  });

  it('queues reprocessing and marks the related ERA exception for review', async () => {
    const item = buildException();
    jest.spyOn(EraException, 'findOne').mockResolvedValue(item);
    jest.spyOn(EraEobProcessing, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);

    await eraExceptionService.action('exception-1', 'reprocess', { reason: 'Retry matching' }, 'user-1');

    expect(item.status).toBe('REPROCESSING');
    expect(EraEobProcessing.updateOne).toHaveBeenCalled();
    expect(enqueueRcmJob).toHaveBeenCalledWith(expect.objectContaining({
      jobType: 'PROCESS_ERA_EXCEPTION',
      payload: expect.objectContaining({ eraExceptionId: 'exception-1', action: 'REPROCESS' }),
    }));
  });

  it('creates a denial and AR item from an ERA exception', async () => {
    const item = buildException();
    const denial: any = { _id: 'denial-1', save: jest.fn().mockResolvedValue(undefined) };
    jest.spyOn(EraException, 'findOne').mockResolvedValue(item);
    jest.spyOn(Claim, 'findOne').mockResolvedValue({ _id: 'claim-1', patientId: 'patient-1', payerId: 'payer-1' } as any);
    jest.spyOn(Denial, 'create').mockResolvedValue([denial] as any);
    jest.spyOn(ArWorkItem, 'create').mockResolvedValue([{ _id: 'ar-1' }] as any);

    await eraExceptionService.action('exception-1', 'create_denial', { denialAmount: 50, reason: 'Denied line' }, 'user-1');

    expect(Denial.create).toHaveBeenCalledWith([expect.objectContaining({
      claimId: 'claim-1',
      denialStatus: 'OPEN',
      denialSource: 'ERA_EXCEPTION',
    })]);
    expect(item.relatedDenial).toBe('denial-1');
    expect(item.relatedARWorkItem).toBe('ar-1');
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalledWith('claim-1', 'user-1');
  });

  it('creates an appeal from an ERA exception denial', async () => {
    const item = buildException({ relatedDenial: 'denial-1' });
    const denial: any = {
      _id: 'denial-1',
      claimId: 'claim-1',
      arWorkItemId: 'ar-1',
      payerId: 'payer-1',
      denialCode: '50',
      denialCategory: 'MEDICAL_NECESSITY',
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(EraException, 'findOne').mockResolvedValue(item);
    jest.spyOn(Denial, 'findOne').mockResolvedValue(denial);
    jest.spyOn(Appeal, 'create').mockResolvedValue([{ _id: 'appeal-1' }] as any);
    jest.spyOn(ArWorkItem, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);

    await eraExceptionService.action('exception-1', 'create_appeal', { reason: 'Appeal payer decision' }, 'user-1');

    expect(Appeal.create).toHaveBeenCalledWith([expect.objectContaining({
      denialId: 'denial-1',
      claimId: 'claim-1',
      appealStatus: 'DRAFT',
    })]);
    expect(denial.denialStatus).toBe('APPEAL_READY');
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalledWith('claim-1', 'user-1');
  });

  it('transfers an ERA exception balance to patient billing', async () => {
    const item = buildException();
    jest.spyOn(EraException, 'findOne').mockResolvedValue(item);
    jest.spyOn(Claim, 'findOne').mockResolvedValue({ _id: 'claim-1', patientId: 'patient-1' } as any);
    jest.spyOn(PatientBilling, 'create').mockResolvedValue([{ _id: 'billing-1' }] as any);

    await eraExceptionService.action('exception-1', 'transfer_to_billing', { amount: 25, reason: 'Patient responsibility' }, 'user-1');

    expect(PatientBilling.create).toHaveBeenCalledWith([expect.objectContaining({
      claimId: 'claim-1',
      patientId: 'patient-1',
      currentBalance: 25,
      status: 'READY_TO_SEND',
    })]);
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalledWith('claim-1', 'user-1');
  });

  it('resolves a manual payment match and updates denial, appeal recovery, and AR', async () => {
    const item = buildException({
      exceptionType: 'MANUAL_REVIEW_REQUIRED',
      relatedDenial: 'denial-1',
      relatedPaymentPosting: 'posting-1',
    });
    const denial: any = {
      _id: 'denial-1',
      claimId: 'claim-1',
      payerId: 'payer-1',
      appealId: 'appeal-1',
      arWorkItemId: 'ar-1',
      denialAmount: 1600,
      resolvedAmount: 0,
      relatedPaymentPostingIds: [],
      manualReviewRequired: true,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const appeal: any = {
      _id: 'appeal-1',
      claimId: 'claim-1',
      payerId: 'payer-1',
      appealStatus: 'OVERTURNED',
      packetStatus: 'DECISION_RECEIVED',
      recoveredAmount: 0,
      statusHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(EraException, 'findOne').mockResolvedValue(item);
    jest.spyOn(Denial, 'findOne').mockResolvedValue(denial);
    jest.spyOn(PaymentPosting, 'findOne').mockResolvedValue({
      _id: 'posting-1',
      claimId: 'claim-1',
      payerId: 'payer-1',
      postedAmount: 1100,
      eraEobProcessingId: 'era-1',
      financialEventId: 'financial-event-1',
    } as any);
    jest.spyOn(Appeal, 'findOne').mockResolvedValue(appeal);
    jest.spyOn(ArWorkItem, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as any);

    await eraExceptionService.action('exception-1', 'resolve_payment_match', {
      reason: 'Manual review confirmed this reprocessed payment resolves the appeal.',
      payerRecoveredAmount: 1100,
      patientRecoveredAmount: 500,
    }, 'user-1');

    expect(denial.denialStatus).toBe('RESOLVED');
    expect(denial.manualReviewRequired).toBe(false);
    expect(denial.remainingDeniedBalance).toBe(0);
    expect(appeal.recoveredAmount).toBe(1600);
    expect(appeal.recoveryStatus).toBe('FULL');
    expect(appeal.recoveryPercent).toBe(100);
    expect(appeal.appealStatus).toBe('CLOSED');
    expect(appeal.packetStatus).toBe('CLOSED');
    expect(appeal.statusHistory).toEqual([
      expect.objectContaining({
        previousStatus: 'OVERTURNED',
        newStatus: 'CLOSED',
        source: 'MANUAL_PAYMENT_MATCH',
      }),
    ]);
    expect(ArWorkItem.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'ar-1' }),
      expect.objectContaining({ status: 'CLOSED', balanceAmount: 0 })
    );
    expect(item.status).toBe('RESOLVED');
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalledWith('claim-1', 'user-1');
  });
});
