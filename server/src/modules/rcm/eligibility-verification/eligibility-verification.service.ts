import mongoose from 'mongoose';
import { Appointment } from '../appointment/appointment.model';
import { Facility } from '../facility/facility.model';
import { InsurancePolicy } from '../insurance-policy/insurance-policy.model';
import { Payer } from '../payer/payer.model';
import { Patient } from '../patient/patient.model';
import { Provider } from '../provider/provider.model';
import { PriorAuthorization } from '../prior-authorization/prior-authorization.model';
import { EligibilityVerification } from './eligibility-verification.model';
import {
  eligibilityIntegrationConfig,
  isEligibilityIntegrationConfigured,
} from './eligibility-verification.integration.config';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';

type CurrentUser = {
  _id?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
};

type RunRealtimeVerificationPayload = {
  appointmentId?: string;
  providerId?: string;
  facilityId?: string;
  insuranceId: string;
  serviceTypeCode?: string;
  serviceTypeCodes?: string[];
  serviceDate?: Date | string;
  coveragePriority?: string;
  procedureCodes?: string[];
};

type EligibilityVerificationSummary = {
  eligibilityStatus: string;
  coverageStatus?: string;
  planActive: boolean;
  copayAmount?: number;
  coinsurancePercent?: number;
  deductibleRemaining?: number;
  outOfPocketRemaining?: number;
  networkStatus?: string;
  referralRequired: boolean;
  authorizationRequired: boolean;
  serviceTypeCodes?: string[];
  benefitNotes?: string;
  externalVerificationId?: string;
  rawResponseReference?: string;
  nextVerificationDueDate?: Date;
};

type VendorRequestResult = {
  responseStatusCode: number;
  responseBody: unknown;
  summary: EligibilityVerificationSummary;
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

let cachedToken: TokenCache | null = null;
const REDACTED_VALUE = '[REDACTED]';

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function normalizeTextArray(value: unknown) {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value
    .map((item) => normalizeText(item))
    .filter((item): item is string => Boolean(item));

  return values.length ? values : undefined;
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

function formatDateOnly(value: unknown) {
  const dateValue = normalizeDate(value);

  if (!dateValue) {
    return '';
  }

  return dateValue.toISOString().slice(0, 10);
}

function formatStediDate(value: unknown) {
  return formatDateOnly(value).replace(/-/g, '');
}

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

export function redactEligibilityPayload(value: unknown): unknown {
  const sensitiveKeys = new Set([
    'memberid',
    'subscriberid',
    'policyid',
    'firstname',
    'middlename',
    'lastname',
    'name',
    'dateofbirth',
    'dob',
    'birthdate',
    'address',
    'addressline1',
    'addressline2',
    'city',
    'state',
    'zipcode',
    'zip',
    'phone',
    'phonenumber',
    'mobile',
    'mobilenumber',
    'alternatephonenumber',
    'x12',
  ]);

  const shouldRedactKey = (key: string, path: string[]) => {
    const normalizedKey = key.toLowerCase();

    if (sensitiveKeys.has(normalizedKey)) {
      return true;
    }

    return normalizedKey === 'id' && path.some((segment) =>
      ['subscriber', 'dependent', 'member', 'patient'].includes(segment.toLowerCase())
    );
  };

  const redactRecursive = (source: unknown, path: string[] = []): unknown => {
    if (Array.isArray(source)) {
      return source.map((item) => redactRecursive(item, path));
    }

    if (typeof source !== 'object' || source === null) {
      return source;
    }

    return Object.entries(source as Record<string, unknown>).reduce<Record<string, unknown>>((nextValue, [key, item]) => {
      if (shouldRedactKey(key, path)) {
        nextValue[key] = REDACTED_VALUE;
        return nextValue;
      }

      if (key.toLowerCase() === 'value' && typeof item === 'string') {
        nextValue[key] = REDACTED_VALUE;
        return nextValue;
      }

      nextValue[key] = redactRecursive(item, [...path, key]);
      return nextValue;
    }, {});
  };

  if (typeof value === 'string') {
    try {
      return redactRecursive(JSON.parse(value));
    } catch (error) {
      return REDACTED_VALUE;
    }
  }

  return redactRecursive(value);
}

function maybeRedactEligibilityPayload(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  return eligibilityIntegrationConfig.storage.storeRawPayloads
    ? value
    : redactEligibilityPayload(value);
}

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (Array.isArray(current)) {
      const index = Number(segment);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (typeof current !== 'object' || current === null) {
      return undefined;
    }

    return (current as Record<string, unknown>)[segment];
  }, source);
}

function readFirstPath(source: unknown, paths: readonly string[]) {
  for (const path of paths) {
    const value = readPath(source, path);

    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }

  return undefined;
}

function coerceString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue ? trimmedValue : undefined;
  }

  if (Array.isArray(value)) {
    const values: string[] = value
      .map((item) => coerceString(item))
      .filter((item): item is string => Boolean(item));

    return values.length ? values.join('\n') : undefined;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return undefined;
}

function coerceNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.replace(/[^0-9.-]+/g, '');
    if (!normalizedValue) {
      return undefined;
    }

    const parsedValue = Number(normalizedValue);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
  }

  return undefined;
}

function coerceBoolean(value: unknown) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();

    if (['true', 'yes', 'y', '1', 'active', 'eligible', 'covered'].includes(normalizedValue)) {
      return true;
    }

    if (['false', 'no', 'n', '0', 'inactive', 'ineligible', 'denied', 'terminated'].includes(normalizedValue)) {
      return false;
    }
  }

  return undefined;
}

function inferPlanActive(coverageStatus?: string, eligibilityStatus?: string) {
  const statusText = `${coverageStatus ?? ''} ${eligibilityStatus ?? ''}`.trim().toLowerCase();

  if (!statusText) {
    return undefined;
  }

  if (/(inactive|ineligible|terminated|cancelled|canceled|denied)/.test(statusText)) {
    return false;
  }

  if (/(active|eligible|covered|approved)/.test(statusText)) {
    return true;
  }

  return undefined;
}

