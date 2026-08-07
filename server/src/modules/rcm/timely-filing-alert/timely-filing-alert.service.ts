import axios from 'axios';
import mongoose, { ClientSession } from 'mongoose';
import { envConfig } from '../../../config/env.config';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { logRcmEvent } from '../../../utils/hipaa-logger.util';
import { User } from '../../user/user.model';
import { Claim } from '../claim/claim.model';
import { Payer } from '../payer/payer.model';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import {
  ITimelyFilingAlert,
  TimelyFilingAlert,
  TimelyFilingSeverity,
  TimelyFilingStatus,
} from './timely-filing-alert.model';

type TimelyFilingEvaluation = {
  claimId: string;
  payerId: string;
  serviceDate: Date;
  filingDeadline: Date;
  daysRemaining: number;
  severity: TimelyFilingSeverity;
  status: TimelyFilingStatus;
  timelyFilingDays: number;
  claimCreatedBy?: string;
  claimCreatedByEmail?: string;
  claimCreatedByName?: string;
  notificationRecipientEmail?: string;
  fallbackRecipientEmail?: string;
  notificationRouting?: 'CLAIM_CREATOR' | 'FALLBACK';
  alert?: ITimelyFilingAlert | null;
};

type EvaluationOptions = {
  session?: ClientSession;
  triggerZapier?: boolean;
  updatedBy?: string;
};

const RISK_STATUSES = new Set<TimelyFilingStatus>(['WARNING', 'CRITICAL', 'EXPIRED']);
const SUBMITTED_STATUSES = new Set(['QUEUED', 'SUBMITTED', 'PRINTED', 'TRANSMITTED', 'ACKNOWLEDGED', 'ACCEPTED']);

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  return undefined;
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function addCalendarDays(date: Date, days: number) {
  const nextDate = startOfDay(date);
  nextDate.setDate(nextDate.getDate() + days);
  return endOfDay(nextDate);
}

function daysUntil(deadline: Date, now = new Date()) {
  return Math.ceil((endOfDay(deadline).getTime() - startOfDay(now).getTime()) / (24 * 60 * 60 * 1000));
}

function getClaimServiceDate(claim: any) {
  const lineDates = (claim.claimLines ?? [])
    .map((line: any) => normalizeDate(line.serviceDateFrom) ?? normalizeDate(line.serviceDateTo))
    .filter((date: Date | undefined): date is Date => Boolean(date))
    .sort((first: Date, second: Date) => first.getTime() - second.getTime());

  return lineDates[0] ?? normalizeDate(claim.claimDate);
}

function calculateSeverity(daysRemaining: number): Pick<TimelyFilingEvaluation, 'severity' | 'status'> {
  if (daysRemaining < 0) {
    return { status: 'EXPIRED', severity: 'CRITICAL' };
  }

  if (daysRemaining <= 7) {
    return { status: 'CRITICAL', severity: 'HIGH' };
  }

  if (daysRemaining <= 15) {
    return { status: 'WARNING', severity: 'MEDIUM' };
  }

  if (daysRemaining <= 30) {
    return { status: 'WARNING', severity: 'LOW' };
  }

  return { status: 'SAFE', severity: 'LOW' };
}

function getZapierSeverity(severity: TimelyFilingSeverity) {
  if (severity === 'CRITICAL') return 'CRITICAL';
  if (severity === 'HIGH') return 'HIGH';
  if (severity === 'MEDIUM') return 'MEDIUM';
  return 'LOW';
}

async function resolvePayerByReference(reference?: unknown, session?: ClientSession) {
  const normalizedReference = normalizeText(reference);
  if (!normalizedReference) return null;

  const filters: any[] = [
    { payerId: normalizedReference },
    { ediPayerId: normalizedReference },
    { payerName: normalizedReference },
  ];

  if (mongoose.Types.ObjectId.isValid(normalizedReference)) {
    filters.unshift({ _id: normalizedReference });
  }

  return Payer.findOne({
    isDeleted: false,
    active: { $ne: false },
    $or: filters,
  }).session(session ?? null);
}

function isSubmittedClaim(claim: any) {
  const submissionStatus = normalizeText(claim.submissionStatus)?.toUpperCase();
  const claimStatus = normalizeText(claim.claimStatus)?.toUpperCase();
  return SUBMITTED_STATUSES.has(submissionStatus ?? '') || claimStatus === 'SUBMITTED';
}

