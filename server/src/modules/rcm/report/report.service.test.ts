import { reportService } from './report.service';
import { ReportSnapshot } from './report-snapshot.model';
import { Claim } from '../claim/claim.model';
import { ClaimSubmission } from '../claim-submission/claim-submission.model';
import { ClaimTracking } from '../claim-tracking/claim-tracking.model';
import { CodingReview } from '../coding-review/coding-review.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { PatientPayment } from '../patient-payment/patient-payment.model';
import { Adjustment } from '../adjustment/adjustment.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { Denial } from '../denial/denial.model';
import { Appeal } from '../appeal/appeal.model';
import { CorrectedClaim } from '../corrected-claim/corrected-claim.model';
import { Collection } from '../collection/collection.model';
import { EraEobProcessing } from '../era-eob-processing/era-eob-processing.model';
import { EraException } from '../era-exception/era-exception.model';
import { Refund } from '../refund/refund.model';
import { FinancialEvent } from '../financial-event/financial-event.model';
import { AuditLog } from '../audit-log/audit-log.model';
import { RcmBackgroundJob } from '../background-job/background-job.model';

function queryResult(rows: unknown[]) {
  return {
    lean: jest.fn().mockResolvedValue(rows),
    sort: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
  };
}

function mockFind(model: { find: (...args: any[]) => any }, rows: unknown[]) {
  return jest.spyOn(model, 'find').mockImplementation((query: any = {}) => {
    const claimIds = query?.claimId?.$in;
    if (Array.isArray(claimIds) && claimIds.length === 0) {
      return queryResult([]) as any;
    }
    return queryResult(rows) as any;
  });
}

function mockReportReads(overrides: Partial<Record<string, unknown[]>> = {}) {
  jest.spyOn(ReportSnapshot, 'findOne').mockReturnValue(queryResult([]) as any);
  jest.spyOn(ReportSnapshot, 'findOneAndUpdate').mockResolvedValue({} as any);
  jest.spyOn(RcmBackgroundJob, 'countDocuments').mockResolvedValue(0 as any);

  return {
    claims: mockFind(Claim, overrides.claims ?? []),
    submissions: mockFind(ClaimSubmission, overrides.submissions ?? []),
    trackings: mockFind(ClaimTracking, overrides.trackings ?? []),
    postings: mockFind(PaymentPosting, overrides.postings ?? []),
    patientPayments: mockFind(PatientPayment, overrides.patientPayments ?? []),
    adjustments: mockFind(Adjustment, overrides.adjustments ?? []),
    patientBillings: mockFind(PatientBilling, overrides.patientBillings ?? []),
    arItems: mockFind(ArWorkItem, overrides.arItems ?? []),
    denials: mockFind(Denial, overrides.denials ?? []),
    appeals: mockFind(Appeal, overrides.appeals ?? []),
    correctedClaims: mockFind(CorrectedClaim, overrides.correctedClaims ?? []),
    collections: mockFind(Collection, overrides.collections ?? []),
    eras: mockFind(EraEobProcessing, overrides.eras ?? []),
    eraExceptions: mockFind(EraException, overrides.eraExceptions ?? []),
    refunds: mockFind(Refund, overrides.refunds ?? []),
    codingReviews: mockFind(CodingReview, overrides.codingReviews ?? []),
    financialEvents: mockFind(FinancialEvent, overrides.financialEvents ?? []),
    auditLogs: mockFind(AuditLog, overrides.auditLogs ?? []),
    queueJobs: mockFind(RcmBackgroundJob, overrides.queueJobs ?? []),
  };
}