function mapCoverageToPolicyStatus(coverageStatus: string | undefined, planActive: boolean) {
  const normalizedValue = coverageStatus?.trim().toLowerCase();

  if (!normalizedValue) {
    return planActive ? 'Active' : 'Inactive';
  }

  if (normalizedValue.includes('terminated')) {
    return 'Terminated';
  }

  if (normalizedValue.includes('cancel')) {
    return 'Cancelled';
  }

  if (normalizedValue.includes('pending')) {
    return 'Pending';
  }

  if (normalizedValue.includes('inactive') || normalizedValue.includes('ineligible')) {
    return 'Inactive';
  }

  if (
    normalizedValue.includes('active') ||
    normalizedValue.includes('eligible') ||
    normalizedValue.includes('covered')
  ) {
    return 'Active';
  }

  return undefined;
}

function extractVendorMessage(payload: unknown) {
  if (typeof payload === 'string') {
    const trimmedValue = payload.trim();
    return trimmedValue || undefined;
  }

  return coerceString(
    readFirstPath(payload, ['message', 'error', 'errors.0.message', 'data.message', 'data.error'])
  );
}

function readObjectArray(source: unknown, path: string) {
  const value = readPath(source, path);

  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    : [];
}

function hasServiceType(item: Record<string, unknown>, serviceTypeCode: string) {
  const serviceTypeCodes = item.serviceTypeCodes;

  if (!Array.isArray(serviceTypeCodes) || !serviceTypeCodes.length) {
    return true;
  }

  return serviceTypeCodes.some((code) => normalizeText(code) === serviceTypeCode);
}

function getStediActiveCoverageStatus(responseBody: unknown, serviceTypeCode: string) {
  return readObjectArray(responseBody, 'planStatus').find((status) => {
    const statusCode = normalizeText(status.statusCode);
    const statusText = normalizeText(status.status)?.toLowerCase() ?? '';

    return hasServiceType(status, serviceTypeCode)
      && (statusCode === '1' || statusText.includes('active coverage'));
  });
}

function getStediNetworkStatus(value: unknown) {
  const normalizedValue = normalizeText(value)?.toUpperCase();

  if (normalizedValue === 'Y') {
    return 'IN_NETWORK';
  }

  if (normalizedValue === 'N') {
    return 'OUT_OF_NETWORK';
  }

  if (normalizedValue === 'W') {
    return 'NOT_APPLICABLE';
  }

  return undefined;
}

function findStediBenefit(
  responseBody: unknown,
  options: {
    code?: string;
    timeQualifierCode?: string;
    networkCode?: string;
    serviceTypeCode?: string;
  }
) {
  return readObjectArray(responseBody, 'benefitsInformation').find((benefit) => {
    if (options.code && normalizeText(benefit.code) !== options.code) {
      return false;
    }

    if (options.timeQualifierCode && normalizeText(benefit.timeQualifierCode) !== options.timeQualifierCode) {
      return false;
    }

    if (options.networkCode && normalizeText(benefit.inPlanNetworkIndicatorCode) !== options.networkCode) {
      return false;
    }

    return hasServiceType(benefit, options.serviceTypeCode ?? eligibilityIntegrationConfig.request.defaultServiceTypeCode);
  });
}

function collectStediServiceTypeCodes(responseBody: unknown) {
  const codes = new Set<string>();
  const collect = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(collect);
      return;
    }

    const code = normalizeText(value);
    if (code) {
      codes.add(code);
    }
  };

  readObjectArray(responseBody, 'planStatus').forEach((status) => collect(status.serviceTypeCodes));
  readObjectArray(responseBody, 'benefitsInformation').forEach((benefit) => collect(benefit.serviceTypeCodes));

  return codes.size ? Array.from(codes) : undefined;
}

function collectStediBenefitNotes(responseBody: unknown) {
  const notes = new Set<string>();
  const addNote = (value: unknown) => {
    const text = coerceString(value);
    if (text) {
      notes.add(text);
    }
  };

  readObjectArray(responseBody, 'benefitsInformation').forEach((benefit) => {
    addNote(benefit.name);
    addNote(benefit.planCoverage);
    addNote(benefit.inPlanNetworkIndicator);
    readObjectArray(benefit, 'additionalInformation').forEach((item) => addNote(item.description));
  });

  return notes.size ? Array.from(notes).slice(0, 20).join('\n') : undefined;
}

function getStediRequirementFlag(responseBody: unknown, patterns: RegExp[]) {
  const textValues: string[] = [];
  const collect = (value: unknown) => {
    const text = coerceString(value);
    if (text) {
      textValues.push(text.toLowerCase());
    }
  };

  readObjectArray(responseBody, 'benefitsInformation').forEach((benefit) => {
    collect(benefit.name);
    collect(benefit.benefitNotes);
    collect(benefit.statusDescription);
    collect(benefit.planCoverage);
    readObjectArray(benefit, 'additionalInformation').forEach((item) => collect(item.description));
  });

  return textValues.some((value) => patterns.every((pattern) => pattern.test(value)));
}

function getCurrentUserLabel(user: CurrentUser) {
  const fullName = [normalizeText(user.firstName), normalizeText(user.lastName)]
    .filter((item): item is string => Boolean(item))
    .join(' ');

  return fullName || normalizeText(user.email) || 'System';
}

