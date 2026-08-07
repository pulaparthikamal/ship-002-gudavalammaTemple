import { PatientPayment } from './patient-payment.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { Refund } from '../refund/refund.model';
import { collectionService } from '../collection/collection.service';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';
import type { ClientSession } from 'mongoose';
import { claimClosureService } from '../claim/claim-closure.service';
import { financialEventService } from '../financial-event/financial-event.service';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { rejectAppendOnlyMutation } from '../shared/rcm-lifecycle-safety';
import { auditLogService } from '../audit-log/audit-log.service';

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function receiptNumber() {
  return `RCPT-${Date.now().toString(36).toUpperCase()}`;
}

function billingStatusForBalance(currentBalance: number, originalBalance: number, dueDate?: Date) {
  if (currentBalance <= 0) return 'PAID';
  if (dueDate && dueDate.getTime() < Date.now()) return 'OVERDUE';
  if (originalBalance > 0 && currentBalance < originalBalance) return 'PARTIALLY_PAID';
  return 'SENT';
}

function isAppliedPaymentStatus(status?: string) {
  return !['VOID', 'VOIDED', 'REVERSED', 'FAILED', 'DECLINED'].includes(String(status ?? '').trim().toUpperCase());
}

function normalizePaymentReference(data: any) {
  const idempotencyKey = typeof data.idempotencyKey === 'string' ? data.idempotencyKey.trim() : '';
  const externalTransactionId = typeof data.externalTransactionId === 'string' ? data.externalTransactionId.trim() : '';
  const referenceNumber = typeof data.referenceNumber === 'string' ? data.referenceNumber.trim() : '';
  const receipt = typeof data.receiptNumber === 'string' ? data.receiptNumber.trim() : '';
  const effectiveReference = idempotencyKey || externalTransactionId || referenceNumber || receipt;
  if (!effectiveReference) {
    throw new AppError(
      'Patient payment requires an idempotency key, external transaction id, reference number, or receipt number.',
      HTTP_STATUS.BAD_REQUEST
    );
  }
  return { idempotencyKey, externalTransactionId, referenceNumber, receipt };
}

async function findDuplicatePayment(data: any, paymentAmount: number, session?: ClientSession) {
  const reference = normalizePaymentReference(data);
  const filters: Record<string, unknown>[] = [];
  if (reference.idempotencyKey) filters.push({ idempotencyKey: reference.idempotencyKey });
  if (reference.externalTransactionId) filters.push({ externalTransactionId: reference.externalTransactionId });
  if (reference.receipt) filters.push({ receiptNumber: reference.receipt });
  if (reference.referenceNumber) {
    filters.push({
      patientBillingId: data.patientBillingId,
      amount: paymentAmount,
      referenceNumber: reference.referenceNumber,
      paymentStatus: { $nin: ['VOID', 'VOIDED', 'REVERSED', 'FAILED', 'DECLINED'] },
    });
  }

  return PatientPayment.findOne({
    isDeleted: false,
    $or: filters,
  }).session(session ?? null);
}

async function recalculateBillingBalance(billing: any, userId: string, session?: ClientSession) {
  const payments = await PatientPayment.find({
    patientBillingId: billing._id,
    isDeleted: false,
    active: true,
  }).session(session ?? null);

  const patientPayments = roundCurrency(
    payments
      .filter((payment) => isAppliedPaymentStatus(payment.paymentStatus))
      .reduce((total, payment) => total + Number(payment.appliedAmount ?? 0), 0)
  );
  const refundAmount = roundCurrency(
    payments
      .filter((payment) => isAppliedPaymentStatus(payment.paymentStatus))
      .reduce((total, payment) => total + Number(payment.overpaymentAmount ?? 0), 0)
  );
  const originalBalance = roundCurrency(Number(billing.originalBalance ?? billing.patientBalance ?? billing.amountDue ?? 0));
  const nextBalance = roundCurrency(Math.max(0, originalBalance - patientPayments));
  const nextStatus = billingStatusForBalance(nextBalance, originalBalance, billing.dueDate);

  billing.patientPayments = patientPayments;
  billing.amountPaid = patientPayments;
  billing.currentBalance = nextBalance;
  billing.amountDue = nextBalance;
  billing.status = nextStatus;
  billing.statementStatus = nextStatus;
  billing.refundFlag = refundAmount > 0;
  billing.refundAmount = refundAmount;
  billing.creditBalanceAmount = refundAmount;
  billing.updated = new Date();
  billing.updatedBy = userId as any;
  await billing.save({ session });

  return billing;
}

