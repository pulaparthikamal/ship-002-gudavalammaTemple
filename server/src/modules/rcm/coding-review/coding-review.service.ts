import { CodingReview } from './coding-review.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { appendStatusHistory } from '../workflow/workflow-history';
import { Charge } from '../charge/charge.model';
import { Encounter } from '../encounter/encounter.model';
import { Facility } from '../facility/facility.model';
import { InsurancePolicy } from '../insurance-policy/insurance-policy.model';
import { rcmAiService } from '../workflow/rcm-ai.service';
import { claimService } from '../claim/claim.service';
import { patientBillingService } from '../patient-billing/patient-billing.service';
import { chargeMasterService } from '../charge-master/charge-master.service';
import { ruleService } from '../rule/rule.service';
import { withMongoTransaction } from '../../../utils/mongoose-transaction.util';
import type { ClientSession } from 'mongoose';

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

function dateTime(value: unknown) {
  const parsedDate = normalizeDate(value);
  return parsedDate?.getTime();
}

function buildValidationError(message: string) {
  return new AppError(message, HTTP_STATUS.BAD_REQUEST);
}

function normalizeUpperStringSet(values: unknown[]) {
  return new Set(
    values
      .map((value) => normalizeText(value)?.toUpperCase())
      .filter((value): value is string => Boolean(value))
  );
}

function normalizeCode(value: unknown) {
  return normalizeText(value)?.toUpperCase();
}

function codeMatchesRule(rule: any, code?: string) {
  const normalizedCode = normalizeCode(code);
  if (!normalizedCode) {
    return false;
  }

  return normalizeCode(rule.code) === normalizedCode
    || (Array.isArray(rule.codes) && rule.codes.map(normalizeCode).includes(normalizedCode));
}

function hasPayerRuleRequiredField(field: string, context: { charge: any; encounter: any; line: any }) {
  const normalizedField = field.trim().toLowerCase();

  switch (normalizedField) {
    case 'clinicalnotes':
    case 'clinical_notes':
      return Boolean(normalizeText(context.encounter?.clinicalNotes));
    case 'diagnosiscodes':
    case 'diagnosis_codes':
      return Boolean(context.line?.icdCodes?.length || context.encounter?.diagnosisCodes?.length);
    case 'renderingprovider':
    case 'rendering_provider':
    case 'renderingproviderid':
      return Boolean(context.line?.renderingProviderId || context.charge?.providerId);
    case 'placeofservice':
    case 'place_of_service':
      return Boolean(normalizeText(context.charge?.placeOfService));
    case 'modifiers':
      return Boolean(context.line?.modifiers?.length);
    case 'documentationcomplete':
    case 'documentation_complete':
      return Boolean(context.charge?.documentationComplete);
    default:
      return Boolean(context.line?.[field] ?? context.charge?.[field] ?? context.encounter?.[field]);
  }
}

