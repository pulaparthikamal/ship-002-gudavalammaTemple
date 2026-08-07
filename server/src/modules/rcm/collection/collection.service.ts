import { Collection } from './collection.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { envConfig } from '../../../config/env.config';
import { PatientBilling } from '../patient-billing/patient-billing.model';
import { Adjustment } from '../adjustment/adjustment.model';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';
import type { ClientSession } from 'mongoose';
import { claimClosureService } from '../claim/claim-closure.service';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { rejectAppendOnlyMutation, requireActionReason } from '../shared/rcm-lifecycle-safety';
import { financialEventService } from '../financial-event/financial-event.service';
import { auditLogService } from '../audit-log/audit-log.service';

const CLOSED_STATUSES = ['SETTLED', 'WRITTEN_OFF', 'CLOSED'];

function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function plusDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function daysPastDue(dueDate?: Date) {
  if (!dueDate) return 0;
  return Math.max(0, Math.floor((Date.now() - dueDate.getTime()) / (24 * 60 * 60 * 1000)));
}

function resolveRules(overrides: any = {}) {
  return {
    daysOverdueThreshold: Number(overrides.daysOverdueThreshold ?? envConfig.collectionsDaysOverdueThreshold),
    minimumBalance: Number(overrides.minimumBalance ?? envConfig.collectionsMinimumBalance),
    maxContactAttempts: Number(overrides.maxContactAttempts ?? envConfig.collectionsMaxContactAttempts),
    escalationIntervalDays: Number(overrides.escalationIntervalDays ?? envConfig.collectionsEscalationIntervalDays),
    writeOffThreshold: Number(overrides.writeOffThreshold ?? envConfig.collectionsWriteOffThreshold),
    settlementAllowed: Boolean(overrides.settlementAllowed ?? envConfig.collectionsSettlementAllowed),
  };
}

function stageFor(item: { daysPastDue: number; contactAttempts: number }, rules: ReturnType<typeof resolveRules>) {
  if (item.contactAttempts >= rules.maxContactAttempts || item.daysPastDue >= rules.daysOverdueThreshold + rules.escalationIntervalDays * 3) {
    return 'EXTERNAL_READY';
  }
  if (item.contactAttempts >= Math.max(2, rules.maxContactAttempts - 1) || item.daysPastDue >= rules.daysOverdueThreshold + rules.escalationIntervalDays * 2) {
    return 'FINAL_NOTICE';
  }
  if (item.contactAttempts >= 1 || item.daysPastDue >= rules.daysOverdueThreshold + rules.escalationIntervalDays) {
    return 'INTERNAL_SECOND_NOTICE';
  }
  return 'INTERNAL_FIRST_NOTICE';
}

function audit(action: string, userId: string, data: Record<string, unknown> = {}) {
  return {
    action,
    performedBy: String(userId),
    performedAt: new Date(),
    ...data,
  };
}

