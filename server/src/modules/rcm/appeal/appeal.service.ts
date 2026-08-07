import { Appeal, IAppeal } from './appeal.model';
import { AppealTemplate } from './appeal-template.model';
import { AppealPayerRule } from './appeal-payer-rule.model';
import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { Denial } from '../denial/denial.model';
import { Claim } from '../claim/claim.model';
import { ArWorkItem } from '../ar-work-item/ar-work-item.model';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';
import { appealResolutionService } from './appeal-resolution.service';
import mongoose, { type ClientSession } from 'mongoose';
import { claimClosureService } from '../claim/claim-closure.service';
import { assertUnsafeMutationAllowed, requireActionReason } from '../shared/rcm-lifecycle-safety';
import { assertDenialTransition, normalizeDenialStatus } from '../denial/denial-workflow.service';
import { registerRcmJobHandler } from '../background-job/rcm-queue.service';
import { rcmAiService } from '../workflow/rcm-ai.service';
import { auditLogService } from '../audit-log/audit-log.service';
import { markEntityDocumentsDeleted, syncEntityDocuments } from '../document/document-registry.service';
import { documentService } from '../document/document.service';
import { envConfig } from '../../../config/env.config';
import { appConfig } from '../../../config/app.config';
import { assignAuditActor, auditActorPatch } from '../shared/audit-actor.util';

export const APPEAL_STATUSES = [
  'DRAFT',
  'PACKET_GENERATED',
  'READY',
  'SUBMITTED',
  'PAYER_RECEIVED',
  'PAYER_REVIEW',
  'IN_REVIEW',
  'MORE_INFO_REQUIRED',
  'EVIDENCE_SUBMITTED',
  'OVERTURNED',
  'PARTIALLY_OVERTURNED',
  'UPHELD',
  'WITHDRAWN',
  'CLOSED',
] as const;

type AppealStatus = typeof APPEAL_STATUSES[number];

const APPEAL_PACKET_STATUSES = [
  'DRAFT',
  'GENERATED',
  'READY_FOR_SUBMISSION',
  'SUBMITTED',
  'MORE_INFO_REQUESTED',
  'UNDER_REVIEW',
  'DECISION_RECEIVED',
  'CLOSED',
] as const;

const APPEAL_DOCUMENT_TYPES = new Set([
  'MEDICAL_RECORDS',
  'PROGRESS_NOTES',
  'OPERATIVE_NOTES',
  'AUTHORIZATION_DOCUMENTS',
  'REFERRAL_DOCUMENTS',
  'ELIGIBILITY_EVIDENCE',
  'EOB_ERA_DOCUMENTS',
  'CORRECTED_CLAIM_DOCUMENTS',
  'PROVIDER_LETTER',
  'APPEAL_LETTER',
  'CUSTOM_ATTACHMENTS',
]);

const APPEAL_DOCUMENT_EXTENSIONS = new Set(['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg']);
const APPEAL_SUBMISSION_CHANNELS = new Set(['FAX', 'EMAIL', 'PORTAL', 'MAIL', 'MANUAL']);
const APPEAL_DELIVERY_STATUSES = new Set(['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'CONFIRMED']);

const APPEAL_TEMPLATE_BODIES: Record<string, string> = {
  MEDICAL_NECESSITY:
    'Please reconsider claim {{claimId}}. The denied service {{cptCodes}} was medically necessary based on the attached clinical record and diagnosis {{denialReason}}.',
  CODING_DISPUTE:
    'Please reprocess claim {{claimId}}. The submitted CPT/HCPCS codes {{cptCodes}} are supported by the record and should not be denied for coding.',
  AUTHORIZATION_DENIAL:
    'Please reconsider claim {{claimId}}. Authorization/referral evidence is attached and supports payment for the date of service {{dos}}.',
  ELIGIBILITY_DENIAL:
    'Please reconsider claim {{claimId}}. Eligibility evidence confirms active coverage for the member on {{dos}}.',
  TIMELY_FILING:
    'Please reconsider claim {{claimId}}. Timely filing evidence and submission trace information are attached.',
  DUPLICATE_CLAIM:
    'Please reconsider claim {{claimId}}. This claim is not a duplicate, or the duplicate relationship was corrected as documented in the attachment index.',
  UNDERPAYMENT:
    'Please reprocess claim {{claimId}} for underpayment. The contract/allowed amount evidence supports additional reimbursement.',
  CUSTOM:
    '{{denialReason}}',
};

const DEFAULT_PAYER_APPEAL_RULES: Record<string, {
  requiredEvidence: string[];
  requiredForms: string[];
  allowedSubmissionChannels: string[];
  deadlineDays: number;
}> = {
  '60054': {
    requiredEvidence: ['MEDICAL_RECORDS', 'EOB_ERA_DOCUMENTS'],
    requiredForms: ['Payer appeal cover sheet'],
    allowedSubmissionChannels: ['PORTAL', 'FAX', 'MAIL'],
    deadlineDays: 180,
  },
  AETNA: {
    requiredEvidence: ['MEDICAL_RECORDS', 'EOB_ERA_DOCUMENTS'],
    requiredForms: ['Payer appeal cover sheet'],
    allowedSubmissionChannels: ['PORTAL', 'FAX', 'MAIL'],
    deadlineDays: 180,
  },
  BCBS: {
    requiredEvidence: ['MEDICAL_RECORDS', 'PROVIDER_LETTER'],
    requiredForms: ['Plan-specific appeal form'],
    allowedSubmissionChannels: ['PORTAL', 'FAX', 'MAIL'],
    deadlineDays: 180,
  },
  UHC: {
    requiredEvidence: ['MEDICAL_RECORDS', 'EOB_ERA_DOCUMENTS'],
    requiredForms: ['Provider reconsideration form'],
    allowedSubmissionChannels: ['PORTAL', 'FAX'],
    deadlineDays: 365,
  },
  CIGNA: {
    requiredEvidence: ['MEDICAL_RECORDS', 'AUTHORIZATION_DOCUMENTS'],
    requiredForms: ['Cigna appeal form'],
    allowedSubmissionChannels: ['PORTAL', 'FAX', 'MAIL'],
    deadlineDays: 180,
  },
  HUMANA: {
    requiredEvidence: ['MEDICAL_RECORDS', 'EOB_ERA_DOCUMENTS'],
    requiredForms: ['Humana appeal form'],
    allowedSubmissionChannels: ['PORTAL', 'FAX', 'MAIL'],
    deadlineDays: 180,
  },
};

const APPEAL_TRANSITIONS: Record<AppealStatus, AppealStatus[]> = {
  DRAFT: ['PACKET_GENERATED', 'READY', 'SUBMITTED', 'WITHDRAWN'],
  PACKET_GENERATED: ['READY', 'SUBMITTED', 'WITHDRAWN'],
  READY: ['SUBMITTED', 'WITHDRAWN'],
  SUBMITTED: ['PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW', 'MORE_INFO_REQUIRED', 'WITHDRAWN'],
  PAYER_RECEIVED: ['PAYER_REVIEW', 'IN_REVIEW', 'MORE_INFO_REQUIRED'],
  PAYER_REVIEW: ['MORE_INFO_REQUIRED', 'OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD'],
  IN_REVIEW: ['MORE_INFO_REQUIRED', 'OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD'],
  MORE_INFO_REQUIRED: ['EVIDENCE_SUBMITTED', 'SUBMITTED', 'PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW', 'WITHDRAWN'],
  EVIDENCE_SUBMITTED: ['PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW', 'MORE_INFO_REQUIRED', 'OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD'],
  OVERTURNED: ['CLOSED'],
  PARTIALLY_OVERTURNED: ['CLOSED'],
  UPHELD: ['CLOSED'],
  WITHDRAWN: ['CLOSED'],
  CLOSED: [],
};

function normalizeStatus(value: unknown): AppealStatus {
  const status = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (status === 'PENDING') return 'PAYER_RECEIVED';
  if (status === 'PACKET_READY') return 'PACKET_GENERATED';
  return APPEAL_STATUSES.includes(status as AppealStatus) ? status as AppealStatus : 'DRAFT';
}

function assertTransition(current: string | undefined, next: AppealStatus, locale: string) {
  const from = normalizeStatus(current);
  if (from === next) return;
  if (!APPEAL_TRANSITIONS[from].includes(next)) {
    throw new AppError(`Invalid appeal transition from ${from} to ${next}.`, HTTP_STATUS.BAD_REQUEST);
  }
}

function addStatusHistory(item: IAppeal, next: AppealStatus, data: any, updatedBy: string) {
  const previousStatus = normalizeStatus(item.appealStatus);
  item.statusHistory = [
    ...(item.statusHistory ?? []),
    {
      previousStatus,
      newStatus: next,
      reason: data?.reason ?? data?.decisionNotes ?? data?.payerResponse,
      userId: updatedBy,
      timestamp: new Date(),
      source: data?.source ?? 'USER_ACTION',
      relatedPaymentPostingId: data?.relatedPaymentPostingId,
      relatedEraId: data?.relatedEraId,
    },
  ];
}

function toPlainObject(value: any) {
  return value && typeof value.toObject === 'function' ? value.toObject() : value;
}

function normalizePacketStatus(value: unknown): typeof APPEAL_PACKET_STATUSES[number] {
  const status = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return APPEAL_PACKET_STATUSES.includes(status as typeof APPEAL_PACKET_STATUSES[number])
    ? status as typeof APPEAL_PACKET_STATUSES[number]
    : 'DRAFT';
}

function normalizeDocumentType(value: unknown) {
  const type = typeof value === 'string' ? value.trim().toUpperCase().replace(/[\s-]+/g, '_') : 'CUSTOM_ATTACHMENTS';
  return APPEAL_DOCUMENT_TYPES.has(type) ? type : 'CUSTOM_ATTACHMENTS';
}

function normalizeDeliveryStatus(value: unknown) {
  const status = typeof value === 'string' ? value.trim().toUpperCase() : 'PENDING';
  return APPEAL_DELIVERY_STATUSES.has(status) ? status : 'PENDING';
}

function normalizeSubmissionChannel(value: unknown) {
  const channel = typeof value === 'string' ? value.trim().toUpperCase() : 'PORTAL';
  return APPEAL_SUBMISSION_CHANNELS.has(channel) ? channel : 'MANUAL';
}

function normalizeTemplateType(value: unknown) {
  const type = typeof value === 'string' ? value.trim().toUpperCase().replace(/[\s-]+/g, '_') : 'CUSTOM';
  return APPEAL_TEMPLATE_BODIES[type] ? type : 'CUSTOM';
}

function shortId(value: unknown) {
  const text = value === undefined || value === null ? '' : String(value);
  return text.length > 10 ? text.slice(-10).toUpperCase() : text.toUpperCase();
}

function escapePdfText(value: unknown) {
  return String(value ?? '')
    .replace(/[\\()]/g, (match) => `\\${match}`)
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');
}

function buildSimplePdf(lines: string[]) {
  const contentLines = lines
    .flatMap((line) => {
      const chunks = String(line || ' ').match(/.{1,92}/g) ?? [''];
      return chunks.length ? chunks : [''];
    })
    .slice(0, 54);
  const textOps = [
    'BT',
    '/F1 10 Tf',
    '50 760 Td',
    ...contentLines.map((line, index) => `${index ? '0 -14 Td ' : ''}(${escapePdfText(line)}) Tj`),
    'ET',
  ].join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
    `5 0 obj\n<< /Length ${Buffer.byteLength(textOps)} >>\nstream\n${textOps}\nendstream\nendobj\n`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'binary');
}

async function writeAppealPacketPdf(appeal: IAppeal, lines: string[], version: number) {
  const directory = path.resolve(process.cwd(), envConfig.uploadRootDir, 'rcm', 'appeal-packets', String(appeal._id));
  const fileName = `AppealPacket-v${version}.pdf`;
  const absolutePath = path.join(directory, fileName);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(absolutePath, buildSimplePdf(lines));
  return {
    fileName,
    fileReference: `${appConfig.apiPrefix}/uploads/rcm/appeal-packets/${appeal._id}/${fileName}`,
    absolutePath,
  };
}

function resolveUploadReference(fileReference: unknown) {
  const reference = String(fileReference ?? '').trim();
  if (!reference) return undefined;
  if (path.isAbsolute(reference)) return reference;
  const uploadsIndex = reference.toLowerCase().indexOf('uploads/');
  if (uploadsIndex < 0) return undefined;
  const relativePath = decodeURIComponent(reference.slice(uploadsIndex + 'uploads/'.length).replace(/^\/+/, ''));
  const uploadRoot = path.resolve(process.cwd(), envConfig.uploadRootDir);
  const absolutePath = path.resolve(uploadRoot, relativePath);
  return absolutePath.startsWith(uploadRoot) ? absolutePath : undefined;
}

async function writeMergedAppealPacketPdf(appeal: IAppeal, lines: string[], documents: Array<Record<string, unknown>>, version: number) {
  const directory = path.resolve(process.cwd(), envConfig.uploadRootDir, 'rcm', 'appeal-packets', String(appeal._id));
  const fileName = `AppealPacket-final-v${version}.pdf`;
  const absolutePath = path.join(directory, fileName);
  await fs.mkdir(directory, { recursive: true });

  const merged = await PDFDocument.create();
  const cover = await PDFDocument.load(buildSimplePdf(lines));
  const coverPages = await merged.copyPages(cover, cover.getPageIndices());
  coverPages.forEach((page) => merged.addPage(page));

  let mergedEvidenceCount = 0;
  for (const document of documents) {
    const fileNameValue = String(document.fileName ?? '');
    const reference = resolveUploadReference(document.fileReference);
    if (!reference || path.extname(fileNameValue).toLowerCase() !== '.pdf') continue;
    try {
      const bytes = await fs.readFile(reference);
      const source = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const pages = await merged.copyPages(source, source.getPageIndices());
      pages.forEach((page) => merged.addPage(page));
      mergedEvidenceCount += 1;
    } catch {
      // Evidence remains indexed in the generated packet when a local PDF cannot be merged.
    }
  }

  const bytes = await merged.save();
  await fs.writeFile(absolutePath, bytes);
  return {
    fileName,
    fileReference: `${appConfig.apiPrefix}/uploads/rcm/appeal-packets/${appeal._id}/${fileName}`,
    absolutePath,
    mergedEvidenceCount,
  };
}

function renderAppealTemplate(templateType: string, placeholders: Record<string, unknown>, override?: string) {
  const template = override?.trim() || APPEAL_TEMPLATE_BODIES[templateType] || APPEAL_TEMPLATE_BODIES.CUSTOM;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const value = placeholders[key];
    if (Array.isArray(value)) return value.join(', ');
    return value === undefined || value === null || value === '' ? '-' : String(value);
  });
}