async function buildCodingReviewFromCharge(
  charge: any,
  encounter: any,
  facility: any,
  policy: any,
  locale: string
) {
  const validationErrors: string[] = [];
  const modifierIssues: string[] = [];
  const payerSpecificRuleFailures: string[] = [];
  const aiSuggestedCodes: string[] = [];
  const aiSuggestedFixes: string[] = [];
  const resolvedPlaceOfService =
    normalizeText(charge.placeOfService)
    ?? normalizeText(facility?.placeOfServiceCode);

  let missingDocumentationFlag = false;
  let icdCptMismatchFlag = false;
  let ncciEditFlag = false;
  let lcdNcdEditFlag = false;

  if (!facility) {
    validationErrors.push('Billing Facility is missing or inactive.');
    aiSuggestedFixes.push('Assign the charge to an active billing facility.');
  }

  // Expert Scrubbing Rule: Billing Entity Verification
  if (facility && (!facility.npi || !facility.taxId)) {
    validationErrors.push('Billing Facility is missing NPI or Tax ID.');
    aiSuggestedFixes.push('Update Facility profile with valid NPI and Tax ID.');
  }

  // Expert Scrubbing Rule: Coverage Verification
  if (!policy) {
    validationErrors.push('No active insurance policy found for this patient.');
    aiSuggestedFixes.push('Capture insurance information or route to Self-Pay.');
  } else if (!policy.memberId) {
    validationErrors.push('Insurance policy is missing Member ID.');
    aiSuggestedFixes.push('Update insurance policy with valid Member ID.');
  }

  if (!resolvedPlaceOfService) {
    validationErrors.push('Charge is missing place of service.');
    aiSuggestedFixes.push('Populate the place of service before claim creation.');
  }

  if (typeof charge.totalChargeAmount !== 'number' || charge.totalChargeAmount <= 0) {
    validationErrors.push('Charge total amount must be greater than zero.');
    aiSuggestedFixes.push('Recalculate the charge total from valid charge lines.');
  }

  if (!(charge.chargeLines ?? []).length) {
    validationErrors.push('Charge cannot be released to claim creation without at least one charge line.');
    aiSuggestedFixes.push('Add supported procedure charge lines before approving coding review.');
  }

  for (const [index, line] of (charge.chargeLines ?? []).entries()) {
    const lineNumber = line.lineNumber ?? index + 1;

    if (!line.icdCodes?.length) {
      validationErrors.push(`Charge line ${lineNumber} is missing diagnosis codes.`);
      aiSuggestedFixes.push(`Add ICD diagnosis codes to charge line ${lineNumber}.`);
    }

    if (!line.cptCode) {
      validationErrors.push(`Charge line ${lineNumber} is missing CPT code.`);
      aiSuggestedFixes.push(`Add a CPT code to charge line ${lineNumber}.`);
    }

    if (typeof line.units !== 'number' || line.units <= 0) {
      validationErrors.push(`Charge line ${lineNumber} is missing valid units.`);
      aiSuggestedFixes.push(`Update units on charge line ${lineNumber}.`);
    }

    if (typeof line.chargeAmount !== 'number' || line.chargeAmount <= 0) {
      validationErrors.push(`Charge line ${lineNumber} is missing a valid charge amount.`);
      aiSuggestedFixes.push(`Update the charge amount on line ${lineNumber}.`);
    }

    if (line.cptCode && line.icdCodes?.length && !line.icdPointers?.length) {
      icdCptMismatchFlag = true;
      validationErrors.push(`Charge line ${lineNumber} has CPT/ICD linkage missing ICD pointers.`);
      aiSuggestedFixes.push(`Review ICD pointers for charge line ${lineNumber}.`);
    }

    if ((line.modifiers ?? []).length > 4) {
      modifierIssues.push(`Charge line ${lineNumber} has too many modifiers.`);
      validationErrors.push(`Charge line ${lineNumber} has modifier issues.`);
    }

    if (line.cptCode) {
      const chargeMasterEntry = await chargeMasterService.getByCptCode(line.cptCode, locale, {
        serviceDate: charge.serviceDate ?? encounter?.encounterDate,
        placeOfService: resolvedPlaceOfService,
      });

      if (!chargeMasterEntry) {
        validationErrors.push(`No active charge master applies to charge line ${lineNumber} CPT ${line.cptCode}.`);
        aiSuggestedFixes.push(`Review charge master setup for charge line ${lineNumber} CPT ${line.cptCode}.`);
      } else {
        const allowedModifiers = Array.isArray(chargeMasterEntry.modifiersAllowed)
          ? chargeMasterEntry.modifiersAllowed
              .map((value: unknown) => normalizeText(value)?.toUpperCase())
              .filter((value: string | undefined): value is string => Boolean(value))
          : [];
        const invalidLineModifiers = (line.modifiers ?? [])
          .map((value: string) => normalizeText(value)?.toUpperCase())
          .filter((value: string | undefined): value is string => Boolean(value))
          .filter((value: string) => allowedModifiers.length > 0 && !allowedModifiers.includes(value));

        if (invalidLineModifiers.length) {
          modifierIssues.push(
            `Charge line ${lineNumber} contains modifiers not allowed by charge master: ${invalidLineModifiers.join(', ')}.`
          );
          validationErrors.push(`Charge line ${lineNumber} has modifier issues.`);
          aiSuggestedFixes.push(`Update modifiers on charge line ${lineNumber} to the allowed charge master set.`);
        }

        const diagnosisRestrictions = Array.isArray(chargeMasterEntry.diagnosisRestrictions)
          ? chargeMasterEntry.diagnosisRestrictions
              .map((value: unknown) => normalizeText(value)?.toUpperCase())
              .filter((value: string | undefined): value is string => Boolean(value))
          : [];
        const normalizedLineDiagnosisCodes = (line.icdCodes ?? [])
          .map((value: string) => normalizeText(value)?.toUpperCase())
          .filter((value: string | undefined): value is string => Boolean(value));

        if (
          diagnosisRestrictions.length > 0
          && normalizedLineDiagnosisCodes.length > 0
          && !normalizedLineDiagnosisCodes.some((code: string) => diagnosisRestrictions.includes(code))
        ) {
          lcdNcdEditFlag = true;
          validationErrors.push(
            [
              `Charge line ${lineNumber} CPT ${line.cptCode} diagnoses do not satisfy charge master diagnosis restrictions.`,
              `Current diagnoses: ${normalizedLineDiagnosisCodes.join(', ') || 'None'}.`,
              `Allowed diagnoses for this Charge Master entry: ${diagnosisRestrictions.join(', ') || 'None configured'}.`,
              chargeMasterEntry.description ? `Charge Master description: ${chargeMasterEntry.description}.` : undefined,
            ].filter(Boolean).join(' ')
          );
          aiSuggestedFixes.push(
            `Align charge line ${lineNumber} CPT ${line.cptCode} diagnosis coding with allowed diagnoses: ${diagnosisRestrictions.join(', ')}.`
          );
        }
      }

      const applicablePayerRules = await ruleService.findApplicable({
        payerIds: [policy?.payerId, policy?.ediPayerId].filter(Boolean),
        cptCode: line.cptCode,
        providerId: normalizeText(line.renderingProviderId?.toString?.()) ?? normalizeText(charge.providerId?.toString?.()),
        facilityId: normalizeText(charge.facilityId?.toString?.()),
        state: normalizeText(facility?.state),
        placeOfServiceCode: resolvedPlaceOfService,
        planName: normalizeText(policy?.planName),
        groupNumber: normalizeText(policy?.groupNumber),
        network: normalizeText(policy?.network),
        coverageType: normalizeText(policy?.coverageType),
        serviceDate: charge.serviceDate ?? encounter?.encounterDate,
      });

      for (const rule of applicablePayerRules) {
        if (!codeMatchesRule(rule, line.cptCode) && rule.code) {
          continue;
        }

        const isError = normalizeText(rule.severity)?.toLowerCase() === 'error';
        const ruleMessage = `Payer rule ${rule.ruleId}: ${rule.message}`;

        if (rule.type === 'missing_required') {
          const missingFields = (rule.requiredFields ?? []).filter(
            (field: string) => !hasPayerRuleRequiredField(field, { charge, encounter, line })
          );

          if (!missingFields.length) {
            continue;
          }

          const message = `${ruleMessage} Missing: ${missingFields.join(', ')}.`;
          payerSpecificRuleFailures.push(message);
          aiSuggestedFixes.push(`Resolve payer rule ${rule.ruleId}: add ${missingFields.join(', ')}.`);
          if (isError) validationErrors.push(message);
          continue;
        }

        if (rule.type === 'invalid_combination') {
          const ruleCodes = Array.isArray(rule.codes)
            ? rule.codes.map(normalizeCode).filter((code: string | undefined): code is string => Boolean(code))
            : [];
          const chargeCodes = (charge.chargeLines ?? [])
            .map((chargeLine: any) => normalizeCode(chargeLine.cptCode))
            .filter((code: string | undefined): code is string => Boolean(code));
          const allCodesPresent = ruleCodes.length > 1 && ruleCodes.every((code) => chargeCodes.includes(code));

          if (!allCodesPresent) {
            continue;
          }
        }

        payerSpecificRuleFailures.push(ruleMessage);
        aiSuggestedFixes.push(`Review payer rule ${rule.ruleId}: ${rule.message}`);
        if (isError) validationErrors.push(ruleMessage);
      }
    }
  }

  if (!charge.documentationComplete || !encounter?.clinicalNotes?.trim()) {
    missingDocumentationFlag = true;
    validationErrors.push('Clinical documentation is incomplete for this charge.');
    aiSuggestedFixes.push('Complete clinical notes before claim creation.');
  }

  if (!encounter?.diagnosisCodes?.length) {
    missingDocumentationFlag = true;
    validationErrors.push('Encounter diagnosis codes are missing.');
    aiSuggestedFixes.push('Add diagnosis codes to the encounter documentation.');
  }

  if ((charge.chargeLines ?? []).length > 8) {
    ncciEditFlag = true;
    validationErrors.push('Charge has a high number of lines and needs NCCI review.');
  }

  if ((encounter?.procedureCodes ?? []).length > 5) {
    lcdNcdEditFlag = true;
    validationErrors.push('Procedure mix requires LCD/NCD review.');
  }

  if (!charge.patientId) {
    payerSpecificRuleFailures.push('Missing patient linkage for payer rule validation.');
    validationErrors.push('Payer-specific validation could not be completed.');
  }

  if (!charge.chargeLines.every((line: any) => line.renderingProviderId || charge.providerId)) {
    payerSpecificRuleFailures.push('One or more charge lines are missing rendering provider assignment.');
    validationErrors.push('Rendering provider assignment is incomplete.');
  }

  const scrubStatus = validationErrors.length ? 'Failed' : 'Passed';
  const codingRiskLevel = missingDocumentationFlag || icdCptMismatchFlag
    ? 'High'
    : validationErrors.length
      ? 'Medium'
      : 'Low';

  if (!validationErrors.length) {
    aiSuggestedCodes.push(...((encounter?.diagnosisCodes ?? []).slice(0, 3)));
    aiSuggestedFixes.push('Charge is ready for claim creation.');
  }

  return {
    chargeId: charge._id,
    encounterId: charge.encounterId,
    patientId: charge.patientId,
    scrubStatus,
    codingRiskLevel,
    missingDocumentationFlag,
    modifierIssues,
    icdCptMismatchFlag,
    ncciEditFlag,
    lcdNcdEditFlag,
    payerSpecificRuleFailures,
    validationErrors,
    aiSuggestedCodes,
    aiSuggestedFixes,
    codingValidationResults: [],
    codingFailureExplanations: [],
  };
}

