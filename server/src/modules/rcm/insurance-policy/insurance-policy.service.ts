import mongoose from 'mongoose';
import { InsurancePolicy } from './insurance-policy.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { Patient } from '../patient/patient.model';
import { Payer } from '../payer/payer.model';
import { rcmAiService } from '../workflow/rcm-ai.service';
import { markEntityDocumentsDeleted, syncEntityDocuments } from '../document/document-registry.service';

const COVERAGE_PRIORITY_TO_COB_ORDER: Record<string, number> = {
  Primary: 1,
  Secondary: 2,
  Tertiary: 3,
  Quaternary: 4,
};

const COVERAGE_TYPE_OPTIONS = new Set([
  'Commercial',
  'Medicare',
  'Medicaid',
  'Tricare',
  'Workers Compensation',
  'Self Pay',
  'Other',
]);

const COVERAGE_PRIORITY_OPTIONS = new Set(Object.keys(COVERAGE_PRIORITY_TO_COB_ORDER));
const POLICY_STATUS_OPTIONS = new Set(['Active', 'Pending', 'Inactive', 'Terminated', 'Cancelled']);
const RELATIONSHIP_TO_SUBSCRIBER_OPTIONS = new Set(['Self', 'Spouse', 'Child', 'Other', 'Unknown']);

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function normalizeEmail(value: unknown) {
  const email = normalizeText(value);
  return email ? email.toLowerCase() : undefined;
}

function normalizeDate(value: unknown) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return undefined;
}

function hasAnyValue(record: Record<string, unknown>) {
  return Object.values(record).some((value) => {
    if (value === undefined || value === null) {
      return false;
    }

    if (typeof value === 'string') {
      return value.trim().length > 0;
    }

    return true;
  });
}

function deriveCoordinationOfBenefitsOrder(coveragePriority?: string) {
  return coveragePriority ? COVERAGE_PRIORITY_TO_COB_ORDER[coveragePriority] : undefined;
}

function normalizeSubscriber(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const subscriber = value as Record<string, unknown>;
  const nextSubscriber = {
    firstName: normalizeText(subscriber.firstName),
    lastName: normalizeText(subscriber.lastName),
    dob: normalizeDate(subscriber.dob),
    gender: normalizeText(subscriber.gender),
    phone: normalizeText(subscriber.phone),
    email: normalizeEmail(subscriber.email),
    addressLine1: normalizeText(subscriber.addressLine1),
    addressLine2: normalizeText(subscriber.addressLine2),
    city: normalizeText(subscriber.city),
    state: normalizeText(subscriber.state),
    zipCode: normalizeText(subscriber.zipCode),
  };

  return hasAnyValue(nextSubscriber) ? nextSubscriber : undefined;
}

function normalizeCard(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const card = value as Record<string, unknown>;
  const nextCard = {
    frontImageUrl: normalizeText(card.frontImageUrl),
    backImageUrl: normalizeText(card.backImageUrl),
  };

  return hasAnyValue(nextCard) ? nextCard : undefined;
}

function normalizeVerification(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }

  const verification = value as Record<string, unknown>;
  const nextVerification = {
    lastVerifiedDateTime: normalizeDate(verification.lastVerifiedDateTime),
    nextVerificationDueDate: normalizeDate(verification.nextVerificationDueDate),
  };

  return hasAnyValue(nextVerification) ? nextVerification : undefined;
}

function normalizeAttachments(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value
    .filter((attachment): attachment is Record<string, unknown> => typeof attachment === 'object' && attachment !== null)
    .map((attachment) => ({
      documentType: normalizeText(attachment.documentType),
      title: normalizeText(attachment.title),
      fileUrl: normalizeText(attachment.fileUrl),
      description: normalizeText(attachment.description),
    }))
    .filter((attachment) => hasAnyValue(attachment));
}