function buildAppealPlaceholders(appeal: IAppeal, claim: any, denial: any, data: any = {}) {
  return {
    patientName: '[REDACTED]',
    claimId: claim?._id ? String(claim._id) : String(appeal.claimId ?? ''),
    denialReason: denial?.denialReason ?? appeal.appealReason ?? appeal.priorPayerResponse ?? '',
    providerName: claim?.billingProviderId ? String(claim.billingProviderId) : '',
    payerName: appeal.payerId ?? denial?.payerId ?? claim?.payerId ?? '',
    dos: claim?.claimDate ? new Date(claim.claimDate).toISOString().slice(0, 10) : '',
    cptCodes: data?.procedureCodes ?? appeal.procedureCodes ?? (claim?.claimLines ?? []).map((line: any) => line.cptCode).filter(Boolean),
    ...data?.placeholders,
  };
}

function buildPacketLines(appeal: IAppeal, claim: any, denial: any, narrative: string, documents: Array<Record<string, unknown>>) {
  const claimLines = claim?.claimLines ?? [];
  return [
    'Appeal Packet',
    `Generated: ${new Date().toISOString()}`,
    `Appeal ID: ${appeal._id}`,
    `Claim ID: ${claim?._id ?? appeal.claimId ?? '-'}`,
    `Denial ID: ${denial?._id ?? appeal.denialId ?? '-'}`,
    `Payer: ${appeal.payerId ?? denial?.payerId ?? claim?.payerId ?? '-'}`,
    '',
    'Claim Summary',
    `Total Charge: ${claim?.totalChargeAmount ?? '-'}`,
    `Diagnosis Codes: ${(claim?.diagnosisCodes ?? appeal.diagnosisCodes ?? []).join(', ') || '-'}`,
    `Procedure Codes: ${claimLines.map((line: any) => line.cptCode).filter(Boolean).join(', ') || (appeal.procedureCodes ?? []).join(', ') || '-'}`,
    '',
    'Denial Summary',
    `Code: ${denial?.denialCode ?? appeal.denialCode ?? '-'}`,
    `Category: ${denial?.denialCategory ?? appeal.appealCategory ?? '-'}`,
    `Reason: ${denial?.denialReason ?? appeal.priorPayerResponse ?? appeal.appealReason ?? '-'}`,
    '',
    'Appeal Narrative',
    narrative,
    '',
    'Supporting Documents Index',
    ...(documents.length
      ? documents.map((doc, index) => `${index + 1}. ${doc.documentType ?? 'DOCUMENT'} - ${doc.fileName ?? doc.fileReference ?? '-'}`)
      : ['No supporting documents recorded yet.']),
    '',
    'Submission Information',
    `Channel: ${appeal.submissionChannel ?? appeal.submissionMethod ?? '-'}`,
    `Tracking: ${appeal.submissionTracking ? JSON.stringify(appeal.submissionTracking) : '-'}`,
  ];
}

function payerRuleFor(appeal: IAppeal) {
  const payerKey = String(appeal.payerId ?? '').trim().toUpperCase();
  return DEFAULT_PAYER_APPEAL_RULES[payerKey] ?? DEFAULT_PAYER_APPEAL_RULES.AETNA;
}

async function loadPayerRuleFor(appeal: IAppeal, claim?: any, denial?: any) {
  const payerId = String(appeal.payerId ?? claim?.payerId ?? denial?.payerId ?? '').trim();
  if (!payerId) return payerRuleFor(appeal);
  const now = new Date();
  const persisted = await AppealPayerRule.findOne({
    isDeleted: false,
    active: true,
    payerId,
    $and: [
      { $or: [{ effectiveDate: { $exists: false } }, { effectiveDate: { $lte: now } }] },
      { $or: [{ expirationDate: { $exists: false } }, { expirationDate: { $gte: now } }] },
    ],
  }).sort({ effectiveDate: -1, updated: -1 });
  if (!persisted) return payerRuleFor({ ...appeal, payerId } as IAppeal);
  return {
    requiredEvidence: persisted.requiredEvidence ?? [],
    requiredForms: persisted.requiredForms ?? [],
    allowedSubmissionChannels: persisted.allowedSubmissionChannels ?? ['PORTAL', 'FAX', 'MAIL', 'MANUAL'],
    deadlineDays: Number(persisted.deadlineDays ?? 60),
    appealLevels: persisted.appealLevels ?? ['LEVEL_1'],
    source: 'PERSISTED_PAYER_RULE',
    payerRuleId: String(persisted._id),
  };
}