function buildAiDenialPayload(charge: any, encounter: any, facility?: any, policy?: any) {
  const diagnosisCodes = Array.from(
    new Set(
      [
        ...(encounter?.diagnosisCodes ?? []),
        ...(charge.chargeLines ?? []).flatMap((line: any) => line.icdCodes ?? []),
      ]
        .map((code) => normalizeText(code))
        .filter((code): code is string => Boolean(code))
    )
  );

  return {
    chargeId: String(charge._id),
    patientId: charge.patientId ? String(charge.patientId) : undefined,
    payerId: policy?.payerId ? String(policy.payerId) : undefined,
    memberId: normalizeText(policy?.memberId),
    subscriberId: normalizeText(policy?.subscriberId),
    billingProviderNpi: normalizeText(facility?.npi),
    facilityTaxId: normalizeText(facility?.taxId),
    diagnosisCodes,
    totalChargeAmount: charge.totalChargeAmount ?? 0,
    claimLines: (charge.chargeLines ?? []).map((line: any) => ({
      cptCode: normalizeText(line.cptCode),
      icdCodes: (line.icdCodes ?? [])
        .map((code: string) => normalizeText(code))
        .filter((code: string | undefined): code is string => Boolean(code)),
      modifiers: line.modifiers ?? [],
      units: line.units,
      chargeAmount: line.chargeAmount,
      placeOfService: normalizeText(charge.placeOfService ?? facility?.placeOfServiceCode),
    })),
  };
}