async function resolveManualVerificationLinks(data: any, locale: string) {
  const nextData = { ...data };
  let appointmentPatientId: string | undefined;
  let insurancePatientId: string | undefined;

  if (nextData.appointmentId) {
    const appointment = await Appointment.findOne({
      _id: nextData.appointmentId,
      isDeleted: false,
    });

    if (!appointment) {
      throw buildNotFoundError(t('appointment.notFound', {}, locale));
    }

    appointmentPatientId = String(appointment.patientId);
    nextData.patientId = nextData.patientId ?? appointmentPatientId;
  }

  if (nextData.insuranceId) {
    const insurance = await InsurancePolicy.findOne({
      _id: nextData.insuranceId,
      isDeleted: false,
    });

    if (!insurance) {
      throw buildNotFoundError(t('insurancePolicy.notFound', {}, locale));
    }

    insurancePatientId = String(insurance.patientId);
    nextData.patientId = nextData.patientId ?? insurancePatientId;
    nextData.payerId = nextData.payerId ?? normalizeText(insurance.payerId);
  }

  if (
    appointmentPatientId &&
    insurancePatientId &&
    appointmentPatientId !== insurancePatientId
  ) {
    throw buildEligibilityPrerequisiteError([
      {
        field: 'insuranceId',
        message: 'The selected insurance policy does not belong to the appointment patient.',
      },
    ]);
  }

  return nextData;
}

function buildManualVerificationSummary(data: any, checkedAt: Date): EligibilityVerificationSummary {
  const planActive = typeof data.planActive === 'boolean' ? data.planActive : false;
  const eligibilityStatus =
    normalizeText(data.eligibilityStatus)
    ?? (planActive ? 'Eligible' : 'Ineligible');
  const coverageStatus =
    normalizeText(data.coverageStatus)
    ?? (planActive ? 'Active' : 'Inactive');

  return {
    eligibilityStatus,
    coverageStatus,
    planActive,
    copayAmount: coerceNumber(data.copayAmount),
    coinsurancePercent: coerceNumber(data.coinsurancePercent),
    deductibleRemaining: coerceNumber(data.deductibleRemaining),
    outOfPocketRemaining: coerceNumber(data.outOfPocketRemaining),
    networkStatus: normalizeText(data.networkStatus),
    referralRequired: typeof data.referralRequired === 'boolean' ? data.referralRequired : false,
    authorizationRequired:
      typeof data.authorizationRequired === 'boolean' ? data.authorizationRequired : false,
    serviceTypeCodes: normalizeTextArray(data.serviceTypeCodes) ?? (
      normalizeText(data.serviceTypeCode) ? [normalizeText(data.serviceTypeCode)!] : undefined
    ),
    benefitNotes: normalizeText(data.benefitNotes),
    rawResponseReference: normalizeText(data.rawResponseReference),
    nextVerificationDueDate: addDays(
      checkedAt,
      eligibilityIntegrationConfig.request.reverificationDays
    ),
  };
}

function buildManualVerificationRecord(data: any, user: CurrentUser) {
  const checkedAt = new Date();
  const summary = buildManualVerificationSummary(data, checkedAt);

  return {
    itemData: {
      ...data,
      patientId: data.patientId,
      payerId: normalizeText(data.payerId),
      serviceTypeCode:
        normalizeText(data.serviceTypeCode) ??
        eligibilityIntegrationConfig.request.defaultServiceTypeCode,
      serviceTypeCodes:
        summary.serviceTypeCodes ??
        [normalizeText(data.serviceTypeCode) ?? eligibilityIntegrationConfig.request.defaultServiceTypeCode],
      serviceDate: normalizeDate(data.serviceDate),
      coveragePriority: normalizeText(data.coveragePriority),
      eligibilityStatus: summary.eligibilityStatus,
      coverageStatus: summary.coverageStatus,
      planActive: summary.planActive,
      copayAmount: summary.copayAmount,
      coinsurancePercent: summary.coinsurancePercent,
      deductibleRemaining: summary.deductibleRemaining,
      outOfPocketRemaining: summary.outOfPocketRemaining,
      networkStatus: summary.networkStatus,
      referralRequired: summary.referralRequired,
      authorizationRequired: summary.authorizationRequired,
      benefitNotes: summary.benefitNotes,
      checkedBy: getCurrentUserLabel(user),
      checkedAt,
      verificationSource: normalizeText(data.verificationSource) ?? 'Manual',
      rawResponseReference: summary.rawResponseReference,
      rawRequestPayload: maybeRedactEligibilityPayload(data.rawRequestPayload),
      rawResponsePayload: maybeRedactEligibilityPayload(data.rawResponsePayload),
    },
    checkedAt,
    summary,
  };
}

function buildEligibilityConfigurationError() {
  return new AppError(
    'Eligibility integration is not configured for this environment.',
    HTTP_STATUS.SERVICE_UNAVAILABLE
  );
}

function isStediEligibilityTarget() {
  const vendorName = eligibilityIntegrationConfig.vendorName.trim().toLowerCase();
  const verificationUrl = eligibilityIntegrationConfig.request.verificationUrl.trim().toLowerCase();

  return vendorName === 'stedi' || verificationUrl.includes('stedi.com');
}

function logStediEligibilityDebug(label: string, payload: unknown) {
  if (!eligibilityIntegrationConfig.debug.enabled || !isStediEligibilityTarget()) {
    return;
  }

  console.log(
    `[RCM Stedi Eligibility] ${label}`,
    JSON.stringify(redactEligibilityPayload(payload), null, 2)
  );
}

function buildEligibilityPrerequisiteError(errors: Array<{ field: string; message: string }>) {
  return new AppError(
    errors.map((error) => error.message).join(' '),
    HTTP_STATUS.BAD_REQUEST,
    errors
  );
}

function buildNotFoundError(message: string) {
  return new AppError(message, HTTP_STATUS.NOT_FOUND);
}

function getPayerRoutingId(insurance: any, payer: any) {
  const payerId = normalizeText(insurance.payerId) ?? normalizeText(payer.payerId);
  const ediPayerId = normalizeText(insurance.ediPayerId) ?? normalizeText(payer.ediPayerId);

  switch (eligibilityIntegrationConfig.request.payerIdentifierSource) {
    case 'payerId':
      return payerId;
    case 'ediPayerId':
      return ediPayerId;
    default:
      return ediPayerId ?? payerId;
  }
}