function activeDocumentsFor(appeal: IAppeal) {
  return (appeal.supportingDocumentsMetadata ?? [])
    .filter((document: any) => String(document.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE');
}

function documentTypesFor(documents: Array<Record<string, unknown>>) {
  return new Set(documents.map((document) => String(document.documentType ?? '').toUpperCase()));
}

function deadlineMetrics(appeal: IAppeal, now = new Date()) {
  const dueDate = appeal.appealDeadline ?? appeal.dueDate ?? appeal.payerResponseDueAt;
  if (!dueDate) {
    return { daysRemaining: undefined, deadlineStatus: 'UNKNOWN' };
  }
  const daysRemaining = Math.ceil((new Date(dueDate).getTime() - now.getTime()) / 86_400_000);
  const deadlineStatus = daysRemaining < 0
    ? 'PAST_DUE'
    : daysRemaining <= 1
      ? 'DUE_1_DAY'
      : daysRemaining <= 3
        ? 'DUE_3_DAYS'
        : daysRemaining <= 7
          ? 'DUE_7_DAYS'
          : 'ON_TRACK';
  return { daysRemaining, deadlineStatus };
}

function readinessStatusFrom(blockers: unknown[], warnings: unknown[]) {
  if (blockers.length) return 'BLOCKED';
  if (warnings.length) return 'WARNING';
  return 'READY';
}

function buildReadinessReview(appeal: IAppeal, claim: any, denial: any, now = new Date(), payerRuleOverride?: any) {
  const blockers: Array<Record<string, string>> = [];
  const warnings: Array<Record<string, string>> = [];
  const documents = activeDocumentsFor(appeal);
  const documentTypes = documentTypesFor(documents);
  const payerRules = payerRuleOverride ?? payerRuleFor(appeal);
  const { daysRemaining, deadlineStatus } = deadlineMetrics(appeal, now);
  const submissionChannel = normalizeSubmissionChannel(appeal.submissionChannel ?? appeal.submissionMethod);

  if (!appeal.generatedAppealLetterText?.trim()) blockers.push({ code: 'APPEAL_LETTER_MISSING', message: 'Appeal letter is required before submission.' });
  if (!appeal.denialId || !denial) blockers.push({ code: 'DENIAL_LINK_MISSING', message: 'Appeal must be linked to a denial.' });
  if (!appeal.claimId || !claim) blockers.push({ code: 'CLAIM_LINK_MISSING', message: 'Appeal must be linked to a claim.' });
  if (!documents.length) blockers.push({ code: 'EVIDENCE_MISSING', message: 'At least one supporting evidence document is required.' });
  if (!claim?.billingProviderId && !claim?.renderingProviderId) blockers.push({ code: 'PROVIDER_INFO_MISSING', message: 'Billing/rendering provider information is required.' });
  if (!appeal.payerId && !claim?.payerId && !denial?.payerId) blockers.push({ code: 'PAYER_INFO_MISSING', message: 'Payer information is required.' });
  if (!appeal.submissionChannel && !appeal.submissionMethod) blockers.push({ code: 'SUBMISSION_CHANNEL_MISSING', message: 'Submission channel is required.' });
  if (daysRemaining !== undefined && daysRemaining < 0) blockers.push({ code: 'APPEAL_DEADLINE_EXPIRED', message: 'Appeal deadline has expired.' });

  const missingEvidence = (payerRules.requiredEvidence as string[]).filter((type: string) => !documentTypes.has(type));
  for (const type of missingEvidence) {
    warnings.push({ code: 'PAYER_REQUIRED_EVIDENCE_MISSING', message: `${type.replace(/_/g, ' ')} is required or expected by payer rule.` });
  }
  if (!payerRules.allowedSubmissionChannels.includes(submissionChannel)) {
    blockers.push({ code: 'PAYER_CHANNEL_NOT_ALLOWED', message: `${submissionChannel} is not an allowed appeal submission channel for this payer.` });
  }
  if (!(appeal.correspondenceHistory ?? []).length) {
    warnings.push({ code: 'CORRESPONDENCE_MISSING', message: 'No payer correspondence or submission preparation note has been recorded.' });
  }
  if (daysRemaining !== undefined && daysRemaining >= 0 && daysRemaining <= 7) {
    warnings.push({ code: 'APPEAL_DEADLINE_NEAR', message: `Appeal deadline is in ${daysRemaining} day(s).` });
  }

  return {
    status: readinessStatusFrom(blockers, warnings),
    blockers,
    warnings,
    checks: {
      appealLetterExists: Boolean(appeal.generatedAppealLetterText?.trim()),
      denialLinked: Boolean(appeal.denialId && denial),
      claimLinked: Boolean(appeal.claimId && claim),
      supportingEvidenceAttached: documents.length > 0,
      providerInfoPresent: Boolean(claim?.billingProviderId || claim?.renderingProviderId),
      payerInfoPresent: Boolean(appeal.payerId || claim?.payerId || denial?.payerId),
      correspondencePresent: Boolean((appeal.correspondenceHistory ?? []).length),
      submissionChannelSelected: Boolean(appeal.submissionChannel || appeal.submissionMethod),
      appealDeadlineNotExpired: daysRemaining === undefined || daysRemaining >= 0,
    },
    payerRules,
    daysRemaining,
    deadlineStatus,
    generatedAt: now,
  };
}

function buildFinalPacketLines(appeal: IAppeal, claim: any, denial: any) {
  const documents = activeDocumentsFor(appeal);
  return [
    ...buildPacketLines(appeal, claim, denial, appeal.generatedAppealLetterText ?? '', documents),
    '',
    'Evidence Attachment Pages',
    ...documents.flatMap((document, index) => [
      '',
      `Evidence ${index + 1}: ${document.fileName ?? document.documentType ?? 'Document'}`,
      `Type: ${document.documentType ?? '-'}`,
      `Reference: ${document.fileReference ?? '-'}`,
      `Status: ${document.status ?? 'ACTIVE'}`,
      'Binary attachment merge status: local PDF evidence is merged when available; non-PDF or remote-only evidence remains indexed.',
    ]),
  ];
}

async function auditAppealActivity(
  item: IAppeal,
  action: string,
  updatedBy: string,
  data: {
    reason?: string;
    previousState?: unknown;
    newState?: unknown;
    session?: ClientSession;
    severity?: string;
  } = {},
) {
  await auditLogService.record({
    entityType: 'appeal',
    entityId: item._id,
    action,
    userId: updatedBy,
    changedBy: updatedBy,
    source: 'appeal',
    claimId: item.claimId,
    payerId: item.payerId,
    reason: data.reason,
    previousState: data.previousState,
    newState: data.newState,
    severity: data.severity,
    category: 'APPEAL',
    visibility: 'COMPLIANCE_VISIBLE',
    session: data.session,
  });
}


function buildAppealDocumentAttachments(item: IAppeal) {
  return (item.supportingDocuments ?? [])
    .filter((fileUrl): fileUrl is string => typeof fileUrl === 'string' && Boolean(fileUrl.trim()))
    .map((fileUrl, index) => ({
      sourceTag: 'source:appeal-supporting-documents',
      documentType: 'Appeal Document',
      title: `Appeal Document ${index + 1}`,
      fileUrl,
    }));
}

async function syncAppealDocuments(item: IAppeal, userId: string) {
  const claim = item.claimId
    ? await Claim.findOne({ _id: item.claimId, isDeleted: false }).select('patientId')
    : null;

  await syncEntityDocuments({
    entityType: 'appeal',
    entityId: String(item._id),
    patientId: claim?.patientId ? String(claim.patientId) : undefined,
    attachments: buildAppealDocumentAttachments(item),
    sourceTags: ['source:appeal-supporting-documents'],
    userId,
  });
}

async function transitionAppeal(
  item: IAppeal,
  next: AppealStatus,
  data: any,
  locale: string,
  updatedBy: string,
  session?: ClientSession,
) {
  const previousStatus = normalizeStatus(item.appealStatus);
  assertTransition(item.appealStatus, next, locale);
  addStatusHistory(item, next, data, updatedBy);
  item.appealStatus = next;
  item.updated = new Date();
  item.updatedBy = updatedBy as any;

  if (data?.payerResponse !== undefined) item.payerResponse = data.payerResponse;
  if (data?.resolution !== undefined) item.resolution = data.resolution;
  if (data?.outcome !== undefined) item.outcome = data.outcome;
  if (data?.decisionNotes !== undefined) item.decisionNotes = data.decisionNotes;
  if (data?.payerReferenceNumber !== undefined) item.payerReferenceNumber = data.payerReferenceNumber;
  if (data?.expectedReprocessBy !== undefined) item.expectedReprocessBy = new Date(data.expectedReprocessBy);
  if (data?.relatedPaymentPostingId !== undefined) item.relatedPaymentPostingId = data.relatedPaymentPostingId;
  if (data?.relatedEraId !== undefined) item.relatedEraId = data.relatedEraId;
  if (data?.payerResponseDueAt !== undefined) item.payerResponseDueAt = new Date(data.payerResponseDueAt);
  if (data?.correspondence !== undefined) {
    item.correspondenceHistory = [
      ...(item.correspondenceHistory ?? []),
      {
        ...data.correspondence,
        status: next,
        recordedAt: new Date(),
        recordedBy: updatedBy,
      },
    ];
  }

  if (next === 'SUBMITTED') {
    item.submissionDate = data?.submissionDate ? new Date(data.submissionDate) : item.submissionDate ?? new Date();
    item.submittedAt = data?.submittedAt ? new Date(data.submittedAt) : item.submittedAt ?? new Date();
    item.submittedBy = updatedBy as any;
    if (data?.submissionMethod !== undefined) item.submissionMethod = data.submissionMethod;
    item.submissionChannel = normalizeSubmissionChannel(data?.submissionChannel ?? data?.submissionMethod ?? item.submissionChannel);
    item.submissionTracking = {
      ...(typeof item.submissionTracking === 'object' && item.submissionTracking !== null ? item.submissionTracking : {}),
      submittedAt: item.submittedAt,
      submittedBy: updatedBy,
      trackingNumber: data?.trackingNumber,
      confirmationNumber: data?.confirmationNumber,
      destination: data?.destination,
      deliveryStatus: normalizeDeliveryStatus(data?.deliveryStatus ?? 'SENT'),
    };
    item.packetStatus = 'SUBMITTED';
    item.payerResponseDueAt = item.payerResponseDueAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  if (next === 'PAYER_RECEIVED') {
    item.payerReceivedAt = data?.payerReceivedAt ? new Date(data.payerReceivedAt) : item.payerReceivedAt ?? new Date();
    item.packetStatus = 'UNDER_REVIEW';
    item.submissionTracking = {
      ...(typeof item.submissionTracking === 'object' && item.submissionTracking !== null ? item.submissionTracking : {}),
      deliveryStatus: normalizeDeliveryStatus(data?.deliveryStatus ?? 'CONFIRMED'),
      confirmationNumber: data?.confirmationNumber ?? (item.submissionTracking as any)?.confirmationNumber,
      payerReceivedAt: item.payerReceivedAt,
    };
  }
  if (next === 'MORE_INFO_REQUIRED') {
    item.packetStatus = 'MORE_INFO_REQUESTED';
    item.missingDocumentRequests = [
      ...(item.missingDocumentRequests ?? []),
      {
        requestedAt: new Date(),
        requestedBy: updatedBy,
        reason: data?.reason ?? data?.payerResponse ?? 'Payer requested more information.',
        dueDate: data?.dueDate ? new Date(data.dueDate) : undefined,
      },
    ];
  }
  if (next === 'EVIDENCE_SUBMITTED') {
    item.evidenceSubmittedAt = new Date();
    item.packetStatus = 'UNDER_REVIEW';
    item.evidenceItems = [
      ...(item.evidenceItems ?? []),
      ...((Array.isArray(data?.evidenceItems) ? data.evidenceItems : []).map((entry: any) => ({
        ...entry,
        submittedAt: new Date(),
        submittedBy: updatedBy,
      }))),
    ];
  }
  if (['OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD'].includes(next)) {
    item.outcome = data?.outcome ?? next;
    item.outcomeDate = new Date();
    item.decisionAt = new Date();
    item.decisionBy = updatedBy as any;
    item.packetStatus = 'DECISION_RECEIVED';
  }
  if (next === 'CLOSED') {
    item.packetStatus = 'CLOSED';
  }

  await item.save({ session });

  if (item.denialId) {
    await syncDenialForAppealTransition(item, next, data, updatedBy, session);
  }

  if (['OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD'].includes(next)) {
    await appealResolutionService.handleAppealOutcome(item, next, data, locale, updatedBy, { session });
  }

  const eventType = next === 'SUBMITTED'
    ? 'APPEAL_SUBMITTED'
    : ['OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD'].includes(next)
      ? 'APPEAL_OUTCOME_RECORDED'
      : 'AR_STATUS_CHANGED';
  publishRcmRealtimeEvent({
    eventType,
    title: `Appeal ${next.toLowerCase().replace(/_/g, ' ')}`,
    claimId: item.claimId ? String(item.claimId) : undefined,
    entityType: 'appeal',
    entityId: String(item._id),
    status: next,
  });

  if (item.claimId) {
    await claimClosureService.syncClaimClosureStatus(String(item.claimId), updatedBy, session);
  }

  await auditLogService.record({
    entityType: 'appeal',
    entityId: item._id,
    action: `APPEAL_${next}`,
    userId: updatedBy,
    changedBy: updatedBy,
    source: data?.source ?? 'appeal',
    claimId: item.claimId,
    payerId: item.payerId,
    reason: data?.reason ?? data?.decisionNotes ?? data?.payerResponse,
    previousState: { appealStatus: previousStatus },
    newState: {
      appealStatus: item.appealStatus,
      outcome: item.outcome,
      payerResponse: item.payerResponse,
      decisionAt: item.decisionAt,
    },
    session,
  });

  return item;
}

export const appealService = {
  async create(data: any, locale: string, createdBy: string, options: { session?: ClientSession } = {}) {
    const [item] = await Appeal.create([{
      ...data,
      appealStatus: normalizeStatus(data.appealStatus),
      active: data.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    }], { session: options.session });

    publishRcmRealtimeEvent({
      eventType: 'APPEAL_CREATED',
      title: 'Appeal created',
      claimId: item.claimId ? String(item.claimId) : undefined,
      entityType: 'appeal',
      entityId: String(item._id),
      status: item.appealStatus,
    });

    await auditLogService.record({
      entityType: 'appeal',
      entityId: item._id,
      action: 'APPEAL_CREATED',
      userId: createdBy,
      changedBy: createdBy,
      source: 'appeal',
      claimId: item.claimId,
      payerId: item.payerId,
      reason: item.appealReason,
      newState: item.toObject(),
      session: options.session,
    });
    await syncAppealDocuments(item, createdBy);

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await Appeal.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    assertUnsafeMutationAllowed('Appeal', 'updated through generic CRUD');
    const item = await Appeal.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    Object.assign(item, {
      ...data,
      appealStatus: data.appealStatus ? normalizeStatus(data.appealStatus) : item.appealStatus,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    await syncAppealDocuments(item, updatedBy);
    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    assertUnsafeMutationAllowed('Appeal', 'deleted');

    const item = await Appeal.findOneAndUpdate(
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
      throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    await markEntityDocumentsDeleted('appeal', id, updatedBy);

    return true;
  },

  async createFromDenial(denialId: string, data: any, locale: string, createdBy: string, options: { session?: ClientSession } = {}) {
    const createWithSession = async (session?: ClientSession) => {
      const denial = await Denial.findOne({ _id: denialId, isDeleted: false }).session(session ?? null);
      if (!denial) {
        throw new AppError(t('denial.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      }

      let appeal = await Appeal.findOne({ denialId: denial._id, isDeleted: false }).session(session ?? null);

      if (!appeal) {
        const dueDate = data?.dueDate ? new Date(data.dueDate) : denial.appealDeadline ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        const [createdAppeal] = await Appeal.create([{
          denialId: denial._id,
          claimId: denial.claimId,
          arWorkItemId: denial.arWorkItemId,
          payerId: denial.payerId,
          denialCode: denial.denialCode,
          appealCategory: data?.appealCategory ?? denial.denialCategory,
          appealLevel: data?.appealLevel ?? 'FIRST_LEVEL',
          appealReason: data?.appealReason ?? denial.denialReason ?? denial.recommendedAction,
          appealDescription: denial.recommendationReason ?? denial.classificationExplanation,
          supportingDocuments: [],
          appealStatus: 'DRAFT',
          dueDate,
          appealDeadline: dueDate,
          owner: data?.owner ?? denial.owner,
          active: true,
          created: new Date(),
          updated: new Date(),
          createdBy,
        }], { session });
        appeal = createdAppeal;
      }

      const previousDenialStatus = denial.denialStatus;
      try {
        assertDenialTransition(previousDenialStatus, 'APPEAL_READY', {
          source: 'APPEAL_CREATED',
          reason: data?.appealReason ?? 'Appeal draft created from denial.',
        });
      } catch (error) {
        throw new AppError(error instanceof Error ? error.message : 'Invalid denial transition.', HTTP_STATUS.BAD_REQUEST);
      }
      denial.statusHistory = [
        ...(denial.statusHistory ?? []),
        {
          previousStatus: previousDenialStatus,
          newStatus: 'APPEAL_READY',
          reason: data?.appealReason ?? 'Appeal draft created from denial.',
          userId: createdBy,
          timestamp: new Date(),
          source: 'APPEAL_CREATED',
          appealId: appeal._id,
        },
      ];
      denial.appealId = appeal._id;
      denial.denialStatus = 'APPEAL_READY';
      denial.appealEligible = true;
      denial.reworkType = 'APPEAL_REVIEW';
      denial.updated = new Date();
      denial.updatedBy = createdBy as any;
      await denial.save({ session });

      if (denial.arWorkItemId) {
        await ArWorkItem.updateOne(
          { _id: denial.arWorkItemId, isDeleted: false },
          {
            appealId: appeal._id,
            status: 'APPEAL_DRAFT',
            nextAction: 'Generate appeal packet and submit to payer.',
            updated: new Date(),
            updatedBy: createdBy,
          },
          { session },
        );
      }

      publishRcmRealtimeEvent({
        eventType: 'APPEAL_CREATED',
        title: 'Appeal draft created',
        claimId: denial.claimId ? String(denial.claimId) : undefined,
        entityType: 'appeal',
        entityId: String(appeal._id),
        status: appeal.appealStatus,
      });

      await auditLogService.record({
        entityType: 'appeal',
        entityId: appeal._id,
        action: 'APPEAL_CREATED',
        userId: createdBy,
        changedBy: createdBy,
        source: 'denial',
        claimId: appeal.claimId,
        payerId: appeal.payerId,
        reason: data?.appealReason ?? denial.denialReason,
        newState: appeal.toObject(),
        session,
      });

      await auditLogService.record({
        entityType: 'denial',
        entityId: denial._id,
        action: 'DENIAL_APPEALED',
        userId: createdBy,
        changedBy: createdBy,
        source: 'appeal',
        claimId: denial.claimId,
        patientId: denial.patientId,
        payerId: denial.payerId,
        reason: data?.appealReason ?? 'Appeal created from denial.',
        previousState: { denialStatus: previousDenialStatus },
        newState: { denialStatus: denial.denialStatus, appealId: appeal._id },
        session,
      });

      return appeal;
    };

    return options.session
      ? createWithSession(options.session)
      : withMongoTransaction((session) => createWithSession(session));
  },

  async changeStatus(id: string, data: any, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
      const item = await Appeal.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      return transitionAppeal(item, normalizeStatus(data.appealStatus), data, locale, updatedBy, session);
    });
  },

  async generatePacket(id: string, data: any, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
      const item = await Appeal.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);

      const [claim, denial] = await Promise.all([
        item.claimId ? Claim.findOne({ _id: item.claimId, isDeleted: false }).session(session) : Promise.resolve(null),
        item.denialId ? Denial.findOne({ _id: item.denialId, isDeleted: false }).session(session) : Promise.resolve(null),
      ]);

      const diagnosisCodes = data?.diagnosisCodes ?? claim?.diagnosisCodes ?? [];
      const procedureCodes = data?.procedureCodes ?? (claim?.claimLines ?? []).map((line: any) => line.cptCode).filter(Boolean);
      const activeDocuments = (item.supportingDocumentsMetadata ?? [])
        .filter((document: any) => String(document.status ?? 'ACTIVE').toUpperCase() === 'ACTIVE');
      const templateType = normalizeTemplateType(data?.templateType ?? item.appealCategory);
      const placeholders = buildAppealPlaceholders(item, claim, denial, { ...data, diagnosisCodes, procedureCodes });
      const narrative = data?.generatedAppealLetterText
        ?? data?.appealNarrative
        ?? renderAppealTemplate(templateType, placeholders, data?.bodyTemplate);
      const packetVersion = (item.packetVersion ?? 0) + 1;
      const pdf = await writeAppealPacketPdf(
        item,
        buildPacketLines(item, claim, denial, narrative, activeDocuments),
        packetVersion,
      );
      item.packetSnapshot = {
        claimId: claim?._id,
        denialId: denial?._id,
        denialCode: denial?.denialCode,
        denialCategory: denial?.denialCategory,
        denialReason: denial?.denialReason,
        diagnosisCodes,
        procedureCodes,
        templateType,
        documentCount: activeDocuments.length,
        packetFileReference: pdf.fileReference,
        generatedAt: new Date(),
      };
      item.packetGenerated = true;
      item.packetGeneratedAt = new Date();
      item.packetVersion = packetVersion;
      item.packetStatus = activeDocuments.length ? 'READY_FOR_SUBMISSION' : 'GENERATED';
      item.packetFileReference = pdf.fileReference;
      item.packetFileName = pdf.fileName;
      item.diagnosisCodes = diagnosisCodes;
      item.procedureCodes = procedureCodes;
      item.medicalNecessityNotes = data?.medicalNecessityNotes ?? item.medicalNecessityNotes;
      item.authorizationEvidence = data?.authorizationEvidence ?? item.authorizationEvidence;
      item.eligibilityEvidence = data?.eligibilityEvidence ?? item.eligibilityEvidence;
      item.priorPayerResponse = data?.priorPayerResponse ?? denial?.denialReason ?? item.priorPayerResponse;
      item.evidenceSummary = data?.evidenceSummary ?? item.evidenceSummary ?? 'Appeal packet generated from claim, denial, and payment context.';
      item.generatedAppealLetterText = narrative;

      if (normalizeStatus(item.appealStatus) === 'DRAFT') {
        await transitionAppeal(item, 'PACKET_GENERATED', { reason: 'Appeal packet generated.', source: 'PACKET_GENERATION' }, locale, updatedBy, session);
      } else {
        item.updated = new Date();
        item.updatedBy = updatedBy as any;
        await item.save({ session });
      }

      publishRcmRealtimeEvent({
        eventType: 'APPEAL_PACKET_GENERATED',
        title: 'Appeal packet generated',
        claimId: item.claimId ? String(item.claimId) : undefined,
        entityType: 'appeal',
        entityId: String(item._id),
        status: item.packetStatus,
      });

      await auditAppealActivity(item, packetVersion > 1 ? 'APPEAL_PACKET_REGENERATED' : 'APPEAL_PACKET_PDF_GENERATED', updatedBy, {
        reason: data?.reason ?? 'Appeal packet generated.',
        newState: {
          packetStatus: item.packetStatus,
          packetVersion,
          packetFileReference: item.packetFileReference,
          documentCount: activeDocuments.length,
          templateType,
        },
        session,
      });

      return item;
    });
  },

  async generateAiPacket(id: string, data: any, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
      const item = await Appeal.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);

      const [claim, denial, arWorkItem] = await Promise.all([
        item.claimId ? Claim.findOne({ _id: item.claimId, isDeleted: false }).session(session) : Promise.resolve(null),
        item.denialId ? Denial.findOne({ _id: item.denialId, isDeleted: false }).session(session) : Promise.resolve(null),
        item.arWorkItemId ? ArWorkItem.findOne({ _id: item.arWorkItemId, isDeleted: false }).session(session) : Promise.resolve(null),
      ]);
      const packet = await rcmAiService.generateAppealPacket({
        appeal: toPlainObject(item),
        denial: toPlainObject(denial) ?? {},
        claim: toPlainObject(claim) ?? {},
        arWorkItem: toPlainObject(arWorkItem) ?? {},
        operatorContext: data ?? {},
      });

      item.aiPacketDraft = packet as unknown as Record<string, unknown>;
      item.aiPacketHistory = [
        ...(item.aiPacketHistory ?? []),
        {
          type: 'APPEAL_PACKET_DRAFT',
          generatedAt: new Date(),
          generatedBy: updatedBy,
          source: packet.source,
          confidence: packet.confidence,
          overturnProbability: packet.overturnProbability,
          missingDocs: packet.missingDocs,
        },
      ];
      item.updated = new Date();
      item.updatedBy = updatedBy as any;
      await item.save({ session });

      publishRcmRealtimeEvent({
        eventType: 'AI_RECOMMENDATION_RECORDED',
        title: 'AI appeal packet drafted',
        claimId: item.claimId ? String(item.claimId) : undefined,
        entityType: 'appeal',
        entityId: String(item._id),
        status: item.appealStatus,
      });

      await auditAppealActivity(item, 'APPEAL_AI_RECOMMENDATION_GENERATED', updatedBy, {
        reason: data?.reason ?? 'AI appeal packet draft generated.',
        newState: {
          confidence: packet.confidence,
          overturnProbability: packet.overturnProbability,
          missingDocs: packet.missingDocs,
          source: packet.source,
        },
        session,
      });
      return item;
    });
  },

  async previewTemplate(id: string, data: any, locale: string) {
    const item = await this.getById(id, locale);
    const [claim, denial] = await Promise.all([
      item.claimId ? Claim.findOne({ _id: item.claimId, isDeleted: false }) : Promise.resolve(null),
      item.denialId ? Denial.findOne({ _id: item.denialId, isDeleted: false }) : Promise.resolve(null),
    ]);
    const persistedTemplate = data?.templateId
      ? await AppealTemplate.findOne({ _id: data.templateId, isDeleted: false, active: true })
      : null;
    const templateType = normalizeTemplateType(data?.templateType ?? persistedTemplate?.templateType ?? item.appealCategory);
    const placeholders = buildAppealPlaceholders(item, claim, denial, data);
    return {
      templateName: data?.templateName ?? persistedTemplate?.templateName ?? templateType.replace(/_/g, ' '),
      templateType,
      templateVersion: data?.templateVersion ?? persistedTemplate?.templateVersion ?? 1,
      previewText: renderAppealTemplate(templateType, placeholders, data?.bodyTemplate ?? persistedTemplate?.bodyTemplate),
      placeholders,
      active: data?.active ?? true,
    };
  },

  async runReadinessReview(id: string, data: any, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
      const item = await Appeal.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      const [claim, denial] = await Promise.all([
        item.claimId ? Claim.findOne({ _id: item.claimId, isDeleted: false }).session(session) : Promise.resolve(null),
        item.denialId ? Denial.findOne({ _id: item.denialId, isDeleted: false }).session(session) : Promise.resolve(null),
      ]);
      if (data?.submissionMethod !== undefined) item.submissionMethod = data.submissionMethod;
      if (data?.submissionChannel !== undefined) item.submissionChannel = normalizeSubmissionChannel(data.submissionChannel);
      const payerRules = await loadPayerRuleFor(item, claim, denial);
      const review = buildReadinessReview(item, claim, denial, new Date(), payerRules);
      item.readinessStatus = review.status;
      item.readinessReview = review;
      item.deadlineStatus = review.deadlineStatus;
      item.daysRemaining = review.daysRemaining;
      if (review.status === 'READY' && normalizeStatus(item.appealStatus) === 'PACKET_GENERATED') {
        item.appealStatus = 'READY';
        addStatusHistory(item, 'READY', { reason: 'Appeal packet passed readiness review.', source: 'APPEAL_READINESS' }, updatedBy);
      }
      item.updated = new Date();
      item.updatedBy = updatedBy as any;
      await item.save({ session });
      publishRcmRealtimeEvent({
        eventType: 'APPEAL_READINESS_REVIEWED',
        title: 'Appeal readiness reviewed',
        claimId: item.claimId ? String(item.claimId) : undefined,
        entityType: 'appeal',
        entityId: String(item._id),
        status: review.status,
      });
      await auditAppealActivity(item, 'APPEAL_READINESS_REVIEWED', updatedBy, {
        reason: data?.reason ?? 'Appeal readiness review completed.',
        newState: review,
        severity: review.status === 'BLOCKED' ? 'ERROR' : review.status === 'WARNING' ? 'WARNING' : 'INFO',
        session,
      });
      return item;
    });
  },

  async generateFinalPacket(id: string, data: any, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
      const item = await Appeal.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      const [claim, denial] = await Promise.all([
        item.claimId ? Claim.findOne({ _id: item.claimId, isDeleted: false }).session(session) : Promise.resolve(null),
        item.denialId ? Denial.findOne({ _id: item.denialId, isDeleted: false }).session(session) : Promise.resolve(null),
      ]);
      if (data?.submissionMethod !== undefined) item.submissionMethod = data.submissionMethod;
      if (data?.submissionChannel !== undefined) item.submissionChannel = normalizeSubmissionChannel(data.submissionChannel);
      const payerRules = await loadPayerRuleFor(item, claim, denial);
      const review = buildReadinessReview(item, claim, denial, new Date(), payerRules);
      if (review.status === 'BLOCKED' && !data?.allowBlockedFinalPacket) {
        const blockerCodes = review.blockers.map((blocker) => blocker.code).join(', ');
        throw new AppError(
          `Appeal packet is blocked by readiness checks and cannot be finalized: ${blockerCodes || 'UNKNOWN_BLOCKER'}.`,
          HTTP_STATUS.BAD_REQUEST,
          review.blockers,
        );
      }
      const finalVersion = (item.finalPacketVersion ?? 0) + 1;
      const documents = activeDocumentsFor(item);
      const pdf = await writeMergedAppealPacketPdf(item, buildFinalPacketLines(item, claim, denial), documents, finalVersion);
      item.finalPacketGeneratedAt = new Date();
      item.finalPacketVersion = finalVersion;
      item.finalPacketFileReference = pdf.fileReference;
      item.finalPacketFileName = pdf.fileName;
      item.packetStatus = review.status === 'READY' ? 'READY_FOR_SUBMISSION' : normalizePacketStatus(item.packetStatus);
      item.readinessStatus = review.status;
      item.readinessReview = review;
      item.updated = new Date();
      item.updatedBy = updatedBy as any;
      await item.save({ session });
      publishRcmRealtimeEvent({
        eventType: 'APPEAL_FINAL_PACKET_GENERATED',
        title: 'Final appeal packet generated',
        claimId: item.claimId ? String(item.claimId) : undefined,
        entityType: 'appeal',
        entityId: String(item._id),
        status: item.packetStatus,
      });
      await auditAppealActivity(item, 'APPEAL_FINAL_PACKET_GENERATED', updatedBy, {
        reason: data?.reason ?? 'Final appeal packet generated.',
        newState: {
          finalPacketVersion: finalVersion,
          finalPacketFileReference: item.finalPacketFileReference,
          evidenceDocumentCount: documents.length,
          mergedEvidenceDocumentCount: pdf.mergedEvidenceCount,
          readinessStatus: review.status,
          mergeMode: 'PDF_MERGE_WITH_EVIDENCE_FALLBACK_INDEX',
        },
        session,
      });
      return item;
    });
  },

  async addDocument(id: string, data: any, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
      const item = await Appeal.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);

      const fileName = String(data?.fileName ?? '').trim();
      const extension = path.extname(fileName).toLowerCase();
      if (!fileName) throw new AppError('Appeal document fileName is required.', HTTP_STATUS.BAD_REQUEST);
      if (!APPEAL_DOCUMENT_EXTENSIONS.has(extension)) {
        throw new AppError('Appeal documents must be PDF, DOCX, TXT, PNG, JPG, or JPEG.', HTTP_STATUS.BAD_REQUEST);
      }

      let fileReference = String(data?.fileReference ?? data?.fileUrl ?? '').trim();
      let fileSize = Number(data?.fileSize ?? data?.fileSizeBytes ?? 0) || 0;
      if (data?.contentBase64) {
        const uploaded = await documentService.uploadFile({
          fileName,
          mimeType: data?.mimeType,
          contentBase64: data.contentBase64,
          folder: 'appeal-documents',
        }, locale);
        fileReference = uploaded.fileUrl;
        fileSize = uploaded.sizeBytes;
      }

      if (!fileReference) {
        throw new AppError('Appeal document fileReference or contentBase64 is required.', HTTP_STATUS.BAD_REQUEST);
      }
      if (fileSize > envConfig.uploadMaxFileSizeMb * 1024 * 1024) {
        throw new AppError(`Appeal document exceeds the ${envConfig.uploadMaxFileSizeMb} MB size limit.`, HTTP_STATUS.BAD_REQUEST);
      }

      const document = {
        documentId: new mongoose.Types.ObjectId().toString(),
        documentType: normalizeDocumentType(data?.documentType),
        fileName,
        fileSize,
        fileReference,
        uploadedBy: updatedBy,
        uploadedAt: new Date(),
        version: 1,
        status: 'ACTIVE',
        notes: data?.notes,
      };
      item.supportingDocumentsMetadata = [...(item.supportingDocumentsMetadata ?? []), document];
      item.supportingDocuments = Array.from(new Set([...(item.supportingDocuments ?? []), fileReference]));
      item.packetStatus = item.packetGenerated ? 'READY_FOR_SUBMISSION' : normalizePacketStatus(item.packetStatus);
      item.updated = new Date();
      item.updatedBy = updatedBy as any;
      await item.save({ session });

      publishRcmRealtimeEvent({
        eventType: 'APPEAL_DOCUMENT_UPDATED',
        title: 'Appeal document uploaded',
        claimId: item.claimId ? String(item.claimId) : undefined,
        entityType: 'appeal',
        entityId: String(item._id),
        status: 'DOCUMENT_UPLOADED',
      });
      await auditAppealActivity(item, 'APPEAL_DOCUMENT_UPLOADED', updatedBy, {
        reason: data?.reason ?? data?.notes ?? 'Appeal evidence document uploaded.',
        newState: document,
        session,
      });
      return item;
    });
  },

  async replaceDocument(id: string, documentId: string, data: any, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
      const item = await Appeal.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      const documents = [...(item.supportingDocumentsMetadata ?? [])];
      const index = documents.findIndex((document: any) => String(document.documentId) === String(documentId));
      if (index < 0) throw new AppError('Appeal document not found.', HTTP_STATUS.NOT_FOUND);
      const previous = documents[index] as any;
      previous.status = 'REPLACED';
      previous.replacedAt = new Date();
      previous.replacedBy = updatedBy;
      const fileName = String(data?.fileName ?? previous.fileName ?? '').trim();
      const extension = path.extname(fileName).toLowerCase();
      if (!APPEAL_DOCUMENT_EXTENSIONS.has(extension)) {
        throw new AppError('Appeal documents must be PDF, DOCX, TXT, PNG, JPG, or JPEG.', HTTP_STATUS.BAD_REQUEST);
      }
      let fileReference = String(data?.fileReference ?? data?.fileUrl ?? '').trim();
      let fileSize = Number(data?.fileSize ?? data?.fileSizeBytes ?? 0) || 0;
      if (data?.contentBase64) {
        const uploaded = await documentService.uploadFile({
          fileName,
          mimeType: data?.mimeType,
          contentBase64: data.contentBase64,
          folder: 'appeal-documents',
        }, locale);
        fileReference = uploaded.fileUrl;
        fileSize = uploaded.sizeBytes;
      }
      if (!fileReference) throw new AppError('Replacement fileReference or contentBase64 is required.', HTTP_STATUS.BAD_REQUEST);
      const replacement = {
        documentId: new mongoose.Types.ObjectId().toString(),
        documentType: normalizeDocumentType(data?.documentType ?? previous.documentType),
        fileName,
        fileSize,
        fileReference,
        uploadedBy: updatedBy,
        uploadedAt: new Date(),
        version: Number(previous.version ?? 1) + 1,
        status: 'ACTIVE',
        replacesDocumentId: previous.documentId,
        notes: data?.notes,
      };
      previous.replacedByDocumentId = replacement.documentId;
      documents.splice(index, 1, previous, replacement);
      item.supportingDocumentsMetadata = documents;
      item.supportingDocuments = documents
        .filter((document: any) => String(document.status).toUpperCase() === 'ACTIVE')
        .map((document: any) => String(document.fileReference))
        .filter(Boolean);
      item.updated = new Date();
      item.updatedBy = updatedBy as any;
      await item.save({ session });
      publishRcmRealtimeEvent({
        eventType: 'APPEAL_DOCUMENT_UPDATED',
        title: 'Appeal document replaced',
        claimId: item.claimId ? String(item.claimId) : undefined,
        entityType: 'appeal',
        entityId: String(item._id),
        status: 'DOCUMENT_REPLACED',
      });
      await auditAppealActivity(item, 'APPEAL_DOCUMENT_REPLACED', updatedBy, {
        reason: data?.reason ?? data?.notes ?? 'Appeal evidence document replaced.',
        previousState: previous,
        newState: replacement,
        session,
      });
      return item;
    });
  },

  async removeDocument(id: string, documentId: string, data: any, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
      const item = await Appeal.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      const documents = [...(item.supportingDocumentsMetadata ?? [])];
      const index = documents.findIndex((document: any) => String(document.documentId) === String(documentId));
      if (index < 0) throw new AppError('Appeal document not found.', HTTP_STATUS.NOT_FOUND);
      const previous = { ...(documents[index] as any) };
      documents[index] = {
        ...(documents[index] as any),
        status: 'REMOVED',
        removedAt: new Date(),
        removedBy: updatedBy,
        removalReason: data?.reason,
      };
      item.supportingDocumentsMetadata = documents;
      item.supportingDocuments = documents
        .filter((document: any) => String(document.status).toUpperCase() === 'ACTIVE')
        .map((document: any) => String(document.fileReference))
        .filter(Boolean);
      item.updated = new Date();
      item.updatedBy = updatedBy as any;
      await item.save({ session });
      publishRcmRealtimeEvent({
        eventType: 'APPEAL_DOCUMENT_UPDATED',
        title: 'Appeal document removed',
        claimId: item.claimId ? String(item.claimId) : undefined,
        entityType: 'appeal',
        entityId: String(item._id),
        status: 'DOCUMENT_REMOVED',
      });
      await auditAppealActivity(item, 'APPEAL_DOCUMENT_REMOVED', updatedBy, {
        reason: data?.reason ?? 'Appeal evidence document removed.',
        previousState: previous,
        newState: documents[index],
        session,
      });
      return item;
    });
  },

  async recordCorrespondence(id: string, data: any, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
      const item = await Appeal.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      const correspondenceType = String(data?.correspondenceType ?? data?.type ?? 'PHONE_FOLLOW_UP').trim().toUpperCase().replace(/[\s-]+/g, '_');
      const entry = {
        correspondenceId: new mongoose.Types.ObjectId().toString(),
        correspondenceType,
        timestamp: data?.timestamp ? new Date(data.timestamp) : new Date(),
        status: normalizeDeliveryStatus(data?.status ?? data?.deliveryStatus ?? 'SENT'),
        notes: data?.notes,
        performedBy: updatedBy,
        trackingNumber: data?.trackingNumber,
        confirmationNumber: data?.confirmationNumber,
        destination: data?.destination,
        channel: normalizeSubmissionChannel(data?.channel ?? data?.submissionChannel ?? data?.submissionMethod),
      };
      item.correspondenceHistory = [...(item.correspondenceHistory ?? []), entry];
      item.updated = new Date();
      item.updatedBy = updatedBy as any;
      await item.save({ session });
      publishRcmRealtimeEvent({
        eventType: 'APPEAL_CORRESPONDENCE_RECORDED',
        title: 'Appeal correspondence recorded',
        claimId: item.claimId ? String(item.claimId) : undefined,
        entityType: 'appeal',
        entityId: String(item._id),
        status: entry.status,
      });
      await auditAppealActivity(item, 'APPEAL_CORRESPONDENCE_RECORDED', updatedBy, {
        reason: data?.reason ?? data?.notes ?? 'Appeal payer correspondence recorded.',
        newState: entry,
        session,
        severity: entry.status === 'FAILED' ? 'ERROR' : 'INFO',
      });
      return item;
    });
  },

  async recordSubmissionProof(id: string, data: any, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
      const item = await Appeal.findOne({ _id: id, isDeleted: false }).session(session);
      if (!item) throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      const proof = {
        proofId: new mongoose.Types.ObjectId().toString(),
        channel: normalizeSubmissionChannel(data?.channel ?? data?.submissionChannel ?? item.submissionChannel ?? item.submissionMethod),
        confirmationNumber: data?.confirmationNumber,
        trackingNumber: data?.trackingNumber,
        proofDocumentReference: data?.proofDocumentReference ?? data?.fileReference,
        deliveredAt: data?.deliveredAt ? new Date(data.deliveredAt) : undefined,
        deliveryStatus: normalizeDeliveryStatus(data?.deliveryStatus ?? 'CONFIRMED'),
        recordedAt: new Date(),
        recordedBy: updatedBy,
        notes: data?.notes,
      };
      item.submissionProof = proof;
      item.submissionTracking = {
        ...(typeof item.submissionTracking === 'object' && item.submissionTracking !== null ? item.submissionTracking : {}),
        ...proof,
      };
      if (proof.deliveryStatus === 'CONFIRMED' && normalizeStatus(item.appealStatus) === 'SUBMITTED') {
        item.payerReceivedAt = proof.deliveredAt ?? new Date();
      }
      item.correspondenceHistory = [
        ...(item.correspondenceHistory ?? []),
        {
          correspondenceId: proof.proofId,
          correspondenceType: `${proof.channel}_CONFIRMATION`,
          timestamp: proof.deliveredAt ?? proof.recordedAt,
          status: proof.deliveryStatus,
          notes: proof.notes ?? 'Appeal submission proof recorded.',
          performedBy: updatedBy,
          trackingNumber: proof.trackingNumber,
          confirmationNumber: proof.confirmationNumber,
          destination: data?.destination,
          channel: proof.channel,
        },
      ];
      item.updated = new Date();
      item.updatedBy = updatedBy as any;
      await item.save({ session });
      publishRcmRealtimeEvent({
        eventType: 'APPEAL_SUBMISSION_PROOF_RECORDED',
        title: 'Appeal submission proof recorded',
        claimId: item.claimId ? String(item.claimId) : undefined,
        entityType: 'appeal',
        entityId: String(item._id),
        status: proof.deliveryStatus,
      });
      await auditAppealActivity(item, 'APPEAL_SUBMISSION_PROOF_RECORDED', updatedBy, {
        reason: data?.reason ?? 'Appeal submission proof recorded.',
        newState: proof,
        session,
      });
      return item;
    });
  },

  async getTimeline(id: string, locale: string) {
    const item = await this.getById(id, locale);
    const auditTimeline = await auditLogService.list({
      entityType: 'appeal',
      entityId: id,
      page: 1,
      limit: 250,
      defaultDateRange: 'none',
      includeTechnical: false,
    });
    const events = [
      ...(item.statusHistory ?? []).map((entry: any, index: number) => ({
        section: 'Appeal Status',
        timestamp: entry.timestamp ?? item.updated,
        action: `APPEAL_${entry.newStatus ?? item.appealStatus}`,
        entityType: 'appeal',
        entityId: String(item._id),
        previousState: { appealStatus: entry.previousStatus },
        newState: { appealStatus: entry.newStatus },
        reason: entry.reason,
        source: entry.source,
        userId: entry.userId,
        correlationId: item.claimId ? String(item.claimId) : undefined,
        sequence: index + 1,
      })),
      ...(item.supportingDocumentsMetadata ?? []).map((document: any) => ({
        section: 'Documents',
        timestamp: document.uploadedAt ?? document.removedAt ?? document.replacedAt ?? item.updated,
        action: `APPEAL_DOCUMENT_${String(document.status ?? 'ACTIVE').toUpperCase()}`,
        entityType: 'appealDocument',
        entityId: document.documentId,
        newState: document,
        source: 'appeal',
      })),
      ...(item.correspondenceHistory ?? []).map((entry: any) => ({
        section: 'Correspondence',
        timestamp: entry.timestamp ?? entry.recordedAt ?? item.updated,
        action: `APPEAL_CORRESPONDENCE_${entry.correspondenceType ?? entry.type ?? 'RECORDED'}`,
        entityType: 'appealCorrespondence',
        entityId: entry.correspondenceId,
        newState: entry,
        reason: entry.notes,
        source: 'appeal',
      })),
      ...((auditTimeline as any).data ?? []),
    ].sort((left, right) => new Date(left.timestamp ?? 0).getTime() - new Date(right.timestamp ?? 0).getTime());

    const grouped = ['Denial', 'Appeal Status', 'Packet', 'Documents', 'Correspondence', 'Decision', 'Payment Resolution', 'Audit']
      .map((section) => ({
        section,
        events: events.filter((event: any) => {
          const action = String(event.action ?? '').toUpperCase();
          if (section === 'Denial') return action.includes('DENIAL');
          if (section === 'Packet') return action.includes('PACKET') || action.includes('AI_RECOMMENDATION');
          if (section === 'Decision') return action.includes('OUTCOME') || action.includes('OVERTURN') || action.includes('UPHELD') || action.includes('WITHDRAW') || action.includes('CLOSED');
          if (section === 'Payment Resolution') return action.includes('PAYMENT') || action.includes('RESOLVED');
          return event.section === section;
        }),
      }))
      .filter((group) => group.events.length);
    return {
      appealId: String(item._id),
      claimId: item.claimId ? String(item.claimId) : undefined,
      denialId: item.denialId ? String(item.denialId) : undefined,
      status: item.appealStatus,
      packetStatus: item.packetStatus,
      sections: grouped,
      events,
    };
  },

  async getDashboard(_query: any = {}) {
    const appeals = await Appeal.find({ isDeleted: false, active: true }).lean();
    const openStatuses = new Set(['DRAFT', 'PACKET_GENERATED', 'READY', 'SUBMITTED', 'PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW', 'MORE_INFO_REQUIRED', 'EVIDENCE_SUBMITTED']);
    const overturned = appeals.filter((appeal) => ['OVERTURNED', 'PARTIALLY_OVERTURNED'].includes(String(appeal.appealStatus)));
    const decided = appeals.filter((appeal) => ['OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD', 'CLOSED'].includes(String(appeal.appealStatus)));
    const deadlineRows = appeals.map((appeal) => deadlineMetrics(appeal as any));
    return {
      summary: {
        openAppeals: appeals.filter((appeal) => openStatuses.has(String(appeal.appealStatus))).length,
        appealsAwaitingPacket: appeals.filter((appeal) => !appeal.packetGenerated || ['DRAFT', 'GENERATED'].includes(String(appeal.packetStatus))).length,
        appealsReadyForSubmission: appeals.filter((appeal) => ['READY', 'READY_FOR_SUBMISSION'].includes(String(appeal.appealStatus)) || String(appeal.packetStatus) === 'READY_FOR_SUBMISSION').length,
        appealsSubmitted: appeals.filter((appeal) => Boolean(appeal.submittedAt) || String(appeal.appealStatus) === 'SUBMITTED').length,
        appealsUnderReview: appeals.filter((appeal) => ['PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW'].includes(String(appeal.appealStatus))).length,
        appealsAwaitingMoreInfo: appeals.filter((appeal) => String(appeal.appealStatus) === 'MORE_INFO_REQUIRED').length,
        appealsNearDeadline: deadlineRows.filter((row) => ['DUE_7_DAYS', 'DUE_3_DAYS', 'DUE_1_DAY'].includes(row.deadlineStatus)).length,
        appealsPastDue: deadlineRows.filter((row) => row.deadlineStatus === 'PAST_DUE').length,
        slaViolations: appeals.filter((appeal) => ['OVERDUE', 'VIOLATED'].includes(String(appeal.slaStatus ?? '').toUpperCase())).length,
        appealsOverturned: appeals.filter((appeal) => String(appeal.appealStatus) === 'OVERTURNED').length,
        appealsPartiallyOverturned: appeals.filter((appeal) => String(appeal.appealStatus) === 'PARTIALLY_OVERTURNED').length,
        appealsUpheld: appeals.filter((appeal) => String(appeal.appealStatus) === 'UPHELD').length,
        appealSuccessRate: decided.length ? Math.round((overturned.length / decided.length) * 1000) / 10 : 0,
        averageDaysToDecision: (() => {
          const values = appeals
            .filter((appeal) => appeal.submittedAt && appeal.decisionAt)
            .map((appeal) => (new Date(appeal.decisionAt as any).getTime() - new Date(appeal.submittedAt as any).getTime()) / 86_400_000)
            .filter(Number.isFinite);
          return values.length ? Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 : 0;
        })(),
        appealRecoveryAmount: appeals.reduce((sum, appeal) => sum + (Number(appeal.recoveredAmount) || 0), 0),
      },
      byStatus: appeals.reduce<Record<string, number>>((acc, appeal) => {
        const status = String(appeal.appealStatus ?? 'UNKNOWN');
        acc[status] = (acc[status] ?? 0) + 1;
        return acc;
      }, {}),
      generatedAt: new Date(),
    };
  },

  async listTemplates(query: any = {}) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25) || 25));
    const filter: Record<string, unknown> = { isDeleted: false };
    if (query.active !== undefined) filter.active = query.active === true || query.active === 'true';
    if (query.templateType) filter.templateType = String(query.templateType).trim().toUpperCase().replace(/[\s-]+/g, '_');
    const [data, totalCount] = await Promise.all([
      AppealTemplate.find(filter).sort({ templateType: 1, templateVersion: -1 }).skip((page - 1) * limit).limit(limit),
      AppealTemplate.countDocuments(filter),
    ]);
    return { data, pagination: { page, limit, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / limit)) } };
  },

  async createTemplate(data: any, locale: string, createdBy: string) {
    const templateType = normalizeTemplateType(data?.templateType);
    const item = await AppealTemplate.create({
      templateName: data?.templateName ?? templateType.replace(/_/g, ' '),
      templateType,
      templateVersion: Number(data?.templateVersion ?? 1) || 1,
      bodyTemplate: data?.bodyTemplate ?? APPEAL_TEMPLATE_BODIES[templateType],
      active: data?.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });
    await auditLogService.record({
      entityType: 'appealTemplate',
      entityId: item._id,
      action: 'APPEAL_TEMPLATE_CREATED',
      userId: createdBy,
      changedBy: createdBy,
      source: 'appealTemplate',
      category: 'APPEAL',
      newState: item.toObject(),
    });
    return item;
  },

  async createTemplateVersion(templateId: string, data: any, locale: string, createdBy: string) {
    const source = await AppealTemplate.findOne({ _id: templateId, isDeleted: false });
    if (!source) throw new AppError('Appeal template not found.', HTTP_STATUS.NOT_FOUND);
    const item = await AppealTemplate.create({
      templateName: data?.templateName ?? source.templateName,
      templateType: data?.templateType ? normalizeTemplateType(data.templateType) : source.templateType,
      templateVersion: Number(data?.templateVersion ?? source.templateVersion + 1),
      bodyTemplate: data?.bodyTemplate ?? source.bodyTemplate,
      active: data?.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });
    await auditLogService.record({
      entityType: 'appealTemplate',
      entityId: item._id,
      action: 'APPEAL_TEMPLATE_VERSION_CREATED',
      userId: createdBy,
      changedBy: createdBy,
      source: 'appealTemplate',
      category: 'APPEAL',
      previousState: source.toObject(),
      newState: item.toObject(),
    });
    return item;
  },

  async setTemplateActive(templateId: string, active: boolean, locale: string, updatedBy: string) {
    const item = await AppealTemplate.findOne({ _id: templateId, isDeleted: false });
    if (!item) throw new AppError('Appeal template not found.', HTTP_STATUS.NOT_FOUND);
    const previousState = item.toObject();
    item.active = active;
    item.updated = new Date();
    item.updatedBy = updatedBy as any;
    await item.save();
    await auditLogService.record({
      entityType: 'appealTemplate',
      entityId: item._id,
      action: active ? 'APPEAL_TEMPLATE_ACTIVATED' : 'APPEAL_TEMPLATE_DEACTIVATED',
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'appealTemplate',
      category: 'APPEAL',
      previousState,
      newState: item.toObject(),
    });
    return item;
  },

  async listPayerRules(query: any = {}) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 25) || 25));
    const filter: Record<string, unknown> = { isDeleted: false };
    if (query.payerId) filter.payerId = String(query.payerId).trim();
    if (query.active !== undefined) filter.active = query.active === true || query.active === 'true';
    const [data, totalCount] = await Promise.all([
      AppealPayerRule.find(filter).sort({ payerId: 1, effectiveDate: -1, updated: -1 }).skip((page - 1) * limit).limit(limit),
      AppealPayerRule.countDocuments(filter),
    ]);
    return { data, pagination: { page, limit, totalCount, totalPages: Math.max(1, Math.ceil(totalCount / limit)) } };
  },

  async createPayerRule(data: any, locale: string, createdBy: string) {
    const item = await AppealPayerRule.create({
      payerId: String(data?.payerId ?? '').trim(),
      payerName: data?.payerName,
      effectiveDate: data?.effectiveDate,
      expirationDate: data?.expirationDate,
      requiredEvidence: data?.requiredEvidence ?? [],
      requiredForms: data?.requiredForms ?? [],
      allowedSubmissionChannels: data?.allowedSubmissionChannels ?? ['PORTAL', 'FAX', 'MAIL', 'MANUAL'],
      deadlineDays: Number(data?.deadlineDays ?? 60),
      appealLevels: data?.appealLevels ?? ['LEVEL_1'],
      active: data?.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
      updatedBy: createdBy,
    });
    await auditLogService.record({
      entityType: 'appealPayerRule',
      entityId: item._id,
      action: 'APPEAL_PAYER_RULE_CREATED',
      userId: createdBy,
      changedBy: createdBy,
      source: 'appealPayerRule',
      payerId: item.payerId,
      category: 'APPEAL',
      newState: item.toObject(),
    });
    return item;
  },

  async submit(id: string, data: any, locale: string, updatedBy: string) {
    if (!data?.skipReadinessValidation) {
      const item = await Appeal.findOne({ _id: id, isDeleted: false });
      if (!item) throw new AppError(t('appeal.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      const [claim, denial] = await Promise.all([
        item.claimId ? Claim.findOne({ _id: item.claimId, isDeleted: false }) : Promise.resolve(null),
        item.denialId ? Denial.findOne({ _id: item.denialId, isDeleted: false }) : Promise.resolve(null),
      ]);
      const payerRules = await loadPayerRuleFor(item, claim, denial);
      const appealForReadiness = {
        ...toPlainObject(item),
        submissionMethod: data?.submissionMethod ?? item.submissionMethod,
        submissionChannel: data?.submissionChannel ?? item.submissionChannel,
      } as IAppeal;
      const review = buildReadinessReview(appealForReadiness, claim, denial, new Date(), payerRules);
      if (review.status === 'BLOCKED') {
        throw new AppError(`Appeal is blocked for submission: ${review.blockers.map((blocker) => blocker.code).join(', ')}`, HTTP_STATUS.BAD_REQUEST);
      }
    }
    return this.changeStatus(id, { ...data, appealStatus: 'SUBMITTED', reason: data?.reason ?? 'Appeal submitted to payer.' }, locale, updatedBy);
  },

  async recordPayerReceived(id: string, data: any, locale: string, updatedBy: string) {
    return this.changeStatus(id, { ...data, appealStatus: 'PAYER_RECEIVED', reason: data?.reason ?? 'Payer acknowledged appeal receipt.' }, locale, updatedBy);
  },

  async requestMoreInfo(id: string, data: any, locale: string, updatedBy: string) {
    return this.changeStatus(id, { ...data, appealStatus: 'MORE_INFO_REQUIRED', reason: data?.reason ?? 'Payer requested more information.' }, locale, updatedBy);
  },

  async submitEvidence(id: string, data: any, locale: string, updatedBy: string) {
    return this.changeStatus(id, {
      ...data,
      appealStatus: 'EVIDENCE_SUBMITTED',
      reason: data?.reason ?? 'Additional appeal evidence submitted to payer.',
    }, locale, updatedBy);
  },

  async recordOutcome(id: string, data: any, locale: string, updatedBy: string) {
    const outcome = normalizeStatus(data?.outcome);
    if (!['OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD'].includes(outcome)) {
      throw new AppError('Appeal outcome must be OVERTURNED, PARTIALLY_OVERTURNED, or UPHELD.', HTTP_STATUS.BAD_REQUEST);
    }
    return this.changeStatus(id, { ...data, appealStatus: outcome, outcome, reason: data?.reason ?? `Appeal outcome recorded as ${outcome}.` }, locale, updatedBy);
  },

  async close(id: string, data: any, locale: string, updatedBy: string) {
    const closeReason = requireActionReason(data?.reason ?? data?.closeReason, 'Appeal close');
    if (!String(data?.notes ?? data?.decisionNotes ?? '').trim()) {
      throw new AppError('Appeal close notes are required.', HTTP_STATUS.BAD_REQUEST);
    }
    if (!String(data?.outcomeCategory ?? data?.outcome ?? '').trim()) {
      throw new AppError('Appeal close outcome category is required.', HTTP_STATUS.BAD_REQUEST);
    }
    return this.changeStatus(id, {
      ...data,
      appealStatus: 'CLOSED',
      reason: closeReason,
      decisionNotes: data?.decisionNotes ?? data?.notes,
      outcome: data?.outcome ?? data?.outcomeCategory,
    }, locale, updatedBy);
  },

  async withdraw(id: string, data: any, locale: string, updatedBy: string) {
    return this.changeStatus(id, { ...data, appealStatus: 'WITHDRAWN', reason: data?.reason ?? 'Appeal withdrawn.' }, locale, updatedBy);
  },
};