function mergeUniqueStrings(...groups: Array<string[] | undefined>) {
  return Array.from(
    new Set(
      groups.flatMap((group) => group ?? []).map((value) => normalizeText(value)).filter(
        (value): value is string => Boolean(value)
      )
    )
  );
}

function buildApprovedCodingSnapshot(charge: any) {
  const placeOfService = normalizeText(charge.placeOfService);
  const lines = (charge.chargeLines ?? []).map((line: any, index: number) => ({
    lineNumber: line.lineNumber ?? index + 1,
    chargeLineId: line._id,
    cptCode: normalizeText(line.cptCode)?.toUpperCase(),
    modifiers: (line.modifiers ?? [])
      .map((modifier: unknown) => normalizeText(modifier)?.toUpperCase())
      .filter((modifier: string | undefined): modifier is string => Boolean(modifier)),
    icdCodes: (line.icdCodes ?? [])
      .map((code: unknown) => normalizeText(code)?.toUpperCase())
      .filter((code: string | undefined): code is string => Boolean(code)),
    icdPointers: (line.icdPointers ?? [])
      .filter((pointer: unknown): pointer is number => typeof pointer === 'number' && Number.isFinite(pointer)),
    units: typeof line.units === 'number' ? line.units : undefined,
    chargeAmount: typeof line.chargeAmount === 'number' ? line.chargeAmount : undefined,
    placeOfService,
    renderingProviderId: line.renderingProviderId,
    serviceDateFrom: normalizeDate(charge.serviceDate),
    serviceDateTo: normalizeDate(charge.serviceDate),
  }));
  const snapshotPayload = lines.map((line: any) => ({
    lineNumber: line.lineNumber,
    chargeLineId: line.chargeLineId?.toString?.() ?? line.chargeLineId,
    cptCode: line.cptCode,
    modifiers: line.modifiers,
    icdCodes: line.icdCodes,
    icdPointers: line.icdPointers,
    units: line.units,
    chargeAmount: line.chargeAmount,
    placeOfService: line.placeOfService,
    renderingProviderId: line.renderingProviderId?.toString?.() ?? line.renderingProviderId,
    serviceDateFrom: line.serviceDateFrom?.toISOString?.(),
  }));

  return {
    sourceChargeUpdatedAt: normalizeDate(charge.updated),
    snapshotHash: Buffer.from(JSON.stringify(snapshotPayload)).toString('base64'),
    approvedAt: new Date(),
    lines,
  };
}

function normalizeCodingFailureExplanations(values: unknown) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((value) => {
      if (!value || typeof value !== 'object') {
        return null;
      }

      const item = value as Record<string, unknown>;
      const title = normalizeText(item.title);
      const explanation = normalizeText(item.explanation);
      const correction = normalizeText(item.correction);

      if (!title || !explanation || !correction) {
        return null;
      }

      const rawLineNumber = item.lineNumber;
      const lineNumber =
        typeof rawLineNumber === 'number' && Number.isFinite(rawLineNumber) && rawLineNumber > 0
          ? rawLineNumber
          : undefined;

      return {
        ...(lineNumber ? { lineNumber } : {}),
        field: normalizeText(item.field) ?? 'Coding review',
        title,
        explanation,
        correction,
        source: normalizeText(item.source) ?? title,
      };
    })
    .filter((value): value is {
      lineNumber?: number;
      field: string;
      title: string;
      explanation: string;
      correction: string;
      source: string;
    } => Boolean(value));
}

function findChargeLineNumberForProcedureCode(charge: any, code: string) {
  const normalizedCode = normalizeText(code)?.toUpperCase();

  if (!normalizedCode) {
    return undefined;
  }

  const lineIndex = (charge.chargeLines ?? []).findIndex((line: any) => (
    normalizeText(line.cptCode)?.toUpperCase() === normalizedCode
  ));

  return lineIndex >= 0
    ? charge.chargeLines[lineIndex]?.lineNumber ?? lineIndex + 1
    : undefined;
}