function getProcedureCodes(payload: RunRealtimeVerificationPayload) {
  const providedCodes = (payload.procedureCodes ?? [])
    .map((item) => normalizeText(item))
    .filter((item): item is string => Boolean(item));

  if (providedCodes.length) {
    return providedCodes;
  }

  return eligibilityIntegrationConfig.request.defaultProcedureCodes.length
    ? eligibilityIntegrationConfig.request.defaultProcedureCodes
    : [];
}

function getServiceDate(appointment: any) {
  return formatDateOnly(appointment.appointmentStart ?? appointment.appointmentDate);
}

function getPayloadServiceDate(payload: RunRealtimeVerificationPayload, appointment?: any) {
  return appointment ? getServiceDate(appointment) : formatDateOnly(payload.serviceDate ?? new Date());
}

function getStediProcedureQualifier(code: string) {
  return code.toUpperCase().startsWith('D') ? 'AD' : 'CJ';
}

function buildSubscriberSnapshot(insurance: any, patient: any) {
  const isSelf = normalizeText(insurance.relationshipToSubscriber)?.toLowerCase() === 'self';

  if (isSelf) {
    return {
      firstName: normalizeText(patient.firstName) ?? '',
      lastName: normalizeText(patient.lastName) ?? '',
      dateOfBirth: formatDateOnly(patient.dateOfBirth),
      zipCode: normalizeText(patient.address?.zipCode) ?? '',
      id: normalizeText(insurance.subscriberId) ?? normalizeText(insurance.memberId) ?? '',
    };
  }

  return {
    firstName: normalizeText(insurance.subscriber?.firstName) ?? '',
    lastName: normalizeText(insurance.subscriber?.lastName) ?? '',
    dateOfBirth: formatDateOnly(insurance.subscriber?.dob),
    zipCode: normalizeText(insurance.subscriber?.zipCode) ?? '',
    id: normalizeText(insurance.subscriberId) ?? normalizeText(insurance.memberId) ?? '',
  };
}

function buildDependentSnapshot(insurance: any, patient: any) {
  return {
    firstName: normalizeText(patient.firstName) ?? '',
    lastName: normalizeText(patient.lastName) ?? '',
    dateOfBirth: formatDateOnly(patient.dateOfBirth),
    zipCode: normalizeText(patient.address?.zipCode) ?? '',
    id:
      normalizeText(insurance.dependentNumber) ??
      normalizeText(insurance.memberId) ??
      normalizeText(insurance.subscriberId) ??
      '',
  };
}

function validateRealtimeContext(context: {
  appointment?: any;
  insurance: any;
  patient: any;
  provider: any;
  facility: any;
  payer: any;
}) {
  const { appointment, insurance, patient, provider, facility, payer } = context;
  const errors: Array<{ field: string; message: string }> = [];

  if (appointment && String(appointment.patientId) !== String(insurance.patientId)) {
    errors.push({
      field: 'insuranceId',
      message: 'The selected insurance policy does not belong to the appointment patient.',
    });
  }

  if (!payer.eligibilityApiSupported) {
    errors.push({
      field: 'insuranceId',
      message: 'This payer is not marked as eligible for real-time eligibility checks.',
    });
  }

  if (!getPayerRoutingId(insurance, payer)) {
    errors.push({
      field: 'insuranceId',
      message: 'Payer routing is incomplete. Add a payer ID or EDI payer ID before running eligibility.',
    });
  }

  if (!normalizeText(insurance.memberId)) {
    errors.push({
      field: 'insuranceId',
      message: 'Member ID is required for real-time eligibility.',
    });
  }

  if (!normalizeText(patient.firstName) || !normalizeText(patient.lastName) || !normalizeDate(patient.dateOfBirth)) {
    errors.push({
      field: 'patientId',
      message: 'Patient first name, last name, and date of birth are required for eligibility.',
    });
  }

  if (!normalizeText(provider.npi)) {
    errors.push({
      field: 'providerId',
      message: 'Provider NPI is required for real-time eligibility.',
    });
  }

  if (!normalizeText(facility.taxId)) {
    errors.push({
      field: 'facilityId',
      message: 'Facility tax ID is required for real-time eligibility.',
    });
  }

  if (!normalizeText(facility.facilityName)) {
    errors.push({
      field: 'facilityId',
      message: 'Facility name is required for real-time eligibility.',
    });
  }

  if (!normalizeText(facility.addressLine1) || !normalizeText(facility.city) || !normalizeText(facility.state) || !normalizeText(facility.zipCode)) {
    errors.push({
      field: 'facilityId',
      message: 'Facility address, city, state, and ZIP code are required for real-time eligibility.',
    });
  }

  if (appointment && !getServiceDate(appointment)) {
    errors.push({
      field: 'appointmentId',
      message: 'Appointment date is required for real-time eligibility.',
    });
  }

  const subscriber = buildSubscriberSnapshot(insurance, patient);

  if (
    normalizeText(insurance.relationshipToSubscriber)?.toLowerCase() !== 'self' &&
    (!subscriber.firstName || !subscriber.lastName || !subscriber.dateOfBirth)
  ) {
    errors.push({
      field: 'insuranceId',
      message: 'Subscriber name and date of birth are required when the patient is not the subscriber.',
    });
  }

  if (errors.length) {
    throw buildEligibilityPrerequisiteError(errors);
  }
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
    throw buildNotFoundError(t('payer.notFound', {}, locale));
  }

  return payer;
}