export async function runAppealAgingCheck(updatedBy = 'rcm-appeal-aging') {
  const now = new Date();
  const warningWindow = new Date(now.getTime() + 7 * 86_400_000);
  const appeals = await Appeal.find({
    isDeleted: false,
    active: true,
    appealStatus: { $in: ['SUBMITTED', 'PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW', 'MORE_INFO_REQUIRED', 'EVIDENCE_SUBMITTED'] },
    $or: [
      { dueDate: { $lte: warningWindow } },
      { appealDeadline: { $lte: warningWindow } },
      { payerResponseDueAt: { $lte: warningWindow } },
    ],
  }).limit(100);

  let warningAppeals = 0;
  let overdueAppeals = 0;
  for (const appeal of appeals) {
    const { deadlineStatus, daysRemaining } = deadlineMetrics(appeal);
    const isPastDue = Number(daysRemaining ?? 999) < 0;
    appeal.slaStatus = isPastDue ? 'OVERDUE' : deadlineStatus;
    appeal.deadlineStatus = deadlineStatus;
    appeal.daysRemaining = daysRemaining;
    if (isPastDue) {
      overdueAppeals += 1;
      appeal.escalatedAt = appeal.escalatedAt ?? now;
      appeal.escalationCount = (appeal.escalationCount ?? 0) + 1;
      appeal.escalationReason = 'Appeal exceeded due date or payer response SLA.';
    } else {
      warningAppeals += 1;
      appeal.escalationReason = `Appeal deadline warning: ${daysRemaining} day(s) remaining.`;
    }
    appeal.statusHistory = [
      ...(appeal.statusHistory ?? []),
      {
        previousStatus: appeal.appealStatus,
        newStatus: appeal.appealStatus,
        reason: appeal.escalationReason,
        userId: updatedBy,
        timestamp: now,
        source: 'APPEAL_SLA_AGING',
      },
    ];
    appeal.updated = now;
    assignAuditActor(appeal, 'updatedBy', updatedBy);
    await appeal.save();

    if (appeal.arWorkItemId) {
      await ArWorkItem.updateOne(
        { _id: appeal.arWorkItemId, isDeleted: false },
        {
          status: isPastDue ? 'ESCALATED' : 'FOLLOW_UP_REQUIRED',
          escalationFlag: isPastDue,
          nextAction: isPastDue
            ? 'Appeal SLA breached. Escalate payer follow-up or supervisor review.'
            : `Appeal deadline is approaching in ${daysRemaining} day(s). Confirm payer status.`,
          updated: now,
          ...auditActorPatch('updatedBy', updatedBy),
        },
      );
    }

    publishRcmRealtimeEvent({
      eventType: 'APPEAL_SLA_BREACHED',
      title: isPastDue ? 'Appeal SLA breached' : 'Appeal deadline warning',
      claimId: appeal.claimId ? String(appeal.claimId) : undefined,
      entityType: 'appeal',
      entityId: String(appeal._id),
      status: appeal.slaStatus,
    });

    await auditLogService.record({
      entityType: 'appeal',
      entityId: appeal._id,
      action: isPastDue ? 'APPEAL_SLA_VIOLATION' : `APPEAL_DEADLINE_${deadlineStatus}`,
      userId: updatedBy,
      changedBy: updatedBy,
      source: 'appealAging',
      claimId: appeal.claimId,
      payerId: appeal.payerId,
      reason: appeal.escalationReason,
      severity: isPastDue ? 'WARNING' : 'INFO',
      category: 'APPEAL',
      newState: {
        slaStatus: appeal.slaStatus,
        deadlineStatus,
        daysRemaining,
        escalationCount: appeal.escalationCount,
      },
    });
  }

  return { overdueAppeals, warningAppeals };
}

