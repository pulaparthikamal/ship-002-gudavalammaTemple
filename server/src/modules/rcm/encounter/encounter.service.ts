import { Encounter } from './encounter.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { ENCOUNTER_VISIT_STATUS_OPTIONS } from './encounter.constants';
import { appendStatusHistory } from '../workflow/workflow-history';
import { chargeService } from '../charge/charge.service';
import { Patient } from '../patient/patient.model';
import { Provider } from '../provider/provider.model';
import { Facility } from '../facility/facility.model';
import { rcmAiService } from '../workflow/rcm-ai.service';
import { Appointment } from '../appointment/appointment.model';
import { chargeMasterService } from '../charge-master/charge-master.service';
import { Charge } from '../charge/charge.model';
import { InsurancePolicy } from '../insurance-policy/insurance-policy.model';
import type { ClientSession } from 'mongoose';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';

const SYSTEM_MANAGED_ENCOUNTER_COMPLETION_STATUSES = new Set([
  'Provider Completed',
  'Completed',
  'Checked Out',
  'Ready for Charge Capture',
]);
const PROCEDURE_CODE_PATTERN = /\b(?:\d{5}|[A-Z]\d{4})\b/gi;

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : undefined;
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

function formatDateForAi(value: unknown) {
  const dateValue = normalizeDate(value);

  if (!(dateValue instanceof Date) || Number.isNaN(dateValue.getTime())) {
    return undefined;
  }

  return dateValue.toISOString().slice(0, 10);
}

function normalizeStringArray(values: unknown) {
  if (!Array.isArray(values)) {
    return undefined;
  }

  const nextValues = values
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));

  return nextValues.length ? nextValues : [];
}

function normalizeProcedureCodeUnits(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const rawEntries = value instanceof Map
    ? Array.from(value.entries())
    : Object.entries(value);

  const nextValue = rawEntries.reduce<Record<string, number>>((accumulator, [key, rawValue]) => {
    const normalizedCode = normalizeCodeValue(key);
    const normalizedUnits =
      typeof rawValue === 'number'
        ? rawValue
        : typeof rawValue === 'string'
          ? Number(rawValue)
          : NaN;

    if (!normalizedCode || !Number.isFinite(normalizedUnits) || normalizedUnits <= 0) {
      return accumulator;
    }

    accumulator[normalizedCode] = normalizedUnits;
    return accumulator;
  }, {});

  return Object.keys(nextValue).length ? nextValue : {};
}

async function buildInsurancePolicySnapshot(patientId: unknown, serviceDate: unknown, session?: ClientSession) {
  if (!patientId) {
    return undefined;
  }

  const policy = await InsurancePolicy.findOne({
    patientId,
    coverageType: { $not: /^self pay$/i },
    active: true,
    isDeleted: false,
  }).sort({ coordinationOfBenefitsOrder: 1, updated: -1 }).session(session ?? null);

  if (!policy) {
    return undefined;
  }

  const targetDate = normalizeDate(serviceDate);
  const effectiveDate = normalizeDate(policy.effectiveDate);
  const terminationDate = normalizeDate(policy.terminationDate);

  if (
    targetDate
    && (
      (effectiveDate && effectiveDate.getTime() > targetDate.getTime())
      || (terminationDate && terminationDate.getTime() < targetDate.getTime())
    )
  ) {
    return undefined;
  }

  return {
    insurancePolicyId: policy._id,
    payerId: normalizeText(policy.payerId),
    ediPayerId: normalizeText(policy.ediPayerId),
    memberId: normalizeText(policy.memberId),
    planName: normalizeText(policy.planName),
    groupNumber: normalizeText(policy.groupNumber),
    network: normalizeText(policy.network),
    coverageType: normalizeText(policy.coverageType),
    coveragePriority: normalizeText(policy.coveragePriority),
    snapshottedAt: new Date(),
  };
}

function buildValidationError(message: string) {
  return new AppError(message, HTTP_STATUS.BAD_REQUEST);
}

async function syncAppointmentFromEncounterCompletion(encounter: any, updatedBy: string, session?: ClientSession) {
  if (!encounter.appointmentId) {
    return null;
  }

  const appointment = await Appointment.findOne({
    _id: encounter.appointmentId,
    isDeleted: false,
    active: true,
  }).session(session ?? null);

  if (!appointment) {
    return null;
  }

  const checkOutTime = normalizeDate(encounter.endTime) ?? new Date();
  const previousStatus = appointment.appointmentStatus;
  const nextStatus = 'Completed';

  appointment.appointmentStatus = nextStatus;
  appointment.checkInStatus = 'Checked Out';
  appointment.checkOutTime = appointment.checkOutTime ?? checkOutTime;
  appointment.checkInTime =
    appointment.checkInTime ?? normalizeDate(encounter.startTime) ?? appointment.checkInTime;
  appointment.statusHistory =
    previousStatus !== nextStatus
      ? appendStatusHistory(
          appointment.statusHistory,
          nextStatus,
          updatedBy,
          'Encounter completed and visit handed off to charge capture'
        )
      : appointment.statusHistory;
  appointment.updatedBy = updatedBy as any;
  appointment.updated = new Date();

  await appointment.save({ session });
  return appointment;
}

function buildAiGatewayError(error: unknown) {
  const message = error instanceof Error ? error.message : 'AI coding request failed.';
  const normalizedMessage = message.trim() || 'AI coding request failed.';
  const statusCode = /timed out/i.test(normalizedMessage)
    ? HTTP_STATUS.GATEWAY_TIMEOUT
    : HTTP_STATUS.BAD_GATEWAY;

  return new AppError(normalizedMessage, statusCode);
}