function buildAiValidationError(result: any, charge: any) {
  const code = normalizeText(result.code)?.toUpperCase();

  if (!code) {
    return undefined;
  }

  const codeType = normalizeText(result.codeType)?.toLowerCase();
  const typeLabel = codeType === 'diagnosis' ? 'Diagnosis' : 'Procedure';
  const lineNumber = codeType === 'procedure' ? findChargeLineNumberForProcedureCode(charge, code) : undefined;
  const lineContext = lineNumber ? ` on charge line ${lineNumber}` : '';
  const reasoning = normalizeText(result.reasoning);
  const alternative = normalizeText(result.suggestedAlternative);

  return [
    `AI Verification: ${typeLabel} code ${code}${lineContext} is not supported by documentation.`,
    reasoning ? `Reasoning: ${reasoning}` : undefined,
    alternative ? `Suggested alternative: ${alternative}.` : undefined,
  ].filter(Boolean).join(' ');
}

function buildMissingAiSuggestedCodeErrors(
  encounterSuggestionsResult: any,
  charge: any,
  encounter: any
) {
  const validationErrors: string[] = [];
  const chargeProcedureCodes = normalizeUpperStringSet(
    (charge.chargeLines ?? []).map((line: any) => line.cptCode)
  );
  const chargeDiagnosisCodes = normalizeUpperStringSet(
    (charge.chargeLines ?? []).flatMap((line: any) => line.icdCodes ?? [])
  );
  const encounterDiagnosisCodes = normalizeUpperStringSet(encounter?.diagnosisCodes ?? []);

  (encounterSuggestionsResult.procedureCodes ?? []).forEach((suggestion: any) => {
    const code = normalizeText(suggestion.code)?.toUpperCase();

    if (!code || chargeProcedureCodes.has(code)) {
      return;
    }

    validationErrors.push(
      [
        `Revenue Integrity: AI found supported procedure code ${code} that is missing from charge lines.`,
        suggestion.description ? `Description: ${suggestion.description}.` : undefined,
        suggestion.reasoning ? `Evidence: ${suggestion.reasoning}` : undefined,
      ].filter(Boolean).join(' ')
    );
  });

  (encounterSuggestionsResult.diagnosisCodes ?? []).forEach((suggestion: any) => {
    const code = normalizeText(suggestion.code)?.toUpperCase();

    if (!code || chargeDiagnosisCodes.has(code) || encounterDiagnosisCodes.has(code)) {
      return;
    }

    validationErrors.push(
      [
        `Coding Completeness: AI found supported diagnosis code ${code} that is missing from the encounter and charge lines.`,
        suggestion.description ? `Description: ${suggestion.description}.` : undefined,
        suggestion.reasoning ? `Evidence: ${suggestion.reasoning}` : undefined,
      ].filter(Boolean).join(' ')
    );
  });

  return validationErrors;
}

function getRiskLevelFromDenialProbability(probability?: number) {
  if (typeof probability !== 'number' || Number.isNaN(probability)) {
    return undefined;
  }

  if (probability >= 0.7) {
    return 'High';
  }

  if (probability >= 0.35) {
    return 'Medium';
  }

  return undefined;
}