registerRcmJobHandler('CHECK_APPEAL_SLA_AGING', async (job) => {
  await runAppealAgingCheck(String(job.updatedBy ?? 'rcm-appeal-aging'));
});

async function syncDenialForAppealTransition(
  appeal: IAppeal,
  next: AppealStatus,
  data: any,
  updatedBy: string,
  session?: ClientSession,
) {
  const denial = await Denial.findOne({ _id: appeal.denialId, isDeleted: false }).session(session ?? null);
  if (!denial) return;

  const mappedStatus = next === 'SUBMITTED'
    ? 'APPEALED'
    : ['PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW', 'MORE_INFO_REQUIRED', 'EVIDENCE_SUBMITTED'].includes(next)
      ? 'PAYER_REVIEW'
      : undefined;

  if (!mappedStatus || normalizeDenialStatus(denial.denialStatus) === mappedStatus) return;

  try {
    assertDenialTransition(denial.denialStatus, mappedStatus, {
      source: 'APPEAL_TRANSITION',
      reason: data?.reason ?? `Appeal moved to ${next}.`,
    });
  } catch (error) {
    throw new AppError(error instanceof Error ? error.message : 'Invalid denial transition.', HTTP_STATUS.BAD_REQUEST);
  }

  denial.statusHistory = [
    ...(denial.statusHistory ?? []),
    {
      previousStatus: normalizeDenialStatus(denial.denialStatus),
      newStatus: mappedStatus,
      reason: data?.reason ?? `Appeal moved to ${next}.`,
      userId: updatedBy,
      timestamp: new Date(),
      source: 'APPEAL_TRANSITION',
      appealId: appeal._id,
    },
  ];
  denial.transitionAudit = [
    ...(denial.transitionAudit ?? []),
    {
      previousStatus: normalizeDenialStatus(denial.denialStatus),
      newStatus: mappedStatus,
      reason: data?.reason ?? `Appeal moved to ${next}.`,
      userId: updatedBy,
      timestamp: new Date(),
      source: 'APPEAL_TRANSITION',
      appealId: appeal._id,
    },
  ];
  denial.denialStatus = mappedStatus;
  denial.updated = new Date();
  denial.updatedBy = updatedBy as any;
  await denial.save({ session });

  if (denial.arWorkItemId) {
    await ArWorkItem.updateOne(
      { _id: denial.arWorkItemId, isDeleted: false },
      {
        status: mappedStatus === 'APPEALED' ? 'AWAITING_PAYER_RESPONSE' : 'PAYER_REVIEW',
        nextAction: mappedStatus === 'APPEALED'
          ? 'Confirm payer received the appeal.'
          : 'Monitor payer review and response SLA.',
        updated: new Date(),
        updatedBy,
      },
      { session },
    );
  }

  publishRcmRealtimeEvent({
    eventType: 'DENIAL_TRANSITION_RECORDED',
    title: 'Denial lifecycle transition recorded',
    claimId: denial.claimId ? String(denial.claimId) : undefined,
    entityType: 'denial',
    entityId: String(denial._id),
    status: denial.denialStatus,
  });
}
