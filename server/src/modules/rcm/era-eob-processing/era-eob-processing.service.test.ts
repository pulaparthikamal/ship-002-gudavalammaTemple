import { eraEobProcessingService } from './era-eob-processing.service';
import { EraEobProcessing } from './era-eob-processing.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { Claim } from '../claim/claim.model';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { Adjustment } from '../adjustment/adjustment.model';
import { Denial } from '../denial/denial.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { FinancialEvent } from '../financial-event/financial-event.model';
import { denialWorkflowService } from '../denial/denial-workflow.service';
import { arWorkItemService } from '../ar-work-item/ar-work-item.service';
import { patientBillingService } from '../patient-billing/patient-billing.service';
import { financialEventService } from '../financial-event/financial-event.service';
import { claimClosureService } from '../claim/claim-closure.service';
import { appealResolutionService } from '../appeal/appeal-resolution.service';
import { eraExceptionService } from '../era-exception/era-exception.service';

jest.mock('../../../utils/mongoose-transaction.util', () => ({
  withMongoTransaction: (operation: (session?: unknown) => Promise<unknown>) => operation(undefined),
}));

jest.mock('../events/rcm-event-stream.service', () => ({
  publishRcmRealtimeEvent: jest.fn(),
}));

jest.mock('../financial-event/financial-event.service', () => ({
  financialEventService: {
    record: jest.fn().mockResolvedValue({
      _id: 'financial-event-1',
      ledgerSequence: 1,
      financialBalanceSnapshot: {},
    }),
  },
}));

jest.mock('../claim/claim-closure.service', () => ({
  claimClosureService: {
    syncClaimClosureStatus: jest.fn().mockResolvedValue({}),
    reopenForFinancialMutation: jest.fn().mockResolvedValue(false),
  },
}));

jest.mock('../appeal/appeal-resolution.service', () => ({
  appealResolutionService: {
    resolveFromPaymentPosting: jest.fn().mockResolvedValue([]),
  },
}));

function queryResolved<T>(value: T) {
  return {
    session: jest.fn().mockResolvedValue(value),
  };
}

function sortedQueryResolved<T>(value: T) {
  return {
    sort: jest.fn().mockReturnValue(queryResolved(value)),
  };
}

const claimId = '665000000000000000000101';
const claimLineId = '665000000000000000000102';
const submissionId = '665000000000000000000103';
const eraId = '665000000000000000000104';
const paymentPostingId = '665000000000000000000105';
const adjustmentId = '665000000000000000000106';
const userId = '665000000000000000000107';

function build835(controlNumber: string) {
  return [
    'ISA*00*          *00*          *ZZ*CLEARINGHOUSE   *ZZ*RCMRECEIVER    *260521*1200*^*00501*000000001*0*T*:~',
    'GS*HP*CLEARINGHOUSE*RCMRECEIVER*20260521*1200*1*X*005010X221A1~',
    'ST*835*0001~',
    'BPR*I*80*C*ACH************20260521~',
    'TRN*1*TRACE-HAPPY-PATH*1999999999~',
    'N1*PR*Aetna~',
    'N1*PE*RCM PAYMENT RECEIVER~',
    `CLP*${controlNumber}*1*155*80*0*12*PAYER-${controlNumber}~`,
    `SVC*HC:99213*155*80~`,
    'CAS*CO*45*75~',
    `REF*6R*${claimLineId}~`,
    'DTM*472*20260521~',
    'AMT*B6*80~',
    'SE*10*0001~',
    'GE*1*1~',
    'IEA*1*000000001~',
  ].join('');
}