async function createOrRefreshFromBilling(
  billing: any,
  rules: ReturnType<typeof resolveRules>,
  createdBy: string,
  session?: ClientSession
) {
  const currentBalance = roundCurrency(Number(billing.currentBalance ?? billing.amountDue ?? billing.patientBalance ?? 0));
  const pastDue = daysPastDue(billing.dueDate);
  const explicitReady = ['COLLECTIONS_READY'].includes(String(billing.status ?? billing.statementStatus ?? '').toUpperCase());

  if (currentBalance < rules.minimumBalance) return null;
  if (!explicitReady && pastDue < rules.daysOverdueThreshold) return null;

  const existing = await Collection.findOne({
    patientBillingId: billing._id,
    isDeleted: false,
    status: { $nin: CLOSED_STATUSES },
  }).session(session ?? null);
  const contactAttempts = Number(existing?.contactAttempts ?? 0);
  const stage = stageFor({ daysPastDue: pastDue, contactAttempts }, rules);
  const status = stage === 'EXTERNAL_READY' ? 'EXTERNAL_COLLECTIONS_READY' : existing?.status ?? 'REVIEW';

  const payload = {
    patientId: billing.patientId,
    patientBillingId: billing._id,
    claimId: billing.claimId,
    originalBalance: billing.originalBalance ?? billing.patientBalance ?? currentBalance,
    currentBalance,
    balanceAmount: currentBalance,
    daysPastDue: pastDue,
    collectionStage: stage,
    status,
    collectionStatus: status,
    nextContactDate: existing?.nextContactDate ?? plusDays(new Date(), rules.escalationIntervalDays),
    contactAttempts,
    dedupeKey: `COLLECTION:${String(billing._id)}`,
    notes: existing?.notes ?? 'Collection workflow generated from overdue patient billing ledger.',
    active: true,
    updated: new Date(),
    updatedBy: createdBy as any,
  };

  let collection;
  if (existing) {
    Object.assign(existing, payload);
    existing.actionAudit = [
      ...(existing.actionAudit ?? []),
      audit('COLLECTION_RULE_REFRESHED', createdBy, { rules, currentBalance, daysPastDue: pastDue }),
    ];
    await existing.save({ session });
    collection = existing;
  } else {
    const [createdCollection] = await Collection.create([{
      ...payload,
      actionAudit: [audit('COLLECTION_CREATED_FROM_BILLING', createdBy, { rules, currentBalance, daysPastDue: pastDue })],
      created: new Date(),
      createdBy,
    }], { session });
    collection = createdCollection;
  }

  if (billing.status !== 'COLLECTIONS_READY') {
    billing.status = 'COLLECTIONS_READY';
    billing.statementStatus = 'COLLECTIONS_READY';
    billing.collectionsFlag = true;
    billing.updated = new Date();
    billing.updatedBy = createdBy as any;
    await billing.save({ session });
  }

  await auditLogService.record({
    entityType: 'collection',
    entityId: collection._id,
    action: existing ? 'COLLECTION_REFRESHED' : 'COLLECTION_REFERRED',
    userId: createdBy,
    changedBy: createdBy,
    source: 'collection',
    claimId: billing.claimId,
    patientId: billing.patientId,
    reason: existing ? 'Collection workflow refreshed from patient billing.' : 'Patient billing transferred to collections.',
    newState: {
      status: collection.status,
      collectionStage: collection.collectionStage,
      currentBalance: collection.currentBalance,
      patientBillingId: collection.patientBillingId,
    },
    session,
  });

  if (!existing) {
    publishRcmRealtimeEvent({
      eventType: 'COLLECTION_REFERRED',
      title: 'Collection referred',
      entityType: 'collection',
      entityId: String(collection._id),
      claimId: billing.claimId ? String(billing.claimId) : undefined,
      status: collection.status,
    });
  }

  return collection;
}

async function syncPatientBillingForCollectionAction(
  collection: any,
  action: string,
  data: any,
  updatedBy: string,
  session?: ClientSession
) {
  if (!collection.patientBillingId) return null;

  const billing = await PatientBilling.findOne({
    _id: collection.patientBillingId,
    isDeleted: false,
  }).session(session ?? null);

  if (!billing) return null;

  const currentBalance = roundCurrency(Number(billing.currentBalance ?? billing.amountDue ?? billing.patientBalance ?? collection.currentBalance ?? 0));
  const now = new Date();

  if (action === 'PAYMENT_PLAN') {
    billing.status = 'PAYMENT_PLAN';
    billing.statementStatus = 'PAYMENT_PLAN';
    billing.collectionsFlag = true;
  } else if (action === 'SETTLED') {
    throw new AppError(
      'Collection settlement is disabled until it is recorded through the patient payment ledger. Record a patient payment instead.',
      HTTP_STATUS.BAD_REQUEST
    );
  } else if (action === 'WRITE_OFF') {
    const writeOffAmount = roundCurrency(Number(collection.writeOffAmount ?? currentBalance));
    const nextBalance = roundCurrency(Math.max(0, currentBalance - writeOffAmount));

    billing.currentBalance = nextBalance;
    billing.amountDue = nextBalance;
    billing.writeOffFlag = true;
    billing.status = nextBalance <= 0 ? 'WRITTEN_OFF' : 'PARTIALLY_WRITTEN_OFF';
    billing.statementStatus = billing.status;
    billing.collectionsFlag = nextBalance > 0;
    collection.currentBalance = nextBalance;
    collection.balanceAmount = nextBalance;
  } else if (action === 'CLOSE') {
    const balance = roundCurrency(Number(billing.currentBalance ?? billing.amountDue ?? 0));
    billing.collectionsFlag = false;
    billing.status = balance <= 0 ? 'CLOSED' : 'COLLECTIONS_CLOSED';
    billing.statementStatus = billing.status;
  } else if (action === 'EXTERNAL_READY') {
    billing.status = 'COLLECTIONS_READY';
    billing.statementStatus = 'COLLECTIONS_READY';
    billing.collectionsFlag = true;
  }

  billing.updated = now;
  billing.updatedBy = updatedBy as any;
  await billing.save({ session });
  return billing;
}

