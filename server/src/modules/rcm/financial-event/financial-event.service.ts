import type { ClientSession } from 'mongoose';
import mongoose from 'mongoose';
import { createHash } from 'crypto';
import { FinancialEvent } from './financial-event.model';
import { Claim } from '../claim/claim.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { Adjustment } from '../adjustment/adjustment.model';
import { Refund } from '../refund/refund.model';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { PatientPayment } from '../patient-payment/patient-payment.model';
import { EraException } from '../era-exception/era-exception.model';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { auditLogService } from '../audit-log/audit-log.service';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function buildClaimFinancialBalanceSnapshot(claimId: unknown, session?: ClientSession) {
  if (!claimId) {
    return {};
  }

  const unsupportedExceptionQuery = mongoose.isValidObjectId(claimId)
    ? EraException.countDocuments({
      relatedClaim: claimId,
      isDeleted: false,
      exceptionType: 'UNSUPPORTED_FINANCIAL_RECONCILIATION',
      status: { $in: ['OPEN', 'IN_REVIEW', 'ESCALATED', 'REPROCESSING'] },
    }).session(session ?? null)
    : Promise.resolve(0);

  const [claim, postings, adjustments, refunds, billings, patientPayments, unsupportedFinancialExceptions] = await Promise.all([
    Claim.findOne({ _id: claimId, isDeleted: false }).session(session ?? null).lean(),
    PaymentPosting.find({ claimId, isDeleted: false }).session(session ?? null).lean(),
    Adjustment.find({ claimId, isDeleted: false }).session(session ?? null).lean(),
    Refund.find({ claimId, isDeleted: false }).session(session ?? null).lean(),
    PatientBilling.find({ claimId, isDeleted: false }).session(session ?? null).lean(),
    PatientPayment.find({ claimId, isDeleted: false }).session(session ?? null).lean(),
    unsupportedExceptionQuery,
  ]);

  const activePostings = postings.filter((posting: any) => posting.postingStatus !== 'REVERSED');
  const reversedPostings = postings.filter((posting: any) => posting.postingStatus === 'REVERSED');
  const postedAmount = activePostings.reduce((sum: number, posting: any) => sum + Number(posting.postedAmount ?? 0), 0);
  const reversedAmount = reversedPostings.reduce((sum: number, posting: any) => sum + Number(posting.postedAmount ?? 0), 0);
  const adjustmentAmount = adjustments.reduce((sum: number, adjustment: any) => sum + Number(adjustment.adjustmentAmount ?? 0), 0);
  const contractualAllowanceAmount = adjustments
    .filter((adjustment: any) => adjustment.adjustmentGroupCode === 'CO' || adjustment.adjustmentType === 'contractual adjustment')
    .reduce((sum: number, adjustment: any) => sum + Number(adjustment.adjustmentAmount ?? 0), 0);
  const patientResponsibilityAmount = adjustments
    .filter((adjustment: any) => adjustment.adjustmentGroupCode === 'PR' || adjustment.adjustmentType === 'patient responsibility')
    .reduce((sum: number, adjustment: any) => sum + Number(adjustment.adjustmentAmount ?? 0), 0);
  const payerAdjustmentAmount = adjustments
    .filter((adjustment: any) => !['CO', 'PR'].includes(String(adjustment.adjustmentGroupCode ?? '')))
    .reduce((sum: number, adjustment: any) => sum + Number(adjustment.adjustmentAmount ?? 0), 0);
  const refundAmount = refunds.reduce((sum: number, refund: any) => sum + Number(refund.refundAmount ?? 0), 0);
  const processedRefundAmount = refunds
    .filter((refund: any) => String(refund.refundStatus ?? '').toUpperCase() === 'PROCESSED')
    .reduce((sum: number, refund: any) => sum + Number(refund.cashOutAmount ?? refund.refundAmount ?? 0), 0);
  const processedRefundBalanceImpactAmount = refunds
    .filter((refund: any) => String(refund.refundStatus ?? '').toUpperCase() === 'PROCESSED')
    .reduce((sum: number, refund: any) => sum + Number(refund.balanceImpactAmount ?? 0), 0);
  const pendingRefundAmount = refunds
    .filter((refund: any) => ['REQUESTED', 'PENDING', 'PENDING_REVIEW', 'APPROVED', 'READY'].includes(String(refund.refundStatus ?? '').toUpperCase()))
    .reduce((sum: number, refund: any) => sum + Number(refund.refundAmount ?? 0), 0);
  const patientBalance = billings.reduce((sum: number, billing: any) => sum + Number(billing.currentBalance ?? billing.amountDue ?? 0), 0);
  const patientPaidAmount = patientPayments
    .filter((payment: any) => !['VOIDED', 'REVERSED', 'REFUNDED'].includes(String(payment.paymentStatus ?? '').toUpperCase()))
    .reduce((sum: number, payment: any) => sum + Number(payment.appliedAmount ?? payment.amount ?? 0), 0);
  const totalChargeAmount = Number(claim?.totalChargeAmount ?? 0);
  const expectedInsuranceAmount = (claim?.claimLines ?? []).reduce((total: number, line: any) => total + Number(line.expectedInsurancePayment ?? 0), 0);
  const expectedPatientAmount = (claim?.claimLines ?? []).reduce((total: number, line: any) => total + Number(line.expectedPatientResponsibility ?? 0), 0);
  const hasAdjudicatedFinancialActivity =
    postedAmount > 0
    || adjustmentAmount > 0
    || billings.length > 0
    || patientPayments.length > 0
    || refunds.length > 0;
  const payerResponsibilityBase = expectedInsuranceAmount > 0
    ? expectedInsuranceAmount
    : Math.max(0, totalChargeAmount - contractualAllowanceAmount - patientResponsibilityAmount);
  const payerResponsibilityBalance = roundCurrency(Math.max(0, payerResponsibilityBase - postedAmount - payerAdjustmentAmount));
  const patientResponsibilityBase = Math.max(
    patientBalance,
    patientResponsibilityAmount || (hasAdjudicatedFinancialActivity ? 0 : expectedPatientAmount)
  );
  const patientResponsibilityBalance = roundCurrency(Math.max(
    0,
    patientResponsibilityBase
      - patientPaidAmount
      + processedRefundBalanceImpactAmount
      + pendingRefundAmount
  ));
  const unresolvedReversalAmount = roundCurrency(reversedPostings
    .filter((posting: any) => !posting.reversalReason)
    .reduce((sum: number, posting: any) => sum + Number(posting.postedAmount ?? 0), 0));
  const unreconciledPaymentAmount = roundCurrency(activePostings
    .filter((posting: any) => !['POSTED', 'PARTIAL'].includes(String(posting.postingStatus ?? '').toUpperCase()))
    .reduce((sum: number, posting: any) => sum + Number(posting.postedAmount ?? 0), 0));
  const manualReviewRequired = unsupportedFinancialExceptions > 0;
  const ledgerBalanced = !manualReviewRequired
    && payerResponsibilityBalance <= 0.01
    && patientResponsibilityBalance <= 0.01
    && pendingRefundAmount <= 0.01
    && unresolvedReversalAmount <= 0.01
    && unreconciledPaymentAmount <= 0.01
    && (postedAmount > 0 || adjustmentAmount > 0 || patientResponsibilityAmount > 0 || totalChargeAmount <= 0);

  return {
    claimId: String(claimId),
    totalChargeAmount: roundCurrency(totalChargeAmount),
    postedAmount: roundCurrency(postedAmount),
    reversedAmount: roundCurrency(reversedAmount),
    adjustmentAmount: roundCurrency(adjustmentAmount),
    contractualAllowanceAmount: roundCurrency(contractualAllowanceAmount),
    patientResponsibilityAmount: roundCurrency(patientResponsibilityAmount),
    payerAdjustmentAmount: roundCurrency(payerAdjustmentAmount),
    refundAmount: roundCurrency(refundAmount),
    processedRefundAmount: roundCurrency(processedRefundAmount),
    processedRefundBalanceImpactAmount: roundCurrency(processedRefundBalanceImpactAmount),
    pendingRefundAmount: roundCurrency(pendingRefundAmount),
    patientBalance: roundCurrency(patientBalance),
    patientPaidAmount: roundCurrency(patientPaidAmount),
    payerResponsibilityBalance,
    patientResponsibilityBalance,
    contractualAllowanceBalance: roundCurrency(Math.max(0, totalChargeAmount - postedAmount - patientResponsibilityAmount - contractualAllowanceAmount - payerAdjustmentAmount)),
    unresolvedReversalAmount,
    unreconciledPaymentAmount,
    recoupmentBalance: manualReviewRequired ? 1 : 0,
    takebackBalance: manualReviewRequired ? 1 : 0,
    depositReconciliationStatus: manualReviewRequired ? 'MANUAL_REVIEW_REQUIRED' : 'BALANCED',
    plbSupportStatus: manualReviewRequired ? 'UNSUPPORTED_ADJUSTMENT' : 'BALANCED',
    financialBalanceStatus: manualReviewRequired
      ? 'UNSUPPORTED_ADJUSTMENT'
      : ledgerBalanced
        ? 'BALANCED'
        : 'IMBALANCED',
    unsupportedFinancialExceptionCount: unsupportedFinancialExceptions,
    accountingPeriod: new Date().toISOString().slice(0, 7),
    ledgerBalanced,
    remainingBalance: roundCurrency(Math.max(0, totalChargeAmount - postedAmount - adjustmentAmount) + patientBalance),
    postingCount: postings.length,
    adjustmentCount: adjustments.length,
    refundCount: refunds.length,
    patientBillingCount: billings.length,
    capturedAt: new Date(),
  };
}