function buildMultiCasDenied835(controlNumber: string) {
  return [
    'ISA*00*          *00*          *ZZ*CLEARINGHOUSE   *ZZ*RCMRECEIVER    *260521*1200*^*00501*000000002*0*T*:~',
    'GS*HP*CLEARINGHOUSE*RCMRECEIVER*20260521*1200*2*X*005010X221A1~',
    'ST*835*0002~',
    'BPR*I*0*C*ACH************20260521~',
    'TRN*1*TRACE-MULTI-CAS*1999999999~',
    `CLP*${controlNumber}*4*155*0*0*12*PAYER-${controlNumber}~`,
    'SVC*HC:99213*155*0~',
    'CAS*CO*16*100~',
    'CAS*CO*96*55~',
    `REF*6R*${claimLineId}~`,
    'DTM*472*20260521~',
    'SE*11*0002~',
    'GE*1*2~',
    'IEA*1*000000002~',
  ].join('');
}

function buildDeductibleOnly835(controlNumber: string) {
  return [
    'ISA*00*          *00*          *ZZ*AETNA          *ZZ*RCMTEST        *260529*1010*^*00501*000000963*0*T*:~',
    'GS*HP*AETNA*RCMTEST*20260529*1010*963*X*005010X221A1~',
    'ST*835*0963~',
    'BPR*H*0*C*NON************20260529~',
    `TRN*1*TRN-DEDUCT-${controlNumber}-001*1512345678~`,
    'DTM*405*20260529~',
    'N1*PR*AETNA INSURANCE COMPANY~',
    'N1*PE*PROVIDER MEDICAL*XX*1999999984~',
    `CLP*${controlNumber}*1*315*0*299*MC*PAYERDED963*11*1~`,
    'NM1*QC*1*TEST*PATIENT****MI*TESTMEMBER001~',
    'SVC*HC:D0140*125*0~',
    'DTM*472*D8*20260529~',
    'CAS*CO*45*5~',
    'CAS*PR*1*120~',
    'SVC*HC:D0220*45*0~',
    'DTM*472*D8*20260529~',
    'CAS*CO*45*1~',
    'CAS*PR*1*44~',
    'SVC*HC:D9110*145*0~',
    'DTM*472*D8*20260529~',
    'CAS*CO*45*10~',
    'CAS*PR*1*135~',
    'SE*21*0963~',
    'GE*1*963~',
    'IEA*1*000000963~',
  ].join('');
}

function buildUnderpaid835(controlNumber: string) {
  return [
    'ISA*00*          *00*          *ZZ*CLEARINGHOUSE   *ZZ*RCMRECEIVER    *260521*1200*^*00501*000000004*0*T*:~',
    'GS*HP*CLEARINGHOUSE*RCMRECEIVER*20260521*1200*4*X*005010X221A1~',
    'ST*835*0004~',
    'BPR*I*100*C*ACH************20260521~',
    'TRN*1*TRACE-UNDERPAYMENT*1999999999~',
    `CLP*${controlNumber}*1*155*100*0*12*PAYER-${controlNumber}~`,
    'SVC*HC:99213*155*100~',
    'CAS*CO*45*55~',
    `REF*6R*${claimLineId}~`,
    'DTM*472*20260521~',
    'AMT*B6*155~',
    'SE*11*0004~',
    'GE*1*4~',
    'IEA*1*000000004~',
  ].join('');
}

function buildPlb835(controlNumber: string) {
  return [
    'ISA*00*          *00*          *ZZ*CLEARINGHOUSE   *ZZ*RCMRECEIVER    *260521*1200*^*00501*000000005*0*T*:~',
    'GS*HP*CLEARINGHOUSE*RCMRECEIVER*20260521*1200*5*X*005010X221A1~',
    'ST*835*0005~',
    'BPR*I*75*C*ACH************20260521~',
    'TRN*1*TRACE-PLB*1999999999~',
    `CLP*${controlNumber}*1*155*80*0*12*PAYER-${controlNumber}~`,
    'SVC*HC:99213*155*80~',
    'CAS*CO*45*75~',
    `REF*6R*${claimLineId}~`,
    'DTM*472*20260521~',
    'AMT*B6*80~',
    'PLB*1999999994*20260602*WO:TAKEBACK-1*-5~',
    'SE*12*0005~',
    'GE*1*5~',
    'IEA*1*000000005~',
  ].join('');
}

