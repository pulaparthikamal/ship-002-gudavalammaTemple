import { claimClosureService } from './claim-closure.service';
import { Claim } from './claim.model';
import { ClaimClosureSnapshot } from './claim-closure-snapshot.model';
import { Denial } from '../denial/denial.model';
import { Appeal } from '../appeal/appeal.model';
import { CorrectedClaim } from '../corrected-claim/corrected-claim.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { EraEobProcessing } from '../era-eob-processing/era-eob-processing.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { Refund } from '../refund/refund.model';
import { Collection } from '../collection/collection.model';
import { EraException } from '../era-exception/era-exception.model';
import { financialEventService } from '../financial-event/financial-event.service';

function queryResolved(value: any) {
  return {
    session: jest.fn().mockResolvedValue(value),
  };
}

function queryLeanResolved(value: any) {
  return {
    session: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(value),
    }),
  };
}

function latestSnapshotResolved(value: any) {
  return {
    sort: jest.fn().mockReturnValue({
      session: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue(value),
      }),
    }),
  };
}

describe('claimClosureService.evaluate', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks claim closure when an open AR item exists with lowercase legacy status', async () => {
    const claim = {
      _id: 'claim-1',
      claimId: 'claim-number-1',
      totalChargeAmount: 100,
      paymentStatus: 'PAID',
    };

    jest.spyOn(Claim, 'findOne').mockReturnValue(queryResolved(claim) as any);
    jest.spyOn(Denial, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(Appeal, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(CorrectedClaim, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    const arCountSpy = jest.spyOn(ArWorkItem, 'countDocuments').mockReturnValue(queryResolved(1) as any);
    jest.spyOn(EraEobProcessing, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(EraException, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    const patientBillingSpy = jest.spyOn(PatientBilling, 'find').mockReturnValue(queryLeanResolved([]) as any);
    const collectionSpy = jest.spyOn(Collection, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    const refundSpy = jest.spyOn(Refund, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(PaymentPosting, 'find').mockReturnValue(queryLeanResolved([{ postedAmount: 100 }]) as any);
    jest.spyOn(PaymentPosting, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(financialEventService, 'buildClaimFinancialBalanceSnapshot').mockResolvedValue({
      postedAmount: 100,
      remainingBalance: 0,
      payerResponsibilityBalance: 0,
      patientResponsibilityBalance: 0,
      pendingRefundAmount: 0,
      unresolvedReversalAmount: 0,
      unreconciledPaymentAmount: 0,
      recoupmentBalance: 0,
      takebackBalance: 0,
      ledgerBalanced: true,
    } as any);

    const result = await claimClosureService.evaluate('claim-1');

    expect(result.canClose).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('Open AR work items remain'),
    ]));
    expect(arCountSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: expect.objectContaining({
        $in: expect.arrayContaining(['OPEN', 'open']),
      }),
    }));
    expect(patientBillingSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: { $in: expect.arrayContaining(['COLLECTIONS_READY', 'PARTIALLY_PAID']) },
    }));
    expect(refundSpy).toHaveBeenCalledWith(expect.objectContaining({
      refundStatus: { $in: expect.arrayContaining(['PENDING_REVIEW']) },
    }));
    expect(collectionSpy).toHaveBeenCalledWith(expect.objectContaining({
      status: { $in: expect.arrayContaining(['REVIEW']) },
    }));
  });

  it('blocks claim closure when ledger balances are not zero even if workflow statuses are clear', async () => {
    const claim = {
      _id: 'claim-2',
      claimId: 'claim-number-2',
      totalChargeAmount: 100,
      paymentStatus: 'PAID',
    };

    jest.spyOn(Claim, 'findOne').mockReturnValue(queryResolved(claim) as any);
    jest.spyOn(Denial, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(Appeal, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(CorrectedClaim, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(ArWorkItem, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(EraEobProcessing, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(EraException, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(PatientBilling, 'find').mockReturnValue(queryLeanResolved([]) as any);
    jest.spyOn(Collection, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(Refund, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(PaymentPosting, 'find').mockReturnValue(queryLeanResolved([{ postedAmount: 100 }]) as any);
    jest.spyOn(PaymentPosting, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(financialEventService, 'buildClaimFinancialBalanceSnapshot').mockResolvedValue({
      postedAmount: 100,
      remainingBalance: 0,
      payerResponsibilityBalance: 15,
      patientResponsibilityBalance: 0,
      pendingRefundAmount: 0,
      unresolvedReversalAmount: 0,
      unreconciledPaymentAmount: 0,
      recoupmentBalance: 0,
      takebackBalance: 0,
      ledgerBalanced: false,
    } as any);

    const result = await claimClosureService.evaluate('claim-2');

    expect(result.canClose).toBe(false);
    expect(result.financial.payerResponsibilityBalance).toBe(15);
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('Ledger balances are not balanced'),
    ]));
  });

  it('blocks closure when denial, unreconciled ERA, pending refund, and collection blockers remain', async () => {
    const claim = {
      _id: 'claim-blocked',
      claimId: 'claim-number-blocked',
      totalChargeAmount: 100,
      paymentStatus: 'PAID',
    };

    jest.spyOn(Claim, 'findOne').mockReturnValue(queryResolved(claim) as any);
    jest.spyOn(Denial, 'countDocuments').mockReturnValue(queryResolved(1) as any);
    jest.spyOn(Appeal, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(CorrectedClaim, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(ArWorkItem, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(EraEobProcessing, 'countDocuments').mockReturnValue(queryResolved(1) as any);
    jest.spyOn(EraException, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(PatientBilling, 'find').mockReturnValue(queryLeanResolved([]) as any);
    jest.spyOn(Collection, 'countDocuments').mockReturnValue(queryResolved(1) as any);
    jest.spyOn(Refund, 'countDocuments').mockReturnValue(queryResolved(1) as any);
    jest.spyOn(PaymentPosting, 'find').mockReturnValue(queryLeanResolved([{ postedAmount: 100 }]) as any);
    jest.spyOn(PaymentPosting, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(financialEventService, 'buildClaimFinancialBalanceSnapshot').mockResolvedValue({
      postedAmount: 100,
      remainingBalance: 0,
      payerResponsibilityBalance: 0,
      patientResponsibilityBalance: 0,
      pendingRefundAmount: 0,
      unresolvedReversalAmount: 0,
      unreconciledPaymentAmount: 0,
      recoupmentBalance: 0,
      takebackBalance: 0,
      ledgerBalanced: true,
    } as any);

    const result = await claimClosureService.evaluate('claim-blocked');

    expect(result.canClose).toBe(false);
    expect(result.blockers).toEqual(expect.arrayContaining([
      expect.stringContaining('Open denials remain'),
      expect.stringContaining('Unreconciled ERA records remain'),
      expect.stringContaining('Pending collections remain'),
      expect.stringContaining('Pending refunds remain'),
    ]));
  });

  it('writes an immutable hash-chained closure snapshot when a claim closes cleanly', async () => {
    const claim: any = {
      _id: 'claim-clean',
      claimId: 'claim-number-clean',
      totalChargeAmount: 100,
      paymentStatus: 'PAID',
      statusHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(Claim, 'findOne').mockReturnValue(queryResolved(claim) as any);
    jest.spyOn(Denial, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(Appeal, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(CorrectedClaim, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(ArWorkItem, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(EraEobProcessing, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(EraException, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(PatientBilling, 'find').mockReturnValue(queryLeanResolved([]) as any);
    jest.spyOn(Collection, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(Refund, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(PaymentPosting, 'find').mockReturnValue(queryLeanResolved([{ postedAmount: 100 }]) as any);
    jest.spyOn(PaymentPosting, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(financialEventService, 'buildClaimFinancialBalanceSnapshot').mockResolvedValue({
      postedAmount: 100,
      remainingBalance: 0,
      payerResponsibilityBalance: 0,
      patientResponsibilityBalance: 0,
      pendingRefundAmount: 0,
      unresolvedReversalAmount: 0,
      unreconciledPaymentAmount: 0,
      recoupmentBalance: 0,
      takebackBalance: 0,
      ledgerBalanced: true,
    } as any);
    jest.spyOn(financialEventService, 'record').mockResolvedValue({
      _id: 'event-close',
      ledgerSequence: 7,
      ledgerHash: 'ledger-hash-7',
    } as any);
    jest.spyOn(ClaimClosureSnapshot, 'findOne').mockReturnValue(latestSnapshotResolved({
      snapshotSequence: 2,
      snapshotHash: 'previous-snapshot-hash',
    }) as any);
    const snapshotCreateSpy = jest.spyOn(ClaimClosureSnapshot, 'create').mockResolvedValue([{ _id: 'snapshot-3' }] as any);

    const result = await claimClosureService.close('claim-clean', 'Balanced and reconciled', 'user-1');

    expect(result.claim.closureStatus).toBe('CLOSED');
    expect(snapshotCreateSpy).toHaveBeenCalledWith([expect.objectContaining({
      eventType: 'CLAIM_CLOSED',
      claimId: 'claim-clean',
      claimBusinessId: 'claim-number-clean',
      canClose: true,
      blockers: [],
      snapshotSequence: 3,
      previousSnapshotHash: 'previous-snapshot-hash',
      financialLedgerSequence: 7,
      financialLedgerHeadHash: 'ledger-hash-7',
      snapshotHash: expect.any(String),
      active: true,
      isDeleted: false,
    })], { session: undefined });
    expect((snapshotCreateSpy.mock.calls[0][0] as any)[0].snapshotHash).toHaveLength(64);
  });

  it('reopens a closed claim and records an audit event when a later financial blocker is detected', async () => {
    const claim: any = {
      _id: 'claim-closed',
      claimId: 'claim-number-closed',
      totalChargeAmount: 100,
      paymentStatus: 'PAID',
      closureStatus: 'CLOSED',
      closedAt: new Date(),
      closedBy: 'closer',
      closeReason: 'Balanced',
      statusHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(Claim, 'findOne').mockReturnValue(queryResolved(claim) as any);
    jest.spyOn(Denial, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(Appeal, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(CorrectedClaim, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(ArWorkItem, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(EraEobProcessing, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(EraException, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(PatientBilling, 'find').mockReturnValue(queryLeanResolved([]) as any);
    jest.spyOn(Collection, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(Refund, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(PaymentPosting, 'find').mockReturnValue(queryLeanResolved([]) as any);
    jest.spyOn(PaymentPosting, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(financialEventService, 'buildClaimFinancialBalanceSnapshot').mockResolvedValue({
      payerResponsibilityBalance: 100,
      patientResponsibilityBalance: 0,
      pendingRefundAmount: 0,
      unresolvedReversalAmount: 0,
      unreconciledPaymentAmount: 0,
      recoupmentBalance: 0,
      takebackBalance: 0,
      ledgerBalanced: false,
    } as any);
    const recordSpy = jest.spyOn(financialEventService, 'record').mockResolvedValue({ _id: 'event-reopen' } as any);
    jest.spyOn(ClaimClosureSnapshot, 'findOne').mockReturnValue(latestSnapshotResolved(null) as any);
    const snapshotCreateSpy = jest.spyOn(ClaimClosureSnapshot, 'create').mockResolvedValue([{ _id: 'snapshot-reopen' }] as any);

    const result = await claimClosureService.syncClaimClosureStatus('claim-closed', 'user-1');

    expect(result.claim.closureStatus).toBe('REOPENED');
    expect(result.claim.closedAt).toBeUndefined();
    expect(result.claim.reopenReason).toContain('Automatically reopened');
    expect(recordSpy).toHaveBeenCalledWith(expect.objectContaining({
      eventType: 'CLAIM_REOPENED',
      claimId: 'claim-closed',
    }));
    expect(snapshotCreateSpy).toHaveBeenCalledWith([expect.objectContaining({
      eventType: 'CLAIM_AUTO_REOPENED',
      claimId: 'claim-closed',
      canClose: false,
      blockers: expect.arrayContaining([
        expect.stringContaining('Ledger balances are not balanced'),
      ]),
      snapshotSequence: 1,
      snapshotHash: expect.any(String),
    })], { session: undefined });
    expect(claim.save).toHaveBeenCalled();
  });

  it('does not keep an acknowledged paid claim in awaiting ERA when financial blockers remain', async () => {
    const claim: any = {
      _id: 'claim-paid-blocked',
      claimId: 'claim-number-paid-blocked',
      totalChargeAmount: 315,
      submissionStatus: 'Acknowledged',
      paymentStatus: 'PAID',
      closureStatus: 'AWAITING_ERA',
      statusHistory: [],
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(Claim, 'findOne').mockReturnValue(queryResolved(claim) as any);
    jest.spyOn(Denial, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(Appeal, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(CorrectedClaim, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(ArWorkItem, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(EraEobProcessing, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(EraException, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(PatientBilling, 'find').mockReturnValue(queryLeanResolved([]) as any);
    jest.spyOn(Collection, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(Refund, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(PaymentPosting, 'find').mockReturnValue(queryLeanResolved([{ postedAmount: 315 }]) as any);
    jest.spyOn(PaymentPosting, 'countDocuments').mockReturnValue(queryResolved(0) as any);
    jest.spyOn(financialEventService, 'buildClaimFinancialBalanceSnapshot').mockResolvedValue({
      postedAmount: 315,
      postingCount: 1,
      remainingBalance: 0,
      payerResponsibilityBalance: 0,
      patientResponsibilityBalance: 299,
      pendingRefundAmount: 0,
      unresolvedReversalAmount: 0,
      unreconciledPaymentAmount: 0,
      recoupmentBalance: 0,
      takebackBalance: 0,
      ledgerBalanced: false,
    } as any);

    const result = await claimClosureService.syncClaimClosureStatus('claim-paid-blocked', 'user-1');

    expect(result.claim.closureStatus).toBe('FOLLOW_UP_REQUIRED');
    expect(result.evaluation.canClose).toBe(false);
    expect(claim.statusHistory).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'FOLLOW_UP_REQUIRED' }),
    ]));
  });
});