async function resolveRealtimeContext(payload: RunRealtimeVerificationPayload, locale: string) {
  let appointment = null;
  let providerId = payload.providerId;
  let facilityId = payload.facilityId;

  if (payload.appointmentId) {
    appointment = await Appointment.findOne({
      _id: payload.appointmentId,
      isDeleted: false,
      active: true,
    });

    if (!appointment) {
      throw buildNotFoundError(t('appointment.notFound', {}, locale));
    }
    providerId = String(appointment.providerId);
    facilityId = String(appointment.facilityId);
  }

  const insurance = await InsurancePolicy.findOne({
    _id: payload.insuranceId,
    isDeleted: false,
    active: true,
  });

  if (!insurance) {
    throw buildNotFoundError(t('insurancePolicy.notFound', {}, locale));
  }

  const patient = await Patient.findOne({
    _id: insurance.patientId,
    isDeleted: false,
    active: true,
  });

  if (!patient) {
    throw buildNotFoundError(t('patient.notFound', {}, locale));
  }

  if (!providerId || !facilityId) {
    throw buildEligibilityPrerequisiteError([
      {
        field: !providerId ? 'providerId' : 'facilityId',
        message: 'Provider and facility are required for real-time eligibility.',
      },
    ]);
  }

  const provider = await Provider.findOne({
    _id: providerId,
    isDeleted: false,
    active: true,
  });

  if (!provider) {
    throw buildNotFoundError(t('provider.notFound', {}, locale));
  }

  const facility = await Facility.findOne({
    _id: facilityId,
    isDeleted: false,
    active: true,
  });

  if (!facility) {
    throw buildNotFoundError(t('facility.notFound', {}, locale));
  }

  const payer = await resolvePayer(insurance.payerId, locale);

  return {
    appointment,
    insurance,
    patient,
    provider,
    facility,
    payer,
  };
}

function buildVerificationPayload(
  payload: RunRealtimeVerificationPayload,
  context: Awaited<ReturnType<typeof resolveRealtimeContext>>
) {
  const { appointment, insurance, patient, provider, facility, payer } = context;
  const correlationId = `${eligibilityIntegrationConfig.request.correlationPrefix}-${new mongoose.Types.ObjectId().toString()}`;
  const procedureCodes = getProcedureCodes(payload);
  const subscriber = buildSubscriberSnapshot(insurance, patient);
  const dependent = buildDependentSnapshot(insurance, patient);
  const payerRoutingId = getPayerRoutingId(insurance, payer);

  if (isStediEligibilityTarget()) {
    const serviceDate = getPayloadServiceDate(payload, appointment);
    const serviceTypeCode =
      normalizeText(payload.serviceTypeCode) ??
      eligibilityIntegrationConfig.request.defaultServiceTypeCode;
    const normalizedProcedureCodes = procedureCodes
      .map((code) => normalizeText(code)?.toUpperCase())
      .filter((code): code is string => Boolean(code));
    const encounter: Record<string, unknown> = {
      serviceTypeCodes: [serviceTypeCode],
      beginningDateOfService: formatStediDate(serviceDate),
    };

    if (normalizedProcedureCodes.length === 1) {
      encounter.procedureCode = normalizedProcedureCodes[0];
      encounter.productOrServiceIDQualifier = getStediProcedureQualifier(normalizedProcedureCodes[0]);
    } else if (normalizedProcedureCodes.length > 1) {
      encounter.medicalProcedures = normalizedProcedureCodes.map((procedureCode) => ({
        procedureCode,
        productOrServiceIDQualifier: getStediProcedureQualifier(procedureCode),
      }));
    }

    return {
      correlationId,
      payload: {
        controlNumber: correlationId,
        tradingPartnerServiceId: payerRoutingId ?? '',
        provider: {
          organizationName: normalizeText(facility.facilityName) ?? undefined,
          firstName: normalizeText(provider.firstName) ?? undefined,
          lastName: normalizeText(provider.lastName) ?? undefined,
          npi: normalizeText(provider.npi) ?? '',
        },
        subscriber: {
          memberId: normalizeText(insurance.memberId) ?? '',
          firstName: subscriber.firstName,
          lastName: subscriber.lastName,
          dateOfBirth: formatStediDate(subscriber.dateOfBirth),
        },
        encounter,
        externalPatientId: String(patient._id),
      },
      procedureCodes,
    };
  }

  return {
    correlationId,
    payload: {
      appointment: {
        serviceDate: getPayloadServiceDate(payload, appointment),
      },
      categories: eligibilityIntegrationConfig.request.defaultCategories,
      correlationId,
      credentials: [],
      dependent: {
        address: {
          zipCode: dependent.zipCode,
        },
        dateOfBirth: dependent.dateOfBirth,
        firstName: dependent.firstName,
        id: dependent.id,
        lastName: dependent.lastName,
      },
      networkStatuses: eligibilityIntegrationConfig.request.defaultNetworkStatuses,
      office: {
        address: {
          address1: normalizeText(facility.addressLine1) ?? '',
          address2: normalizeText(facility.addressLine2) ?? '',
          city: normalizeText(facility.city) ?? '',
          state: (normalizeText(facility.state) ?? '').toUpperCase(),
          zipCode: normalizeText(facility.zipCode) ?? '',
        },
        name: normalizeText(facility.facilityName) ?? '',
        taxId: normalizeText(facility.taxId) ?? '',
      },
      payer: {
        id: payerRoutingId ?? '',
      },
      planTypes: eligibilityIntegrationConfig.request.defaultPlanTypes,
      priority: eligibilityIntegrationConfig.request.priority,
      procedureCodes,
      provider: {
        firstName: normalizeText(provider.firstName) ?? '',
        lastName: normalizeText(provider.lastName) ?? '',
        nationalProviderId: normalizeText(provider.npi) ?? '',
      },
      subscriber: {
        address: {
          zipCode: subscriber.zipCode,
        },
        dateOfBirth: subscriber.dateOfBirth,
        firstName: subscriber.firstName,
        id: subscriber.id,
        lastName: subscriber.lastName,
      },
      version: eligibilityIntegrationConfig.request.payloadVersion,
    },
    procedureCodes,
  };
}

