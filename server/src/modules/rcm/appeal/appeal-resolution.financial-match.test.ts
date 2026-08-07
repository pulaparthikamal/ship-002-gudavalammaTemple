import { appealResolutionService } from './appeal-resolution.service';
import { Appeal } from './appeal.model';
import { Denial } from '../denial/denial.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { EraException } from '../era-exception/era-exception.model';
import { claimClosureService } from '../claim/claim-closure.service';

jest.mock('../events/rcm-event-stream.service', () => ({
  publishRcmRealtimeEvent: jest.fn(),
}));
jest.mock('../claim/claim-closure.service', () => ({
  claimClosureService: { syncClaimClosureStatus: jest.fn().mockResolvedValue({}) },
}));
jest.mock('../corrected-claim/corrected-claim.service', () => ({
  correctedClaimService: { finalizeResolvedByPayment: jest.fn().mockResolvedValue(null) },
}));

function queryResolved(value: any) {
  return { session: jest.fn().mockResolvedValue(value) };
}

function denial(id: string, amount = 100): any {
  return {
    _id: id,
    claimId: 'claim-1',
    claimLineId: 'line-1',
    arWorkItemId: `ar-${id}`,
    payerId: 'AETNA',
    cptCode: '99213',
    denialStatus: 'OVERTURNED',
    denialAmount: amount,
    remainingDeniedBalance: amount,
    statusHistory: [],
    relatedPaymentPostingIds: [],
    save: jest.fn().mockResolvedValue(undefined),
  };
}

function payment(paidAmount: number, patientRespAmount = 0, adjustmentAmount = 0): any {
  return {
    _id: 'posting-1',
    claimId: 'claim-1',
    payerId: 'AETNA',
    eraEobProcessingId: 'era-reprocessed',
    paymentLines: [{
      claimLineId: 'line-1',
      procedureCode: '99213',
      serviceDate: new Date('2026-05-21'),
      paidAmount,
      patientRespAmount,
      adjustmentAmount,
      deniedAmount: 0,
    }],
    save: jest.fn().mockResolvedValue(undefined),
  };
}

