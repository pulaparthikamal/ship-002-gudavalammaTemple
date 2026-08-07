import { PaymentPosting } from './payment-posting.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { Claim } from '../claim/claim.model';
import { arWorkItemService } from '../ar-work-item/ar-work-item.service';
import { patientBillingService } from '../patient-billing/patient-billing.service';
import { appealResolutionService } from '../appeal/appeal-resolution.service';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';
import type { ClientSession } from 'mongoose';
import { logRcmEvent } from '../../../utils/hipaa-logger.util';
import { financialEventService } from '../financial-event/financial-event.service';
import { claimClosureService } from '../claim/claim-closure.service';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { auditLogService } from '../audit-log/audit-log.service';

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function applyPostingSideEffects(item: any, locale: string, userId: string, session?: ClientSession) {
  if (!item.claimId) return;

  const claim = await Claim.findOne({ _id: item.claimId, isDeleted: false }).session(session ?? null);
  if (!claim) return;

  for (const line of item.paymentLines ?? []) {
    const expectedAmount = roundCurrency(Number(line.expectedInsurancePayment ?? 0));
    const paidAmount = roundCurrency(Number(line.paidAmount ?? 0));
    if (expectedAmount > 0 && paidAmount < expectedAmount) {
      await arWorkItemService.createUnderpaymentVarianceItem({
        claim,
        paymentPostingId: item._id,
        claimLineId: line.claimLineId,
        expectedAmount,
        paidAmount,
        balanceAmount: roundCurrency(expectedAmount - paidAmount),
        createdBy: userId,
        session,
      });
    }
  }

  await patientBillingService.createFromPaymentPosting(String(item._id), locale, userId, { session });
  await appealResolutionService.resolveFromPaymentPosting(item, { claim, updatedBy: userId, session });
}

function isEraCreatedPosting(item: any) {
  return Boolean(item.eraEobProcessingId) || String(item.sourceType ?? '').toUpperCase() === '835_ERA';
}

function normalizePostingIdempotencyKey(data: any) {
  if (typeof data.idempotencyKey === 'string' && data.idempotencyKey.trim()) {
    return data.idempotencyKey.trim();
  }
  const sourceType = String(data.sourceType ?? 'MANUAL').trim().toUpperCase();
  const claimId = data.claimId ? String(data.claimId) : 'NO_CLAIM';
  const amount = roundCurrency(Number(data.postedAmount ?? data.receivedAmount ?? 0)).toFixed(2);
  const paymentDate = data.paymentDate ? new Date(data.paymentDate).toISOString().slice(0, 10) : 'NO_DATE';
  const trace = [data.eraEobProcessingId, data.eftTraceNumber, data.checkNumber, data.payerClaimNumber, data.claimControlNumber]
    .filter(Boolean)
    .map(String)
    .join(':');
  if (!trace && sourceType === 'MANUAL') {
    throw new AppError('Manual payment posting requires an idempotency key, check number, EFT trace, payer claim number, or claim control number.', HTTP_STATUS.BAD_REQUEST);
  }
  return [sourceType, claimId, amount, paymentDate, trace || 'NO_TRACE'].join(':');
}