function hashFinancialEvent(payload: Record<string, unknown>) {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export const financialEventService = {
  async record(input: {
    eventType: string;
    sourceModule?: string;
    amount?: number;
    claimId?: unknown;
    paymentPostingId?: unknown;
    eraEobProcessingId?: unknown;
    adjustmentId?: unknown;
    denialId?: unknown;
    appealId?: unknown;
    correctedClaimId?: unknown;
    refundId?: unknown;
    patientBillingId?: unknown;
    parentFinancialEventId?: unknown;
    reversalOfId?: unknown;
    reason?: string;
    metadata?: Record<string, unknown>;
    createdBy?: string;
    session?: ClientSession;
  }) {
    const claimId = input.claimId;
    const snapshot = await buildClaimFinancialBalanceSnapshot(claimId, input.session);
    let ledgerSequence = 1;
    let previousLedgerHash: string | undefined;
    let ledgerHash = '';
    if (claimId) {
      let allocated = false;
      for (let attempt = 0; attempt < 5 && !allocated; attempt += 1) {
        const ledgerClaim = await Claim.findOne({ _id: claimId, isDeleted: false }).session(input.session ?? null).lean();
        if (!ledgerClaim) {
          throw new AppError('Claim not found while recording financial event.', HTTP_STATUS.NOT_FOUND);
        }
        const priorSequence = Number(ledgerClaim.financialLedgerSequence ?? 0);
        ledgerSequence = priorSequence + 1;
        previousLedgerHash = ledgerClaim.financialLedgerHeadHash || undefined;
        ledgerHash = hashFinancialEvent({
          eventType: input.eventType,
          claimId: String(claimId),
          amount: input.amount,
          ledgerSequence,
          previousLedgerHash,
          snapshot,
        });
        const sequenceClaim = await Claim.findOneAndUpdate(
          {
            _id: claimId,
            isDeleted: false,
            financialLedgerSequence: priorSequence,
            financialLedgerHeadHash: previousLedgerHash ?? { $in: [null, ''] },
          },
          {
            $set: {
              financialLedgerSequence: ledgerSequence,
              financialLedgerHeadHash: ledgerHash,
              updated: new Date(),
              updatedBy: input.createdBy,
            },
          },
          { new: true, session: input.session ?? null }
        ).lean();
        allocated = Boolean(sequenceClaim);
      }
      if (!allocated) {
        throw new AppError('Financial ledger is busy. Retry the financial operation.', HTTP_STATUS.CONFLICT);
      }
    } else {
      ledgerHash = hashFinancialEvent({
        eventType: input.eventType,
        amount: input.amount,
        ledgerSequence,
        snapshot,
      });
    }
    const accountingPeriod = new Date().toISOString().slice(0, 7);

    const [event] = await FinancialEvent.create([{
      eventType: input.eventType,
      sourceModule: input.sourceModule,
      amount: input.amount,
      claimId: input.claimId,
      paymentPostingId: input.paymentPostingId,
      eraEobProcessingId: input.eraEobProcessingId,
      adjustmentId: input.adjustmentId,
      denialId: input.denialId,
      appealId: input.appealId,
      correctedClaimId: input.correctedClaimId,
      refundId: input.refundId,
      patientBillingId: input.patientBillingId,
      parentFinancialEventId: input.parentFinancialEventId,
      reversalOfId: input.reversalOfId,
      ledgerSequence,
      ledgerHash,
      previousLedgerHash,
      accountingPeriod,
      accountingLocked: false,
      reconciliationStatus: (snapshot as any).ledgerBalanced ? 'BALANCED' : 'IMBALANCED',
      financialBalanceSnapshot: snapshot,
      reason: input.reason,
      metadata: input.metadata,
      active: true,
      created: new Date(),
      updated: new Date(),
      createdBy: input.createdBy,
      updatedBy: input.createdBy,
    }], { session: input.session });

    if (claimId) {
      await Claim.findOneAndUpdate(
        { _id: claimId, isDeleted: false },
        {
          financialBalanceSnapshot: snapshot,
          updated: new Date(),
          updatedBy: input.createdBy,
        },
        { session: input.session }
      );
    }

    publishRcmRealtimeEvent({
      eventType: 'FINANCIAL_BALANCE_CHANGED',
      title: 'Financial balance changed',
      message: `${input.eventType} recorded for claim ${claimId ?? '-'}.`,
      entityType: 'financialEvent',
      entityId: String(event._id),
      claimId: claimId ? String(claimId) : undefined,
      status: input.eventType,
    });

    if (claimId && !(snapshot as any).ledgerBalanced) {
      publishRcmRealtimeEvent({
        eventType: 'FINANCIAL_IMBALANCE_DETECTED',
        title: 'Financial imbalance detected',
        message: `${input.eventType} left claim balances unresolved.`,
        entityType: 'financialEvent',
        entityId: String(event._id),
        claimId: String(claimId),
        status: 'IMBALANCED',
      });
    }

    await auditLogService.record({
      entityType: 'financialEvent',
      entityId: event._id,
      action: input.eventType,
      userId: input.createdBy,
      changedBy: input.createdBy,
      source: input.sourceModule ?? 'financialEvent',
      sourceModule: input.sourceModule,
      reason: input.reason,
      claimId,
      financialEventId: event._id,
      newState: {
        eventType: event.eventType,
        amount: event.amount,
        ledgerSequence: event.ledgerSequence,
        reconciliationStatus: event.reconciliationStatus,
      },
      session: input.session,
    });

    return event;
  },

  async findLatestForPaymentPosting(paymentPostingId: unknown, session?: ClientSession) {
    return FinancialEvent.findOne({ paymentPostingId, isDeleted: false })
      .sort({ ledgerSequence: -1 })
      .session(session ?? null);
  },

  async buildClaimFinancialBalanceSnapshot(claimId: unknown, session?: ClientSession) {
    return buildClaimFinancialBalanceSnapshot(claimId, session);
  },
};