function buildNoSuggestionFixes(
  suggestionFixes: string[],
  context: {
    hasProcedureReferenceContext: boolean;
  }
) {
  const nextFixes = [...suggestionFixes];

  if (!context.hasProcedureReferenceContext) {
    nextFixes.push(
      'No active charge master procedure candidates were available for this encounter context. Review your charge master setup.'
    );
  }

  if (!nextFixes.length) {
    nextFixes.push(
      'AI could not support a confident diagnosis or procedure suggestion from the current documentation. Add more clinical detail and try again.'
    );
  }

  return uniqueTextValues(nextFixes.map((value) => normalizeText(value)));
}

function normalizeCodeValue(value: unknown) {
  return normalizeText(value)?.toUpperCase();
}

function uniqueCodeValues(values: Array<string | undefined>) {
  const seenCodes = new Set<string>();
  const nextValues: string[] = [];

  values.forEach((value) => {
    const normalizedValue = normalizeCodeValue(value);

    if (!normalizedValue || seenCodes.has(normalizedValue)) {
      return;
    }

    seenCodes.add(normalizedValue);
    nextValues.push(normalizedValue);
  });

  return nextValues;
}

function uniqueTextValues(values: Array<string | undefined>) {
  const seenValues = new Set<string>();
  const nextValues: string[] = [];

  values.forEach((value) => {
    const normalizedValue = normalizeText(value);

    if (!normalizedValue) {
      return;
    }

    const dedupeKey = normalizedValue.toLowerCase();

    if (seenValues.has(dedupeKey)) {
      return;
    }

    seenValues.add(dedupeKey);
    nextValues.push(normalizedValue);
  });

  return nextValues;
}

function isNegativeCodingSentence(value: string) {
  return /\b(invalid|unsupported|not supported|not documented|contradicted|omitted|omit|remove|removed|do not|don't|not selected|not recommend|not recommended|existing codes?)\b/i.test(value);
}

function isConditionalCodingSentence(value: string) {
  return /\b(if|when|unless|consider|may|might|could|would|additional|alternative|instead|future|if additional)\b/i.test(value);
}

function splitSentences(value: string) {
  return value
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function collectAiResponseText(response: {
  summary?: string;
  suggestedFixes?: string[];
  validationResults?: Array<{
    code?: string;
    reasoning?: string;
    suggestedAlternative?: string;
  }>;
}) {
  return [
    ...splitSentences(response.summary ?? '').filter((sentence) => (
      !isNegativeCodingSentence(sentence) && !isConditionalCodingSentence(sentence)
    )),
  ]
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value))
    .join(' ');
}

function extractCodeValuesFromText(text: string, pattern: RegExp) {
  const matches = text.match(pattern) ?? [];
  return uniqueCodeValues(matches);
}

function tokenizeCodingText(value: unknown) {
  const normalizedValue = normalizeText(value)?.toLowerCase();
  if (!normalizedValue) {
    return [];
  }

  return normalizedValue
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4)
    .map((token) => token.slice(0, 8));
}

function scoreDescriptionAgainstNote(description: unknown, noteText: string) {
  const noteTokens = new Set(tokenizeCodingText(noteText));
  return tokenizeCodingText(description).reduce((score, token) => (
    noteTokens.has(token) ? score + 1 : score
  ), 0);
}

function isRadiographicDescription(value: unknown) {
  return /\b(radiograph|radiographic|x-?ray|image|images|periapical|bitewing|series)\b/i.test(normalizeText(value) ?? '');
}

function selectBetterRadiographicReference(
  currentReference: {
    code: string;
    description: string | undefined;
    placeOfService: string | undefined;
    defaultChargeAmount: number | undefined;
    modifiersAllowed: string[];
    diagnosisRestrictions: string[];
  },
  procedureReferenceContext: Array<{
    code: string;
    description: string | undefined;
    placeOfService: string | undefined;
    defaultChargeAmount: number | undefined;
    modifiersAllowed: string[];
    diagnosisRestrictions: string[];
  }>,
  noteText: string
) {
  if (!isRadiographicDescription(currentReference.description)) {
    return currentReference;
  }

  const currentScore = scoreDescriptionAgainstNote(currentReference.description, noteText);
  const betterReference = procedureReferenceContext
    .filter((item) => normalizeCodeValue(item.code))
    .filter((item) => isRadiographicDescription(item.description))
    .map((item) => ({
      item,
      score: scoreDescriptionAgainstNote(item.description, noteText),
    }))
    .filter((candidate) => candidate.score > currentScore)
    .sort((left, right) => right.score - left.score || String(left.item.code).localeCompare(String(right.item.code)))[0]?.item;

  return betterReference ?? currentReference;
}