export const paymentPostingService = {
  async create(data: any, locale: string, createdBy: string, options: { session?: ClientSession } = {}) {
    const createWithSession = async (session?: ClientSession) => {
    const idempotencyKey = normalizePostingIdempotencyKey(data);
    if (idempotencyKey) {
      const existing = await PaymentPosting.findOne({
        idempotencyKey,
        isDeleted: false,
      }).session(session ?? null);
      if (existing) {
        return existing;
      }
    }

    const [item] = await PaymentPosting.create([{
      ...data,
      idempotencyKey,
      active: data.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    }], { session });

    const financialEvent = await financialEventService.record({
      eventType: 'PAYMENT_POSTED',
      sourceModule: 'paymentPosting',
      amount: Number(item.postedAmount ?? item.receivedAmount ?? 0),
      claimId: item.claimId,
      paymentPostingId: item._id,
      eraEobProcessingId: item.eraEobProcessingId,
      createdBy,
      session,
    });
    item.financialEventId = financialEvent._id;
    item.ledgerSequence = financialEvent.ledgerSequence;
    item.financialBalanceSnapshot = financialEvent.financialBalanceSnapshot;
    await item.save({ session });

    await applyPostingSideEffects(item, locale, createdBy, session);
    if (item.claimId) {
      await claimClosureService.syncClaimClosureStatus(String(item.claimId), createdBy, session);
    }
    await auditLogService.record({
      entityType: 'paymentPosting',
      entityId: item._id,
      action: 'PAYMENT_POSTED',
      userId: createdBy,
      changedBy: createdBy,
      source: item.eraEobProcessingId ? 'era835' : 'paymentPosting',
      claimId: item.claimId,
      payerId: item.payerId,
      financialEventId: financialEvent._id,
      newState: item.toObject(),
      session,
    });
    return item;
    };

    return options.session
      ? createWithSession(options.session)
      : withMongoTransaction((session) => createWithSession(session));
  },

  async getById(id: string, locale: string) {
    const item = await PaymentPosting.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('paymentPosting.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await PaymentPosting.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('paymentPosting.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    if (isEraCreatedPosting(item)) {
      throw new AppError('ERA-created payment postings are append-only. Use a controlled reversal with reason instead of editing.', HTTP_STATUS.BAD_REQUEST);
    }

    if (item.postingStatus === 'POSTED') {
      throw new AppError('Posted financial records cannot be edited directly in production or controlled-pilot workflows. Use reversal and repost workflow.', HTTP_STATUS.BAD_REQUEST);
    }

    Object.assign(item, {
      ...data,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const existing = await PaymentPosting.findOne({ _id: id, isDeleted: false });
    if (!existing) {
      throw new AppError(t('paymentPosting.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    if (isEraCreatedPosting(existing)) {
      throw new AppError('ERA-created payment postings cannot be deleted. Use a controlled reversal with reason.', HTTP_STATUS.BAD_REQUEST);
    }
    throw new AppError('Payment postings cannot be hard-deleted in production or controlled-pilot workflows. Use reversal with reason.', HTTP_STATUS.BAD_REQUEST);
  },

  async reverse(id: string, reason: string, locale: string, updatedBy: string) {
    if (!reason?.trim()) {
      throw new AppError('Payment posting reversal reason is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const reverseWithSession = async (session: ClientSession) => {
    const item = await PaymentPosting.findOne({ _id: id, isDeleted: false }).session(session);

    if (!item) {
      throw new AppError(t('paymentPosting.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    if (item.postingStatus === 'REVERSED') {
      return item;
    }
    if (item.claimId) {
      await claimClosureService.reopenForFinancialMutation(
        String(item.claimId),
        `Payment posting ${String(item._id)} reversed: ${reason.trim()}`,
        updatedBy,
        session
      );
    }

    const originalFinancialEvent = item.financialEventId
      ? await financialEventService.findLatestForPaymentPosting(item._id, session)
      : null;

    item.postingStatus = 'REVERSED';
    item.reversedAt = new Date();
    item.reversedBy = updatedBy as any;
    item.reversalReason = reason.trim();
    item.updated = new Date();
    item.updatedBy = updatedBy as any;

    const reversalEvent = await financialEventService.record({
      eventType: 'PAYMENT_REVERSED',
      sourceModule: 'paymentPosting',
      amount: -Math.abs(Number(item.postedAmount ?? item.receivedAmount ?? 0)),
      claimId: item.claimId,
      paymentPostingId: item._id,
      eraEobProcessingId: item.eraEobProcessingId,
      parentFinancialEventId: originalFinancialEvent?._id,
      reversalOfId: originalFinancialEvent?._id ?? item.financialEventId,
      reason: reason.trim(),
      createdBy: updatedBy,
      session,
    });

    item.parentFinancialEventId = originalFinancialEvent?._id;
    item.reversalOfId = reversalEvent.reversalOfId;
    item.ledgerSequence = reversalEvent.ledgerSequence;
    item.financialBalanceSnapshot = reversalEvent.financialBalanceSnapshot;
    await item.save({ session });

    if (item.claimId) {
      await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy, session);
    }

    logRcmEvent({
      module: 'rcm.paymentPosting',
      eventType: 'PAYMENT_REVERSED',
      status: 'SUCCEEDED',
      userId: updatedBy,
      correlationId: String(item._id),
      metadata: {
        paymentPostingId: String(item._id),
        sourceType: item.sourceType,
        reason: item.reversalReason,
      },
    });

    publishRcmRealtimeEvent({
      eventType: 'PAYMENT_REVERSED',
      title: 'Payment posting reversed',
      message: `Payment posting ${item._id} was reversed.`,
      entityType: 'paymentPosting',
      entityId: String(item._id),
      claimId: item.claimId ? String(item.claimId) : undefined,
      status: 'REVERSED',
    });

    await auditLogService.record({
      entityType: 'paymentPosting',
      entityId: item._id,
      action: 'PAYMENT_REVERSED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'paymentPosting',
      claimId: item.claimId,
      payerId: item.payerId,
      financialEventId: reversalEvent._id,
      reason: reason.trim(),
      previousState: { postingStatus: 'POSTED' },
      newState: { postingStatus: item.postingStatus, reversedAt: item.reversedAt },
      session,
    });

    return item;
    };

    return withMongoTransaction((session) => reverseWithSession(session));
  },
};