export const patientPaymentService = {
  async create(data: any, locale: string, createdBy: string) {
    const item = await withMongoTransaction(async (session) => {
      const paymentAmount = roundCurrency(Number(data.amount ?? 0));
      if (paymentAmount <= 0) {
        throw new AppError('Patient payment amount must be greater than zero.', HTTP_STATUS.BAD_REQUEST);
      }
      const duplicatePayment = await findDuplicatePayment(data, paymentAmount, session);
      if (duplicatePayment) {
        return duplicatePayment;
      }

      let billing: any = null;
      let appliedAmount = data.appliedAmount;
      let overpaymentAmount = data.overpaymentAmount;
      const paymentStatus = data.paymentStatus ?? 'POSTED';

      if (data.patientBillingId) {
        billing = await PatientBilling.findOne({ _id: data.patientBillingId, isDeleted: false }).session(session);
        if (!billing) {
          throw new AppError(t('patientBilling.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
        }
        if (billing.claimId) {
          await claimClosureService.reopenForFinancialMutation(
            String(billing.claimId),
            'Patient payment posted after claim closure.',
            createdBy,
            session
          );
        }

        const currentBalance = roundCurrency(Number(billing.currentBalance ?? billing.amountDue ?? billing.patientBalance ?? 0));
        appliedAmount = roundCurrency(Math.min(paymentAmount, Math.max(0, currentBalance)));
        overpaymentAmount = roundCurrency(Math.max(0, paymentAmount - appliedAmount));
      }

      const [item] = await PatientPayment.create([{
        ...data,
        patientId: data.patientId ?? billing?.patientId,
        claimId: data.claimId ?? billing?.claimId,
        paymentDate: data.paymentDate ?? new Date(),
        paymentStatus,
        idempotencyKey: data.idempotencyKey,
        externalTransactionId: data.externalTransactionId,
        appliedAmount: appliedAmount ?? paymentAmount,
        overpaymentAmount: overpaymentAmount ?? 0,
        receiptNumber: data.receiptNumber ?? receiptNumber(),
        receiptMetadata: data.receiptMetadata ?? {
          generatedAt: new Date(),
          source: 'PATIENT_PAYMENT_APPLICATION',
          patientBillingId: billing?._id ? String(billing._id) : undefined,
        },
        active: data.active ?? true,
        created: new Date(),
        updated: new Date(),
        createdBy,
      }], { session });

      if (billing && isAppliedPaymentStatus(item.paymentStatus)) {
        const updatedBilling = await recalculateBillingBalance(billing, createdBy, session);

        if ((item.overpaymentAmount ?? 0) > 0) {
          await Refund.findOneAndUpdate(
            { patientPaymentId: item._id, isDeleted: false },
            {
              $set: {
                patientId: item.patientId ?? billing.patientId,
                claimId: item.claimId ?? billing.claimId,
                patientBillingId: billing._id,
                patientPaymentId: item._id,
                refundType: 'PATIENT_OVERPAYMENT',
                refundReason: 'Patient payment exceeded current patient billing balance.',
                refundAmount: item.overpaymentAmount,
                balanceImpactAmount: 0,
                refundMethod: item.paymentMethod,
                requestedDate: new Date(),
                refundStatus: 'PENDING_REVIEW',
                notes: 'Refund candidate created automatically for manual review. No refund was issued.',
                active: true,
                updated: new Date(),
                updatedBy: createdBy as any,
              },
              $setOnInsert: {
                created: new Date(),
                createdBy,
                isDeleted: false,
              },
            },
            { upsert: true, new: true, session }
          );
        }

        if ((updatedBilling.currentBalance ?? 0) > 0) {
          await collectionService.ensureFromPatientBilling(updatedBilling, {}, locale, createdBy, { session });
        }

        if (item.claimId) {
          await financialEventService.record({
            eventType: 'PATIENT_PAYMENT_POSTED',
            sourceModule: 'patientPayment',
            amount: item.appliedAmount,
            claimId: item.claimId,
            patientBillingId: billing._id,
            metadata: { patientPaymentId: String(item._id), overpaymentAmount: item.overpaymentAmount ?? 0 },
            createdBy,
            session,
          });
          await claimClosureService.syncClaimClosureStatus(String(item.claimId), createdBy, session);
        }
      }

      await auditLogService.record({
        entityType: 'patientPayment',
        entityId: item._id,
        action: 'PATIENT_PAYMENT_RECORDED',
        userId: createdBy,
        changedBy: createdBy,
        source: 'patientPayment',
        claimId: item.claimId,
        patientId: item.patientId,
        reason: data.reason ?? data.notes,
        newState: {
          paymentStatus: item.paymentStatus,
          amount: item.amount,
          appliedAmount: item.appliedAmount,
          overpaymentAmount: item.overpaymentAmount,
          receiptNumber: item.receiptNumber,
        },
        session,
      });

      return item;
    });

    publishRcmRealtimeEvent({
      eventType: 'PATIENT_PAYMENT_POSTED',
      title: 'Patient payment posted',
      message: `Patient payment ${String(item._id)} was posted.`,
      entityType: 'patientPayment',
      entityId: String(item._id),
      claimId: item.claimId ? String(item.claimId) : undefined,
      status: item.paymentStatus,
    });
    return item;
  },

  async getById(id: string, locale: string) {
    const item = await PatientPayment.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('patientPayment.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    rejectAppendOnlyMutation('Patient payment', 'updated through generic CRUD');
    const item = await PatientPayment.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('patientPayment.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    Object.assign(item, {
      ...data,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    if (item.claimId) {
      await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy);
    }
    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    rejectAppendOnlyMutation('Patient payment', 'deleted');
    const item = await PatientPayment.findOneAndUpdate(
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
      throw new AppError(t('patientPayment.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