export const collectionService = {
  async create(data: any, locale: string, createdBy: string, options: { session?: ClientSession } = {}): Promise<any> {
    return rejectAppendOnlyMutation('Collection', 'manually created');
  },

  async getById(id: string, locale: string) {
    const item = await Collection.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('collection.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    rejectAppendOnlyMutation('Collection', 'updated through generic CRUD');
    const item = await Collection.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('collection.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
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
    rejectAppendOnlyMutation('Collection', 'deleted');
    const item = await Collection.findOneAndUpdate(
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
      throw new AppError(t('collection.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },

  getRules(overrides: any = {}) {
    return resolveRules(overrides);
  },

  async ensureFromPatientBilling(billingOrId: any, overrides: any = {}, locale: string, createdBy: string, options: { session?: ClientSession } = {}) {
    const session = options.session;
    const billing = typeof billingOrId === 'string'
      ? await PatientBilling.findOne({ _id: billingOrId, isDeleted: false }).session(session ?? null)
      : billingOrId;

    if (!billing) {
      throw new AppError(t('patientBilling.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return createOrRefreshFromBilling(billing, resolveRules(overrides), createdBy, session);
  },

  async generateFromPatientBilling(overrides: any = {}, locale: string, createdBy: string) {
    const result = await withMongoTransaction(async (session) => {
    const rules = resolveRules(overrides);
    const candidateBillings = await PatientBilling.find({
      isDeleted: false,
      paymentPlanId: { $in: [null, undefined, ''] },
      $or: [
        { status: 'COLLECTIONS_READY' },
        { statementStatus: 'COLLECTIONS_READY' },
        { currentBalance: { $gte: rules.minimumBalance } },
        { amountDue: { $gte: rules.minimumBalance } },
      ],
    }).limit(500).session(session);

    const createdOrUpdated: any[] = [];
    for (const billing of candidateBillings) {
      const collection = await createOrRefreshFromBilling(billing, rules, createdBy, session);
      if (collection) createdOrUpdated.push(collection);
    }

    return { rules, createdOrUpdatedCount: createdOrUpdated.length, collections: createdOrUpdated };
    });

    for (const collection of result.collections) {
      publishRcmRealtimeEvent({
        eventType: 'COLLECTION_STATUS_CHANGED',
        title: 'Collection generated',
        message: `Collection ${String(collection._id)} is available for follow-up.`,
        entityType: 'collection',
        entityId: String(collection._id),
        claimId: collection.claimId ? String(collection.claimId) : undefined,
        status: collection.status,
      });
    }
    return result;
  },

  async applyAction(id: string, action: string, data: any, locale: string, updatedBy: string) {
    const item = await withMongoTransaction(async (session) => {
    const item = await Collection.findOne({ _id: id, isDeleted: false }).session(session);
    if (!item) {
      throw new AppError(t('collection.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }
    const normalizedAction = String(action ?? '').trim().toUpperCase();
    if (!normalizedAction) {
      throw new AppError('Collection action is required.', HTTP_STATUS.BAD_REQUEST);
    }
    const now = new Date();
    let createdAdjustment: any = null;
    const currentStatus = item.status ?? item.collectionStatus;

    if (normalizedAction === 'ASSIGN') {
      item.owner = data.owner;
    } else if (normalizedAction === 'LOG_CONTACT') {
      item.lastContactDate = data.lastContactDate ?? now;
      item.nextContactDate = data.nextContactDate ?? item.nextContactDate;
      item.contactAttempts = Number(item.contactAttempts ?? 0) + 1;
      item.status = 'CONTACTED';
      item.collectionStatus = 'CONTACTED';
    } else if (normalizedAction === 'SCHEDULE_FOLLOW_UP') {
      item.nextContactDate = data.nextContactDate;
    } else if (normalizedAction === 'PAYMENT_PLAN') {
      item.status = 'PAYMENT_PLAN';
      item.collectionStatus = 'PAYMENT_PLAN';
      item.resolution = data.resolution ?? 'Patient placed on payment plan.';
    } else if (normalizedAction === 'SETTLED') {
      throw new AppError(
        'Collection settlement is disabled until it is recorded through the patient payment ledger. Record a patient payment instead.',
        HTTP_STATUS.BAD_REQUEST
      );
    } else if (normalizedAction === 'WRITE_OFF') {
      requireActionReason(data.reason ?? data.resolution ?? data.notes, 'Collection write-off');
      if (item.claimId) {
        await claimClosureService.reopenForFinancialMutation(
          String(item.claimId),
          `Collection ${String(item._id)} write-off: ${data.reason ?? data.resolution ?? data.notes}`,
          updatedBy,
          session
        );
      }
      item.status = 'WRITTEN_OFF';
      item.collectionStatus = 'WRITTEN_OFF';
      item.writeOffAmount = roundCurrency(Number(data.writeOffAmount ?? item.currentBalance ?? item.balanceAmount ?? 0));
      item.resolution = data.resolution ?? 'Collection balance written off.';
      item.closeDate = now;
      [createdAdjustment] = await Adjustment.create([{
        claimId: item.claimId,
        adjustmentType: 'collection write-off',
        adjustmentGroupCode: 'WO',
        adjustmentReasonCode: 'COLLECTION_WRITE_OFF',
        adjustmentAmount: item.writeOffAmount,
        source: 'COLLECTION_WORKFLOW',
        writeOffFlag: true,
        approvedBy: String(updatedBy),
        adjustmentDate: now,
        notes: data.notes ?? `Write-off from collection ${String(item._id)}`,
        active: true,
        created: now,
        updated: now,
        createdBy: updatedBy,
      }], { session });
    } else if (normalizedAction === 'EXTERNAL_READY') {
      item.status = 'EXTERNAL_COLLECTIONS_READY';
      item.collectionStatus = 'EXTERNAL_COLLECTIONS_READY';
      item.collectionStage = 'EXTERNAL_READY';
    } else if (normalizedAction === 'CLOSE') {
      requireActionReason(data.reason ?? data.resolution ?? data.notes, 'Collection close');
      item.status = 'CLOSED';
      item.collectionStatus = 'CLOSED';
      item.resolution = data.resolution ?? item.resolution;
      item.closeDate = now;
    } else {
      throw new AppError('Unsupported collection action.', HTTP_STATUS.BAD_REQUEST);
    }

    item.notes = data.notes ?? item.notes;
    item.actionAudit = [
      ...(item.actionAudit ?? []),
      audit(normalizedAction, updatedBy, {
        notes: data.notes,
        owner: data.owner,
        contactType: data.contactType,
        contactOutcome: data.contactOutcome,
        nextContactDate: data.nextContactDate,
        writeOffAmount: data.writeOffAmount,
        settlementAmount: data.settlementAmount,
      }),
    ];
    item.updated = now;
    item.updatedBy = updatedBy as any;
    await syncPatientBillingForCollectionAction(item, normalizedAction, data, updatedBy, session);
    await item.save({ session });
    if (item.claimId) {
      if (normalizedAction === 'WRITE_OFF') {
        await financialEventService.record({
          eventType: 'COLLECTION_WRITE_OFF',
          sourceModule: 'collection',
          amount: Number(item.writeOffAmount ?? 0),
          claimId: item.claimId,
          adjustmentId: createdAdjustment?._id,
          patientBillingId: item.patientBillingId,
          reason: data.reason ?? data.resolution ?? data.notes,
          metadata: { collectionId: String(item._id), resolutionType: 'WRITE_OFF' },
          createdBy: updatedBy,
          session,
        });
      }
      await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy, session);
    }
    const auditAction = normalizedAction === 'LOG_CONTACT'
      ? 'COLLECTION_CONTACTED'
      : normalizedAction === 'WRITE_OFF'
        ? 'COLLECTION_WRITTEN_OFF'
        : normalizedAction === 'CLOSE'
          ? 'COLLECTION_CLOSED'
          : normalizedAction === 'EXTERNAL_READY'
            ? 'COLLECTION_REFERRED'
            : `COLLECTION_${normalizedAction}`;
    await auditLogService.record({
      entityType: 'collection',
      entityId: item._id,
      action: auditAction,
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'collection',
      claimId: item.claimId,
      patientId: item.patientId,
      payerId: (item as any).payerId,
      reason: data.reason ?? data.resolution ?? data.notes,
      previousState: { status: currentStatus },
      newState: {
        status: item.status,
        collectionStatus: item.collectionStatus,
        writeOffAmount: item.writeOffAmount,
        closeDate: item.closeDate,
      },
      session,
    });
    return item;
    });

    publishRcmRealtimeEvent({
      eventType: 'COLLECTION_STATUS_CHANGED',
      title: 'Collection status changed',
      message: `Collection ${String(item._id)} moved to ${item.status}.`,
      entityType: 'collection',
      entityId: String(item._id),
      claimId: item.claimId ? String(item.claimId) : undefined,
      status: item.status,
    });
    return item;
  },
};
