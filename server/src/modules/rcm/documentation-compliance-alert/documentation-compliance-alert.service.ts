import axios from 'axios';
import mongoose, { ClientSession } from 'mongoose';
import { envConfig } from '../../../config/env.config';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { logRcmEvent } from '../../../utils/hipaa-logger.util';
import { User } from '../../user/user.model';
import { Claim } from '../claim/claim.model';
import { Document } from '../document/document.model';
import { Encounter } from '../encounter/encounter.model';
import { PriorAuthorization } from '../prior-authorization/prior-authorization.model';
import { ProcedureCode } from '../procedure-code/procedure-code.model';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import {
  DocumentationComplianceAlert,
  DocumentationComplianceSeverity,
  DocumentationComplianceStatus,
  IDocumentationComplianceAlert,
} from './documentation-compliance-alert.model';

type DocumentationComplianceEvaluation = {
  claimId: string;
  requiredDocuments: string[];
  missingDocuments: string[];
  matchedDocuments: string[];
  severity: DocumentationComplianceSeverity;
  status: DocumentationComplianceStatus;
  claimCreatedBy?: string;
  claimCreatedByEmail?: string;
  claimCreatedByName?: string;
  fallbackRecipientEmail?: string;
  notificationRecipientEmail?: string;
  notificationRouting?: 'CLAIM_CREATOR' | 'FALLBACK';
  alert?: IDocumentationComplianceAlert | null;
};

type EvaluationOptions = {
  session?: ClientSession;
  triggerZapier?: boolean;
  updatedBy?: string;
};

const SUBMITTED_STATUSES = new Set(['QUEUED', 'SUBMITTED', 'PRINTED', 'TRANSMITTED', 'ACKNOWLEDGED', 'ACCEPTED']);