function calculateAgeOnDate(dateOfBirth: unknown, referenceDate: unknown) {
  const dob = normalizeDate(dateOfBirth);
  const serviceDate = normalizeDate(referenceDate);

  if (!(dob instanceof Date) || Number.isNaN(dob.getTime()) || !(serviceDate instanceof Date) || Number.isNaN(serviceDate.getTime())) {
    return undefined;
  }

  let age = serviceDate.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = serviceDate.getUTCMonth() - dob.getUTCMonth();
  const dayDelta = serviceDate.getUTCDate() - dob.getUTCDate();

  if (monthDelta < 0 || (monthDelta === 0 && dayDelta < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : undefined;
}

function uniqueSuggestedCodes<T extends {
  code: string;
  confidence: number;
}>(values: T[]) {
  const suggestionByCode = new Map<string, T>();

  values.forEach((value) => {
    const normalizedCode = normalizeCodeValue(value.code);

    if (!normalizedCode) {
      return;
    }

    const normalizedValue = {
      ...value,
      code: normalizedCode,
    };
    const existingValue = suggestionByCode.get(normalizedCode);

    if (!existingValue || normalizedValue.confidence >= existingValue.confidence) {
      suggestionByCode.set(normalizedCode, normalizedValue);
    }
  });

  return Array.from(suggestionByCode.values());
}

async function loadProcedureReferenceContext(candidate: {
  noteContext: string;
  appointmentType?: string;
  visitType?: string;
  appointmentReason?: string;
  providerSpecialty?: string;
  placeOfServiceCode?: string;
  serviceDate?: Date;
}) {
  const activeChargeMasters = await chargeMasterService.listApplicableProcedureCandidates({
    serviceDate: candidate.serviceDate,
    placeOfService: candidate.placeOfServiceCode,
  });

  return activeChargeMasters.map((item) => ({
    code: normalizeText(item.cptCode)?.toUpperCase() ?? '',
    description: normalizeText(item.description),
    placeOfService: normalizeText(item.placeOfService),
    defaultChargeAmount: typeof item.defaultChargeAmount === 'number' ? item.defaultChargeAmount : undefined,
    modifiersAllowed: Array.isArray(item.modifiersAllowed) ? item.modifiersAllowed.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())) : [],
    diagnosisRestrictions: Array.isArray(item.diagnosisRestrictions) ? item.diagnosisRestrictions.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())) : [],
  })).filter((item) => item.code);
}

function buildProcedureReferenceContextItem(item: any) {
  return {
    code: normalizeText(item.cptCode)?.toUpperCase() ?? '',
    description: normalizeText(item.description),
    placeOfService: normalizeText(item.placeOfService),
    defaultChargeAmount: typeof item.defaultChargeAmount === 'number' ? item.defaultChargeAmount : undefined,
    modifiersAllowed: Array.isArray(item.modifiersAllowed) ? item.modifiersAllowed.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())) : [],
    diagnosisRestrictions: Array.isArray(item.diagnosisRestrictions) ? item.diagnosisRestrictions.filter((value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())) : [],
  };
}

async function expandProcedureReferenceContextForSuggestions(
  procedureSuggestions: Array<{ code: string }>,
  procedureReferenceContext: Array<{
    code: string;
    description: string | undefined;
    placeOfService: string | undefined;
    defaultChargeAmount: number | undefined;
    modifiersAllowed: string[];
    diagnosisRestrictions: string[];
  }>
) {
  const referenceByCode = new Map(
    procedureReferenceContext.map((item) => [normalizeCodeValue(item.code), item])
  );
  const recoveredCodes: string[] = [];

  for (const suggestion of procedureSuggestions) {
    const normalizedCode = normalizeCodeValue(suggestion.code);

    if (!normalizedCode || referenceByCode.has(normalizedCode)) {
      continue;
    }

    const chargeMasterEntry = await chargeMasterService.getByCptCode(normalizedCode, 'en');

    if (!chargeMasterEntry) {
      continue;
    }

    const referenceItem = buildProcedureReferenceContextItem(chargeMasterEntry);
    if (!referenceItem.code) {
      continue;
    }

    referenceByCode.set(referenceItem.code, referenceItem);
    recoveredCodes.push(referenceItem.code);
  }

  return {
    procedureReferenceContext: Array.from(referenceByCode.values()),
    recoveredCodes,
  };
}

async function recoverProcedureSuggestionsFromAiText(
  aiText: string,
  noteText: string,
  existingProcedureSuggestions: Array<{
    code: string;
    description: string;
    confidence: number;
    reasoning: string;
    units?: number;
  }>,
  procedureReferenceContext: Array<{
    code: string;
    description: string | undefined;
    placeOfService: string | undefined;
    defaultChargeAmount: number | undefined;
    modifiersAllowed: string[];
    diagnosisRestrictions: string[];
  }>
) {
  const existingCodes = new Set(existingProcedureSuggestions.map((suggestion) => normalizeCodeValue(suggestion.code)));
  const referenceByCode = new Map(
    procedureReferenceContext.map((item) => [normalizeCodeValue(item.code), item])
  );
  const recoveredSuggestions: Array<{
    code: string;
    description: string;
    confidence: number;
    reasoning: string;
    units: number;
  }> = [];
  const recoveredReferences = new Map(referenceByCode);

  for (const code of extractCodeValuesFromText(aiText, PROCEDURE_CODE_PATTERN)) {
    if (existingCodes.has(code)) {
      continue;
    }

    let reference = recoveredReferences.get(code);

    if (!reference) {
      const chargeMasterEntry = await chargeMasterService.getByCptCode(code, 'en');

      if (!chargeMasterEntry) {
        continue;
      }

      reference = buildProcedureReferenceContextItem(chargeMasterEntry);
      recoveredReferences.set(code, reference);
    }

    const selectedReference = selectBetterRadiographicReference(reference, Array.from(recoveredReferences.values()), noteText);
    const selectedCode = normalizeCodeValue(selectedReference.code);

    if (!selectedCode || existingCodes.has(selectedCode)) {
      continue;
    }

    recoveredReferences.set(selectedCode, selectedReference);
    recoveredSuggestions.push({
      code: selectedCode,
      description: normalizeText(selectedReference.description) ?? '',
      confidence: 0.74,
      reasoning: 'Recovered from AI recommendation text and confirmed against active Charge Master by code.',
      units: 1,
    });
    existingCodes.add(selectedCode);
  }

  return {
    procedureCodes: uniqueSuggestedCodes([...existingProcedureSuggestions, ...recoveredSuggestions]),
    procedureReferenceContext: Array.from(recoveredReferences.values()),
    recoveredCodes: recoveredSuggestions.map((suggestion) => suggestion.code),
  };
}