async function enrichCodingReviewWithAi(
  reviewId: string,
  charge: any,
  encounter: any,
  facility: any,
  insurancePolicy: any,
  updatedBy: string,
  expectedReviewUpdatedAt?: Date
) {
  const payerId = normalizeText(insurancePolicy?.payerId);
  const uniqueAuthRequests: Array<{
    cptCode: string;
    diagnosisCodes: string[];
    lineNumber: number;
  }> = Array.from(
    new Map(
      (charge.chargeLines ?? [])
        .filter((line: any) => Boolean(normalizeText(line.cptCode)) && payerId)
        .map((line: any, index: number) => {
          const normalizedCode = normalizeText(line.cptCode) as string;
          const diagnosisCodes = (
            line.icdCodes?.length
              ? line.icdCodes
              : encounter?.diagnosisCodes ?? []
          )
            .map((code: string) => normalizeText(code))
            .filter((code: string | undefined): code is string => Boolean(code));
          const key = `${normalizedCode}|${diagnosisCodes.join(',')}`;

          return [
            key,
            {
              cptCode: normalizedCode,
              diagnosisCodes,
              lineNumber: line.lineNumber ?? index + 1,
            },
          ] as const;
        })
    ).values()
  ) as Array<{
    cptCode: string;
    diagnosisCodes: string[];
    lineNumber: number;
  }>;

  const resolvedPlaceOfService =
    normalizeText(charge.placeOfService) ?? normalizeText(facility?.placeOfServiceCode);

  const applicableProcedures = await chargeMasterService.listApplicableProcedureCandidates({
    serviceDate: charge.serviceDate ?? encounter?.encounterDate,
    placeOfService: resolvedPlaceOfService,
  });

  const procedureReferenceContext = applicableProcedures.map((item: any) => ({
    code: item.cptCode,
    description: item.description,
    placeOfService: item.placeOfService,
    defaultChargeAmount: item.defaultChargeAmount,
    modifiersAllowed: item.modifiersAllowed,
    diagnosisRestrictions: item.diagnosisRestrictions,
  }));

  const review = await CodingReview.findOne({ _id: reviewId, isDeleted: false });

  if (!review) {
    return;
  }

  if (
    expectedReviewUpdatedAt
    && dateTime(review.updated) !== expectedReviewUpdatedAt.getTime()
  ) {
    return;
  }

  const [
    encounterSuggestionsResult,
    denialPredictionResult,
    authPredictionResults,
  ] = await Promise.all([
    encounter?.clinicalNotes
      ? rcmAiService.suggestEncounterCodes({
          encounterNote: encounter.clinicalNotes,
          chiefComplaint: encounter.chiefComplaint,
          historyOfPresentIllness: encounter.historyOfPresentIllness,
          clinicalNotes: encounter.clinicalNotes,
          existingDiagnosisCodes: encounter.diagnosisCodes ?? [],
          existingProcedureCodes: charge.chargeLines.map((line: any) => line.cptCode).filter(Boolean),
          procedureReferenceContext,
        })
      : Promise.resolve({
          diagnosisCodes: [],
          procedureCodes: [],
          validationResults: [],
          suggestedFixes: [],
          status: 'skipped',
        }),
    payerId
      ? rcmAiService.predictDenial(
          buildAiDenialPayload(charge, encounter, facility, insurancePolicy),
          payerId
        )
      : Promise.resolve({
          status: 'skipped',
          denialProbability: 0,
          potentialRejectionReasons: [],
          recommendedActions: [],
        }),
    uniqueAuthRequests.length
      ? Promise.all(
          uniqueAuthRequests.map(async (request) => ({
            request,
            prediction: await rcmAiService.predictAuth(request.cptCode, payerId as string, request.diagnosisCodes),
          }))
        )
      : Promise.resolve([]),
  ]);

  const aiSuggestedCodes = [
    ...encounterSuggestionsResult.diagnosisCodes.map(
      (suggestion: any) => `Diagnosis ${suggestion.code}: ${suggestion.description || suggestion.reasoning || 'AI suggestion'}`
    ),
    ...encounterSuggestionsResult.procedureCodes.map(
      (suggestion: any) => `Procedure ${suggestion.code}: ${suggestion.description || suggestion.reasoning || 'AI suggestion'}`
    ),
  ];

  const aiSuggestedFixes = [
    ...encounterSuggestionsResult.suggestedFixes,
    ...denialPredictionResult.recommendedActions,
  ];

  const denialRiskLevel = getRiskLevelFromDenialProbability(denialPredictionResult.denialProbability);

  if (denialRiskLevel === 'High' && denialPredictionResult.potentialRejectionReasons.length) {
    aiSuggestedFixes.push(
      `High denial risk detected: ${denialPredictionResult.potentialRejectionReasons.join(', ')}.`
    );
  }

  authPredictionResults.forEach(({ request, prediction }) => {
    if (prediction.requiresAuth) {
      aiSuggestedFixes.push(
        `Line ${request.lineNumber}: ${request.cptCode} may require prior authorization. Source: ${prediction.ruleSource}.`
      );
    }
  });

  // AI-Driven Code Verification
  const aiValidationErrors: string[] = [];
  aiValidationErrors.push(
    ...buildMissingAiSuggestedCodeErrors(encounterSuggestionsResult, charge, encounter)
  );

  (encounterSuggestionsResult.validationResults ?? []).forEach((result) => {
    if (result.status === 'Invalid') {
      const typeLabel = result.codeType === 'diagnosis' ? 'Diagnosis' : 'Procedure';
      aiSuggestedFixes.push(
        `AI Verification: ${typeLabel} code ${result.code} is NOT supported by documentation. Reasoning: ${result.reasoning}`
      );
      const validationError = buildAiValidationError(result, charge);
      if (validationError) {
        aiValidationErrors.push(validationError);
      }
      // High risk for invalid codes
      denialPredictionResult.denialProbability = Math.max(denialPredictionResult.denialProbability, 0.75);
    } else if (result.status === 'Optimization Suggested') {
      const alternative = result.suggestedAlternative ? ` (Suggest: ${result.suggestedAlternative})` : '';
      aiSuggestedFixes.push(
        `AI Optimization: Code ${result.code} could be improved${alternative}. Reasoning: ${result.reasoning}`
      );
      // Medium risk for sub-optimal codes
      denialPredictionResult.denialProbability = Math.max(denialPredictionResult.denialProbability, 0.4);
    }
  });

  const combinedValidationErrors = mergeUniqueStrings(review.validationErrors, aiValidationErrors);
  const failureExplanationResult =
    combinedValidationErrors.length || review.modifierIssues?.length || review.payerSpecificRuleFailures?.length
      ? await rcmAiService.explainCodingReviewFailure({
          review: {
            scrubStatus: combinedValidationErrors.length ? 'Failed' : review.scrubStatus,
            codingRiskLevel: review.codingRiskLevel,
            missingDocumentationFlag: review.missingDocumentationFlag,
            icdCptMismatchFlag: review.icdCptMismatchFlag,
            ncciEditFlag: review.ncciEditFlag,
            lcdNcdEditFlag: review.lcdNcdEditFlag,
          },
          charge: {
            serviceDate: charge.serviceDate,
            placeOfService: charge.placeOfService,
            totalChargeAmount: charge.totalChargeAmount,
            documentationComplete: charge.documentationComplete,
            chargeLines: charge.chargeLines,
          },
          encounter: {
            encounterDate: encounter?.encounterDate,
            chiefComplaint: encounter?.chiefComplaint,
            clinicalNotes: encounter?.clinicalNotes,
            diagnosisCodes: encounter?.diagnosisCodes ?? [],
            procedureCodes: encounter?.procedureCodes ?? [],
          },
          validationErrors: combinedValidationErrors,
          modifierIssues: review.modifierIssues ?? [],
          payerSpecificRuleFailures: review.payerSpecificRuleFailures ?? [],
        })
      : {
          status: 'skipped',
          issues: [],
          suggestedFixes: [],
        };

  const latestReview = await CodingReview.findOne({ _id: reviewId, isDeleted: false });

  if (!latestReview) {
    return;
  }

  if (
    expectedReviewUpdatedAt
    && dateTime(latestReview.updated) !== expectedReviewUpdatedAt.getTime()
  ) {
    return;
  }

  latestReview.aiSuggestedCodes = mergeUniqueStrings(latestReview.aiSuggestedCodes, aiSuggestedCodes);
  latestReview.aiSuggestedFixes = mergeUniqueStrings(
    latestReview.aiSuggestedFixes,
    aiSuggestedFixes,
    failureExplanationResult.suggestedFixes
  );
  latestReview.codingValidationResults = encounterSuggestionsResult.validationResults;
  latestReview.codingFailureExplanations = normalizeCodingFailureExplanations(failureExplanationResult.issues);
  latestReview.validationErrors = combinedValidationErrors;

  if (aiValidationErrors.length) {
    latestReview.scrubStatus = 'Failed';
    latestReview.codingRiskLevel = 'High';
  }

  if (denialRiskLevel === 'High' || (denialRiskLevel === 'Medium' && latestReview.codingRiskLevel === 'Low')) {
    latestReview.codingRiskLevel = denialRiskLevel;
  }

  latestReview.updatedBy = updatedBy;
  latestReview.updated = new Date();
  await latestReview.save();

  if (aiValidationErrors.length) {
    await Charge.findByIdAndUpdate(charge._id, {
      codingReviewStatus: latestReview.scrubStatus,
      validationErrors: latestReview.validationErrors,
      updatedByUserId: updatedBy,
      updated: new Date(),
    });
  }
}