describe('eraEobProcessingService.import835', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('imports a matched 835, creates payment posting, posts adjustment, and marks claim paid', async () => {
    const controlNumber = 'CTRL-HAPPY-PATH';
    const eraRecord: any = {
      _id: eraId,
      matchedClaims: [],
      unmatchedClaims: [],
      importErrors: [],
      parseErrors: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const paymentPostingRecord: any = {
      _id: paymentPostingId,
      claimId,
      postingStatus: 'POSTED',
      postedAmount: 80,
      patientResponsibilityAmount: 0,
      remainingBalance: 0,
      paymentLines: [],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const claim: any = {
      _id: claimId,
      claimId: 'CLAIM-NUMBER',
      payerId: 'AETNA',
      patientId: '665000000000000000000108',
      claimLines: [
        {
          _id: claimLineId,
          cptCode: '99213',
          chargeAmount: 155,
          expectedAllowedAmount: 80,
          expectedInsurancePayment: 80,
          serviceDateFrom: new Date('2026-05-21T00:00:00.000Z'),
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };
    const submission = {
      _id: submissionId,
      claimId,
      controlNumber,
      claimControlNumber: controlNumber,
    };

    jest.spyOn(EraEobProcessing, 'findOne')
      .mockReturnValueOnce(queryResolved(null) as any)
      .mockReturnValueOnce(queryResolved(null) as any);
    jest.spyOn(EraEobProcessing, 'create').mockImplementation(async (...args: unknown[]) => {
      const payload = args[0] as any[];
      Object.assign(eraRecord, payload[0]);
      return [eraRecord];
    });
    jest.spyOn(ClaimSubmission, 'findOne').mockReturnValue(sortedQueryResolved(submission) as any);
    jest.spyOn(Claim, 'findOne').mockReturnValue(queryResolved(claim) as any);
    jest.spyOn(PaymentPosting, 'findOne').mockReturnValue(queryResolved(null) as any);
    jest.spyOn(PaymentPosting, 'create').mockImplementation(async (...args: unknown[]) => {
      const payload = args[0] as any[];
      Object.assign(paymentPostingRecord, payload[0]);
      return [paymentPostingRecord];
    });
    jest.spyOn(Adjustment, 'insertMany').mockResolvedValue([
      {
        _id: adjustmentId,
        adjustmentType: 'contractual adjustment',
        claimLineId,
      },
    ] as any);
    jest.spyOn(denialWorkflowService, 'createFromAdjustment').mockResolvedValue({} as any);
    jest.spyOn(denialWorkflowService, 'ensureArWorkItemForUnderpaidClaim').mockResolvedValue({} as any);
    jest.spyOn(arWorkItemService, 'createUnderpaymentVarianceItem').mockResolvedValue({} as any);
    jest.spyOn(patientBillingService, 'createFromPaymentPosting').mockResolvedValue(null as any);
    jest.spyOn(financialEventService, 'record').mockResolvedValue({
      _id: 'financial-event-1',
      ledgerSequence: 1,
      financialBalanceSnapshot: {},
    } as any);
    jest.spyOn(claimClosureService, 'syncClaimClosureStatus').mockResolvedValue({} as any);
    jest.spyOn(appealResolutionService, 'resolveFromPaymentPosting').mockResolvedValue([] as any);

    const result = await eraEobProcessingService.import835({
      raw835Text: build835(controlNumber),
      payerId: 'AETNA',
      eraFileReference: 'happy-path.835',
    }, 'en', userId);

    expect(result.paymentPostings).toHaveLength(1);
    expect(result.matchedClaims).toHaveLength(1);
    expect(result.unmatchedClaims).toHaveLength(0);
    expect(result.parseErrors).toHaveLength(0);
    expect(result.importErrors).toHaveLength(0);
    expect(paymentPostingRecord.postingStatus).toBe('POSTED');
    expect(paymentPostingRecord.postedAmount).toBe(80);
    expect(paymentPostingRecord.remainingBalance).toBe(0);
    expect(paymentPostingRecord.paymentLines).toEqual([
      expect.objectContaining({
        claimLineId,
        procedureCode: '99213',
        billedAmount: 155,
        paidAmount: 80,
        adjustmentAmount: 75,
        patientRespAmount: 0,
        deniedAmount: 0,
      }),
    ]);
    expect(Adjustment.insertMany).toHaveBeenCalledWith(
      [expect.objectContaining({
        paymentPostingId,
        claimId,
        claimLineId,
        adjustmentGroupCode: 'CO',
        adjustmentReasonCode: '45',
        adjustmentAmount: 75,
      })],
      { session: undefined },
    );
    expect(claim.paymentStatus).toBe('PAID');
    expect(claim.save).toHaveBeenCalledWith({ session: undefined });
    expect(patientBillingService.createFromPaymentPosting).toHaveBeenCalledWith(paymentPostingId, 'en', userId, { session: undefined });
    expect(claimClosureService.reopenForFinancialMutation).toHaveBeenCalledWith(
      claimId,
      expect.stringContaining('ERA adjudication imported'),
      userId,
      undefined,
    );
    expect(denialWorkflowService.createFromAdjustment).not.toHaveBeenCalled();
    expect(arWorkItemService.createUnderpaymentVarianceItem).not.toHaveBeenCalled();
    expect(eraRecord.reconciliationStatus).toBe('RECONCILED');
    expect(eraRecord.accountingLocked).toBe(false);
    expect(eraRecord.accountingLockReason).toBe('ERA is reconciled and ready for explicit accounting lock.');
    expect(eraRecord.save).toHaveBeenCalledWith({ session: undefined });
  });

  it('aggregates multiple denial CAS adjustments on one service line without overstating denial or AR balance', async () => {
    const controlNumber = 'CTRL-MULTI-CAS';
    const eraRecord: any = { _id: eraId, save: jest.fn().mockResolvedValue(undefined) };
    const posting: any = { _id: paymentPostingId, save: jest.fn().mockResolvedValue(undefined) };
    const claim: any = {
      _id: claimId,
      payerId: 'AETNA',
      patientId: '665000000000000000000108',
      claimLines: [{
        _id: claimLineId,
        cptCode: '99213',
        chargeAmount: 155,
        expectedInsurancePayment: 100,
        serviceDateFrom: new Date('2026-05-21'),
      }],
      save: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(EraEobProcessing, 'findOne')
      .mockReturnValueOnce(queryResolved(null) as any)
      .mockReturnValueOnce(queryResolved(null) as any);
    jest.spyOn(EraEobProcessing, 'create').mockImplementation(async (payload: any) => {
      Object.assign(eraRecord, payload[0]);
      return [eraRecord];
    });
    jest.spyOn(ClaimSubmission, 'findOne').mockReturnValue(sortedQueryResolved({ claimId, controlNumber }) as any);
    jest.spyOn(Claim, 'findOne').mockReturnValue(queryResolved(claim) as any);
    jest.spyOn(PaymentPosting, 'findOne').mockReturnValue(queryResolved(null) as any);
    jest.spyOn(PaymentPosting, 'create').mockImplementation(async (payload: any) => {
      Object.assign(posting, payload[0]);
      return [posting];
    });
    jest.spyOn(Adjustment, 'insertMany').mockResolvedValue([
      { _id: 'cas-1', adjustmentType: 'denial-related adjustment', adjustmentReasonCode: '16', adjustmentAmount: 100, claimLineId },
      { _id: 'cas-2', adjustmentType: 'denial-related adjustment', adjustmentReasonCode: '96', adjustmentAmount: 55, claimLineId },
    ] as any);
    jest.spyOn(denialWorkflowService, 'createFromAdjustment').mockResolvedValue({} as any);
    jest.spyOn(arWorkItemService, 'createUnderpaymentVarianceItem').mockResolvedValue({} as any);
    jest.spyOn(patientBillingService, 'createFromPaymentPosting').mockResolvedValue(null as any);

    await eraEobProcessingService.import835({ raw835Text: buildMultiCasDenied835(controlNumber), payerId: 'AETNA' }, 'en', userId);

    expect(posting.paymentLines[0].deniedAmount).toBe(155);
    expect(denialWorkflowService.createFromAdjustment).toHaveBeenCalledTimes(1);
    expect(denialWorkflowService.createFromAdjustment).toHaveBeenCalledWith(expect.objectContaining({
      deniedAmount: 155,
      carcCodes: ['16', '96'],
      lineBilledAmount: 155,
      linePaidAmount: 0,
    }));
    expect(arWorkItemService.createUnderpaymentVarianceItem).not.toHaveBeenCalled();
  });

  it('posts a zero-pay deductible-only ERA as patient responsibility instead of line match failed', async () => {
    const controlNumber = 'CTRL-DEDUCTIBLE';
    const lineIds = [
      '665000000000000000000121',
      '665000000000000000000122',
      '665000000000000000000123',
    ];
    const eraRecord: any = { _id: eraId, save: jest.fn().mockResolvedValue(undefined) };
    const posting: any = { _id: paymentPostingId, save: jest.fn().mockResolvedValue(undefined) };
    const billing = { _id: '665000000000000000000130' };
    const claim: any = {
      _id: claimId,
      claimId: 'CLAIM-DEDUCTIBLE',
      payerId: 'AETNA',
      patientId: '665000000000000000000108',
      claimLines: [
        { _id: lineIds[0], cptCode: 'D0140', chargeAmount: 125, expectedAllowedAmount: 120, expectedInsurancePayment: 0, serviceDateFrom: new Date('2026-05-29') },
        { _id: lineIds[1], cptCode: 'D0220', chargeAmount: 45, expectedAllowedAmount: 44, expectedInsurancePayment: 0, serviceDateFrom: new Date('2026-05-29') },
        { _id: lineIds[2], cptCode: 'D9110', chargeAmount: 145, expectedAllowedAmount: 135, expectedInsurancePayment: 0, serviceDateFrom: new Date('2026-05-29') },
      ],
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(EraEobProcessing, 'findOne')
      .mockReturnValueOnce(queryResolved(null) as any)
      .mockReturnValueOnce(queryResolved(null) as any);
    jest.spyOn(EraEobProcessing, 'create').mockImplementation(async (payload: any) => {
      Object.assign(eraRecord, payload[0]);
      return [eraRecord];
    });
    jest.spyOn(ClaimSubmission, 'findOne').mockReturnValue(sortedQueryResolved({ _id: submissionId, claimId, controlNumber }) as any);
    jest.spyOn(Claim, 'findOne').mockReturnValue(queryResolved(claim) as any);
    jest.spyOn(PaymentPosting, 'findOne').mockReturnValue(queryResolved(null) as any);
    jest.spyOn(PaymentPosting, 'create').mockImplementation(async (payload: any) => {
      Object.assign(posting, payload[0]);
      return [posting];
    });
    jest.spyOn(Adjustment, 'insertMany').mockImplementation(async (rows: unknown) =>
      (rows as any[]).map((row, index) => ({ _id: `adjustment-${index}`, ...row })) as any
    );
    jest.spyOn(denialWorkflowService, 'createFromAdjustment').mockResolvedValue({} as any);
    jest.spyOn(denialWorkflowService, 'ensureArWorkItemForUnderpaidClaim').mockResolvedValue({} as any);
    jest.spyOn(arWorkItemService, 'createUnderpaymentVarianceItem').mockResolvedValue({} as any);
    jest.spyOn(patientBillingService, 'createFromPaymentPosting').mockResolvedValue(billing as any);
    jest.spyOn(financialEventService, 'record').mockResolvedValue({
      _id: 'financial-event-1',
      ledgerSequence: 1,
      financialBalanceSnapshot: {},
    } as any);
    jest.spyOn(claimClosureService, 'syncClaimClosureStatus').mockResolvedValue({} as any);
    jest.spyOn(appealResolutionService, 'resolveFromPaymentPosting').mockResolvedValue([] as any);

    const result = await eraEobProcessingService.import835({
      raw835Text: buildDeductibleOnly835(controlNumber),
      payerId: 'AETNA',
      eraFileReference: 'deductible.835',
    }, 'en', userId);

    expect(result.paymentPostings).toHaveLength(1);
    expect(posting.postingStatus).toBe('POSTED');
    expect(posting.postedAmount).toBe(0);
    expect(posting.patientResponsibilityAmount).toBe(299);
    expect(posting.remainingBalance).toBe(0);
    expect(posting.paymentLines).toEqual([
      expect.objectContaining({ procedureCode: 'D0140', paidAmount: 0, adjustmentAmount: 5, patientRespAmount: 120 }),
      expect.objectContaining({ procedureCode: 'D0220', paidAmount: 0, adjustmentAmount: 1, patientRespAmount: 44 }),
      expect.objectContaining({ procedureCode: 'D9110', paidAmount: 0, adjustmentAmount: 10, patientRespAmount: 135 }),
    ]);
    expect(claim.paymentStatus).toBe('PATIENT_RESPONSIBILITY');
    expect(result.matchedClaims[0]).toEqual(expect.objectContaining({
      paymentStatus: 'PATIENT_RESPONSIBILITY',
      postingStatus: 'POSTED',
      patientRespAmount: 299,
      paidAmount: 0,
      adjustmentAmount: 16,
      patientBillingId: billing._id,
    }));
    expect(denialWorkflowService.createFromAdjustment).not.toHaveBeenCalled();
    expect(arWorkItemService.createUnderpaymentVarianceItem).not.toHaveBeenCalled();
    expect(patientBillingService.createFromPaymentPosting).toHaveBeenCalledWith(paymentPostingId, 'en', userId, { session: undefined });
  });

  it('marks a balanced partial payer payment as underpaid and creates payer AR work items', async () => {
    const controlNumber = 'CTRL-UNDERPAID';
    const eraRecord: any = { _id: eraId, save: jest.fn().mockResolvedValue(undefined) };
    const posting: any = { _id: paymentPostingId, save: jest.fn().mockResolvedValue(undefined) };
    const claim: any = {
      _id: claimId,
      claimId: 'CLAIM-UNDERPAID',
      payerId: 'AETNA',
      patientId: '665000000000000000000108',
      claimLines: [{
        _id: claimLineId,
        cptCode: '99213',
        chargeAmount: 155,
        expectedAllowedAmount: 155,
        expectedInsurancePayment: 120,
        serviceDateFrom: new Date('2026-05-21T00:00:00.000Z'),
      }],
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(EraEobProcessing, 'findOne')
      .mockReturnValueOnce(queryResolved(null) as any)
      .mockReturnValueOnce(queryResolved(null) as any);
    jest.spyOn(EraEobProcessing, 'create').mockImplementation(async (payload: any) => {
      Object.assign(eraRecord, payload[0]);
      return [eraRecord];
    });
    jest.spyOn(ClaimSubmission, 'findOne').mockReturnValue(sortedQueryResolved({ _id: submissionId, claimId, controlNumber }) as any);
    jest.spyOn(Claim, 'findOne').mockReturnValue(queryResolved(claim) as any);
    jest.spyOn(PaymentPosting, 'findOne').mockReturnValue(queryResolved(null) as any);
    jest.spyOn(PaymentPosting, 'create').mockImplementation(async (payload: any) => {
      Object.assign(posting, payload[0]);
      return [posting];
    });
    jest.spyOn(Adjustment, 'insertMany').mockResolvedValue([
      { _id: adjustmentId, adjustmentType: 'contractual adjustment', adjustmentReasonCode: '45', adjustmentAmount: 55, claimLineId },
    ] as any);
    jest.spyOn(denialWorkflowService, 'createFromAdjustment').mockResolvedValue({} as any);
    jest.spyOn(denialWorkflowService, 'ensureArWorkItemForUnderpaidClaim').mockResolvedValue({ _id: 'ar-underpaid-claim' } as any);
    jest.spyOn(arWorkItemService, 'createUnderpaymentVarianceItem').mockResolvedValue({ _id: 'ar-underpaid-line' } as any);
    jest.spyOn(patientBillingService, 'createFromPaymentPosting').mockResolvedValue(null as any);
    jest.spyOn(claimClosureService, 'syncClaimClosureStatus').mockResolvedValue({} as any);
    jest.spyOn(appealResolutionService, 'resolveFromPaymentPosting').mockResolvedValue([] as any);

    const result = await eraEobProcessingService.import835({
      raw835Text: buildUnderpaid835(controlNumber),
      payerId: 'AETNA',
      eraFileReference: 'underpaid.835',
    }, 'en', userId);

    expect(result.matchedClaims[0]).toEqual(expect.objectContaining({
      paymentStatus: 'UNDERPAID',
      paidAmount: 100,
      adjustmentAmount: 55,
      deniedAmount: 0,
    }));
    expect(claim.paymentStatus).toBe('UNDERPAID');
    expect(denialWorkflowService.createFromAdjustment).not.toHaveBeenCalled();
    expect(denialWorkflowService.ensureArWorkItemForUnderpaidClaim).toHaveBeenCalledWith(expect.objectContaining({
      claim,
      paymentPostingId,
      balanceAmount: 20,
      createdBy: userId,
    }));
    expect(arWorkItemService.createUnderpaymentVarianceItem).toHaveBeenCalledWith(expect.objectContaining({
      claim,
      paymentPostingId,
      claimLineId,
      expectedAmount: 120,
      paidAmount: 100,
      balanceAmount: 20,
    }));
  });

  it('creates manual review exceptions when an ERA includes unsupported PLB/takeback adjustments', async () => {
    const controlNumber = 'CTRL-PLB';
    const eraRecord: any = { _id: eraId, save: jest.fn().mockResolvedValue(undefined) };
    const posting: any = { _id: paymentPostingId, save: jest.fn().mockResolvedValue(undefined) };
    const claim: any = {
      _id: claimId,
      claimId: 'CLAIM-PLB',
      payerId: 'AETNA',
      patientId: '665000000000000000000108',
      claimLines: [{
        _id: claimLineId,
        cptCode: '99213',
        chargeAmount: 155,
        expectedAllowedAmount: 80,
        expectedInsurancePayment: 80,
        serviceDateFrom: new Date('2026-05-21T00:00:00.000Z'),
      }],
      save: jest.fn().mockResolvedValue(undefined),
    };

    jest.spyOn(EraEobProcessing, 'findOne')
      .mockReturnValueOnce(queryResolved(null) as any)
      .mockReturnValueOnce(queryResolved(null) as any);
    jest.spyOn(EraEobProcessing, 'create').mockImplementation(async (payload: any) => {
      Object.assign(eraRecord, payload[0]);
      return [eraRecord];
    });
    jest.spyOn(ClaimSubmission, 'findOne').mockReturnValue(sortedQueryResolved({ _id: submissionId, claimId, controlNumber }) as any);
    jest.spyOn(Claim, 'findOne').mockReturnValue(queryResolved(claim) as any);
    jest.spyOn(PaymentPosting, 'findOne').mockReturnValue(queryResolved(null) as any);
    jest.spyOn(PaymentPosting, 'create').mockImplementation(async (payload: any) => {
      Object.assign(posting, payload[0]);
      return [posting];
    });
    jest.spyOn(Adjustment, 'insertMany').mockResolvedValue([
      { _id: adjustmentId, adjustmentType: 'contractual adjustment', adjustmentReasonCode: '45', adjustmentAmount: 75, claimLineId },
    ] as any);
    jest.spyOn(denialWorkflowService, 'createFromAdjustment').mockResolvedValue({} as any);
    jest.spyOn(arWorkItemService, 'createUnderpaymentVarianceItem').mockResolvedValue({} as any);
    jest.spyOn(patientBillingService, 'createFromPaymentPosting').mockResolvedValue(null as any);
    jest.spyOn(eraExceptionService, 'create').mockResolvedValue({ _id: 'era-exception-1' } as any);

    const result = await eraEobProcessingService.import835({
      raw835Text: buildPlb835(controlNumber),
      payerId: 'AETNA',
      eraFileReference: 'plb.835',
    }, 'en', userId);

    expect(result.importErrors).toEqual(expect.arrayContaining([
      expect.stringContaining('Unsupported provider-level adjustment/PLB detected'),
    ]));
    expect(eraRecord.importStatus).toBe('POSTED_WITH_WARNINGS');
    expect(eraRecord.reconciliationStatus).toBe('PARTIALLY_POSTED');
    expect(eraExceptionService.create).toHaveBeenCalledWith(expect.objectContaining({
      exceptionType: 'UNSUPPORTED_FINANCIAL_RECONCILIATION',
      relatedERA: eraId,
      relatedClaim: claimId,
      resolutionNotes: expect.stringContaining('Manual deposit reconciliation is required'),
    }), userId);
    expect(eraExceptionService.create).toHaveBeenCalledWith(expect.objectContaining({
      exceptionType: 'POSTING_IMBALANCE',
      relatedERA: eraId,
      resolutionNotes: expect.stringContaining('does not equal ERA total'),
    }), userId);
  });

  it('returns an existing ERA and payment postings when the same idempotency key is retried', async () => {
    const duplicateEra: any = {
      _id: eraId,
      idempotencyKey: '835-duplicate-key',
      matchedClaims: [{ claimId }],
      unmatchedClaims: [],
      parseErrors: [],
    };
    const duplicatePosting = { _id: paymentPostingId, eraEobProcessingId: eraId };

    jest.spyOn(EraEobProcessing, 'findOne').mockReturnValue(queryResolved(duplicateEra) as any);
    jest.spyOn(PaymentPosting, 'find').mockReturnValue(queryResolved([duplicatePosting]) as any);
    const createSpy = jest.spyOn(EraEobProcessing, 'create');

    const result = await eraEobProcessingService.import835({
      raw835Text: build835('CTRL-DUPLICATE'),
      payerId: 'AETNA',
      idempotencyKey: '835-duplicate-key',
    }, 'en', userId) as any;

    expect(result.duplicate).toBe(true);
    expect(result.eraEobProcessing).toBe(duplicateEra);
    expect(result.paymentPostings).toEqual([duplicatePosting]);
    expect(result.importErrors).toEqual(['Duplicate ERA ignored because the idempotency key was already processed.']);
    expect(createSpy).not.toHaveBeenCalled();
  });
});

describe('eraEobProcessingService.replay', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks replay when the original ERA has financial side effects', async () => {
    const originalEra: any = {
      _id: eraId,
      raw835Payload: build835('CTRL-HAPPY-PATH'),
      accountingLocked: false,
    };
    jest.spyOn(EraEobProcessing, 'findOne').mockResolvedValue(originalEra as any);
    jest.spyOn(PaymentPosting, 'find').mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ _id: paymentPostingId }]),
      }),
    } as any);
    jest.spyOn(Adjustment, 'countDocuments').mockResolvedValue(1 as any);
    jest.spyOn(Denial, 'countDocuments').mockResolvedValue(1 as any);
    jest.spyOn(FinancialEvent, 'countDocuments').mockResolvedValue(1 as any);
    jest.spyOn(PatientBilling, 'countDocuments').mockResolvedValue(1 as any);

    await expect(
      eraEobProcessingService.replay(eraId, 'Retry import after parser fix.', 'en', userId),
    ).rejects.toThrow('ERA replay is blocked because this ERA already created financial side effects.');
  });
});