function constrainProcedureSuggestionsToChargeMaster(
  procedureSuggestions: Array<{
    code: string;
    description: string;
    confidence: number;
    reasoning: string;
    units?: number;
  }>,
  procedureReferenceContext: Array<{
    code: string;
    description?: string;
  }>
) {
  const referenceByCode = new Map(
    procedureReferenceContext.map((item) => [normalizeCodeValue(item.code), item])
  );

  if (!referenceByCode.size) {
    return [];
  }

  return procedureSuggestions
    .map((suggestion) => {
      const normalizedCode = normalizeCodeValue(suggestion.code);
      const reference = normalizedCode ? referenceByCode.get(normalizedCode) : undefined;

      if (!normalizedCode || !reference) {
        return null;
      }

      return {
        ...suggestion,
        code: normalizedCode,
        description: normalizeText(reference.description) ?? normalizeText(suggestion.description) ?? '',
        reasoning: normalizeText(suggestion.reasoning)
          ?? 'Selected from the active applicable Charge Master entries. Review required documentation before charge capture.',
        units: typeof suggestion.units === 'number' && suggestion.units > 0 ? suggestion.units : 1,
      };
    })
    .filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion));
}

function constrainDiagnosisSuggestionsToChargeMaster(
  diagnosisSuggestions: Array<{
    code: string;
    description: string;
    confidence: number;
    reasoning: string;
  }>,
  procedureSuggestions: Array<{
    code: string;
  }>,
  procedureReferenceContext: Array<{
    code: string;
    diagnosisRestrictions?: string[];
  }>
) {
  const selectedProcedureCodes = new Set(
    procedureSuggestions
      .map((suggestion) => normalizeCodeValue(suggestion.code))
      .filter((code): code is string => Boolean(code))
  );
  const allowedDiagnosisCodes = new Set(
    procedureReferenceContext
      .filter((item) => {
        const normalizedProcedureCode = normalizeCodeValue(item.code);
        return normalizedProcedureCode ? selectedProcedureCodes.has(normalizedProcedureCode) : false;
      })
      .flatMap((item) => item.diagnosisRestrictions ?? [])
      .map((code) => normalizeCodeValue(code))
      .filter((code): code is string => Boolean(code))
  );

  if (!allowedDiagnosisCodes.size) {
    return [];
  }

  return diagnosisSuggestions
    .map((suggestion) => {
      const normalizedCode = normalizeCodeValue(suggestion.code);

      if (!normalizedCode || !allowedDiagnosisCodes.has(normalizedCode)) {
        return null;
      }

      return {
        ...suggestion,
        code: normalizedCode,
      };
    })
    .filter((suggestion): suggestion is NonNullable<typeof suggestion> => Boolean(suggestion));
}

function normalizeEncounterData(data: any) {
  const normalizedData = { ...data };

  if (data.encounterDate !== undefined) {
    normalizedData.encounterDate = normalizeDate(data.encounterDate);
  }

  if (data.startTime !== undefined) {
    normalizedData.startTime = normalizeDate(data.startTime);
  }

  if (data.endTime !== undefined) {
    normalizedData.endTime = normalizeDate(data.endTime);
  }

  if (data.visitStatus !== undefined) {
    normalizedData.visitStatus = normalizeText(data.visitStatus);
  }

  if (data.chiefComplaint !== undefined) {
    normalizedData.chiefComplaint = normalizeText(data.chiefComplaint);
  }

  if (data.historyOfPresentIllness !== undefined) {
    normalizedData.historyOfPresentIllness = normalizeText(data.historyOfPresentIllness);
  }

  if (data.clinicalNotes !== undefined) {
    normalizedData.clinicalNotes = normalizeText(data.clinicalNotes);
  }

  if (data.diagnosisCodes !== undefined) {
    normalizedData.diagnosisCodes = normalizeStringArray(data.diagnosisCodes);
  }

  if (data.procedureCodes !== undefined) {
    normalizedData.procedureCodes = normalizeStringArray(data.procedureCodes);
  }

  if (data.procedureCodeUnits !== undefined) {
    normalizedData.procedureCodeUnits = normalizeProcedureCodeUnits(data.procedureCodeUnits);
  }

  if (data.vitals) {
    normalizedData.vitals = {
      ...data.vitals,
      bloodPressure: normalizeText(data.vitals.bloodPressure),
    };
  }

  if (data.checkout) {
    normalizedData.checkout = {
      ...data.checkout,
      checkOutTime: normalizeDate(data.checkout.checkOutTime),
      followUpInstructions: normalizeText(data.checkout.followUpInstructions),
    };
  }

  return normalizedData;
}

