import { envConfig } from '../../../config/env.config';
import { ClaimSubmissionEdiContext, ClaimSubmissionEdiOptions } from './claim-submission.edi';

export type ClaimSubmissionValidationSeverity = 'BLOCKING' | 'WARNING';

export type ClaimSubmissionValidationFinding = {
  code: string;
  fieldPath: string;
  severity: ClaimSubmissionValidationSeverity;
  message: string;
  loop?: string;
  segment?: string;
  remediation?: string;
  payerId?: string;
  source: 'GENERIC' | 'PAYER_COMPANION_GUIDE';
};

export type ClaimSubmissionValidationResult = {
  valid: boolean;
  findings: ClaimSubmissionValidationFinding[];
};

export type ProfessionalClaimValidationRule = (
  context: ClaimSubmissionEdiContext,
  options: ClaimSubmissionEdiOptions
) => ClaimSubmissionValidationFinding[];

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeDigits(value: unknown) {
  return normalizeText(value).replace(/\D+/g, '');
}

function normalizeDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
  }

  return undefined;
}

function pushFinding(
  findings: ClaimSubmissionValidationFinding[],
  finding: ClaimSubmissionValidationFinding
) {
  findings.push(finding);
}

function requireText(
  findings: ClaimSubmissionValidationFinding[],
  value: unknown,
  fieldPath: string,
  code: string,
  message: string,
  metadata?: Partial<ClaimSubmissionValidationFinding>
) {
  if (!normalizeText(value)) {
    pushFinding(findings, {
      code,
      fieldPath,
      severity: 'BLOCKING',
      message,
      remediation: 'Complete the missing claim readiness field and rerun readiness before submission.',
      source: 'GENERIC',
      ...metadata,
    });
  }
}

function requireDate(
  findings: ClaimSubmissionValidationFinding[],
  value: unknown,
  fieldPath: string,
  code: string,
  message: string,
  metadata?: Partial<ClaimSubmissionValidationFinding>
) {
  if (!normalizeDate(value)) {
    pushFinding(findings, {
      code,
      fieldPath,
      severity: 'BLOCKING',
      message,
      remediation: 'Enter a valid date and rerun readiness before submission.',
      source: 'GENERIC',
      ...metadata,
    });
  }
}

function requirePositiveNumber(
  findings: ClaimSubmissionValidationFinding[],
  value: unknown,
  fieldPath: string,
  code: string,
  message: string,
  metadata?: Partial<ClaimSubmissionValidationFinding>
) {
  if (!(typeof value === 'number' && Number.isFinite(value) && value > 0)) {
    pushFinding(findings, {
      code,
      fieldPath,
      severity: 'BLOCKING',
      message,
      remediation: 'Correct pricing/charge data and rerun readiness before submission.',
      source: 'GENERIC',
      ...metadata,
    });
  }
}