async function resolveClaimCreator(claim: any, session?: ClientSession) {
  const fallbackRecipientEmail = normalizeText(envConfig.rcmZapierTimelyFilingFallbackEmail);
  const createdBy = claim?.createdBy;
  const createdById =
    typeof createdBy === 'object' && createdBy !== null && '_id' in createdBy
      ? normalizeText(String(createdBy._id))
      : normalizeText(createdBy?.toString?.() ?? createdBy);

  if (!createdById || !mongoose.Types.ObjectId.isValid(createdById)) {
    return {
      claimCreatedBy: createdById,
      fallbackRecipientEmail,
      notificationRecipientEmail: fallbackRecipientEmail,
      notificationRouting: 'FALLBACK' as const,
    };
  }

  const user = await User.findOne({
    _id: createdById,
    isDeleted: false,
    active: { $ne: false },
  })
    .select('firstName lastName email')
    .session(session ?? null)
    .lean();

  const claimCreatedByEmail = normalizeText(user?.email);
  const claimCreatedByName = [normalizeText(user?.firstName), normalizeText(user?.lastName)]
    .filter(Boolean)
    .join(' ');

  return {
    claimCreatedBy: createdById,
    claimCreatedByEmail,
    claimCreatedByName: claimCreatedByName || undefined,
    fallbackRecipientEmail,
    notificationRecipientEmail: claimCreatedByEmail ?? fallbackRecipientEmail,
    notificationRouting: claimCreatedByEmail ? 'CLAIM_CREATOR' as const : 'FALLBACK' as const,
  };
}

function shouldTriggerZapier(previous: ITimelyFilingAlert | null, next: TimelyFilingEvaluation) {
  if (!RISK_STATUSES.has(next.status)) return false;
  if (!previous) return true;
  if (previous.status !== next.status || previous.severity !== next.severity) return true;
  return previous.lastZapierStatus !== next.status || previous.lastZapierSeverity !== next.severity;
}