function mergeEncounterState(currentItem: any, nextData: any) {
  return {
    ...currentItem,
    ...nextData,
    diagnosisCodes: nextData.diagnosisCodes ?? currentItem.diagnosisCodes ?? [],
    procedureCodes: nextData.procedureCodes ?? currentItem.procedureCodes ?? [],
    procedureCodeUnits: nextData.procedureCodeUnits ?? currentItem.procedureCodeUnits ?? {},
    vitals: {
      ...(currentItem.vitals ?? {}),
      ...(nextData.vitals ?? {}),
    },
    checkout: {
      ...(currentItem.checkout ?? {}),
      ...(nextData.checkout ?? {}),
    },
  };
}

function buildChiefComplaintFromAppointment(appointment: any) {
  return normalizeText(appointment?.reason)
    ?? normalizeText(appointment?.visitType)
    ?? normalizeText(appointment?.appointmentType)
    ?? 'Scheduled visit';
}

function buildClinicalNotesFromAppointment(appointment: any) {
  const notes = normalizeText(appointment?.notes);

  if (!notes) {
    return undefined;
  }

  return notes;
}

function validateEncounterState(candidate: any) {
  if (!candidate.patientId || !candidate.providerId || !candidate.facilityId) {
    throw buildValidationError('Patient, provider, and facility are required for an encounter.');
  }

  if (!(candidate.encounterDate instanceof Date) || Number.isNaN(candidate.encounterDate.getTime())) {
    throw buildValidationError('Encounter date is required.');
  }

  if (!(candidate.startTime instanceof Date) || Number.isNaN(candidate.startTime.getTime())) {
    throw buildValidationError('Encounter start time is required.');
  }

  if (!candidate.visitStatus || !ENCOUNTER_VISIT_STATUS_OPTIONS.includes(candidate.visitStatus)) {
    throw buildValidationError('Encounter visit status is invalid.');
  }

  if (!candidate.chiefComplaint) {
    throw buildValidationError('Chief complaint is required.');
  }

  if (
    ['Provider Completed', 'Completed', 'Checked Out', 'Ready for Charge Capture'].includes(candidate.visitStatus)
      && !candidate.endTime
  ) {
    throw buildValidationError('Encounter end time is required once the encounter is completed.');
  }

  if (
    ['Provider Completed', 'Completed', 'Checked Out', 'Ready for Charge Capture'].includes(candidate.visitStatus)
      && !candidate.clinicalNotes
  ) {
    throw buildValidationError('Clinical notes are required before the encounter can be completed.');
  }

  if (
    ['Provider Completed', 'Completed', 'Checked Out', 'Ready for Charge Capture'].includes(candidate.visitStatus)
      && (!candidate.diagnosisCodes || !candidate.diagnosisCodes.length)
  ) {
    throw buildValidationError('At least one diagnosis code is required before the encounter can be completed.');
  }

  if (
    ['Provider Completed', 'Completed', 'Checked Out', 'Ready for Charge Capture'].includes(candidate.visitStatus)
      && (!candidate.procedureCodes || !candidate.procedureCodes.length)
  ) {
    throw buildValidationError('At least one procedure code is required before the encounter can be completed.');
  }

  if (candidate.checkout?.followUpRequired && !candidate.checkout?.followUpInstructions) {
    throw buildValidationError('Follow-up instructions are required when follow-up is marked as required.');
  }
}

function assertManualEncounterWorkflowStatusAllowed(
  previousEncounter: any,
  nextEncounter: any
) {
  const previousVisitStatus = previousEncounter?.visitStatus;
  const nextVisitStatus = nextEncounter?.visitStatus;

  if (
    nextVisitStatus
    && nextVisitStatus !== previousVisitStatus
    && SYSTEM_MANAGED_ENCOUNTER_COMPLETION_STATUSES.has(nextVisitStatus)
  ) {
    throw buildValidationError(
      'Use the Complete Encounter workflow action instead of manually setting this encounter status.'
    );
  }
}

async function validateEncounterReferences(candidate: any) {
  const [patient, provider, facility] = await Promise.all([
    Patient.findOne({ _id: candidate.patientId, isDeleted: false, active: true }),
    Provider.findOne({ _id: candidate.providerId, isDeleted: false, active: true }),
    Facility.findOne({ _id: candidate.facilityId, isDeleted: false, active: true }),
  ]);

  if (!patient) {
    throw buildValidationError('Encounter patient must reference an active patient.');
  }

  if (!provider) {
    throw buildValidationError('Encounter provider must reference an active provider.');
  }

  if (!facility) {
    throw buildValidationError('Encounter facility must reference an active facility.');
  }
}

