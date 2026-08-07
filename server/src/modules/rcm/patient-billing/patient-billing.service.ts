import { PatientBilling } from './patient-billing.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { Charge } from '../charge/charge.model';
import { PaymentPosting } from '../payment-posting/payment-posting.model';
import { Claim } from '../claim/claim.model';
import { calculateAgingBucket } from '../ar-work-item/ar-work-item.service';
import type { ClientSession } from 'mongoose';
import { claimClosureService } from '../claim/claim-closure.service';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { rejectAppendOnlyMutation, requireActionReason } from '../shared/rcm-lifecycle-safety';
import { collectionService } from '../collection/collection.service';
import { auditLogService } from '../audit-log/audit-log.service';

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function plusDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function statementNumberFor(paymentPostingId: unknown) {
  return `STMT-${String(paymentPostingId).slice(-8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
}

export const patientBillingService = {
  async create(data: any, locale: string, createdBy: string): Promise<any> {
    return rejectAppendOnlyMutation('Patient billing', 'manually created');
  },

  async getById(id: string, locale: string) {
    const item = await PatientBilling.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('patientBilling.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    rejectAppendOnlyMutation('Patient billing', 'updated through generic CRUD');
    const item = await PatientBilling.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('patientBilling.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
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
    rejectAppendOnlyMutation('Patient billing', 'deleted');
    const item = await PatientBilling.findOneAndUpdate(
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
      throw new AppError(t('patientBilling.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },

  async createFromCharge(chargeId: string, locale: string, createdBy: string) {
    const charge = await Charge.findOne({ _id: chargeId, isDeleted: false });
    if (!charge) {
      throw new AppError(t('charge.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    throw new AppError(
      'Patient billing cannot be generated from charge estimates. Final patient responsibility requires ERA/payment posting adjudication.',
      HTTP_STATUS.BAD_REQUEST
    );
  },

  async createFromPaymentPosting(paymentPostingId: string, locale: string, createdBy: string, options: { session?: ClientSession } = {}) {
    const session = options.session;
    const paymentPosting = await PaymentPosting.findOne({ _id: paymentPostingId, isDeleted: false }).session(session ?? null);
    if (!paymentPosting) {
      throw new AppError(t('paymentPosting.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    if (!paymentPosting.claimId) {
      throw new AppError('Payment posting is not linked to a claim.', HTTP_STATUS.BAD_REQUEST);
    }

    const existingBilling = await PatientBilling.findOne({ paymentPostingId: paymentPosting._id, isDeleted: false }).session(session ?? null);
    if (existingBilling) {
      return existingBilling;
    }

    const claim = await Claim.findOne({ _id: paymentPosting.claimId, isDeleted: false }).session(session ?? null);
    if (!claim) {
      throw new AppError(t('claim.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const patientResponsibility = roundCurrency(
      (paymentPosting.paymentLines ?? []).reduce((total, line) => total + (line.patientRespAmount ?? 0), 0)
    );

    if (patientResponsibility <= 0) {
      return null;
    }

    const statementDate = new Date();
    const dueDate = plusDays(statementDate, 30);
    const insurancePaid = roundCurrency((paymentPosting.paymentLines ?? []).reduce((total, line) => total + (line.paidAmount ?? 0), 0));
    const adjustments = roundCurrency((paymentPosting.paymentLines ?? []).reduce((total, line) => total + (line.adjustmentAmount ?? 0), 0));

    const lineItems = (paymentPosting.paymentLines ?? [])
      .filter((line) => (line.patientRespAmount ?? 0) > 0)
      .map((line) => ({
        claimLineId: line.claimLineId,
        procedureCode: line.procedureCode,
        serviceDate: line.serviceDate,
        description: line.procedureCode ? `Service ${line.procedureCode}` : 'Adjudicated service line',
        allowedAmount: line.allowedAmount,
        insurancePaid: line.paidAmount,
        adjustments: line.adjustmentAmount,
        patientResponsibility: line.patientRespAmount,
      }));

    const [billing] = await PatientBilling.create([{
      patientId: claim.patientId,
      claimId: claim._id,
      chargeId: claim.chargeId,
      encounterId: claim.encounterId,
      paymentPostingId: paymentPosting._id,
      statementNumber: statementNumberFor(paymentPosting._id),
      statementDate,
      statementCycle: 'Initial Post-ERA Statement',
      billingCycle: 'CYCLE_1',
      originalBalance: patientResponsibility,
      currentBalance: patientResponsibility,
      insurancePaid,
      adjustments,
      patientPayments: 0,
      patientBalance: patientResponsibility,
      amountPaid: 0,
      amountDue: patientResponsibility,
      dueDate,
      collectionsFlag: false,
      writeOffFlag: false,
      refundFlag: false,
      statementStatus: 'READY_TO_SEND',
      status: 'READY_TO_SEND',
      agingBucket: calculateAgingBucket(0),
      lineItems,
      active: true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    }], { session });

    await auditLogService.record({
      entityType: 'patientBilling',
      entityId: billing._id,
      action: 'PATIENT_BILLING_CREATED',
      userId: createdBy,
      changedBy: createdBy,
      source: 'patientBilling',
      claimId: claim._id,
      patientId: claim.patientId,
      payerId: claim.payerId,
      reason: 'Patient responsibility created from adjudicated payment posting.',
      newState: {
        statementStatus: billing.statementStatus,
        originalBalance: billing.originalBalance,
        currentBalance: billing.currentBalance,
        paymentPostingId: billing.paymentPostingId,
      },
      session,
    });

    publishRcmRealtimeEvent({
      eventType: 'PATIENT_BILLING_CREATED',
      title: 'Patient billing created',
      entityType: 'patientBilling',
      entityId: String(billing._id),
      claimId: String(claim._id),
      status: billing.status,
    });

    return billing;
  },

  async applyAction(id: string, action: string, data: any, locale: string, updatedBy: string) {
    const item = await PatientBilling.findOne({ _id: id, isDeleted: false });
    if (!item) {
      throw new AppError(t('patientBilling.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const normalizedAction = String(action).trim().toUpperCase();
    const currentBalance = roundCurrency(Number(item.currentBalance ?? item.amountDue ?? item.patientBalance ?? 0));
    if (currentBalance <= 0) {
      throw new AppError('Patient billing has no open patient balance.', HTTP_STATUS.BAD_REQUEST);
    }

    if (normalizedAction === 'SEND_STATEMENT') {
      if (!['READY_TO_SEND', 'SENT', 'OVERDUE'].includes(String(item.status ?? item.statementStatus ?? '').toUpperCase())) {
        throw new AppError('Only an open patient statement can be sent.', HTTP_STATUS.BAD_REQUEST);
      }
      item.lastStatementSent = new Date();
      item.status = 'SENT';
      item.statementStatus = 'SENT';
    } else if (normalizedAction === 'MARK_COLLECTIONS_READY') {
      requireActionReason(data.reason ?? data.notes, 'Collections referral');
      item.status = 'COLLECTIONS_READY';
      item.statementStatus = 'COLLECTIONS_READY';
      item.collectionsFlag = true;
    } else {
      throw new AppError('Unsupported patient billing action.', HTTP_STATUS.BAD_REQUEST);
    }

    item.updated = new Date();
    item.updatedBy = updatedBy as any;
    await item.save();
    if (normalizedAction === 'MARK_COLLECTIONS_READY') {
      await collectionService.ensureFromPatientBilling(item, {}, locale, updatedBy);
    }
    if (item.claimId) {
      await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy);
    }

    await auditLogService.record({
      entityType: 'patientBilling',
      entityId: item._id,
      action: normalizedAction === 'SEND_STATEMENT' ? 'PATIENT_BILLING_STATEMENT_SENT' : 'PATIENT_BILLING_TRANSFERRED_TO_COLLECTIONS',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'patientBilling',
      claimId: item.claimId,
      patientId: item.patientId,
      reason: data.reason ?? data.notes,
      newState: {
        status: item.status,
        statementStatus: item.statementStatus,
        currentBalance: item.currentBalance,
      },
    });

    publishRcmRealtimeEvent({
      eventType: 'PATIENT_BILLING_STATUS_CHANGED',
      title: 'Patient billing status changed',
      message: `Patient billing ${String(item._id)} moved to ${item.status}.`,
      entityType: 'patientBilling',
      entityId: String(item._id),
      claimId: item.claimId ? String(item.claimId) : undefined,
      status: item.status,
    });
    return item;
  },
};
