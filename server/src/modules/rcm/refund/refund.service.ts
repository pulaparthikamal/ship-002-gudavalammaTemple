import { Refund } from './refund.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { claimClosureService } from '../claim/claim-closure.service';
import { financialEventService } from '../financial-event/financial-event.service';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { rejectAppendOnlyMutation, requireActionReason } from '../shared/rcm-lifecycle-safety';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { PatientPayment } from '../patient-payment/patient-payment.model';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';
import { auditLogService } from '../audit-log/audit-log.service';

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

const REFUND_LIABILITY_STATUSES = ['PENDING_REVIEW', 'REQUESTED', 'PENDING', 'APPROVED', 'READY', 'PROCESSED'];

function normalizeRefundReference(data: any) {
  const idempotencyKey = typeof data.idempotencyKey === 'string' ? data.idempotencyKey.trim() : '';
  const externalRefundReference = typeof data.externalRefundReference === 'string' ? data.externalRefundReference.trim() : '';
  if (!idempotencyKey && !externalRefundReference && !data.patientPaymentId) {
    throw new AppError('Refund request requires an idempotency key, external refund reference, or linked patient payment.', HTTP_STATUS.BAD_REQUEST);
  }
  return { idempotencyKey, externalRefundReference };
}

async function findDuplicateRefund(data: any, session?: any) {
  const reference = normalizeRefundReference(data);
  const filters: Record<string, unknown>[] = [];
  if (reference.idempotencyKey) filters.push({ idempotencyKey: reference.idempotencyKey });
  if (reference.externalRefundReference) filters.push({ externalRefundReference: reference.externalRefundReference });
  if (data.patientPaymentId) filters.push({ patientPaymentId: data.patientPaymentId });
  if (!filters.length) return null;
  return Refund.findOne({ isDeleted: false, $or: filters }).session(session ?? null);
}

async function calculateAvailableRefundCredit(data: any, session?: any, excludeRefundId?: unknown) {
  const linkedPayment = data.patientPaymentId
    ? await PatientPayment.findOne({ _id: data.patientPaymentId, isDeleted: false }).session(session ?? null)
    : null;
  const linkedBilling = data.patientBillingId
    ? await PatientBilling.findOne({ _id: data.patientBillingId, isDeleted: false }).session(session ?? null)
    : null;

  const grossCredit = roundCurrency(Math.max(
    Number(linkedPayment?.overpaymentAmount ?? 0),
    Number(linkedPayment?.appliedAmount ?? 0),
    Number(linkedBilling?.creditBalanceAmount ?? 0)
  ));
  if (grossCredit <= 0) {
    return 0;
  }

  const query: Record<string, unknown> = {
    isDeleted: false,
    refundStatus: { $in: REFUND_LIABILITY_STATUSES },
  };
  if (data.patientPaymentId) {
    query.patientPaymentId = data.patientPaymentId;
  } else if (data.patientBillingId) {
    query.patientBillingId = data.patientBillingId;
  } else {
    return 0;
  }
  if (excludeRefundId) {
    query._id = { $ne: excludeRefundId };
  }

  const existingRefunds = await Refund.find(query).session(session ?? null).lean();
  const committedRefundAmount = existingRefunds.reduce((sum: number, refund: any) => sum + Number(refund.refundAmount ?? 0), 0);
  return roundCurrency(Math.max(0, grossCredit - committedRefundAmount));
}

async function assertRefundCreditAvailable(data: any, refundAmount: number, session?: any, excludeRefundId?: unknown) {
  const availableCredit = await calculateAvailableRefundCredit(data, session, excludeRefundId);
  if (refundAmount > availableCredit + 0.01) {
    throw new AppError(
      `Refund amount exceeds available patient credit. Available credit is ${availableCredit.toFixed(2)}.`,
      HTTP_STATUS.BAD_REQUEST
    );
  }
}