export const encounterService = {
  async create(data: any, locale: string, createdBy: string) {
    const normalizedData = normalizeEncounterData(data);
    const candidate = {
      ...normalizedData,
      diagnosisCodes: normalizedData.diagnosisCodes ?? [],
      procedureCodes: normalizedData.procedureCodes ?? [],
      procedureCodeUnits: normalizedData.procedureCodeUnits ?? {},
      vitals: normalizedData.vitals ?? {},
      checkout: {
        followUpRequired: false,
        ...(normalizedData.checkout ?? {}),
      },
      visitStatus: normalizedData.visitStatus ?? 'Created',
    };

    assertManualEncounterWorkflowStatusAllowed(undefined, candidate);
    validateEncounterState(candidate);
    await validateEncounterReferences(candidate);

    const item = await Encounter.create({
      ...candidate,
      statusHistory: appendStatusHistory(undefined, candidate.visitStatus, createdBy, 'Encounter created'),
      active: normalizedData.active ?? true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    });

    return item;
  },

  async createFromAppointment(appointment: any, locale: string, createdBy: string, options: { session?: ClientSession } = {}) {
    const session = options.session;
    const existingEncounter = await Encounter.findOne({
      appointmentId: appointment._id,
      isDeleted: false,
    }).session(session ?? null);

    if (existingEncounter) {
      return existingEncounter;
    }

    const encounterDate = normalizeDate(appointment.appointmentDate) ?? new Date();
    const startTime = normalizeDate(appointment.checkInTime) ?? new Date();
    const chiefComplaint = buildChiefComplaintFromAppointment(appointment);
    const clinicalNotes = buildClinicalNotesFromAppointment(appointment);
    const insurancePolicySnapshot = await buildInsurancePolicySnapshot(
      appointment.patientId,
      encounterDate,
      session
    );

    const [item] = await Encounter.create([{
      appointmentId: appointment._id,
      patientId: appointment.patientId,
      providerId: appointment.providerId,
      renderingProviderId: appointment.providerId,
      facilityId: appointment.facilityId,
      encounterDate,
      startTime,
      visitStatus: 'In Progress',
      chiefComplaint,
      clinicalNotes,
      diagnosisCodes: [],
      procedureCodes: [],
      procedureCodeUnits: {},
      insurancePolicySnapshot,
      checkout: { followUpRequired: false },
      statusHistory: appendStatusHistory(undefined, 'In Progress', createdBy, 'Auto-created from appointment check-in'),
      active: true,
      created: new Date(),
      updated: new Date(),
      createdBy,
    }], { session });

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await Encounter.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('encounter.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async suggestAiCodes(
    id: string,
    locale: string,
    updatedBy: string,
    options?: {
      applySuggestions?: boolean;
      replaceExistingCodes?: boolean;
      appointmentId?: string;
      patientId?: string;
      providerId?: string;
      renderingProviderId?: string;
      supervisingProviderId?: string;
      facilityId?: string;
      encounterDate?: Date | string;
      startTime?: Date | string;
      endTime?: Date | string;
      visitStatus?: string;
      chiefComplaint?: string;
      historyOfPresentIllness?: string;
      clinicalNotes?: string;
      diagnosisCodes?: string[];
      procedureCodes?: string[];
      procedureCodeUnits?: Record<string, number>;
      vitals?: Record<string, unknown>;
      checkout?: Record<string, unknown>;
      active?: boolean;
    }
  ) {
    const item = await this.getById(id, locale);
    const draftInput = Object.fromEntries(
      Object.entries({
        appointmentId: options?.appointmentId,
        patientId: options?.patientId,
        providerId: options?.providerId,
        renderingProviderId: options?.renderingProviderId,
        supervisingProviderId: options?.supervisingProviderId,
        facilityId: options?.facilityId,
        encounterDate: options?.encounterDate,
        startTime: options?.startTime,
        endTime: options?.endTime,
        visitStatus: options?.visitStatus,
        chiefComplaint: options?.chiefComplaint,
        historyOfPresentIllness: options?.historyOfPresentIllness,
        clinicalNotes: options?.clinicalNotes,
        diagnosisCodes: options?.diagnosisCodes,
        procedureCodes: options?.procedureCodes,
        procedureCodeUnits: options?.procedureCodeUnits,
        vitals: options?.vitals,
        checkout: options?.checkout,
        active: options?.active,
      }).filter(([, value]) => value !== undefined)
    );
    const draftData = normalizeEncounterData(draftInput);
    const candidate = mergeEncounterState(item.toObject(), draftData);
    const providerReferenceId = candidate.renderingProviderId ?? candidate.providerId;
    const [appointment, patient, provider, facility] = await Promise.all([
      candidate.appointmentId
        ? Appointment.findOne({ _id: candidate.appointmentId, isDeleted: false, active: true }).lean()
        : Promise.resolve(null),
      candidate.patientId
        ? Patient.findOne({ _id: candidate.patientId, isDeleted: false, active: true }).lean()
        : Promise.resolve(null),
      providerReferenceId
        ? Provider.findOne({ _id: providerReferenceId, isDeleted: false, active: true }).lean()
        : Promise.resolve(null),
      candidate.facilityId
        ? Facility.findOne({ _id: candidate.facilityId, isDeleted: false, active: true }).lean()
        : Promise.resolve(null),
    ]);
    const noteContext = normalizeText(candidate.clinicalNotes);

    if (!noteContext) {
      throw buildValidationError(
        'Clinical notes are required before AI can suggest diagnosis and procedure codes.'
      );
    }

    const serviceDate = normalizeDate(candidate.encounterDate)
      ?? normalizeDate(appointment?.appointmentStart)
      ?? normalizeDate(appointment?.appointmentDate)
      ?? normalizeDate(new Date());
    const appointmentType = normalizeText(appointment?.appointmentType);
    const visitType = normalizeText(appointment?.visitType);
    const appointmentReason = normalizeText(appointment?.reason);
    const providerSpecialty = normalizeText(provider?.specialty);
    const placeOfServiceCode = normalizeText(facility?.placeOfServiceCode);
    let procedureReferenceContext = await loadProcedureReferenceContext({
      noteContext,
      appointmentType,
      visitType,
      appointmentReason,
      providerSpecialty,
      placeOfServiceCode,
      serviceDate,
    });

    let suggestionResponse;

    try {
      suggestionResponse = await rcmAiService.suggestEncounterCodes({
        encounterNote: noteContext,
        chiefComplaint: normalizeText(candidate.chiefComplaint),
        historyOfPresentIllness: normalizeText(candidate.historyOfPresentIllness),
        clinicalNotes: normalizeText(candidate.clinicalNotes),
        appointmentType,
        visitType,
        appointmentReason,
        appointmentNotes: normalizeText(appointment?.notes),
        serviceDate: formatDateForAi(serviceDate),
        patientAge: calculateAgeOnDate(patient?.dateOfBirth, serviceDate),
        patientGender: normalizeText(patient?.gender),
        patientSex: normalizeText(patient?.sex),
        providerSpecialty,
        providerCredentials: normalizeText(provider?.credentials),
        providerType: normalizeText(provider?.providerType),
        facilityName: normalizeText(facility?.facilityName),
        placeOfServiceCode,
        vitals: {
          temperature: candidate.vitals?.temperature,
          bloodPressure: normalizeText(candidate.vitals?.bloodPressure),
          pulse: candidate.vitals?.pulse,
          height: candidate.vitals?.height,
          weight: candidate.vitals?.weight,
          bmi: candidate.vitals?.bmi,
        },
        procedureReferenceContext,
        existingDiagnosisCodes: candidate.diagnosisCodes ?? [],
        existingProcedureCodes: candidate.procedureCodes ?? [],
      });
    } catch (error) {
      throw buildAiGatewayError(error);
    }

    const aiResponseText = collectAiResponseText(suggestionResponse);
    const recoveredProcedureSuggestions = await recoverProcedureSuggestionsFromAiText(
      aiResponseText,
      noteContext,
      suggestionResponse.procedureCodes,
      procedureReferenceContext
    );
    suggestionResponse = {
      ...suggestionResponse,
      procedureCodes: recoveredProcedureSuggestions.procedureCodes,
    };
    procedureReferenceContext = recoveredProcedureSuggestions.procedureReferenceContext;

    const expandedProcedureContext = await expandProcedureReferenceContextForSuggestions(
      suggestionResponse.procedureCodes,
      procedureReferenceContext
    );
    procedureReferenceContext = expandedProcedureContext.procedureReferenceContext;

    const rawProcedureSuggestionCount = suggestionResponse.procedureCodes.length;
    const chargeMasterProcedureSuggestions = constrainProcedureSuggestionsToChargeMaster(
      suggestionResponse.procedureCodes,
      procedureReferenceContext
    );
    const droppedProcedureSuggestionCount = rawProcedureSuggestionCount - chargeMasterProcedureSuggestions.length;
    suggestionResponse = {
      ...suggestionResponse,
      procedureCodes: chargeMasterProcedureSuggestions,
    };

    const constrainedDiagnosisSuggestions = constrainDiagnosisSuggestionsToChargeMaster(
      suggestionResponse.diagnosisCodes,
      suggestionResponse.procedureCodes,
      procedureReferenceContext
    );
    const droppedDiagnosisSuggestionCount =
      suggestionResponse.diagnosisCodes.length - constrainedDiagnosisSuggestions.length;

    suggestionResponse = {
      ...suggestionResponse,
      diagnosisCodes: uniqueSuggestedCodes(constrainedDiagnosisSuggestions),
    };

    if (
      !procedureReferenceContext.length
      || droppedProcedureSuggestionCount > 0
      || droppedDiagnosisSuggestionCount > 0
      || recoveredProcedureSuggestions.recoveredCodes.length > 0
      || expandedProcedureContext.recoveredCodes.length > 0
    ) {
      suggestionResponse.suggestedFixes = uniqueTextValues([
        ...suggestionResponse.suggestedFixes,
        !procedureReferenceContext.length
          ? 'No active charge master procedure candidates were available for this encounter context. Review your charge master setup.'
          : undefined,
        expandedProcedureContext.recoveredCodes.length > 0
          ? `Some AI procedure suggestions were found in active Charge Master outside the initial encounter filter (${expandedProcedureContext.recoveredCodes.join(', ')}). Review facility place of service and Charge Master POS setup.`
          : undefined,
        recoveredProcedureSuggestions.recoveredCodes.length > 0
          ? `Recovered AI-mentioned procedure codes after confirming them in active Charge Master (${recoveredProcedureSuggestions.recoveredCodes.join(', ')}).`
          : undefined,
        droppedProcedureSuggestionCount > 0
          ? 'Some AI procedure suggestions were omitted because they are not active in the applicable charge master.'
          : undefined,
        droppedDiagnosisSuggestionCount > 0
          ? 'Some AI diagnosis suggestions were omitted because they are not configured as diagnosis restrictions for the selected charge master entries.'
          : undefined,
      ]);
    }

    const suggestedDiagnosisCodes = uniqueCodeValues(
      suggestionResponse.diagnosisCodes.map((suggestion) => suggestion.code)
    );
    const suggestedProcedureCodes = uniqueCodeValues(
      suggestionResponse.procedureCodes.map((suggestion) => suggestion.code)
    );

    const applySuggestions = options?.applySuggestions === true;
    const replaceExistingCodes = Boolean(options?.replaceExistingCodes);
    const hasSuggestions = suggestedDiagnosisCodes.length > 0 || suggestedProcedureCodes.length > 0;
    const suggestedFixes = hasSuggestions
      ? suggestionResponse.suggestedFixes
      : buildNoSuggestionFixes(suggestionResponse.suggestedFixes, {
          hasProcedureReferenceContext: procedureReferenceContext.length > 0,
        });
    const responseSummary = hasSuggestions
      ? suggestionResponse.summary
      : suggestionResponse.summary
        ?? 'AI reviewed the encounter but could not support a confident diagnosis or procedure code suggestion yet.';

    let appliedDiagnosisCodes: string[] = [];
    let appliedProcedureCodes: string[] = [];
    let appliedProcedureCodeUnits = normalizeProcedureCodeUnits(candidate.procedureCodeUnits) ?? {};

    if (applySuggestions && hasSuggestions) {
      const nextSuggestedProcedureUnits = suggestionResponse.procedureCodes.reduce<Record<string, number>>(
        (accumulator, suggestion) => {
          const normalizedCode = normalizeCodeValue(suggestion.code);

          if (!normalizedCode) {
            return accumulator;
          }

          accumulator[normalizedCode] =
            typeof suggestion.units === 'number' && suggestion.units > 0 ? suggestion.units : 1;
          return accumulator;
        },
        {}
      );

      appliedDiagnosisCodes = replaceExistingCodes
        ? suggestedDiagnosisCodes
        : uniqueCodeValues([...(candidate.diagnosisCodes ?? []), ...suggestedDiagnosisCodes]);
      appliedProcedureCodes = replaceExistingCodes
        ? suggestedProcedureCodes
        : uniqueCodeValues([...(candidate.procedureCodes ?? []), ...suggestedProcedureCodes]);
      appliedProcedureCodeUnits = replaceExistingCodes
        ? nextSuggestedProcedureUnits
        : {
            ...appliedProcedureCodeUnits,
            ...nextSuggestedProcedureUnits,
          };

      item.diagnosisCodes = appliedDiagnosisCodes;
      item.procedureCodes = appliedProcedureCodes;
      item.procedureCodeUnits = appliedProcedureCodeUnits;
      item.updatedBy = updatedBy;
      item.updated = new Date();

      await item.save();
    }

    return {
      encounter: item,
      suggestions: {
        status: hasSuggestions
          ? suggestionResponse.status === 'no_suggestions'
            ? 'success'
            : suggestionResponse.status
          : 'no_suggestions',
        summary: responseSummary,
        diagnosisCodes: suggestionResponse.diagnosisCodes,
        procedureCodes: suggestionResponse.procedureCodes,
        validationResults: suggestionResponse.validationResults,
        suggestedFixes,
        appliedDiagnosisCodes,
        appliedProcedureCodes,
        applySuggestions: applySuggestions && hasSuggestions,
        replaceExistingCodes,
      },
    };
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await Encounter.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('encounter.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const previousStatus = item.visitStatus;
    const normalizedData = normalizeEncounterData(data);
    const candidate = mergeEncounterState(item.toObject(), normalizedData);

    assertManualEncounterWorkflowStatusAllowed(item.toObject(), candidate);
    validateEncounterState(candidate);
    await validateEncounterReferences(candidate);

    Object.assign(item, {
      ...normalizedData,
      statusHistory:
        normalizedData.visitStatus && normalizedData.visitStatus !== previousStatus
          ? appendStatusHistory(item.statusHistory, normalizedData.visitStatus, updatedBy, 'Encounter updated')
          : item.statusHistory,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    return item;
  },

  async complete(id: string, locale: string, updatedBy: string) {
    return withMongoTransaction(async (session) => {
    const item = await Encounter.findOne({ _id: id, isDeleted: false }).session(session);

    if (!item) {
      throw new AppError(t('encounter.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const completionCandidate = {
      ...item.toObject(),
      visitStatus: 'Completed',
      endTime: item.endTime ?? new Date(),
    };

    validateEncounterState(completionCandidate);
    await validateEncounterReferences(completionCandidate);
    await chargeService.prepareDraftFromEncounterData(completionCandidate, locale);

    if (!item.insurancePolicySnapshot?.insurancePolicyId) {
      item.insurancePolicySnapshot = await buildInsurancePolicySnapshot(
        item.patientId,
        item.encounterDate,
        session
      ) as any;
    }

    item.visitStatus = 'Completed';
    item.endTime = completionCandidate.endTime;
    item.statusHistory = appendStatusHistory(
      item.statusHistory,
      item.visitStatus,
      updatedBy,
      'Encounter completed'
    );
    item.updatedBy = updatedBy;
    item.updated = new Date();

    await item.save({ session });
    await syncAppointmentFromEncounterCompletion(item, updatedBy, session);

    const charge = await chargeService.createFromEncounter(String(item._id), locale, updatedBy, { session });

    return {
      encounter: item,
      charge,
    };
    });
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const existingItem = await Encounter.findOne({ _id: id, isDeleted: false });

    if (!existingItem) {
      throw new AppError(t('encounter.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const linkedCharge = await Charge.findOne({
      encounterId: id,
      isDeleted: false,
      active: true,
    }).select('_id').lean();

    if (existingItem.appointmentId) {
      throw buildValidationError(
        'Appointment-linked encounters cannot be deleted. Continue the encounter workflow or correct the downstream charge instead.'
      );
    }

    if (linkedCharge || ['Completed', 'Checked Out', 'Ready for Charge Capture'].includes(existingItem.visitStatus ?? '')) {
      throw buildValidationError(
        'Completed or charge-linked encounters cannot be deleted. Void or correct the downstream charge instead.'
      );
    }

    const item = await Encounter.findOneAndUpdate(
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
      throw new AppError(t('encounter.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