function buildInsurancePolicyDocumentAttachments(policy: any) {
  const card = policy.card ?? {};
  const cardAttachments: any[] = [
    card.frontImageUrl
      ? {
          sourceTag: 'source:insurance-card',
          documentType: 'Insurance Card',
          title: 'Insurance card front',
          fileUrl: card.frontImageUrl,
        }
      : null,
    card.backImageUrl
      ? {
          sourceTag: 'source:insurance-card',
          documentType: 'Insurance Card',
          title: 'Insurance card back',
          fileUrl: card.backImageUrl,
        }
      : null,
  ].filter(Boolean);

  const documentAttachments = (policy.attachments ?? []).map((attachment: any) => ({
    ...attachment,
    sourceTag: 'source:insurance-documents',
  }));

  return [...cardAttachments, ...documentAttachments];
}

function normalizeInsurancePolicyData(data: any) {
  const normalizedData = { ...data };

  if ('patientId' in data) {
    normalizedData.patientId = normalizeText(data.patientId);
  }

  if ('payerId' in data) {
    normalizedData.payerId = normalizeText(data.payerId);
  }

  if ('ediPayerId' in data) {
    normalizedData.ediPayerId = normalizeText(data.ediPayerId);
  }

  if ('payerType' in data) {
    normalizedData.payerType = normalizeText(data.payerType);
  }

  if ('coverageType' in data) {
    normalizedData.coverageType = normalizeText(data.coverageType);
  }

  if ('planName' in data) {
    normalizedData.planName = normalizeText(data.planName);
  }

  if ('memberId' in data) {
    normalizedData.memberId = normalizeText(data.memberId);
  }

  if ('subscriberId' in data) {
    normalizedData.subscriberId = normalizeText(data.subscriberId);
  }

  if ('groupNumber' in data) {
    normalizedData.groupNumber = normalizeText(data.groupNumber);
  }

  if ('dependentNumber' in data) {
    normalizedData.dependentNumber = normalizeText(data.dependentNumber);
  }

  if ('coveragePriority' in data) {
    normalizedData.coveragePriority = normalizeText(data.coveragePriority);
    normalizedData.coordinationOfBenefitsOrder = deriveCoordinationOfBenefitsOrder(
      normalizedData.coveragePriority
    );
  } else if ('coordinationOfBenefitsOrder' in data) {
    normalizedData.coordinationOfBenefitsOrder =
      typeof data.coordinationOfBenefitsOrder === 'number' ? data.coordinationOfBenefitsOrder : undefined;
  }

  if ('network' in data) {
    normalizedData.network = normalizeText(data.network);
  }

  if ('effectiveDate' in data) {
    normalizedData.effectiveDate = normalizeDate(data.effectiveDate);
  }

  if ('terminationDate' in data) {
    normalizedData.terminationDate = normalizeDate(data.terminationDate);
  }

  if ('policyStatus' in data) {
    normalizedData.policyStatus = normalizeText(data.policyStatus);
  }

  if ('relationshipToSubscriber' in data) {
    normalizedData.relationshipToSubscriber = normalizeText(data.relationshipToSubscriber);
  }

  if ('subscriber' in data) {
    normalizedData.subscriber = normalizeSubscriber(data.subscriber);
  }

  if ('card' in data) {
    normalizedData.card = normalizeCard(data.card);
  }

  if ('verification' in data) {
    normalizedData.verification = normalizeVerification(data.verification);
  }

  if ('attachments' in data) {
    normalizedData.attachments = normalizeAttachments(data.attachments) ?? [];
  }

  return normalizedData;
}

function buildValidationError(message: string) {
  return new AppError(message, HTTP_STATUS.BAD_REQUEST);
}

function normalizeDateKey(value: unknown) {
  const dateValue = normalizeDate(value);
  return dateValue instanceof Date && !Number.isNaN(dateValue.getTime())
    ? dateValue.toISOString().slice(0, 10)
    : undefined;
}