export const codingReviewService = {
  async create(data: any, locale: string, createdBy: string): Promise<any> {
    void data;
    void locale;
    void createdBy;
    throw buildValidationError(
      'Coding reviews are system-generated. Use Submit for Coding Review or the from-charge workflow instead of creating them manually.'
    );
  },

  async createFromCharge(chargeId: string, locale: string, createdBy: string, options: { session?: ClientSession; skipAiEnrichment?: boolean } = {}) {
    const session = options.session;
    const charge = await Charge.findOne({ _id: chargeId, isDeleted: false }).session(session ?? null);

    if (!charge) {
      throw new AppError(t('charge.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    const encounter = charge.encounterId
      ? await Encounter.findOne({ _id: charge.encounterId, isDeleted: false }).session(session ?? null)
      : null;

    const facility = charge.facilityId
      ? await Facility.findOne({ _id: charge.facilityId, isDeleted: false }).session(session ?? null)
      : null;

    const insurancePolicy = await InsurancePolicy.findOne({
      patientId: charge.patientId,
      coverageType: { $not: /^self pay$/i },
      active: true,
      isDeleted: false,
    }).sort({ coordinationOfBenefitsOrder: 1, updated: -1 }).session(session ?? null);

    const reviewSnapshot = await buildCodingReviewFromCharge(
      charge,
      encounter,
      facility,
      insurancePolicy,
      locale
    );

    const existingReview = await CodingReview.findOne({ chargeId: charge._id, isDeleted: false }).session(session ?? null);

    if (existingReview) {
      const reviewUpdatedAt = new Date();

      Object.assign(existingReview, {
        ...reviewSnapshot,
        statusHistory:
          existingReview.scrubStatus !== reviewSnapshot.scrubStatus
            ? appendStatusHistory(
              existingReview.statusHistory,
              reviewSnapshot.scrubStatus,
              createdBy,
              'Coding review recalculated'
            )
            : existingReview.statusHistory,
        updatedBy: createdBy,
        updated: reviewUpdatedAt,
      });

      await existingReview.save({ session });

      await Charge.findByIdAndUpdate(chargeId, {
        codingReviewStatus:
          reviewSnapshot.scrubStatus === 'Approved' ? 'Approved for Claim' : reviewSnapshot.scrubStatus,
        validationErrors: reviewSnapshot.validationErrors,
        updatedByUserId: createdBy,
        updated: new Date(),
      }, { session });

      if (!options.skipAiEnrichment) {
        void enrichCodingReviewWithAi(
        String(existingReview._id),
        charge,
        encounter,
        facility,
        insurancePolicy,
        createdBy,
        reviewUpdatedAt
      ).catch((error) => {
        console.error('AI coding review enrichment failed:', error);
      });
      }

      return existingReview;
    }

    const reviewUpdatedAt = new Date();
    const [item] = await CodingReview.create([{
      ...reviewSnapshot,
      statusHistory: appendStatusHistory(
        undefined,
        reviewSnapshot.scrubStatus,
        createdBy,
        'Auto-created from charge submission'
      ),
      active: true,
      created: reviewUpdatedAt,
      updated: reviewUpdatedAt,
      createdBy,
    }], { session });

    await Charge.findByIdAndUpdate(chargeId, {
      codingReviewStatus:
        reviewSnapshot.scrubStatus === 'Approved' ? 'Approved for Claim' : reviewSnapshot.scrubStatus,
      validationErrors: reviewSnapshot.validationErrors,
      updatedByUserId: createdBy,
      updated: new Date(),
    }, { session });

    if (!options.skipAiEnrichment) {
      void enrichCodingReviewWithAi(
      String(item._id),
      charge,
      encounter,
      facility,
      insurancePolicy,
      createdBy,
      reviewUpdatedAt
    ).catch((error) => {
      console.error('AI coding review enrichment failed:', error);
    });
    }

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await CodingReview.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('codingReview.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    void data;
    void updatedBy;
    await this.getById(id, locale);
    throw buildValidationError(
      'Coding reviews are system-generated. Re-run charge submission or claim approval workflow instead of editing them manually.'
    );
  },

  async approve(id: string, locale: string, updatedBy: string) {
    const result = await withMongoTransaction(async (session) => {
      const item = await CodingReview.findOne({ _id: id, isDeleted: false }).session(session);

      if (!item) {
        throw new AppError(t('codingReview.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      }

      if (item.scrubStatus !== 'Passed') {
        throw buildValidationError('Claim cannot be created unless coding review scrub status is Passed.');
      }

      if (!item.chargeId) {
        throw buildValidationError('Coding review is missing the related charge.');
      }

      const charge = await Charge.findOne({ _id: item.chargeId, isDeleted: false }).session(session);

      if (!charge) {
        throw new AppError(t('charge.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
      }

      const approvedCodingSnapshot = buildApprovedCodingSnapshot(charge);

      if (!approvedCodingSnapshot.lines.length) {
        throw buildValidationError('Coding review cannot be approved without approved coding lines.');
      }

      const incompleteLine = approvedCodingSnapshot.lines.find((line: any) => (
        !line.cptCode
        || !line.icdPointers?.length
        || !line.icdCodes?.length
        || !line.placeOfService
        || typeof line.units !== 'number'
        || typeof line.chargeAmount !== 'number'
        || !line.renderingProviderId
      ));

      if (incompleteLine) {
        throw buildValidationError(
          `Charge line ${incompleteLine.lineNumber ?? ''} is missing final CPT/CDT, ICD pointers, POS, units, billed amount, or rendering provider.`
        );
      }

      item.scrubStatus = 'Approved';
      item.reviewedBy = String(updatedBy);
      item.reviewedAt = new Date();
      item.approvedCodingSnapshot = approvedCodingSnapshot as any;
      item.statusHistory = appendStatusHistory(
        item.statusHistory,
        item.scrubStatus,
        updatedBy,
        'Approved for claim creation'
      );
      item.updatedBy = updatedBy;
      item.updated = new Date();

      await item.save({ session });

      await Charge.findByIdAndUpdate(item.chargeId, {
        codingReviewStatus: 'Approved for Claim',
        chargeStatus: 'Approved',
        updatedByUserId: updatedBy,
        updated: new Date(),
      }, { session });

      // Expert Logic: If no insurance, route to Patient Billing
      const insurancePolicy = await InsurancePolicy.findOne({
        patientId: item.patientId,
        coverageType: { $not: /^self pay$/i },
        active: true,
        isDeleted: false,
      }).sort({ coordinationOfBenefitsOrder: 1, updated: -1 }).session(session);

      if (!insurancePolicy) {
        const billing = await patientBillingService.createFromCharge(String(item.chargeId), locale, updatedBy);
        return {
          codingReview: item,
          billing,
        };
      }

      const claim = await claimService.createFromCharge(String(item.chargeId), locale, updatedBy, {
        session,
        skipSideEffects: true,
      });

      return {
        codingReview: item,
        claim,
      };
    });

    return result;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    void updatedBy;
    await this.getById(id, locale);
    throw buildValidationError(
      'Coding reviews are append-only workflow records and cannot be deleted. Re-run coding review from the linked charge instead.'
    );
  },
};