async function parseResponseBody(response: Response) {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    return text;
  }
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.accessToken;
  }

  const authBody = new URLSearchParams({
    client_id: eligibilityIntegrationConfig.auth.clientId,
    client_secret: eligibilityIntegrationConfig.auth.clientSecret,
    grant_type: eligibilityIntegrationConfig.auth.grantType,
    audience: eligibilityIntegrationConfig.auth.audience,
  });

  const response = await fetch(eligibilityIntegrationConfig.auth.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: authBody.toString(),
    signal: AbortSignal.timeout(eligibilityIntegrationConfig.request.timeoutMs),
  });

  const responseBody = await parseResponseBody(response);

  if (!response.ok) {
    const message =
      extractVendorMessage(responseBody) ??
      `Eligibility token request failed with status ${response.status}.`;
    throw new AppError(message, HTTP_STATUS.BAD_GATEWAY);
  }

  if (typeof responseBody !== 'object' || responseBody === null) {
    throw new AppError(
      'Eligibility token response is invalid.',
      HTTP_STATUS.BAD_GATEWAY
    );
  }

  const accessToken = normalizeText((responseBody as Record<string, unknown>).access_token);
  const expiresIn = coerceNumber((responseBody as Record<string, unknown>).expires_in) ?? 3600;

  if (!accessToken) {
    throw new AppError(
      'Eligibility token response did not include an access token.',
      HTTP_STATUS.BAD_GATEWAY
    );
  }

  cachedToken = {
    accessToken,
    expiresAt: Date.now() + expiresIn * 1000,
  };

  return accessToken;
}

function parseEligibilitySummary(responseBody: unknown, checkedAt: Date): EligibilityVerificationSummary {
  const serviceTypeCode = eligibilityIntegrationConfig.request.defaultServiceTypeCode;
  const serviceTypeCodes = collectStediServiceTypeCodes(responseBody);
  const stediActiveCoverageStatus = getStediActiveCoverageStatus(responseBody, serviceTypeCode);
  const stediInNetworkBenefit =
    findStediBenefit(responseBody, { networkCode: 'Y', serviceTypeCode }) ??
    findStediBenefit(responseBody, { serviceTypeCode });
  const stediCopayBenefit = findStediBenefit(responseBody, {
    code: 'B',
    networkCode: 'Y',
    serviceTypeCode,
  });
  const stediCoinsuranceBenefit = findStediBenefit(responseBody, {
    code: 'A',
    networkCode: 'Y',
    serviceTypeCode,
  });
  const stediDeductibleRemainingBenefit = findStediBenefit(responseBody, {
    code: 'C',
    timeQualifierCode: '29',
    networkCode: 'Y',
    serviceTypeCode,
  });
  const stediOutOfPocketRemainingBenefit = findStediBenefit(responseBody, {
    code: 'G',
    timeQualifierCode: '29',
    networkCode: 'Y',
    serviceTypeCode,
  });
  const externalVerificationId = coerceString(
    readFirstPath(
      responseBody,
      eligibilityIntegrationConfig.response.externalVerificationIdPaths
    )
  );
  const eligibilityStatus =
    coerceString(
      readFirstPath(
        responseBody,
        eligibilityIntegrationConfig.response.eligibilityStatusPaths
      )
    ) ?? (stediActiveCoverageStatus ? 'Eligible' : 'Not Verified');
  const coverageStatus =
    coerceString(
      readFirstPath(
        responseBody,
        eligibilityIntegrationConfig.response.coverageStatusPaths
      )
    ) ?? normalizeText(stediActiveCoverageStatus?.status);
  const explicitPlanActive = coerceBoolean(
    readFirstPath(responseBody, eligibilityIntegrationConfig.response.planActivePaths)
  );
  const inferredPlanActive = inferPlanActive(coverageStatus, eligibilityStatus);
  const planActive = explicitPlanActive ?? inferredPlanActive ?? Boolean(stediActiveCoverageStatus);
  const benefitNotes = coerceString(
    readFirstPath(
      responseBody,
      eligibilityIntegrationConfig.response.benefitNotesPaths
    )
  ) ?? collectStediBenefitNotes(responseBody);
  const nextVerificationDueDate =
    normalizeDate(
      readFirstPath(
        responseBody,
        eligibilityIntegrationConfig.response.nextVerificationDueDatePaths
      )
    ) ??
    addDays(checkedAt, eligibilityIntegrationConfig.request.reverificationDays);

  return {
    externalVerificationId,
    eligibilityStatus,
    coverageStatus:
      coverageStatus ?? (planActive ? 'Active' : 'Unclear - not verified'),
    planActive,
    copayAmount:
      coerceNumber(readFirstPath(responseBody, eligibilityIntegrationConfig.response.copayAmountPaths)) ??
      coerceNumber(stediCopayBenefit?.benefitAmount),
    coinsurancePercent:
      coerceNumber(readFirstPath(responseBody, eligibilityIntegrationConfig.response.coinsurancePercentPaths)) ??
      (
        coerceNumber(stediCoinsuranceBenefit?.benefitPercent) !== undefined
          ? Number(coerceNumber(stediCoinsuranceBenefit?.benefitPercent)) * 100
          : undefined
      ),
    deductibleRemaining:
      coerceNumber(readFirstPath(responseBody, eligibilityIntegrationConfig.response.deductibleRemainingPaths)) ??
      coerceNumber(stediDeductibleRemainingBenefit?.benefitAmount),
    outOfPocketRemaining:
      coerceNumber(readFirstPath(responseBody, eligibilityIntegrationConfig.response.outOfPocketRemainingPaths)) ??
      coerceNumber(stediOutOfPocketRemainingBenefit?.benefitAmount),
    networkStatus:
      coerceString(readFirstPath(responseBody, eligibilityIntegrationConfig.response.networkStatusPaths)) ??
      getStediNetworkStatus(stediInNetworkBenefit?.inPlanNetworkIndicatorCode),
    referralRequired:
      coerceBoolean(
        readFirstPath(
          responseBody,
          eligibilityIntegrationConfig.response.referralRequiredPaths
        )
      ) ?? getStediRequirementFlag(responseBody, [/referral/, /(required|needed|necessary)/]),
    authorizationRequired:
      coerceBoolean(
        readFirstPath(
          responseBody,
          eligibilityIntegrationConfig.response.authorizationRequiredPaths
        )
      ) ?? getStediRequirementFlag(responseBody, [/(authorization|authorisation|prior auth|precert)/, /(required|needed|necessary)/]),
    serviceTypeCodes,
    benefitNotes,
    rawResponseReference: externalVerificationId,
    nextVerificationDueDate,
  };
}