function buildLocalDependentValidation(policy: any, patient: any) {
  const issues: string[] = [];
  const suggestedFixes: string[] = [];
  const relationship = normalizeText(policy.relationshipToSubscriber);
  const subscriber = policy.subscriber ?? {};
  const cardUploaded = Boolean(policy.card?.frontImageUrl || policy.card?.backImageUrl);

  if (relationship === 'Self') {
    const subscriberNamePresent = Boolean(normalizeText(subscriber.firstName) || normalizeText(subscriber.lastName));
    const subscriberDobPresent = Boolean(normalizeDateKey(subscriber.dob));
    const subscriberFirstName = normalizeText(subscriber.firstName)?.toLowerCase();
    const subscriberLastName = normalizeText(subscriber.lastName)?.toLowerCase();
    const patientFirstName = normalizeText(patient.firstName)?.toLowerCase();
    const patientLastName = normalizeText(patient.lastName)?.toLowerCase();

    if (subscriberNamePresent && (subscriberFirstName !== patientFirstName || subscriberLastName !== patientLastName)) {
      issues.push('Subscriber name is populated but does not match the patient while relationship is Self.');
      suggestedFixes.push('Change relationship to subscriber or correct subscriber/patient demographics before eligibility.');
    }

    if (subscriberDobPresent && normalizeDateKey(subscriber.dob) !== normalizeDateKey(patient.dateOfBirth)) {
      issues.push('Subscriber date of birth does not match the patient while relationship is Self.');
      suggestedFixes.push('Correct the subscriber DOB or set the correct dependent relationship.');
    }
  } else {
    if (!normalizeText(subscriber.firstName) || !normalizeText(subscriber.lastName) || !normalizeDateKey(subscriber.dob)) {
      issues.push('Dependent coverage is selected but subscriber name or DOB is incomplete.');
      suggestedFixes.push('Capture subscriber first name, last name, and date of birth from the card before eligibility.');
    }

    if (!normalizeText(policy.dependentNumber) && relationship === 'Child') {
      issues.push('Child dependent coverage has no dependent number on file.');
      suggestedFixes.push('Review the insurance card or payer portal for the dependent sequence/number.');
    }
  }

  if (cardUploaded && !normalizeText(policy.memberId)) {
    issues.push('Insurance card is uploaded but member ID is missing.');
    suggestedFixes.push('Extract or enter the member ID from the uploaded insurance card.');
  }

  return {
    status: issues.length ? 'Needs Review' : 'Passed',
    riskScore: Math.min(0.95, issues.length * 0.25),
    issues,
    suggestedFixes,
    source: 'local-rcm-rules',
  };
}

async function buildDependentValidation(policy: any, patient: any) {
  const localResult = buildLocalDependentValidation(policy, patient);
  const aiResult = await rcmAiService.validateDependentSubscriber({
    patient: {
      firstName: patient.firstName,
      lastName: patient.lastName,
      dateOfBirth: patient.dateOfBirth,
      gender: patient.gender,
      sex: patient.sex,
      address: patient.address,
    },
    insurancePolicy: {
      payerId: policy.payerId,
      planName: policy.planName,
      memberId: policy.memberId,
      subscriberId: policy.subscriberId,
      dependentNumber: policy.dependentNumber,
      relationshipToSubscriber: policy.relationshipToSubscriber,
      subscriber: policy.subscriber,
      card: policy.card,
    },
  });

  const issues = Array.from(new Set([...(localResult.issues ?? []), ...(aiResult.issues ?? [])]));
  const suggestedFixes = Array.from(new Set([...(localResult.suggestedFixes ?? []), ...(aiResult.suggestedFixes ?? [])]));
  const riskScore = Math.max(localResult.riskScore ?? 0, aiResult.riskScore ?? 0);

  return {
    status: issues.length || riskScore >= 0.35 ? 'Needs Review' : 'Passed',
    riskScore,
    issues,
    suggestedFixes,
    source: aiResult.source && aiResult.source !== 'local-fallback'
      ? aiResult.source
      : localResult.source,
    checkedAt: new Date(),
  };
}

