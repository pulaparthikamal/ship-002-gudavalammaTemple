import { financialEventService } from './financial-event.service';
import { FinancialEvent } from './financial-event.model';
import { Claim } from '../claim/claim.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { Adjustment } from '../adjustment/adjustment.model';
import { Refund } from '../refund/refund.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { PatientPayment } from '../patient-payment/patient-payment.model';
import { EraException } from '../era-exception/era-exception.model';

function leanResolved(value: any) {
  return {
    lean: jest.fn().mockResolvedValue(value),
  };
}

function sessionLeanResolved(value: any) {
  return {
    session: jest.fn().mockReturnValue(leanResolved(value)),
  };
}

function countSessionResolved(value: number) {
  return {
    session: jest.fn().mockResolvedValue(value),
  };
}

describe('financialEventService.record', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('serializes concurrent claim financial events into an intact hash chain', async () => {
    const ledger = { sequence: 0, headHash: undefined as string | undefined };
    jest.spyOn(Claim, 'findOneAndUpdate').mockImplementation((filter: any, update: any) => {
      if (update?.$set?.financialLedgerSequence !== undefined) {
        const expectedHead = filter.financialLedgerHeadHash?.$in ? undefined : filter.financialLedgerHeadHash;
        const succeeds = filter.financialLedgerSequence === ledger.sequence && expectedHead === ledger.headHash;
        if (succeeds) {
          ledger.sequence = update.$set.financialLedgerSequence;
          ledger.headHash = update.$set.financialLedgerHeadHash;
          return leanResolved({ financialLedgerSequence: ledger.sequence, financialLedgerHeadHash: ledger.headHash }) as any;
        }
        return leanResolved(null) as any;
      }
      return Promise.resolve({}) as any;
    });
    jest.spyOn(Claim, 'findOne').mockImplementation(() => sessionLeanResolved({
      _id: 'claim-1',
      totalChargeAmount: 0,
      financialLedgerSequence: ledger.sequence,
      financialLedgerHeadHash: ledger.headHash,
    }) as any);
    jest.spyOn(PaymentPosting, 'find').mockReturnValue(sessionLeanResolved([]) as any);
    jest.spyOn(Adjustment, 'find').mockReturnValue(sessionLeanResolved([]) as any);
    jest.spyOn(Refund, 'find').mockReturnValue(sessionLeanResolved([]) as any);
    jest.spyOn(PatientBilling, 'find').mockReturnValue(sessionLeanResolved([]) as any);
    jest.spyOn(PatientPayment, 'find').mockReturnValue(sessionLeanResolved([]) as any);
    jest.spyOn(EraException, 'countDocuments').mockReturnValue(countSessionResolved(0) as any);
    const storedEvents: any[] = [];
    jest.spyOn(FinancialEvent, 'create').mockImplementation(async (payload: any) => {
      const event = { _id: `event-${payload[0].ledgerSequence}`, ...payload[0] };
      storedEvents.push(event);
      return [event] as any;
    });

    const [first, second] = await Promise.all([
      financialEventService.record({ eventType: 'PAYMENT_POSTED', claimId: 'claim-1', createdBy: 'user-1' }),
      financialEventService.record({ eventType: 'ADJUSTMENT_POSTED', claimId: 'claim-1', createdBy: 'user-1' }),
    ]);

    const orderedEvents = storedEvents.sort((left, right) => left.ledgerSequence - right.ledgerSequence);
    expect([first.ledgerSequence, second.ledgerSequence].sort()).toEqual([1, 2]);
    expect(orderedEvents[0].previousLedgerHash).toBeUndefined();
    expect(orderedEvents[1].previousLedgerHash).toBe(orderedEvents[0].ledgerHash);
    expect(ledger.sequence).toBe(2);
    expect(ledger.headHash).toBe(orderedEvents[1].ledgerHash);
  });

  it('does not carry pre-adjudication expected patient responsibility after full payer payment with no PR adjustment', async () => {
    jest.spyOn(Claim, 'findOne').mockReturnValue(sessionLeanResolved({
      _id: 'claim-full-pay',
      totalChargeAmount: 315,
      claimLines: [
        { expectedPatientResponsibility: 120, expectedInsurancePayment: 0 },
        { expectedPatientResponsibility: 44, expectedInsurancePayment: 0 },
        { expectedPatientResponsibility: 135, expectedInsurancePayment: 0 },
      ],
    }) as any);
    jest.spyOn(PaymentPosting, 'find').mockReturnValue(sessionLeanResolved([{
      postingStatus: 'POSTED',
      postedAmount: 315,
    }]) as any);
    jest.spyOn(Adjustment, 'find').mockReturnValue(sessionLeanResolved([]) as any);
    jest.spyOn(Refund, 'find').mockReturnValue(sessionLeanResolved([]) as any);
    jest.spyOn(PatientBilling, 'find').mockReturnValue(sessionLeanResolved([]) as any);
    jest.spyOn(PatientPayment, 'find').mockReturnValue(sessionLeanResolved([]) as any);
    jest.spyOn(EraException, 'countDocuments').mockReturnValue(countSessionResolved(0) as any);

    const snapshot = await financialEventService.buildClaimFinancialBalanceSnapshot('claim-full-pay');

    expect(snapshot).toEqual(expect.objectContaining({
      postedAmount: 315,
      patientResponsibilityAmount: 0,
      patientResponsibilityBalance: 0,
      payerResponsibilityBalance: 0,
      ledgerBalanced: true,
      financialBalanceStatus: 'BALANCED',
    }));
  });
});