async function applyProcessedRefundToBilling(item: any, updatedBy: string, session: any) {
  if (!item.patientBillingId) return;
  const billing = await PatientBilling.findOne({ _id: item.patientBillingId, isDeleted: false }).session(session ?? null);
  if (!billing) return;

  const impact = roundCurrency(Number(item.balanceImpactAmount ?? 0));
  const currentBalance = roundCurrency(Number(billing.currentBalance ?? billing.amountDue ?? 0));
  const nextBalance = roundCurrency(currentBalance + impact);
  billing.refundFlag = true;
  billing.refundAmount = roundCurrency(Number(billing.refundAmount ?? 0) + Number(item.refundAmount ?? 0));
  billing.creditBalanceAmount = roundCurrency(Math.max(0, Number(billing.creditBalanceAmount ?? 0) - Number(item.refundAmount ?? 0)));
  billing.currentBalance = nextBalance;
  billing.amountDue = nextBalance;
  if (impact > 0) {
    billing.status = 'PARTIALLY_PAID';
    billing.statementStatus = 'PARTIALLY_PAID';
  }
  billing.updated = new Date();
  billing.updatedBy = updatedBy as any;
  await billing.save({ session });
}

export const refundService = {
  async create(data: any, locale: string, createdBy: string) {
    const item = await withMongoTransaction(async (session) => {
      const refundAmount = roundCurrency(Number(data.refundAmount ?? 0));
      if (refundAmount <= 0) {
        throw new AppError('Refund amount must be greater than zero.', HTTP_STATUS.BAD_REQUEST);
      }
      requireActionReason(data.refundReason ?? data.notes, 'Refund request');
      const duplicate = await findDuplicateRefund(data, session);
      if (duplicate) {
        return duplicate;
      }
      await assertRefundCreditAvailable(data, refundAmount, session);

      const [item] = await Refund.create([{
        ...data,
        refundAmount,
        requestedDate: data.requestedDate ?? new Date(),
        approvedDate: undefined,
        processedDate: undefined,
        approvedBy: undefined,
        refundStatus: 'PENDING_REVIEW',
        active: data.active ?? true,
        created: new Date(),
        updated: new Date(),
        createdBy,
      }], { session });

      if (item.claimId) {
        await financialEventService.record({
          eventType: 'REFUND_REQUESTED',
          sourceModule: 'refund',
          amount: item.refundAmount,
          claimId: item.claimId,
          refundId: item._id,
          reason: item.refundReason,
          createdBy,
          session,
        });
        await claimClosureService.syncClaimClosureStatus(String(item.claimId), createdBy, session);
      }
      await auditLogService.record({
        entityType: 'refund',
        entityId: item._id,
        action: 'REFUND_REQUESTED',
        userId: createdBy,
        changedBy: createdBy,
        source: 'refund',
        claimId: item.claimId,
        patientId: item.patientId,
        reason: item.refundReason,
        newState: item.toObject(),
        session,
      });
      return item;
    });

    publishRcmRealtimeEvent({
      eventType: 'REFUND_STATUS_CHANGED',
      title: 'Refund requested',
      message: `Refund ${String(item._id)} is pending review.`,
      entityType: 'refund',
      entityId: String(item._id),
      claimId: item.claimId ? String(item.claimId) : undefined,
      status: item.refundStatus,
    });
    return item;
  },

  async getById(id: string, locale: string) {
    const item = await Refund.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('refund.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    rejectAppendOnlyMutation('Refund', 'updated through generic CRUD');
    const item = await Refund.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('refund.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    Object.assign(item, {
      ...data,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    if (item.claimId) {
      await financialEventService.record({
        eventType: 'REFUND_UPDATED',
        sourceModule: 'refund',
        amount: item.refundAmount,
        claimId: item.claimId,
        refundId: item._id,
        reason: data.reason ?? data.notes ?? item.refundReason,
        createdBy: updatedBy,
      });
      await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy);
    }
    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    rejectAppendOnlyMutation('Refund', 'deleted');
    const item = await Refund.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        active: false,
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy,
        updated: new Date(),
      },
      { new: true }
    );

    if (!item) {
      throw new AppError(t('refund.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },

  async applyAction(id: string, action: string, data: any, locale: string, updatedBy: string) {
    const item = await withMongoTransaction(async (session) => {
      const item = await Refund.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) {
        throw new AppError(t('refund.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      }

      const normalizedAction = String(action).trim().toUpperCase();
      const currentStatus = String(item.refundStatus ?? 'PENDING_REVIEW').trim().toUpperCase();
      const reason = requireActionReason(data.reason ?? data.notes, `Refund ${normalizedAction.toLowerCase()}`);

      if (normalizedAction === 'APPROVE') {
        if (!['PENDING_REVIEW', 'REQUESTED', 'PENDING'].includes(currentStatus)) {
          throw new AppError('Only a pending refund can be approved.', HTTP_STATUS.BAD_REQUEST);
        }
        item.refundStatus = 'APPROVED';
        item.approvedDate = new Date();
        item.approvedBy = String(updatedBy);
      } else if (normalizedAction === 'PROCESS') {
        if (currentStatus !== 'APPROVED') {
          throw new AppError('Only an approved refund can be processed.', HTTP_STATUS.BAD_REQUEST);
        }
        await assertRefundCreditAvailable(item, roundCurrency(Number(item.refundAmount ?? 0)), session, item._id);
        if (item.claimId) {
          await claimClosureService.reopenForFinancialMutation(
            String(item.claimId),
            `Refund ${String(item._id)} processed: ${reason}`,
            updatedBy,
            session
          );
        }
        const linkedPayment = item.patientPaymentId
          ? await PatientPayment.findOne({ _id: item.patientPaymentId, isDeleted: false }).session(session)
          : null;
        const refundableCredit = roundCurrency(Number(linkedPayment?.overpaymentAmount ?? 0));
        const refundAmount = roundCurrency(Number(item.refundAmount ?? 0));
        item.cashOutAmount = refundAmount;
        item.balanceImpactAmount = roundCurrency(Math.max(0, refundAmount - refundableCredit));
        item.refundStatus = 'PROCESSED';
        item.processedDate = new Date();
      } else if (normalizedAction === 'REJECT' || normalizedAction === 'CANCEL') {
        if (['PROCESSED', 'REJECTED', 'CANCELLED'].includes(currentStatus)) {
          throw new AppError('Completed refund cannot be changed.', HTTP_STATUS.BAD_REQUEST);
        }
        item.refundStatus = normalizedAction === 'REJECT' ? 'REJECTED' : 'CANCELLED';
      } else {
        throw new AppError('Unsupported refund action.', HTTP_STATUS.BAD_REQUEST);
      }

      item.notes = data.notes ?? reason;
      item.updatedBy = updatedBy as any;
      item.updated = new Date();
      await item.save({ session });

      if (normalizedAction === 'PROCESS') {
        await applyProcessedRefundToBilling(item, updatedBy, session);
      }
      if (item.claimId && normalizedAction === 'PROCESS') {
        await financialEventService.record({
          eventType: 'REFUND_PROCESSED',
          sourceModule: 'refund',
          amount: -Math.abs(Number(item.refundAmount ?? 0)),
          claimId: item.claimId,
          refundId: item._id,
          patientBillingId: item.patientBillingId,
          reason,
          metadata: {
            cashDirection: 'OUTFLOW',
            cashOutAmount: item.cashOutAmount,
            balanceImpactAmount: item.balanceImpactAmount,
            patientPaymentId: item.patientPaymentId ? String(item.patientPaymentId) : undefined,
          },
          createdBy: updatedBy,
          session,
        });
      }
      if (item.claimId && ['REJECT', 'CANCEL'].includes(normalizedAction)) {
        await financialEventService.record({
          eventType: normalizedAction === 'REJECT' ? 'REFUND_REJECTED' : 'REFUND_CANCELLED',
          sourceModule: 'refund',
          amount: 0,
          claimId: item.claimId,
          refundId: item._id,
          reason,
          metadata: { financialImpact: false },
          createdBy: updatedBy,
          session,
        });
      }
      if (item.claimId) {
        await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy, session);
      }
      const actionName = normalizedAction === 'APPROVE'
        ? 'REFUND_APPROVED'
        : normalizedAction === 'PROCESS'
          ? 'REFUND_PROCESSED'
          : normalizedAction === 'REJECT'
            ? 'REFUND_REJECTED'
            : 'REFUND_CANCELLED';
      await auditLogService.record({
        entityType: 'refund',
        entityId: item._id,
        action: actionName,
        userId: updatedBy,
        changedBy: updatedBy,
        source: 'refund',
        claimId: item.claimId,
        patientId: item.patientId,
        reason,
        previousState: { refundStatus: currentStatus },
        newState: {
          refundStatus: item.refundStatus,
          refundAmount: item.refundAmount,
          processedDate: item.processedDate,
          approvedDate: item.approvedDate,
        },
        session,
      });
      return item;
    });

    publishRcmRealtimeEvent({
      eventType: 'REFUND_STATUS_CHANGED',
      title: 'Refund status changed',
      message: `Refund ${String(item._id)} moved to ${item.refundStatus}.`,
      entityType: 'refund',
      entityId: String(item._id),
      claimId: item.claimId ? String(item.claimId) : undefined,
      status: item.refundStatus,
    });
    return item;
  },
};