function validateInsurancePolicyState(candidate: any) {
  if (!candidate.patientId) {
    throw buildValidationError('Patient is required for an insurance policy.');
  }

  if (!candidate.payerId) {
    throw buildValidationError('Payer is required for an insurance policy.');
  }

  if (!candidate.coverageType) {
    throw buildValidationError('Coverage type is required.');
  }

  if (!candidate.planName) {
    throw buildValidationError('Plan name is required.');
  }

  if (!candidate.memberId) {
    throw buildValidationError('Member ID is required.');
  }

  if (!candidate.coveragePriority) {
    throw buildValidationError('Coverage priority is required.');
  }

  if (!candidate.policyStatus) {
    throw buildValidationError('Policy status is required.');
  }

  if (!candidate.relationshipToSubscriber) {
    throw buildValidationError('Relationship to subscriber is required.');
  }

  if (!COVERAGE_TYPE_OPTIONS.has(candidate.coverageType)) {
    throw buildValidationError('Coverage type is invalid.');
  }

  if (!COVERAGE_PRIORITY_OPTIONS.has(candidate.coveragePriority)) {
    throw buildValidationError('Coverage priority is invalid.');
  }

  if (!POLICY_STATUS_OPTIONS.has(candidate.policyStatus)) {
    throw buildValidationError('Policy status is invalid.');
  }

  if (!RELATIONSHIP_TO_SUBSCRIBER_OPTIONS.has(candidate.relationshipToSubscriber)) {
    throw buildValidationError('Relationship to subscriber is invalid.');
  }

  if (
    candidate.effectiveDate &&
    (!(candidate.effectiveDate instanceof Date) || Number.isNaN(candidate.effectiveDate.getTime()))
  ) {
    throw buildValidationError('Effective date is invalid.');
  }

  if (
    candidate.terminationDate &&
    (!(candidate.terminationDate instanceof Date) || Number.isNaN(candidate.terminationDate.getTime()))
  ) {
    throw buildValidationError('Termination date is invalid.');
  }

  if (
    candidate.effectiveDate instanceof Date &&
    candidate.terminationDate instanceof Date &&
    candidate.terminationDate < candidate.effectiveDate
  ) {
    throw buildValidationError('Termination date cannot be before effective date.');
  }

  const lastVerifiedDateTime = candidate.verification?.lastVerifiedDateTime;
  const nextVerificationDueDate = candidate.verification?.nextVerificationDueDate;

  if (
    lastVerifiedDateTime instanceof Date &&
    nextVerificationDueDate instanceof Date &&
    nextVerificationDueDate < lastVerifiedDateTime
  ) {
    throw buildValidationError('Next verification due date cannot be before the last verified date.');
  }

  candidate.coordinationOfBenefitsOrder = deriveCoordinationOfBenefitsOrder(candidate.coveragePriority);
}