export function defaultProfessionalClaimValidationRules(
  context: ClaimSubmissionEdiContext,
  options: ClaimSubmissionEdiOptions
): ClaimSubmissionValidationFinding[] {
  const findings: ClaimSubmissionValidationFinding[] = [];
  const payerId = normalizeText(context.insurancePolicy.ediPayerId) || normalizeText(context.payer.ediPayerId);
  const billingTaxId = normalizeDigits(context.billingProvider.taxId) || normalizeDigits(context.facility.taxId);
  const billingNpi = normalizeDigits(context.billingProvider.npi || context.facility.npi);

  requireText(findings, context.patient.firstName, 'patient.firstName', '837P_PATIENT_FIRST_NAME_REQUIRED', 'Patient first name is required.', { loop: '2010CA', segment: 'NM1*QC' });
  requireText(findings, context.patient.lastName, 'patient.lastName', '837P_PATIENT_LAST_NAME_REQUIRED', 'Patient last name is required.', { loop: '2010CA', segment: 'NM1*QC' });
  requireDate(findings, context.patient.dateOfBirth, 'patient.dateOfBirth', '837P_PATIENT_DOB_REQUIRED', 'Patient date of birth is required.', { loop: '2010CA', segment: 'DMG' });
  requireText(findings, context.patient.sex || context.patient.gender, 'patient.gender', '837P_PATIENT_GENDER_REQUIRED', 'Patient gender/sex is required.', { loop: '2010CA', segment: 'DMG' });
  requireText(findings, context.insurancePolicy.memberId, 'insurancePolicy.memberId', '837P_MEMBER_ID_REQUIRED', 'Subscriber/member ID is required.', { loop: '2010BA', segment: 'NM1*IL' });
  requireText(findings, context.payer.payerName, 'payer.payerName', '837P_PAYER_NAME_REQUIRED', 'Payer name is required.', { loop: '2010BB', segment: 'NM1*PR' });
  requireText(findings, payerId, 'payer.ediPayerId', '837P_PAYER_EDI_ID_REQUIRED', 'Payer EDI ID is required for Loop 2010BB NM109.', { loop: '2010BB', segment: 'NM1*PR' });
  requireText(findings, billingNpi, 'billingProvider.npi', '837P_BILLING_PROVIDER_NPI_REQUIRED', 'Billing provider NPI is required.', { loop: '2010AA', segment: 'NM1*85' });
  requireText(findings, billingTaxId, 'billingProvider.taxId', '837P_BILLING_PROVIDER_TAX_ID_REQUIRED', 'Billing provider tax ID is required.', { loop: '2010AA', segment: 'REF*EI' });
  requireText(findings, context.renderingProvider.npi, 'renderingProvider.npi', '837P_RENDERING_PROVIDER_NPI_REQUIRED', 'Rendering provider NPI is required.', { loop: '2310B', segment: 'NM1*82' });
  requireText(findings, context.facility.npi, 'facility.npi', '837P_FACILITY_NPI_REQUIRED', 'Facility/service location NPI is required.', { loop: '2010AA', segment: 'NM1*85' });
  requireText(findings, context.facility.placeOfServiceCode, 'facility.placeOfServiceCode', '837P_POS_REQUIRED', 'Place of service is required.', { segment: 'CLM05-1/SV105' });
  requireText(findings, context.facility.addressLine1, 'facility.addressLine1', '837P_FACILITY_ADDRESS_REQUIRED', 'Facility address is required.', { loop: '2010AA', segment: 'N3' });
  requireText(findings, context.facility.city, 'facility.city', '837P_FACILITY_CITY_REQUIRED', 'Facility city is required.', { loop: '2010AA', segment: 'N4' });
  requireText(findings, context.facility.state, 'facility.state', '837P_FACILITY_STATE_REQUIRED', 'Facility state is required.', { loop: '2010AA', segment: 'N4' });
  requireText(findings, context.facility.zipCode, 'facility.zipCode', '837P_FACILITY_ZIP_REQUIRED', 'Facility ZIP is required.', { loop: '2010AA', segment: 'N4' });
  requireText(findings, context.claim.frequencyCode, 'claim.frequencyCode', '837P_FREQUENCY_CODE_REQUIRED', 'Claim frequency code is required.', { segment: 'CLM05-3' });
  requireText(findings, options.claimControlNumber, 'options.claimControlNumber', '837P_CLM01_REQUIRED', 'CLM01 claim control number is required.', { segment: 'CLM01' });

  if (options.usageIndicator !== 'T' && options.usageIndicator !== 'P') {
    pushFinding(findings, {
      code: '837P_USAGE_INDICATOR_INVALID',
      fieldPath: 'options.usageIndicator',
      severity: 'BLOCKING',
      message: 'ISA15/usageIndicator must be T for test or P for production.',
      segment: 'ISA15',
      source: 'GENERIC',
      remediation: 'Set CLAIM_SUBMISSION_USAGE_INDICATOR to T in test or P in production.',
    });
  }

  if (envConfig.nodeEnv.trim().toLowerCase() === 'production' && options.usageIndicator === 'T') {
    pushFinding(findings, {
      code: '837P_TEST_INDICATOR_BLOCKED_IN_PRODUCTION',
      fieldPath: 'options.usageIndicator',
      severity: 'BLOCKING',
      message: 'ISA15/usageIndicator T is blocked in production.',
      segment: 'ISA15',
      source: 'GENERIC',
      remediation: 'Use production usageIndicator P and production payer/provider credentials.',
    });
  }

  const diagnosisCodes = (context.claim.diagnosisCodes ?? []).map((code) => normalizeText(code)).filter(Boolean);
  if (!diagnosisCodes.length) {
    pushFinding(findings, {
      code: '837P_DIAGNOSIS_CODES_REQUIRED',
      fieldPath: 'claim.diagnosisCodes',
      severity: 'BLOCKING',
      message: 'At least one diagnosis code is required.',
      segment: 'HI',
      source: 'GENERIC',
      remediation: 'Complete coding review with valid ICD diagnosis codes.',
    });
  }

  if (!context.claim.claimLines.length) {
    pushFinding(findings, {
      code: '837P_SERVICE_LINE_REQUIRED',
      fieldPath: 'claim.claimLines',
      severity: 'BLOCKING',
      message: 'At least one service line is required.',
      segment: 'LX/SV1',
      source: 'GENERIC',
      remediation: 'Create charge lines before claim submission.',
    });
  }

  context.claim.claimLines.forEach((line, index) => {
    const linePath = `claim.claimLines.${index}`;
    const lineNumber = line.lineNumber ?? index + 1;
    requireText(findings, line.placeOfService, `${linePath}.placeOfService`, '837P_LINE_POS_REQUIRED', `Service line ${lineNumber} place of service is required.`, { segment: 'SV105' });
    requireDate(findings, line.serviceDateFrom, `${linePath}.serviceDateFrom`, '837P_LINE_DOS_REQUIRED', `Service line ${lineNumber} date of service is required.`, { segment: 'DTP*472' });
    requireText(findings, line.cptCode, `${linePath}.cptCode`, '837P_LINE_CPT_REQUIRED', `Service line ${lineNumber} CPT/HCPCS code is required.`, { segment: 'SV101-2' });
    requirePositiveNumber(findings, line.units, `${linePath}.units`, '837P_LINE_UNITS_REQUIRED', `Service line ${lineNumber} units must be greater than zero.`, { segment: 'SV104' });
    requirePositiveNumber(findings, line.chargeAmount, `${linePath}.chargeAmount`, '837P_LINE_CHARGE_REQUIRED', `Service line ${lineNumber} charge must be greater than zero.`, { segment: 'SV102' });

    const pointers = (line.icdPointers ?? []).filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    if (!pointers.length) {
      pushFinding(findings, {
        code: '837P_LINE_ICD_POINTER_REQUIRED',
        fieldPath: `${linePath}.icdPointers`,
        severity: 'BLOCKING',
        message: `Service line ${lineNumber} diagnosis pointer is required.`,
        segment: 'SV107',
        source: 'GENERIC',
        remediation: 'Map the service line to at least one diagnosis pointer.',
      });
    }

    pointers.forEach((pointer) => {
      if (pointer < 1 || pointer > diagnosisCodes.length) {
        pushFinding(findings, {
          code: '837P_LINE_ICD_POINTER_INVALID',
          fieldPath: `${linePath}.icdPointers`,
          severity: 'BLOCKING',
          message: `Service line ${lineNumber} diagnosis pointer ${pointer} does not map to a diagnosis code.`,
          segment: 'SV107',
          source: 'GENERIC',
          remediation: 'Correct ICD pointer mapping in coding review.',
        });
      }
    });
  });

  return findings;
}

export function validate837ProfessionalClaim(
  context: ClaimSubmissionEdiContext,
  options: ClaimSubmissionEdiOptions,
  payerSpecificRules: ProfessionalClaimValidationRule[] = []
): ClaimSubmissionValidationResult {
  const findings = [
    ...defaultProfessionalClaimValidationRules(context, options),
    ...payerSpecificRules.flatMap((rule) => rule(context, options)),
  ];

  return {
    valid: findings.every((finding) => finding.severity !== 'BLOCKING'),
    findings,
  };
}