async function sendRealtimeEligibilityRequest(
  requestPayload: Record<string, unknown>,
  checkedAt: Date
): Promise<VendorRequestResult> {
  const stediTarget = isStediEligibilityTarget();
  const accessToken = stediTarget ? eligibilityIntegrationConfig.stedi.apiKey : await getAccessToken();
  const verificationUrl = stediTarget
    ? eligibilityIntegrationConfig.stedi.eligibilityEndpoint
    : eligibilityIntegrationConfig.request.verificationUrl;

  if (!accessToken || !verificationUrl) {
    throw buildEligibilityConfigurationError();
  }

  logStediEligibilityDebug('Request', {
    method: 'POST',
    url: verificationUrl,
    payload: requestPayload,
  });

  const response = await fetch(verificationUrl, {
    method: 'POST',
    headers: {
      Authorization: stediTarget ? accessToken : `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestPayload),
    signal: AbortSignal.timeout(eligibilityIntegrationConfig.request.timeoutMs),
  });

  const responseBody = await parseResponseBody(response);

  logStediEligibilityDebug('Response', {
    status: response.status,
    ok: response.ok,
    body: responseBody,
  });

  if (!response.ok) {
    const message =
      extractVendorMessage(responseBody) ??
      `Eligibility verification request failed with status ${response.status}.`;
    throw new AppError(message, HTTP_STATUS.BAD_GATEWAY);
  }

  return {
    responseStatusCode: response.status,
    responseBody,
    summary: parseEligibilitySummary(responseBody, checkedAt),
  };
}

async function refreshInsuranceSummary(
  insurance: any,
  summary: EligibilityVerificationSummary,
  user: CurrentUser,
  checkedAt: Date
) {
  insurance.insuranceVerifiedFlag = summary.planActive;
  insurance.verification = {
    ...(insurance.verification?.toObject?.() ?? insurance.verification ?? {}),
    lastVerifiedDateTime: checkedAt,
    nextVerificationDueDate: summary.nextVerificationDueDate,
  };

  const nextPolicyStatus = mapCoverageToPolicyStatus(summary.coverageStatus, summary.planActive);
  if (nextPolicyStatus) {
    insurance.policyStatus = nextPolicyStatus;
  }

  insurance.updated = new Date();
  insurance.updatedBy = user._id;
  await insurance.save();
}

function shouldSyncPriorAuthorization(payload: RunRealtimeVerificationPayload) {
  return Boolean(
    payload.appointmentId
    || (
      payload.providerId
      && payload.facilityId
      && payload.procedureCodes?.length
    )
  );
}

async function upsertPriorAuthorizationFromEligibility(
  context: Awaited<ReturnType<typeof resolveRealtimeContext>>,
  summary: EligibilityVerificationSummary,
  procedureCodes: string[],
  checkedAt: Date,
  user: CurrentUser
) {
  if (!summary.authorizationRequired) {
    return null;
  }

  const serviceDate = context.appointment?.appointmentDate ?? checkedAt;

  const existingAuthorization = await PriorAuthorization.findOne({
    patientId: context.patient._id,
    insuranceId: context.insurance._id,
    isDeleted: false,
    active: true,
    $or: [
      { serviceDate },
      { procedureCodes: { $in: procedureCodes } },
    ],
  }).sort({ updated: -1, requestDate: -1 });

  if (existingAuthorization) {
    existingAuthorization.authorizationRequired = true;
    existingAuthorization.providerId = context.provider._id;
    existingAuthorization.facilityId = context.facility._id;
    existingAuthorization.placeOfService =
      existingAuthorization.placeOfService ?? context.facility.placeOfServiceCode;
    existingAuthorization.requestDate = existingAuthorization.requestDate ?? checkedAt;
    existingAuthorization.authorizationStatus =
      existingAuthorization.authorizationStatus ?? 'Pending';
    existingAuthorization.procedureCodes = procedureCodes.length
      ? procedureCodes
      : existingAuthorization.procedureCodes ?? [];
    existingAuthorization.notes = [
      existingAuthorization.notes,
      summary.benefitNotes ? `Eligibility note: ${summary.benefitNotes}` : undefined,
    ]
      .filter((value): value is string => Boolean(value))
      .join('\n');
    existingAuthorization.updated = new Date();
    existingAuthorization.updatedBy = user._id;
    await existingAuthorization.save();
    return existingAuthorization;
  }

  return PriorAuthorization.create({
    patientId: context.patient._id,
    insuranceId: context.insurance._id,
    payerId: context.insurance.payerId,
    providerId: context.provider._id,
    facilityId: context.facility._id,
    serviceDate,
    placeOfService: context.facility.placeOfServiceCode,
    procedureCodes,
    authorizationRequired: true,
    authorizationType: 'Pre-Service',
    requestDate: checkedAt,
    authorizationStatus: 'Pending',
    notes: summary.benefitNotes ? `Eligibility note: ${summary.benefitNotes}` : undefined,
    active: true,
    created: checkedAt,
    updated: checkedAt,
    createdBy: user._id,
    updatedBy: user._id,
  });
}

async function syncAppointmentReferralRequirement(
  context: Awaited<ReturnType<typeof resolveRealtimeContext>>,
  summary: EligibilityVerificationSummary,
  checkedAt: Date,
  user: CurrentUser
) {
  if (!summary.referralRequired || !context.appointment) {
    return null;
  }

  context.appointment.referral = {
    ...((context.appointment.referral as any)?.toObject?.() ?? context.appointment.referral ?? {}),
    required: true,
    validFrom:
      context.appointment.referral?.validFrom
      ?? context.appointment.appointmentDate
      ?? checkedAt,
    validTo:
      context.appointment.referral?.validTo
      ?? summary.nextVerificationDueDate,
  };
  context.appointment.updated = new Date();
  context.appointment.updatedBy = user._id;
  await context.appointment.save();
  return context.appointment;
}

export const eligibilityVerificationService = {
  async create(data: any, locale: string, user: CurrentUser) {
    const linkedData = await resolveManualVerificationLinks(data, locale);
    const { itemData, checkedAt, summary } = buildManualVerificationRecord(linkedData, user);

    const item = await EligibilityVerification.create({
      ...itemData,
      active: itemData.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy: user._id,
      updatedBy: user._id,
    });

    if (itemData.insuranceId) {
      const insurance = await InsurancePolicy.findOne({
        _id: itemData.insuranceId,
        isDeleted: false,
      });

      if (insurance) {
        await refreshInsuranceSummary(insurance, summary, user, checkedAt);
      }
    }

    return item;
  },

  async runRealtimeVerification(
    payload: RunRealtimeVerificationPayload,
    locale: string,
    user: CurrentUser
  ) {
    if (!isEligibilityIntegrationConfigured()) {
      throw buildEligibilityConfigurationError();
    }

    const context = await resolveRealtimeContext(payload, locale);
    validateRealtimeContext(context);

    const checkedAt = new Date();
    const { correlationId, payload: requestPayload, procedureCodes } = buildVerificationPayload(
      payload,
      context
    );
    const vendorResult = await sendRealtimeEligibilityRequest(requestPayload, checkedAt);
    const checkedBy = getCurrentUserLabel(user);
    const serviceTypeCode =
      normalizeText(payload.serviceTypeCode) ??
      eligibilityIntegrationConfig.request.defaultServiceTypeCode;
    const serviceDate =
      normalizeDate(payload.serviceDate) ??
      normalizeDate(context.appointment?.appointmentStart ?? context.appointment?.appointmentDate);
    const rawResponsePayload =
      typeof vendorResult.responseBody === 'object' && vendorResult.responseBody !== null
        ? vendorResult.responseBody
        : { value: vendorResult.responseBody };
    const storedRequestPayload = eligibilityIntegrationConfig.storage.storeRawPayloads
      ? requestPayload
      : redactEligibilityPayload(requestPayload);
    const storedResponsePayload = eligibilityIntegrationConfig.storage.storeRawPayloads
      ? rawResponsePayload
      : redactEligibilityPayload(rawResponsePayload);

    const item = await EligibilityVerification.create({
      appointmentId: context.appointment?._id,
      patientId: context.patient._id,
      insuranceId: context.insurance._id,
      payerId: context.insurance.payerId,
      serviceTypeCode,
      serviceTypeCodes:
        vendorResult.summary.serviceTypeCodes ??
        [serviceTypeCode],
      serviceDate,
      coveragePriority:
        normalizeText(payload.coveragePriority) ??
        normalizeText(context.insurance.coveragePriority),
      procedureCodes,
      correlationId,
      externalVerificationId: vendorResult.summary.externalVerificationId,
      vendorName: eligibilityIntegrationConfig.vendorName,
      eligibilityStatus: vendorResult.summary.eligibilityStatus,
      coverageStatus: vendorResult.summary.coverageStatus,
      planActive: vendorResult.summary.planActive,
      copayAmount: vendorResult.summary.copayAmount,
      coinsurancePercent: vendorResult.summary.coinsurancePercent,
      deductibleRemaining: vendorResult.summary.deductibleRemaining,
      outOfPocketRemaining: vendorResult.summary.outOfPocketRemaining,
      networkStatus: vendorResult.summary.networkStatus,
      referralRequired: vendorResult.summary.referralRequired,
      authorizationRequired: vendorResult.summary.authorizationRequired,
      benefitNotes: vendorResult.summary.benefitNotes,
      checkedBy,
      checkedAt,
      verificationSource: eligibilityIntegrationConfig.vendorName,
      rawResponseReference:
        vendorResult.summary.rawResponseReference ?? correlationId,
      responseStatusCode: vendorResult.responseStatusCode,
      rawRequestPayload: storedRequestPayload,
      rawResponsePayload: storedResponsePayload,
      active: true,
      created: checkedAt,
      updated: checkedAt,
      createdBy: user._id,
      updatedBy: user._id,
    });

    if (shouldSyncPriorAuthorization(payload)) {
      await upsertPriorAuthorizationFromEligibility(
        context,
        vendorResult.summary,
        procedureCodes,
        checkedAt,
        user
      );
    }
    await syncAppointmentReferralRequirement(
      context,
      vendorResult.summary,
      checkedAt,
      user
    );
    await refreshInsuranceSummary(context.insurance, vendorResult.summary, user, checkedAt);

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await EligibilityVerification.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('eligibilityVerification.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, user: CurrentUser) {
    const item = await EligibilityVerification.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('eligibilityVerification.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const linkedData = await resolveManualVerificationLinks(
      {
        ...item.toObject(),
        ...data,
      },
      locale
    );
    const { itemData, checkedAt, summary } = buildManualVerificationRecord(linkedData, user);

    Object.assign(item, {
      ...itemData,
      updatedBy: user._id,
      updated: new Date(),
    });

    await item.save();

    if (item.insuranceId) {
      const insurance = await InsurancePolicy.findOne({
        _id: item.insuranceId,
        isDeleted: false,
      });

      if (insurance) {
        await refreshInsuranceSummary(insurance, summary, user, checkedAt);
      }
    }

    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const item = await EligibilityVerification.findOneAndUpdate(
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
      throw new AppError(t('eligibilityVerification.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