describe('reportService export and snapshot controls', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('exports report data as CSV with generated metadata and applied filters', async () => {
    jest.spyOn(reportService, 'getReport').mockResolvedValueOnce({
      summary: {
        totalBilled: 1200,
        totalInsurancePaid: 900,
      },
      rows: [
        {
          claimId: 'claim-1',
          payerId: '60054',
          totalBilled: 1200,
        },
      ],
    } as any);

    const exported = await reportService.exportReport({
      reportType: 'financial',
      payerId: '60054',
      format: 'xlsx',
    });

    expect(exported.fileName).toBe('rcm-financial-report.csv');
    expect(exported.contentType).toBe('text/csv');
    expect(exported.content).toContain('generatedAt,');
    expect(exported.content).toContain('filters,');
    expect(exported.content).toContain('60054');
    expect(exported.content).toContain('claim-1');
  });

  it('marks fresh report snapshots stale when operational events invalidate reports', async () => {
    const updateManySpy = jest.spyOn(ReportSnapshot, 'updateMany').mockResolvedValueOnce({ modifiedCount: 2 } as any);

    await reportService.invalidateSnapshots('PAYMENT_POSTED');

    expect(updateManySpy).toHaveBeenCalledWith(
      { isDeleted: false, refreshStatus: 'FRESH' },
      expect.objectContaining({
        refreshStatus: 'STALE',
        refreshError: 'PAYMENT_POSTED',
      })
    );
  });

  it('exports the enterprise operational report types without changing the CSV contract', async () => {
    const getReportSpy = jest.spyOn(reportService, 'getReport').mockResolvedValue({
      summary: {
        claimsBlockedFromClosure: 1,
      },
      rows: [{ claimId: 'claim-risk-1', riskTypes: 'financialImbalance' }],
    } as any);

    for (const reportType of ['claim-closure', 'financial-risk', 'ai-operations']) {
      const exported = await reportService.exportReport({ reportType, riskType: 'financialImbalance' });
      expect(exported.fileName).toBe(`rcm-${reportType}-report.csv`);
      expect(exported.contentType).toBe('text/csv');
      expect(exported.content).toContain('riskType');
      expect(exported.content).toContain('claim-risk-1');
    }

    expect(getReportSpy).toHaveBeenCalledTimes(3);
  });

  it('parses all supported report filters and does not overcount related records when no claims match', async () => {
    const reads = mockReportReads({
      claims: [{
        _id: 'claim-1',
        created: new Date('2026-05-01T00:00:00.000Z'),
        payerId: 'payer-a',
        patientId: 'patient-a',
        renderingProviderId: 'provider-a',
        facilityId: 'facility-a',
        claimStatus: 'Submitted',
      }],
      denials: [{ _id: 'denial-1', claimId: 'claim-1', denialAmount: 100 }],
      postings: [{ _id: 'posting-1', claimId: 'claim-1', postedAmount: 100 }],
      arItems: [{ _id: 'ar-1', claimId: 'claim-1', balanceAmount: 100, status: 'OPEN' }],
    });

    const report = await reportService.getReport('dashboard', {
      claimId: 'missing-claim',
      patientId: 'patient-a',
      payerId: 'payer-a',
      providerId: 'provider-a',
      facilityId: 'facility-a',
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
      status: 'Submitted',
      denialStatus: 'OPEN',
      appealStatus: 'SUBMITTED',
      arStatus: 'OPEN',
      closureStatus: 'OPEN',
      riskType: 'financialImbalance',
      exceptionType: 'UNSUPPORTED_ADJUSTMENT',
      financialEventId: 'not-an-object-id',
      correlationId: 'corr-1',
      drillDown: 'denials',
      unsupported: 'ignored',
    } as any) as any;

    expect(report.executive.totalClaims).toBe(0);
    expect(report.denials.totalDenials).toBe(0);
    expect(report.financial.totalInsurancePaid).toBe(0);
    expect(report.ar.openAr).toBe(0);
    expect(reads.denials).toHaveBeenCalledWith(expect.objectContaining({ claimId: { $in: [] } }));
    expect(reads.postings).toHaveBeenCalledWith(expect.objectContaining({ claimId: { $in: [] } }));
    expect(reads.arItems).toHaveBeenCalledWith(expect.objectContaining({ claimId: { $in: [] } }));
  });

  it('does not count zero-pay denied postings as paid claims and includes accepted submissions awaiting ERA', async () => {
    mockReportReads({
      claims: [{
        _id: 'claim-1',
        claimStatus: 'Submitted',
        submissionStatus: 'Acknowledged',
        paymentStatus: 'DENIED',
        closureStatus: 'AWAITING_ERA',
        totalChargeAmount: 100,
        created: new Date('2026-05-01T00:00:00.000Z'),
      }],
      submissions: [{
        _id: 'submission-1',
        claimId: 'claim-1',
        acknowledgementStatus: 'ACCEPTED',
        created: new Date('2026-05-01T00:00:00.000Z'),
      }],
      postings: [{ _id: 'posting-1', claimId: 'claim-1', postedAmount: 0, postingStatus: 'POSTED' }],
    });

    const report = await reportService.getReport('claims') as any;

    expect(report.summary.paidClaims).toBe(0);
    expect(report.summary.claimsAwaitingEra).toBe(1);
  });

  it('keeps original denied amount separate from remaining denied balance after recovery', async () => {
    mockReportReads({
      claims: [{ _id: 'claim-1', created: new Date('2026-05-01T00:00:00.000Z') }],
      denials: [{
        _id: 'denial-1',
        claimId: 'claim-1',
        denialStatus: 'PARTIALLY_RESOLVED',
        denialAmount: 500,
        remainingDeniedBalance: 200,
      }],
    });

    const report = await reportService.getReport('denials') as any;

    expect(report.summary.totalDeniedAmount).toBe(500);
    expect(report.summary.remainingDeniedBalance).toBe(200);
    expect(report.summary.outstandingDeniedAmount).toBe(200);
    expect(report.rows[0]).toMatchObject({
      originalDeniedAmount: 500,
      remainingDeniedBalance: 200,
    });
  });

  it('separates patient responsibility buckets and AR categories without double counting patient balances', async () => {
    mockReportReads({
      claims: [{
        _id: 'claim-1',
        totalChargeAmount: 1000,
        claimLines: [
          { expectedAllowedAmount: 900, expectedInsurancePayment: 700, expectedPatientResponsibility: 200 },
        ],
      }],
      postings: [{ _id: 'posting-1', claimId: 'claim-1', postedAmount: 650, allowedAmount: 850, patientResponsibilityAmount: 250 }],
      patientBillings: [{ _id: 'billing-1', claimId: 'claim-1', originalBalance: 250, currentBalance: 150 }],
      patientPayments: [{ _id: 'payment-1', claimId: 'claim-1', appliedAmount: 100 }],
      arItems: [
        { _id: 'ar-1', claimId: 'claim-1', status: 'OPEN', category: 'INSURANCE', balanceAmount: 50 },
        { _id: 'ar-2', claimId: 'claim-1', status: 'OPEN', category: 'DENIAL', denialId: 'denial-1', balanceAmount: 25 },
      ],
    });

    const report = await reportService.getReport('financial') as any;

    expect(report.summary.totalAllowed).toBe(850);
    expect(report.summary.expectedPatientResponsibility).toBe(200);
    expect(report.summary.adjudicatedPatientResponsibility).toBe(250);
    expect(report.summary.billedPatientResponsibility).toBe(250);
    expect(report.summary.paidPatientResponsibility).toBe(100);
    expect(report.summary.remainingPatientBalance).toBe(150);
    expect(report.summary.insuranceAr).toBe(50);
    expect(report.summary.denialAr).toBe(25);
    expect(report.summary.patientAr).toBe(150);
    expect(report.summary.totalAr).toBe(225);
  });

  it('reports queue processing time in seconds and minutes', async () => {
    mockReportReads({
      queueJobs: [{
        _id: 'job-1',
        jobType: 'ERA_IMPORT',
        status: 'SUCCEEDED',
        attempts: 1,
        startedAt: new Date('2026-05-01T00:00:00.000Z'),
        completedAt: new Date('2026-05-01T00:02:00.000Z'),
      }],
    });

    const report = await reportService.getReport('realtime') as any;

    expect(report.summary.averageProcessingTimeSeconds).toBe(120);
    expect(report.summary.averageProcessingTimeMinutes).toBe(2);
    expect(report.summary.averageProcessingTimeDays).toBeUndefined();
  });
});