async function deliverZapierAlert(alert: ITimelyFilingAlert, evaluation: TimelyFilingEvaluation) {
  if (!envConfig.rcmZapierTimelyFilingEnabled || !envConfig.rcmZapierTimelyFilingWebhookUrl) {
    return;
  }

  const payload = {
    eventType: 'TIMELY_FILING_RISK',
    claimId: String(evaluation.claimId),
    payerId: evaluation.payerId,
    serviceDate: evaluation.serviceDate.toISOString(),
    filingDeadline: evaluation.filingDeadline.toISOString(),
    daysRemaining: evaluation.daysRemaining,
    severity: getZapierSeverity(evaluation.severity),
    status: evaluation.status,
    alertId: String(alert._id),
    claimCreatedBy: evaluation.claimCreatedBy,
    claimCreatedByEmail: evaluation.claimCreatedByEmail,
    claimCreatedByName: evaluation.claimCreatedByName,
    fallbackRecipientEmail: evaluation.fallbackRecipientEmail,
    notificationRecipientEmail: evaluation.notificationRecipientEmail,
    notificationRouting: evaluation.notificationRouting,
  };

  try {
    await axios.post(envConfig.rcmZapierTimelyFilingWebhookUrl, payload, {
      timeout: envConfig.rcmZapierTimelyFilingTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'x-rcm-event-type': 'TIMELY_FILING_RISK',
      },
    });

    await TimelyFilingAlert.updateOne(
      { _id: alert._id },
      {
        $set: {
          lastZapierTriggeredAt: new Date(),
          lastZapierStatus: evaluation.status,
          lastZapierSeverity: evaluation.severity,
          zapierDeliveryStatus: 'DELIVERED',
          updated: new Date(),
        },
        $unset: { zapierDeliveryError: '' },
      }
    );

    logRcmEvent({
      module: 'rcm.timelyFiling',
      eventType: 'TIMELY_FILING_RISK',
      status: 'SUCCEEDED',
      correlationId: String(evaluation.claimId),
      metadata: payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Zapier delivery failed.';
    await TimelyFilingAlert.updateOne(
      { _id: alert._id },
      {
        $set: {
          zapierDeliveryStatus: 'FAILED',
          zapierDeliveryError: message,
          updated: new Date(),
        },
      }
    );

    logRcmEvent({
      module: 'rcm.timelyFiling',
      eventType: 'TIMELY_FILING_RISK',
      status: 'FAILED',
      errorCode: 'ZAPIER_DELIVERY_FAILED',
      message,
      correlationId: String(evaluation.claimId),
    });
  }
}

export const timelyFilingAlertService = {
  calculateForClaim(claim: any, payer: any): TimelyFilingEvaluation | null {
    const timelyFilingDays = Number(payer?.timelyFilingDays);
    const serviceDate = getClaimServiceDate(claim);

    if (!Number.isFinite(timelyFilingDays) || timelyFilingDays <= 0 || !serviceDate) {
      return null;
    }

    const filingDeadline = addCalendarDays(serviceDate, timelyFilingDays);
    const daysRemaining = daysUntil(filingDeadline);
    const severity = calculateSeverity(daysRemaining);

    return {
      claimId: String(claim._id),
      payerId: normalizeText(payer.payerId) ?? normalizeText(payer.ediPayerId) ?? String(payer._id),
      serviceDate,
      filingDeadline,
      daysRemaining,
      timelyFilingDays,
      ...severity,
    };
  },

  async evaluateClaim(claimOrId: any, options: EvaluationOptions = {}) {
    const claim = typeof claimOrId === 'string'
      ? await Claim.findOne({ _id: claimOrId, isDeleted: false }).session(options.session ?? null)
      : claimOrId;

    if (!claim) {
      throw new AppError('Claim not found.', HTTP_STATUS.NOT_FOUND);
    }

    const payer = await resolvePayerByReference(claim.payerId, options.session);

    if (!payer) {
      return null;
    }

    if (isSubmittedClaim(claim)) {
      await this.resolveClaim(String(claim._id), options.updatedBy, options.session);
      return null;
    }

    const evaluation = this.calculateForClaim(claim, payer);
    if (!evaluation) return null;
    Object.assign(evaluation, await resolveClaimCreator(claim, options.session));

    const previous = await TimelyFilingAlert.findOne({
      claimId: claim._id,
      payerId: evaluation.payerId,
      isDeleted: false,
    }).session(options.session ?? null);

    const shouldNotifyZapier = Boolean(options.triggerZapier && !options.session && shouldTriggerZapier(previous, evaluation));
    const alert = await TimelyFilingAlert.findOneAndUpdate(
      { claimId: claim._id, payerId: evaluation.payerId, isDeleted: false },
      {
        $set: {
          claimId: claim._id,
          payerId: evaluation.payerId,
          serviceDate: evaluation.serviceDate,
          filingDeadline: evaluation.filingDeadline,
          daysRemaining: evaluation.daysRemaining,
          severity: evaluation.severity,
          status: evaluation.status,
          active: true,
          updated: new Date(),
          updatedBy: options.updatedBy,
        },
        $setOnInsert: {
          created: new Date(),
          createdBy: options.updatedBy,
          isDeleted: false,
        },
      },
      {
        new: true,
        upsert: true,
        session: options.session,
        setDefaultsOnInsert: true,
      }
    );

    const nextEvaluation = { ...evaluation, alert };

    if (RISK_STATUSES.has(evaluation.status)) {
      publishRcmRealtimeEvent({
        eventType: 'TIMELY_FILING_RISK',
        title: 'Timely filing risk',
        message: `Claim has ${evaluation.daysRemaining} day(s) remaining before timely filing expires.`,
        claimId: String(claim._id),
        entityType: 'timelyFilingAlert',
        entityId: String(alert._id),
        status: evaluation.status,
      });
    }

    if (shouldNotifyZapier) {
      deliverZapierAlert(alert, nextEvaluation).catch((error) => {
        logRcmEvent({
          module: 'rcm.timelyFiling',
          eventType: 'TIMELY_FILING_RISK',
          status: 'FAILED',
          errorCode: 'ZAPIER_ASYNC_DELIVERY_FAILED',
          message: error instanceof Error ? error.message : 'Zapier delivery failed.',
          correlationId: String(claim._id),
        });
      });
    }

    return nextEvaluation;
  },

  async resolveClaim(claimId: string, updatedBy?: string, session?: ClientSession) {
    await TimelyFilingAlert.updateMany(
      { claimId, isDeleted: false, active: true },
      {
        active: false,
        updatedBy,
        updated: new Date(),
      },
      { session }
    );
  },

  async refreshOpenClaims(updatedBy?: string) {
    const claims = await Claim.find({
      isDeleted: false,
      active: { $ne: false },
      submissionStatus: { $nin: Array.from(SUBMITTED_STATUSES) },
      claimStatus: { $nin: ['Submitted', 'Closed'] },
      payerId: { $exists: true, $ne: '' },
    }).limit(1000);

    const results = [];
    for (const claim of claims) {
      const result = await this.evaluateClaim(claim, { triggerZapier: true, updatedBy });
      if (result) {
        results.push(result);
      }
    }

    return {
      scannedClaims: claims.length,
      alertsUpdated: results.length,
      riskAlerts: results.filter((result) => RISK_STATUSES.has(result.status)).length,
      expiredAlerts: results.filter((result) => result.status === 'EXPIRED').length,
    };
  },
};