describe('appealResolutionService reprocessed ERA allocation', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    jest.spyOn(Appeal, 'findOne').mockReturnValue(queryResolved(null) as any);
    jest.spyOn(ArWorkItem, 'findOneAndUpdate').mockResolvedValue(null as any);
    jest.spyOn(EraException, 'create').mockResolvedValue([] as any);
  });

  it('resolves exactly one overturned denial from an exact payment-line match', async () => {
    const candidate = denial('denial-1');
    jest.spyOn(Denial, 'find').mockReturnValue(queryResolved([candidate]) as any);
    jest.spyOn(Denial, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    const claim: any = { paymentStatus: 'DENIED', save: jest.fn().mockResolvedValue(undefined) };

    const result = await appealResolutionService.resolveFromPaymentPosting(payment(100), { claim, updatedBy: 'user-1' });

    expect(result).toHaveLength(1);
    expect(candidate.denialStatus).toBe('RESOLVED');
    expect(candidate.remainingDeniedBalance).toBe(0);
    expect(candidate.matchConfidence).toBeGreaterThanOrEqual(70);
    expect(candidate.paymentAllocations).toEqual([expect.objectContaining({ allocationAmount: 100 })]);
    expect(claimClosureService.syncClaimClosureStatus).toHaveBeenCalled();
  });

  it('updates appeal recovery accounting when a reprocessed payment resolves a denial', async () => {
    const candidate = denial('denial-recovery', 1600);
    candidate.appealId = 'appeal-1';
    const appeal: any = {
      _id: 'appeal-1',
      claimId: 'claim-1',
      payerId: 'AETNA',
      appealStatus: 'OVERTURNED',
      packetStatus: 'DECISION_RECEIVED',
      recoveredAmount: 0,
      statusHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Appeal, 'findOne').mockReturnValue(queryResolved(appeal) as any);
    jest.spyOn(Denial, 'find').mockReturnValue(queryResolved([candidate]) as any);
    jest.spyOn(Denial, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    const claim: any = { paymentStatus: 'DENIED', save: jest.fn().mockResolvedValue(undefined) };

    await appealResolutionService.resolveFromPaymentPosting(payment(1100, 500), { claim, updatedBy: 'user-1' });

    expect(appeal.recoveredAmount).toBe(1600);
    expect(appeal.payerRecoveredAmount).toBe(1100);
    expect(appeal.patientRecoveredAmount).toBe(500);
    expect(appeal.recoveryStatus).toBe('FULL');
    expect(appeal.recoveryPercent).toBe(100);
    expect(appeal.appealStatus).toBe('CLOSED');
    expect(appeal.packetStatus).toBe('CLOSED');
    expect(appeal.statusHistory).toEqual([
      expect.objectContaining({
        previousStatus: 'OVERTURNED',
        newStatus: 'CLOSED',
        source: 'REPROCESSED_PAYMENT',
      }),
    ]);
    expect(appeal.save).toHaveBeenCalled();
  });

  it('creates manual review and does not auto-resolve when one payment line matches multiple denials', async () => {
    const first = denial('denial-1');
    const second = denial('denial-2');
    jest.spyOn(Denial, 'find').mockReturnValue(queryResolved([first, second]) as any);

    const result = await appealResolutionService.resolveFromPaymentPosting(payment(100), {
      claim: { save: jest.fn().mockResolvedValue(undefined) } as any,
      updatedBy: 'user-1',
    });

    expect(result).toHaveLength(0);
    expect(EraException.create).toHaveBeenCalled();
    expect(first.denialStatus).toBe('OVERTURNED');
    expect(second.denialStatus).toBe('OVERTURNED');
    expect(first.manualReviewRequired).toBe(true);
  });

  it('partially allocates a payment and leaves the overturned denial balance open', async () => {
    const candidate = denial('denial-partial');
    jest.spyOn(Denial, 'find').mockReturnValue(queryResolved([candidate]) as any);
    const claim: any = { paymentStatus: 'DENIED', save: jest.fn().mockResolvedValue(undefined) };

    const result = await appealResolutionService.resolveFromPaymentPosting(payment(40), { claim, updatedBy: 'user-1' });

    expect(result).toHaveLength(1);
    expect(candidate.denialStatus).toBe('OVERTURNED');
    expect(candidate.resolvedAmount).toBe(40);
    expect(candidate.remainingDeniedBalance).toBe(60);
    expect(ArWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'PARTIALLY_RESOLVED', balanceAmount: 60 }),
      expect.anything()
    );
  });

  it('resolves an overturned denial when the reprocessed ERA splits allowed liability between payer payment and patient responsibility', async () => {
    const candidate = denial('denial-patient-resp', 1600);
    jest.spyOn(Denial, 'find').mockReturnValue(queryResolved([candidate]) as any);
    jest.spyOn(Denial, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    const claim: any = { paymentStatus: 'DENIED', save: jest.fn().mockResolvedValue(undefined) };

    const result = await appealResolutionService.resolveFromPaymentPosting(payment(1100, 500), { claim, updatedBy: 'user-1' });

    expect(result).toHaveLength(1);
    expect(candidate.denialStatus).toBe('RESOLVED');
    expect(candidate.resolvedAmount).toBe(1600);
    expect(candidate.remainingDeniedBalance).toBe(0);
    expect(candidate.denialBalance).toBe(0);
    expect(candidate.paymentAllocations).toEqual([
      expect.objectContaining({
        allocationAmount: 1600,
        payerPaidAmount: 1100,
        patientResponsibilityAppliedAmount: 500,
      }),
    ]);
    expect(ArWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'CLOSED', balanceAmount: 0 }),
      expect.anything()
    );
  });

  it('resolves an overturned billed denial when reprocessed ERA includes payer, patient, and contractual adjustment', async () => {
    const candidate = denial('denial-contractual', 1650);
    jest.spyOn(Denial, 'find').mockReturnValue(queryResolved([candidate]) as any);
    jest.spyOn(Denial, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    const claim: any = { paymentStatus: 'DENIED', save: jest.fn().mockResolvedValue(undefined) };

    const result = await appealResolutionService.resolveFromPaymentPosting(payment(1100, 500, 50), { claim, updatedBy: 'user-1' });

    expect(result).toHaveLength(1);
    expect(candidate.denialStatus).toBe('RESOLVED');
    expect(candidate.resolvedAmount).toBe(1650);
    expect(candidate.remainingDeniedBalance).toBe(0);
    expect(candidate.denialBalance).toBe(0);
    expect(candidate.paymentAllocations).toEqual([
      expect.objectContaining({
        allocationAmount: 1650,
        payerPaidAmount: 1100,
        patientResponsibilityAppliedAmount: 500,
        contractualAdjustmentAppliedAmount: 50,
      }),
    ]);
    expect(ArWorkItem.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'CLOSED', balanceAmount: 0 }),
      expect.anything()
    );
  });
});