function normalizeText(value: unknown) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeKey(value: unknown) {
  return normalizeText(value)?.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function unique(values: Array<string | undefined>) {
  return Array.from(new Set(values.map(normalizeText).filter((value): value is string => Boolean(value))));
}

function getClaimProcedureCodes(claim: any) {
  return unique((claim.claimLines ?? []).map((line: any) => line.cptCode));
}

function isCptInRange(code: string, min: number, max: number) {
  const numericCode = Number.parseInt(code.replace(/\D+/g, ''), 10);
  return Number.isFinite(numericCode) && numericCode >= min && numericCode <= max;
}

function isMriCode(code: string, metadata?: any) {
  const descriptor = normalizeKey(`${metadata?.description ?? ''} ${metadata?.category ?? ''}`) ?? '';
  return descriptor.includes('mri')
    || descriptor.includes('magnetic resonance')
    || [
      [70540, 70553],
      [71550, 71555],
      [72141, 72158],
      [73218, 73223],
      [73718, 73723],
      [74181, 74183],
      [75557, 75563],
      [77046, 77049],
    ].some(([min, max]) => isCptInRange(code, min, max));
}

function isPhysicalTherapyCode(code: string, metadata?: any) {
  const descriptor = normalizeKey(`${metadata?.description ?? ''} ${metadata?.category ?? ''}`) ?? '';
  return descriptor.includes('physical therapy')
    || descriptor.includes('therapeutic')
    || descriptor.includes('rehabilitation')
    || isCptInRange(code, 97010, 97799);
}

function isDentalCode(code: string, metadata?: any) {
  const descriptor = normalizeKey(`${metadata?.description ?? ''} ${metadata?.category ?? ''}`) ?? '';
  return /^D\d{4}$/i.test(code) || descriptor.includes('dental') || descriptor.includes('dentistry');
}

function getDentalRequiredDocuments(code: string, metadata?: any) {
  if (!isDentalCode(code, metadata)) {
    return [];
  }

  const normalizedCode = code.toUpperCase();
  const required = ['Clinical Note'];

  if (/^D2\d{3}$/.test(normalizedCode) || /^D5\d{3}$/.test(normalizedCode)) {
    required.push('Consent Form');
  }

  if (/^D9\d{3}$/.test(normalizedCode)) {
    required.push('Progress Note');
  }

  return required;
}

function hasRequiredFlag(claim: any, field: 'authorizationRequired' | 'referralRequired') {
  return Boolean(claim?.[field]) || (claim.claimLines ?? []).some((line: any) => Boolean(line?.[field]));
}

function calculateSeverity(missingDocuments: string[]): DocumentationComplianceSeverity {
  if (missingDocuments.some((document) => /authorization|referral/i.test(document))) {
    return 'HIGH';
  }

  return missingDocuments.length > 1 ? 'MEDIUM' : 'LOW';
}

function documentMatchesRequirement(documentLabel: string, requirement: string) {
  const label = normalizeKey(documentLabel) ?? '';
  const required = normalizeKey(requirement) ?? '';

  if (!label || !required) return false;
  if (label.includes(required) || required.includes(label)) return true;

  const aliases: Record<string, string[]> = {
    'clinical note': ['clinical note', 'clinical notes', 'medical record', 'medical records', 'visit note', 'encounter note', 'soap note'],
    'progress note': ['progress note', 'progress notes', 'therapy note', 'therapy notes', 'visit note', 'encounter note', 'soap note'],
    'consent form': ['consent', 'consent form', 'signed consent', 'treatment consent', 'procedure consent'],
    'authorization document': ['authorization', 'prior authorization', 'auth approval', 'authorization approval', 'auth document'],
    referral: ['referral', 'referral document', 'referral order'],
  };

  return (aliases[required] ?? [required]).some((alias) => label.includes(alias));
}

function shouldTriggerZapier(previous: IDocumentationComplianceAlert | null, next: DocumentationComplianceEvaluation) {
  if (next.status !== 'FAIL') return false;
  if (!previous) return true;
  if (previous.status !== next.status || previous.severity !== next.severity) return true;
  const previousMissing = [...(previous.lastZapierMissingDocuments ?? [])].sort().join('|');
  const nextMissing = [...next.missingDocuments].sort().join('|');
  return previous.lastZapierStatus !== next.status || previousMissing !== nextMissing;
}

function isSubmittedClaim(claim: any) {
  const submissionStatus = normalizeText(claim.submissionStatus)?.toUpperCase();
  const claimStatus = normalizeText(claim.claimStatus)?.toUpperCase();
  return SUBMITTED_STATUSES.has(submissionStatus ?? '') || claimStatus === 'SUBMITTED';
}

async function resolveClaimCreator(claim: any, session?: ClientSession) {
  const fallbackRecipientEmail = normalizeText(envConfig.rcmZapierDocumentationComplianceFallbackEmail);
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

async function collectRequiredDocuments(claim: any, session?: ClientSession) {
  const procedureCodes = getClaimProcedureCodes(claim);
  const procedureCodeDocs = procedureCodes.length
    ? await ProcedureCode.find({
      code: { $in: procedureCodes },
      isDeleted: false,
      active: { $ne: false },
    })
      .session(session ?? null)
      .lean()
    : [];
  const procedureCodeByCode = new Map(procedureCodeDocs.map((procedureCode: any) => [procedureCode.code, procedureCode]));

  const required: string[] = [];

  for (const code of procedureCodes) {
    const metadata = procedureCodeByCode.get(code);
    if (isMriCode(code, metadata)) {
      required.push('Clinical Note', 'Authorization Document');
    }
    if (isPhysicalTherapyCode(code, metadata)) {
      required.push('Referral', 'Progress Note');
    }
    required.push(...getDentalRequiredDocuments(code, metadata));
    if (metadata?.requiresAuth) {
      required.push('Authorization Document');
    }
  }

  if (hasRequiredFlag(claim, 'authorizationRequired')) {
    required.push('Authorization Document');
  }

  if (hasRequiredFlag(claim, 'referralRequired')) {
    required.push('Referral');
  }

  return unique(required);
}

async function collectAvailableDocumentLabels(claim: any, session?: ClientSession) {
  const labels = (claim.attachments ?? []).flatMap((attachment: any) => [
    attachment.documentType,
    attachment.title,
    attachment.fileUrl,
    attachment.description,
  ]);

  const filters: any[] = [
    { claimId: claim._id },
    { entityType: 'claim', entityId: claim._id },
  ];

  if (claim.encounterId) {
    filters.push({ encounterId: claim.encounterId }, { entityType: 'encounter', entityId: claim.encounterId });
  }

  const documents = await Document.find({
    isDeleted: false,
    active: { $ne: false },
    $or: filters,
  })
    .select('documentType documentCategory fileName tags description')
    .session(session ?? null)
    .lean();

  labels.push(...documents.flatMap((document: any) => [
    document.documentType,
    document.documentCategory,
    document.fileName,
    ...(document.tags ?? []),
    document.description,
  ]));

  if (claim.encounterId) {
    const encounter = await Encounter.findOne({ _id: claim.encounterId, isDeleted: false })
      .select('clinicalNotes historyOfPresentIllness')
      .session(session ?? null)
      .lean();

    if (normalizeText(encounter?.clinicalNotes) || normalizeText(encounter?.historyOfPresentIllness)) {
      labels.push('Clinical Note', 'Progress Note');
    }
  }

  const authorizationIds = unique((claim.claimLines ?? []).map((line: any) => line.priorAuthorizationId?.toString?.()));
  if (authorizationIds.length) {
    const authorizations = await PriorAuthorization.find({
      _id: { $in: authorizationIds },
      isDeleted: false,
    })
      .select('documentChecklist')
      .session(session ?? null)
      .lean();

    for (const authorization of authorizations) {
      for (const checklistItem of authorization.documentChecklist ?? []) {
        if (checklistItem?.complete) {
          labels.push(checklistItem.documentType, checklistItem.label, checklistItem.name);
        }
      }
    }
  }

  return unique(labels);
}

async function deliverZapierAlert(alert: IDocumentationComplianceAlert, evaluation: DocumentationComplianceEvaluation) {
  if (!envConfig.rcmZapierDocumentationComplianceEnabled || !envConfig.rcmZapierDocumentationComplianceWebhookUrl) {
    return;
  }

  const payload = {
    eventType: 'DOCUMENTATION_GAP',
    alertType: 'DOCUMENTATION_GAP',
    claimId: String(evaluation.claimId),
    alertId: String(alert._id),
    status: evaluation.status,
    severity: evaluation.severity,
    missingDocuments: evaluation.missingDocuments,
    requiredDocuments: evaluation.requiredDocuments,
    matchedDocuments: evaluation.matchedDocuments,
    claimCreatedBy: evaluation.claimCreatedBy,
    claimCreatedByEmail: evaluation.claimCreatedByEmail,
    claimCreatedByName: evaluation.claimCreatedByName,
    fallbackRecipientEmail: evaluation.fallbackRecipientEmail,
    notificationRecipientEmail: evaluation.notificationRecipientEmail,
    notificationRouting: evaluation.notificationRouting,
  };

  try {
    await axios.post(envConfig.rcmZapierDocumentationComplianceWebhookUrl, payload, {
      timeout: envConfig.rcmZapierDocumentationComplianceTimeoutMs,
      headers: {
        'Content-Type': 'application/json',
        'x-rcm-event-type': 'DOCUMENTATION_GAP',
      },
    });

    await DocumentationComplianceAlert.updateOne(
      { _id: alert._id },
      {
        $set: {
          lastZapierTriggeredAt: new Date(),
          lastZapierStatus: evaluation.status,
          lastZapierMissingDocuments: evaluation.missingDocuments,
          zapierDeliveryStatus: 'DELIVERED',
          updated: new Date(),
        },
        $unset: { zapierDeliveryError: '' },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Zapier delivery failed.';
    await DocumentationComplianceAlert.updateOne(
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
      module: 'rcm.documentationCompliance',
      eventType: 'DOCUMENTATION_GAP',
      status: 'FAILED',
      errorCode: 'ZAPIER_DELIVERY_FAILED',
      message,
      correlationId: String(evaluation.claimId),
    });
  }
}

export const documentationComplianceAlertService = {
  async calculateForClaim(claim: any, session?: ClientSession): Promise<DocumentationComplianceEvaluation | null> {
    const requiredDocuments = await collectRequiredDocuments(claim, session);
    if (!requiredDocuments.length) return null;

    const availableDocuments = await collectAvailableDocumentLabels(claim, session);
    const matchedDocuments = requiredDocuments.filter((requirement) =>
      availableDocuments.some((availableDocument) => documentMatchesRequirement(availableDocument, requirement))
    );
    const missingDocuments = requiredDocuments.filter((requirement) => !matchedDocuments.includes(requirement));
    const status: DocumentationComplianceStatus = missingDocuments.length ? 'FAIL' : 'PASS';
    const severity = missingDocuments.length ? calculateSeverity(missingDocuments) : 'LOW';

    return {
      claimId: String(claim._id),
      requiredDocuments,
      missingDocuments,
      matchedDocuments,
      status,
      severity,
    };
  },

  async evaluateClaim(claimOrId: any, options: EvaluationOptions = {}) {
    const claim = typeof claimOrId === 'string'
      ? await Claim.findOne({ _id: claimOrId, isDeleted: false }).session(options.session ?? null)
      : claimOrId;

    if (!claim) {
      throw new AppError('Claim not found.', HTTP_STATUS.NOT_FOUND);
    }

    if (isSubmittedClaim(claim)) {
      await this.resolveClaim(String(claim._id), options.updatedBy, options.session);
      return null;
    }

    const evaluation = await this.calculateForClaim(claim, options.session);
    if (!evaluation) {
      await this.resolveClaim(String(claim._id), options.updatedBy, options.session);
      return null;
    }

    Object.assign(evaluation, await resolveClaimCreator(claim, options.session));

    const previous = await DocumentationComplianceAlert.findOne({
      claimId: claim._id,
      isDeleted: false,
    }).session(options.session ?? null);

    if (evaluation.status === 'PASS') {
      const alert = previous
        ? await DocumentationComplianceAlert.findOneAndUpdate(
          { claimId: claim._id, isDeleted: false },
          {
            $set: {
              alertType: 'DOCUMENTATION_GAP',
              claimId: claim._id,
              missingDocuments: [],
              requiredDocuments: evaluation.requiredDocuments,
              matchedDocuments: evaluation.matchedDocuments,
              severity: evaluation.severity,
              status: evaluation.status,
              active: false,
              updated: new Date(),
              updatedBy: options.updatedBy,
            },
          },
          {
            new: true,
            session: options.session,
          }
        )
        : null;

      return { ...evaluation, alert };
    }

    const shouldNotifyZapier = Boolean(options.triggerZapier && !options.session && shouldTriggerZapier(previous, evaluation));
    const alert = await DocumentationComplianceAlert.findOneAndUpdate(
      { claimId: claim._id, isDeleted: false },
      {
        $set: {
          alertType: 'DOCUMENTATION_GAP',
          claimId: claim._id,
          missingDocuments: evaluation.missingDocuments,
          requiredDocuments: evaluation.requiredDocuments,
          matchedDocuments: evaluation.matchedDocuments,
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

    if (evaluation.status === 'FAIL') {
      publishRcmRealtimeEvent({
        eventType: 'DOCUMENTATION_GAP',
        title: 'Documentation gap',
        message: `Claim is missing: ${evaluation.missingDocuments.join(', ')}.`,
        claimId: String(claim._id),
        entityType: 'documentationComplianceAlert',
        entityId: String(alert._id),
        status: evaluation.status,
      });
    }

    if (shouldNotifyZapier) {
      deliverZapierAlert(alert, nextEvaluation).catch((error) => {
        logRcmEvent({
          module: 'rcm.documentationCompliance',
          eventType: 'DOCUMENTATION_GAP',
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
    await DocumentationComplianceAlert.updateMany(
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
      failedAlerts: results.filter((result) => result.status === 'FAIL').length,
      highSeverityAlerts: results.filter((result) => result.severity === 'HIGH').length,
    };
  },
};