async function resolvePatient(patientId: string, locale: string) {
  const patient = await Patient.findOne({ _id: patientId, isDeleted: false });

  if (!patient) {
    throw new AppError(t('patient.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
  }

  return patient;
}

async function resolvePayer(payerReference: string, locale: string) {
  const payerConditions: Array<Record<string, unknown>> = [{ payerId: payerReference }];

  if (mongoose.Types.ObjectId.isValid(payerReference)) {
    payerConditions.push({ _id: payerReference });
  }

  const payer = await Payer.findOne({
    isDeleted: false,
    $or: payerConditions,
  });

  if (!payer) {
    throw new AppError(t('payer.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
  }

  return payer;
}

async function ensureUniqueCoverage(candidate: any, excludeId?: string) {
  const existingPolicies = await InsurancePolicy.find({
    isDeleted: false,
    patientId: candidate.patientId,
    payerId: candidate.payerId,
    memberId: candidate.memberId,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select('_id groupNumber');

  const candidateGroupNumber = candidate.groupNumber ?? '';
  const duplicatePolicy = existingPolicies.find((policy) => {
    const existingGroupNumber =
      typeof policy.groupNumber === 'string' ? policy.groupNumber.trim() : '';
    return existingGroupNumber === candidateGroupNumber;
  });

  if (duplicatePolicy) {
    throw new AppError(
      'An insurance policy with this patient, payer, member ID, and group number already exists.',
      HTTP_STATUS.CONFLICT
    );
  }

  if (candidate.active !== false && candidate.coveragePriority) {
    const conflictingPriorityPolicy = await InsurancePolicy.findOne({
      isDeleted: false,
      active: true,
      patientId: candidate.patientId,
      coveragePriority: candidate.coveragePriority,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    }).select('_id coveragePriority');

    if (conflictingPriorityPolicy) {
      throw new AppError(
        `Only one active ${candidate.coveragePriority} policy can exist for this patient at a time.`,
        HTTP_STATUS.CONFLICT
      );
    }
  }
}

export const insurancePolicyService = {
  async create(data: any, locale: string, createdBy: string) {
    const normalizedData = normalizeInsurancePolicyData(data);
    validateInsurancePolicyState(normalizedData);

    const patient = await resolvePatient(normalizedData.patientId, locale);
    const payer = await resolvePayer(normalizedData.payerId, locale);
    await ensureUniqueCoverage(normalizedData);
    const dependentValidation = await buildDependentValidation(normalizedData, patient);

    const item = await InsurancePolicy.create({
      ...normalizedData,
      dependentValidation,
      ediPayerId:
        normalizedData.ediPayerId ??
        (typeof payer.ediPayerId === 'string' ? payer.ediPayerId.trim() || undefined : undefined),
      payerType:
        normalizedData.payerType ??
        (typeof payer.payerType === 'string' ? payer.payerType.trim() || undefined : undefined),
      active: normalizedData.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });

    await syncEntityDocuments({
      entityType: 'insurancePolicy',
      entityId: String(item._id),
      patientId: String(item.patientId),
      attachments: buildInsurancePolicyDocumentAttachments(item),
      sourceTags: ['source:insurance-card', 'source:insurance-documents'],
      userId: createdBy,
    });

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await InsurancePolicy.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('insurancePolicy.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await InsurancePolicy.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('insurancePolicy.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const normalizedData = normalizeInsurancePolicyData(data);
    const candidate = {
      ...item.toObject(),
      ...normalizedData,
    };

    validateInsurancePolicyState(candidate);

    const patient = await resolvePatient(candidate.patientId, locale);
    const payer = await resolvePayer(candidate.payerId, locale);
    await ensureUniqueCoverage(candidate, id);
    const dependentValidation = await buildDependentValidation(candidate, patient);

    const assignmentData = {
      ...normalizedData,
      dependentValidation,
      updatedBy,
      updated: new Date(),
    } as Record<string, unknown>;

    if (normalizedData.coveragePriority !== undefined) {
      assignmentData.coordinationOfBenefitsOrder = candidate.coordinationOfBenefitsOrder;
    }

    if (normalizedData.payerId !== undefined || normalizedData.ediPayerId !== undefined) {
      assignmentData.ediPayerId =
        candidate.ediPayerId ??
        (typeof payer.ediPayerId === 'string' ? payer.ediPayerId.trim() || undefined : undefined);
    }

    if (normalizedData.payerId !== undefined || normalizedData.payerType !== undefined) {
      assignmentData.payerType =
        candidate.payerType ??
        (typeof payer.payerType === 'string' ? payer.payerType.trim() || undefined : undefined);
    }

    Object.assign(item, {
      ...assignmentData,
    });

    await item.save();

    await syncEntityDocuments({
      entityType: 'insurancePolicy',
      entityId: String(item._id),
      patientId: String(item.patientId),
      attachments: buildInsurancePolicyDocumentAttachments(item),
      sourceTags: ['source:insurance-card', 'source:insurance-documents'],
      userId: updatedBy,
    });

    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const item = await InsurancePolicy.findOneAndUpdate(
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
      throw new AppError(t('insurancePolicy.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    await markEntityDocumentsDeleted('insurancePolicy', id, updatedBy);

    return true;
  },
};
